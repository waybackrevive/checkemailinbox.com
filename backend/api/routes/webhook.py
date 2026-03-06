"""
Webhook route — Cloudflare Email Worker
========================================

Cloudflare Email Routing catches emails at *@checkemaildelivery.com,
triggers a Worker that reads the raw email stream and POSTs the
complete RFC-2822 message to this endpoint.

Security: The Worker sends a shared secret in the X-Worker-Secret
header.  We compare it with CLOUDFLARE_WORKER_SECRET from .env.
"""

import re
import logging
from email import message_from_string
from typing import Optional

from fastapi import APIRouter, Request, HTTPException

from config import settings
from models.schemas import TestStatus, CheckStatus
from storage.redis_client import (
    get_test_session,
    save_test_session,
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


# ── Helpers ────────────────────────────────────────────────────────────────────

def _extract_test_id(recipient: str) -> Optional[str]:
    """Extract test ID from: test-7a2b4f8e@checkemaildelivery.com → 7a2b4f8e"""
    match = re.match(r"test-([a-f0-9]+)@", recipient)
    return match.group(1) if match else None


def _verify_worker_secret(request: Request) -> bool:
    """
    Verify the shared secret sent by the Cloudflare Worker.

    The Worker includes X-Worker-Secret header in every POST.
    We compare it against CLOUDFLARE_WORKER_SECRET from .env.
    If the env var is empty, skip verification (dev mode).
    """
    expected = settings.CLOUDFLARE_WORKER_SECRET
    if not expected:
        logger.warning("CLOUDFLARE_WORKER_SECRET not set — skipping verification (dev mode)")
        return True

    provided = request.headers.get("x-worker-secret", "")
    if not provided:
        logger.warning("Missing X-Worker-Secret header")
        return False

    return provided == expected


def _extract_sender_ip(raw_email: str) -> Optional[str]:
    """
    Extract the originating sender IP from Received headers.

    The LAST 'Received' header (bottom of the chain) is the one written
    by the first MTA that received the message — it contains the real
    sender IP in square brackets like [1.2.3.4].
    """
    try:
        msg = message_from_string(raw_email)
        received_headers = msg.get_all("Received") or []
        if not received_headers:
            return None

        last_received = received_headers[-1]
        ip_match = re.search(r"\[(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\]", last_received)
        return ip_match.group(1) if ip_match else None
    except Exception as e:
        logger.warning(f"Could not extract sender IP from Received headers: {e}")
        return None


def _extract_email_field(raw_email: str, field_name: str) -> str:
    """Extract a header field (From, Subject) from raw email."""
    try:
        msg = message_from_string(raw_email)
        return msg.get(field_name, "") or ""
    except Exception:
        return ""


# ── Webhook endpoint ──────────────────────────────────────────────────────────

@router.post("/cloudflare")
async def receive_cloudflare_webhook(request: Request):
    """
    Cloudflare Email Worker webhook.

    The Worker POSTs the complete raw RFC-2822 email as the request body
    with Content-Type: message/rfc822.  Recipient and sender are passed
    in X-Recipient and X-Sender headers.

    Flow:
    1. Verify X-Worker-Secret matches our shared secret
    2. Read request body → complete raw email (no parsing needed)
    3. Extract test ID from X-Recipient header
    4. Pass raw email directly to analysis pipeline
    5. Build + save report
    6. Update test status to "ready"
    """
    try:
        # ── Verify shared secret ──────────────────────────────────────────
        if not _verify_worker_secret(request):
            logger.warning("Invalid or missing Worker secret")
            raise HTTPException(status_code=403, detail="Forbidden")

        # ── Read raw email from request body ──────────────────────────────
        raw_bytes = await request.body()
        raw_email = raw_bytes.decode("utf-8", errors="replace")

        if not raw_email or len(raw_email.strip()) < 10:
            logger.warning("Cloudflare webhook received with empty or tiny body")
            raise HTTPException(status_code=400, detail="Missing email body")

        # ── Get recipient and sender from headers ─────────────────────────
        recipient = request.headers.get("x-recipient", "")
        sender    = request.headers.get("x-sender", "")

        # Fallback: extract from the raw email itself
        if not recipient:
            recipient = _extract_email_field(raw_email, "To")
        if not sender:
            sender = _extract_email_field(raw_email, "From")

        if not recipient:
            raise HTTPException(status_code=400, detail="Missing recipient")

        # ── Extract test ID ───────────────────────────────────────────────
        test_id = _extract_test_id(recipient)
        if not test_id:
            logger.warning(f"No test ID in recipient: {recipient}")
            raise HTTPException(status_code=400, detail="Invalid recipient address")

        session = get_test_session(test_id)
        if session is None:
            # Session expired or was lost (e.g., during a redeploy).
            # Recreate it so the analysis can still complete — the email is valid.
            logger.warning(f"Session not found for {test_id} — recreating from webhook data")
            session = {
                "id": test_id,
                "email": recipient,
                "status": "waiting",
                "created_at": None,
                "expires_at": None,
                "raw_email": None,
                "from_address": None,
                "subject": None,
            }
            save_test_session(test_id, session)

        # ── Update session ────────────────────────────────────────────────
        subject = _extract_email_field(raw_email, "Subject")

        session["status"]       = TestStatus.PROCESSING.value
        session["raw_email"]    = raw_email
        session["from_address"] = sender
        session["subject"]      = subject
        update_test_session(test_id, session)

        # ── Run analysis pipeline ─────────────────────────────────────────

        # 1. Authentication (SPF/DKIM/DMARC from Authentication-Results header)
        auth_result, parsed_from, from_domain, sending_ip, parsed_subject = parse_headers(raw_email)

        # If header_parser didn't find an IP, try extracting from Received headers
        if not sending_ip:
            sending_ip = _extract_sender_ip(raw_email)

        # 2. Content analysis
        content_result = analyze_content(raw_email)

        # 3. Reputation (blacklists + domain age)
        reputation_result = check_reputation(sending_ip, from_domain)

        # 4. SpamAssassin
        sa_result = check_spam(raw_email)

        # Update content with SpamAssassin data
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
            from_address  = parsed_from or sender,
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
