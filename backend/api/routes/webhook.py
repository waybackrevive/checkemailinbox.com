"""
Webhook route — receives inbound emails from Resend.

POST /api/webhook/resend → Resend sends inbound email here

Resend Inbound Emails:
  - You set MX records on your domain pointing to Resend
  - Resend catches all mail to *@yourdomain.com
  - Resend POSTs a JSON payload to this webhook

When an email arrives:
1. Verify the webhook signature (svix)
2. Extract the test ID from the recipient address (test-{id}@domain)
3. Store the raw email in the test session
4. Run all analysis (header, content, blacklist, SpamAssassin)
5. Build the report
6. Save the report to Redis
7. Update test status to "ready"
"""

import re
import hmac
import hashlib
import logging
from typing import Optional

from fastapi import APIRouter, Request, HTTPException

from backend.config import settings
from backend.models.schemas import TestStatus, CheckStatus
from backend.storage.redis_client import (
    get_test_session,
    update_test_session,
    save_report,
)
from backend.services.header_parser import parse_headers
from backend.services.content_analyzer import analyze_content
from backend.services.blacklist_checker import check_reputation
from backend.services.spamassassin import check_spam
from backend.services.report_builder import build_report

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhook", tags=["webhook"])


def _extract_test_id(recipient: str) -> Optional[str]:
    """
    Extract test ID from recipient address.
    test-7a2b4f8e@ismyemailspam.com → 7a2b4f8e
    """
    match = re.match(r"test-([a-f0-9]+)@", recipient)
    return match.group(1) if match else None


def _verify_resend_signature(payload: bytes, signature: str, secret: str) -> bool:
    """
    Verify the Resend webhook signature.
    Resend uses svix under the hood. For simplicity, we do HMAC-SHA256 verification.
    If no secret is configured, skip verification (local dev).
    """
    if not secret:
        return True  # Skip in local dev
    try:
        expected = hmac.new(
            secret.encode("utf-8"),
            payload,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)
    except Exception:
        return False


def _build_raw_email_from_resend(data: dict) -> str:
    """
    Reconstruct a raw email (RFC 2822) from Resend's JSON payload.
    Resend sends structured JSON, but our analysis pipeline expects raw MIME.
    We build a minimal raw email with all the headers we need.
    """
    from_addr = data.get("from", "")
    to_addr = data.get("to", [""])[0] if isinstance(data.get("to"), list) else data.get("to", "")
    subject = data.get("subject", "")
    html = data.get("html", "")
    text = data.get("text", "")
    headers = data.get("headers", [])

    # Build raw email
    lines = []
    lines.append(f"From: {from_addr}")
    lines.append(f"To: {to_addr}")
    lines.append(f"Subject: {subject}")

    # Add any authentication headers Resend passes through
    if isinstance(headers, list):
        for header in headers:
            if isinstance(header, dict):
                name = header.get("name", "")
                value = header.get("value", "")
                if name and value:
                    lines.append(f"{name}: {value}")

    # Add MIME headers
    if html:
        lines.append("Content-Type: text/html; charset=UTF-8")
        lines.append("")
        lines.append(html)
    elif text:
        lines.append("Content-Type: text/plain; charset=UTF-8")
        lines.append("")
        lines.append(text)
    else:
        lines.append("")

    return "\r\n".join(lines)


@router.post("/resend")
async def receive_resend_webhook(request: Request):
    """
    Resend Inbound Email webhook.

    Resend sends a JSON POST with:
    {
      "type": "email.received",
      "data": {
        "from": "sender@example.com",
        "to": ["test-7a2b4f8e@ismyemailspam.com"],
        "subject": "Hello World",
        "html": "<p>...</p>",
        "text": "...",
        "headers": [{"name": "...", "value": "..."}],
        "created_at": "2024-01-01T00:00:00.000Z"
      }
    }
    """
    try:
        # Read the raw body for signature verification
        raw_body = await request.body()

        # Verify signature (optional — skipped if RESEND_WEBHOOK_SECRET not set)
        signature = request.headers.get("svix-signature", "")
        if settings.RESEND_WEBHOOK_SECRET and not _verify_resend_signature(
            raw_body, signature, settings.RESEND_WEBHOOK_SECRET
        ):
            logger.warning("Invalid Resend webhook signature")
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

        # Parse JSON payload
        payload = await request.json()

        # Resend wraps data in a "data" key
        event_type = payload.get("type", "")
        data = payload.get("data", payload)  # Fallback: treat root as data

        if event_type and event_type != "email.received":
            # Acknowledge non-email events (e.g., email.sent, email.bounced)
            logger.info(f"Ignoring Resend event type: {event_type}")
            return {"status": "ignored", "event": event_type}

        # Extract fields
        from_addr = data.get("from", "")
        to_list = data.get("to", [])
        subject = data.get("subject", "")
        html = data.get("html", "")
        text = data.get("text", "")

        # Get the first recipient
        recipient = to_list[0] if isinstance(to_list, list) and to_list else str(to_list)

        if not recipient:
            logger.warning("Webhook received with no recipient")
            raise HTTPException(status_code=400, detail="Missing recipient")

        # Extract test ID
        test_id = _extract_test_id(recipient)
        if not test_id:
            logger.warning(f"Could not extract test ID from recipient: {recipient}")
            raise HTTPException(status_code=400, detail="Invalid recipient address")

        # Check if test session exists
        session = get_test_session(test_id)
        if session is None:
            logger.warning(f"Test session not found for ID: {test_id}")
            raise HTTPException(status_code=404, detail="Test session not found or expired")

        # Build raw email from Resend's JSON (our analyzers need raw MIME)
        raw_email = _build_raw_email_from_resend(data)

        # Update status to processing
        session["status"] = TestStatus.PROCESSING.value
        session["raw_email"] = raw_email
        session["from_address"] = from_addr
        session["subject"] = subject
        update_test_session(test_id, session)

        # ===== RUN ALL ANALYSIS =====

        # 1. Parse headers (SPF/DKIM/DMARC)
        auth_result, parsed_from, from_domain, sending_ip, parsed_subject = parse_headers(raw_email)

        # 2. Content analysis (spam words, image ratio, links)
        content_result = analyze_content(raw_email)

        # 3. Reputation (blacklists + domain age)
        reputation_result = check_reputation(sending_ip, from_domain)

        # 4. SpamAssassin score
        sa_result = check_spam(raw_email)

        # Update content result with SpamAssassin data
        content_result.spamassassin_score = sa_result.score
        if sa_result.score <= 2:
            content_result.spamassassin_status = CheckStatus.PASS
        elif sa_result.score <= 5:
            content_result.spamassassin_status = CheckStatus.WARNING
        else:
            content_result.spamassassin_status = CheckStatus.FAIL

        # 5. Build the complete report
        report = build_report(
            test_id=test_id,
            raw_email=raw_email,
            auth=auth_result,
            reputation=reputation_result,
            content=content_result,
            spamassassin=sa_result,
            from_address=parsed_from or from_addr,
            from_domain=from_domain,
            subject=parsed_subject or subject,
        )

        # 6. Save report to Redis
        save_report(test_id, report.model_dump(mode="json"))

        # 7. Update test status to ready
        session["status"] = TestStatus.READY.value
        update_test_session(test_id, session)

        logger.info(f"Report generated for test {test_id}: score={report.final_score}")

        return {"status": "ok", "test_id": test_id, "score": report.final_score}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Webhook processing error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")

