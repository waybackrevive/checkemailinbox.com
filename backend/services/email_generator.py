"""
Generates unique test email addresses for each visitor.
Format: test-{random_hex}@{domain}
"""

import secrets
from datetime import datetime, timedelta, timezone

from backend.config import settings


def generate_test_id() -> str:
    """Generate a short random hex ID (8 chars). Collision-safe for our scale."""
    return secrets.token_hex(4)  # 8 hex chars, e.g. "7a2b4f8e"


def generate_test_email(test_id: str) -> str:
    """Build the full test email address."""
    return f"test-{test_id}@{settings.MAIL_DOMAIN}"


def create_test_session(test_id: str) -> dict:
    """
    Create the initial test session data to store in Redis.
    This gets saved with a 1-hour TTL.
    """
    now = datetime.now(timezone.utc)
    email = generate_test_email(test_id)

    return {
        "id": test_id,
        "email": email,
        "status": "waiting",  # waiting → received → processing → ready
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(seconds=settings.TEST_TTL_SECONDS)).isoformat(),
        "raw_email": None,     # Filled when Mailgun webhook fires
        "from_address": None,
        "subject": None,
    }
