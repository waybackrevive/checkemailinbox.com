"""
SpamAssassin Integration — sends raw email to SpamAssassin daemon (spamd)
running in a Docker container and gets back a spam score + rules hit.

SpamAssassin runs on port 783 via the spamc/spamd protocol.
We use a simple TCP connection to talk to it (spamc protocol).
"""

import socket
from typing import List, Tuple

from config import settings
from models.schemas import CheckStatus, SpamAssassinResult


def _spamc_check(raw_email: str) -> Tuple[float, List[str]]:
    """
    Send raw email to SpamAssassin daemon via spamc protocol.
    Returns: (spam_score, list_of_rules_hit)

    Protocol:
      1. Connect to spamd on TCP port 783
      2. Send: REPORT SPAMC/1.5\r\nContent-length: {len}\r\n\r\n{email}
      3. Read response: score and rule matches
    """
    email_bytes = raw_email.encode("utf-8")
    content_length = len(email_bytes)

    # Build spamc REPORT request
    request = (
        f"REPORT SPAMC/1.5\r\n"
        f"Content-length: {content_length}\r\n"
        f"\r\n"
    ).encode("utf-8") + email_bytes

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(30)  # 30 second timeout
        sock.connect((settings.SPAMASSASSIN_HOST, settings.SPAMASSASSIN_PORT))
        sock.sendall(request)

        # Read response
        response = b""
        while True:
            chunk = sock.recv(4096)
            if not chunk:
                break
            response += chunk

        sock.close()
        response_text = response.decode("utf-8", errors="replace")

        # Parse the response
        score = _parse_score(response_text)
        rules = _parse_rules(response_text)

        return score, rules

    except (socket.timeout, ConnectionRefusedError, OSError):
        # SpamAssassin not available — return neutral score with clean message
        return 0.0, ["SpamAssassin scan not available — score based on other checks"]


def _parse_score(response: str) -> float:
    """
    Extract spam score from spamd response.
    Response line looks like: "Spam: True ; 8.5 / 5.0"
    or in REPORT mode, score line: "score/threshold"
    """
    import re

    # Try to find "X/Y" pattern where X is score, Y is threshold
    match = re.search(r'([-\d.]+)\s*/\s*([-\d.]+)', response)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            pass

    # Fallback: try to find "score=" pattern
    match = re.search(r'score=([-\d.]+)', response)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            pass

    return 0.0


def _parse_rules(response: str) -> List[str]:
    """
    Extract rule names from the SpamAssassin REPORT.
    Rules appear as lines with score and rule name, e.g.:
      " 2.0 URIBL_BLACK           Contains a URL listed in the URIBL blacklist"
    """
    import re

    rules = []
    # Match lines that start with whitespace, then a score, then a rule name
    pattern = re.compile(r'^\s*([-\d.]+)\s+(\S+)\s+', re.MULTILINE)
    for match in pattern.finditer(response):
        rule_name = match.group(2)
        # Skip header lines
        if rule_name not in ("pts", "rule", "---"):
            rules.append(rule_name)

    return rules


def check_spam(raw_email: str) -> SpamAssassinResult:
    """
    Main entry point: run SpamAssassin check on raw email.
    Returns SpamAssassinResult with score, rules, and normalized section score.
    """
    score, rules = _spamc_check(raw_email)

    threshold = 5.0  # Standard SpamAssassin threshold
    is_spam = score >= threshold

    # Normalize to 0-100 section score (for our weighted formula)
    # SA score 0-2 = 100 points (excellent)
    # SA score 2-5 = 60 points (okay)
    # SA score 5-8 = 30 points (risky)
    # SA score 8+  = 0 points (spam)
    if score <= 2:
        section_score = 100.0
    elif score <= 5:
        section_score = 60.0
    elif score <= 8:
        section_score = 30.0
    else:
        section_score = 0.0

    # Status for display
    if score <= 2:
        status = CheckStatus.PASS
    elif score <= 5:
        status = CheckStatus.WARNING
    else:
        status = CheckStatus.FAIL

    return SpamAssassinResult(
        score=round(score, 1),
        threshold=threshold,
        is_spam=is_spam,
        rules_hit=rules,
        section_score=section_score,
    )
