"""
Webhook route — FIXED v2
=========================

Key fix: _build_raw_email_from_resend() now ensures Authentication-Results
headers are included at the TOP of the reconstructed email, before other
headers. This is required because header_parser.py reads them via
email.message_from_string() which needs headers before the blank line.

Also fixed: content_result.spamassassin_score handling for unavailable case.
"""

import re
import hmac
import hashlib
import logging
from typing import Optional

from fastapi import APIRouter, Request, HTTPException

from config import settings
from models.schemas import TestStatus, CheckStatus
from storage.redis_client import (
    get_test_session,
    update_test_session,
    save_report,
)
from services.header_parser import parse_headers
from services.content_analyzer import analyze_content
from services.blacklist_checker import check_reputation
from services.spamassassin import check_spam
from services.report_builder import build_report

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/webhook", tags=["webhook"])


def _extract_test_id(recipient: str) -> Optional[str]:
    """Extract test ID from: test-7a2b4f8e@checkemaildelivery.com → 7a2b4f8e"""
    match = re.match(r"test-([a-f0-9]+)@", recipient)
    return match.group(1) if match else None


def _verify_resend_signature(payload: bytes, request_headers: dict, secret: str) -> bool:
    """Verify Resend/Svix webhook signature."""
    import base64

    if not secret:
        return True  # Skip in local dev

    try:
        svix_id        = request_headers.get("svix-id", "")
        svix_timestamp = request_headers.get("svix-timestamp", "")
        svix_signature = request_headers.get("svix-signature", "")

        if not all([svix_id, svix_timestamp, svix_signature]):
            logger.warning("Missing svix headers")
            return False

        body_str = payload.decode("utf-8")
        message  = f"{svix_id}.{svix_timestamp}.{body_str}"

        secret_str = secret
        if secret_str.startswith("whsec_"):
            secret_str = secret_str[6:]
        secret_bytes = base64.b64decode(secret_str)

        expected_sig = base64.b64encode(
            hmac.new(secret_bytes, message.encode("utf-8"), hashlib.sha256).digest()
        ).decode("utf-8")

        for sig in svix_signature.split(" "):
            parts = sig.split(",", 1)
            if len(parts) == 2 and parts[0] == "v1":
                if hmac.compare_digest(expected_sig, parts[1]):
                    return True

        logger.warning("No matching svix signature found")
        return False
    except Exception as e:
        logger.error(f"Signature verification error: {e}")
        return False


def _build_raw_email_from_resend(data: dict) -> str:
    """
    Reconstruct a raw RFC-2822 email from Resend's JSON webhook payload.

    CRITICAL FIX: Authentication-Results header must be included.
    Resend's MX server writes Authentication-Results after verifying
    SPF/DKIM/DMARC on the incoming email. This is passed in data['headers'].

    We put authentication headers FIRST so email.message_from_string()
    finds them reliably.
    """
    from_addr  = data.get("from", "")
    to_addr    = data.get("to", [""])[0] if isinstance(data.get("to"), list) else data.get("to", "")
    subject    = data.get("subject", "")
    html       = data.get("html", "")
    text       = data.get("text", "")
    headers    = data.get("headers", [])

    lines = []

    # ── Core envelope headers ─────────────────────────────────────────────────
    lines.append(f"From: {from_addr}")
    lines.append(f"To: {to_addr}")
    lines.append(f"Subject: {subject}")

    # ── Authentication headers FIRST (critical for header_parser.py) ──────────
    # Separate auth headers from other headers for priority placement
    auth_header_names = {
        "authentication-results",
        "arc-authentication-results",
        "received-spf",
        "dkim-signature",
        "arc-seal",
        "arc-message-signature",
    }
    auth_headers = []
    other_headers = []

    if isinstance(headers, list):
        for header in headers:
            if isinstance(header, dict):
                name  = header.get("name", "").strip()
                value = header.get("value", "").strip()
                if name and value:
                    if name.lower() in auth_header_names:
                        auth_headers.append(f"{name}: {value}")
                    else:
                        other_headers.append(f"{name}: {value}")

    # Add auth headers first (so parser finds them before body)
    lines.extend(auth_headers)
    # Then other headers
    lines.extend(other_headers)

    # ── Body ──────────────────────────────────────────────────────────────────
    if html:
        lines.append("MIME-Version: 1.0")
        lines.append("Content-Type: text/html; charset=UTF-8")
        lines.append("")
        lines.append(html)
    elif text:
        lines.append("MIME-Version: 1.0")
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

    Flow:
    1. Verify Svix signature
    2. Extract test ID from recipient
    3. Build raw email from JSON (includes auth headers)
    4. Run analysis: SPF/DKIM/DMARC → content → blacklists → SpamAssassin
    5. Build + save report
    6. Update test status to "ready"
    """
    try:
        raw_body = await request.body()

        # Signature verification
        if settings.RESEND_WEBHOOK_SECRET and not _verify_resend_signature(
            raw_body, dict(request.headers), settings.RESEND_WEBHOOK_SECRET
        ):
            logger.warning("Invalid Resend webhook signature")
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

        payload    = await request.json()
        event_type = payload.get("type", "")
        data       = payload.get("data", payload)

        if event_type and event_type != "email.received":
            logger.info(f"Ignoring Resend event: {event_type}")
            return {"status": "ignored", "event": event_type}

        from_addr = data.get("from", "")
        to_list   = data.get("to", [])
        subject   = data.get("subject", "")

        recipient = to_list[0] if isinstance(to_list, list) and to_list else str(to_list)

        if not recipient:
            raise HTTPException(status_code=400, detail="Missing recipient")

        test_id = _extract_test_id(recipient)
        if not test_id:
            logger.warning(f"No test ID in recipient: {recipient}")
            raise HTTPException(status_code=400, detail="Invalid recipient address")

        session = get_test_session(test_id)
        if session is None:
            logger.warning(f"Session not found: {test_id}")
            raise HTTPException(status_code=404, detail="Test session not found or expired")

        # Build reconstructed raw email (with auth headers)
        raw_email = _build_raw_email_from_resend(data)

        # Update status: processing
        session["status"]       = TestStatus.PROCESSING.value
        session["raw_email"]    = raw_email
        session["from_address"] = from_addr
        session["subject"]      = subject
        update_test_session(test_id, session)

        # ── Run all analysis ──────────────────────────────────────────────────

        # 1. Authentication (SPF/DKIM/DMARC from Authentication-Results header)
        auth_result, parsed_from, from_domain, sending_ip, parsed_subject = parse_headers(raw_email)

        # 2. Content analysis
        content_result = analyze_content(raw_email)

        # 3. Reputation (blacklists + domain age)
        reputation_result = check_reputation(sending_ip, from_domain)

        # 4. SpamAssassin
        sa_result = check_spam(raw_email)

        # Update content with SpamAssassin data
        # FIXED: when sa unavailable, use 0.0 score but show correct status
        content_result.spamassassin_score  = sa_result.score if sa_result.available else 0.0
        content_result.spamassassin_status = sa_result.status

        # 5. Build report
        report = build_report(
            test_id       = test_id,
            raw_email     = raw_email,
            auth          = auth_result,
            reputation    = reputation_result,
            content       = content_result,
            spamassassin  = sa_result,
            from_address  = parsed_from or from_addr,
            from_domain   = from_domain,
            subject       = parsed_subject or subject,
        )

        # 6. Save report
        save_report(test_id, report.model_dump(mode="json"))

        # 7. Mark ready
        session["status"] = TestStatus.READY.value
        update_test_session(test_id, session)

        logger.info(f"Report ready: test={test_id} score={report.final_score} risk={report.risk_level}")
        return {"status": "ok", "test_id": test_id, "score": report.final_score}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")
