"""
SpamAssassin Integration — FIXED v2
=====================================

Changes from v1:
  - Returns available=False when spamd is unreachable (instead of score=0.0)
  - Score 0.0 with "not available" message was being used as real data
    (section_score=100 → inflated final score, OR confused user seeing 0/5)
  - Timeout reduced from 30s → 10s for better UX
  - Schema now has SpamAssassinResult.available flag
  - When available=False: section_score=50 (neutral, not 100 or 0)

The `available` flag tells the report UI:
  available=True  → Show real score and rules
  available=False → Show "Score unavailable" — hide section or show greyed out
"""

import re
import socket
import logging
from typing import List, Tuple

from config import settings
from models.schemas import CheckStatus, SpamAssassinResult

logger = logging.getLogger(__name__)

SPAMC_TIMEOUT = 10  # seconds — fast fail


def _spamc_check(raw_email: str) -> Tuple[float, List[str]]:
    """
    Send raw email to SpamAssassin daemon via spamc TCP protocol.
    Returns: (spam_score, list_of_rules_hit)
    Raises: ConnectionRefusedError, socket.timeout, OSError on failure
    """
    email_bytes = raw_email.encode("utf-8")
    content_length = len(email_bytes)

    request = (
        f"REPORT SPAMC/1.5\r\n"
        f"Content-length: {content_length}\r\n"
        f"\r\n"
    ).encode("utf-8") + email_bytes

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(SPAMC_TIMEOUT)
    sock.connect((settings.SPAMASSASSIN_HOST, settings.SPAMASSASSIN_PORT))
    sock.sendall(request)

    response = b""
    while True:
        chunk = sock.recv(4096)
        if not chunk:
            break
        response += chunk
    sock.close()

    response_text = response.decode("utf-8", errors="replace")
    score = _parse_score(response_text)
    rules = _parse_rules(response_text)

    return score, rules


def _parse_score(response: str) -> float:
    # "Spam: True ; 8.5 / 5.0" or score in REPORT block
    match = re.search(r"([-\d.]+)\s*/\s*([-\d.]+)", response)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            pass
    match = re.search(r"score=([-\d.]+)", response)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            pass
    return 0.0


def _parse_rules(response: str) -> List[str]:
    rules = []
    pattern = re.compile(r"^\s*([-\d.]+)\s+(\S+)\s+", re.MULTILINE)
    for match in pattern.finditer(response):
        rule_name = match.group(2)
        if rule_name not in ("pts", "rule", "---", "name"):
            rules.append(rule_name)
    return rules


def check_spam(raw_email: str) -> SpamAssassinResult:
    """
    Main entry point: run SpamAssassin check.

    Returns SpamAssassinResult with available=True/False.
    When available=False: UI must NOT show "0/5" — show "unavailable" instead.
    When available=False: section_score=50 (neutral, doesn't inflate or deflate score).
    """
    try:
        score, rules = _spamc_check(raw_email)

        # Sanity check: 0.0 with no rules = spamd returned empty (treat as unavailable)
        if score == 0.0 and not rules:
            logger.warning("SpamAssassin returned 0 score with no rules — treating as unavailable")
            return _unavailable_result()

        threshold = 5.0
        is_spam = score >= threshold

        # Normalized section score (0-100)
        if score <= 2:
            section_score = 100.0
            status = CheckStatus.PASS
        elif score <= 5:
            section_score = 60.0
            status = CheckStatus.WARNING
        elif score <= 8:
            section_score = 30.0
            status = CheckStatus.FAIL
        else:
            section_score = 0.0
            status = CheckStatus.FAIL

        logger.info(f"[SpamAssassin] score={score:.1f} is_spam={is_spam} rules={len(rules)}")

        return SpamAssassinResult(
            available=True,
            score=round(score, 1),
            threshold=threshold,
            is_spam=is_spam,
            rules_hit=rules,
            section_score=section_score,
            status=status,
        )

    except (socket.timeout, ConnectionRefusedError, OSError) as e:
        logger.warning(f"SpamAssassin unavailable: {e}")
        return _unavailable_result()
    except Exception as e:
        logger.error(f"SpamAssassin unexpected error: {e}", exc_info=True)
        return _unavailable_result()


def _unavailable_result() -> SpamAssassinResult:
    """
    Return when SpamAssassin is down or unreachable.
    available=False → UI shows 'Score unavailable' not '0/5'
    section_score=50 → neutral contribution to final score (not 0 or 100)
    """
    return SpamAssassinResult(
        available=False,
        score=0.0,
        threshold=5.0,
        is_spam=False,
        rules_hit=[],
        section_score=50.0,   # neutral — don't penalize for infra issue
        status=CheckStatus.WARNING,
    )
