"""
Header Parser — extracts SPF, DKIM, DMARC results from raw email headers.

Uses battle-tested libraries:
  - dkimpy: DKIM signature verification
  - pyspf: SPF record checking
  - checkdmarc: DMARC policy parsing

We do NOT rebuild these checks. These libraries handle all the RFC edge cases.
"""

import email
import re
from typing import Optional, Tuple

import dkim
import spf
import checkdmarc

from models.schemas import AuthCheck, AuthenticationResult, CheckStatus


def _extract_sender_info(raw_email: str) -> Tuple[str, str, str]:
    """
    Extract From address, domain, and sending IP from raw email.
    Returns: (from_address, from_domain, sending_ip)
    """
    msg = email.message_from_string(raw_email)

    # From address
    from_header = msg.get("From", "")
    # Extract email from "Name <email@domain.com>" format
    match = re.search(r'[\w.+-]+@[\w.-]+\.\w+', from_header)
    from_address = match.group(0) if match else from_header
    from_domain = from_address.split("@")[-1] if "@" in from_address else ""

    # Sending IP — from the first Received header (bottom-most = originating)
    received_headers = msg.get_all("Received", [])
    sending_ip = ""
    if received_headers:
        # Original sender is typically the LAST Received header
        last_received = received_headers[-1]
        ip_match = re.search(r'\[(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\]', last_received)
        if ip_match:
            sending_ip = ip_match.group(1)

    return from_address, from_domain, sending_ip


def check_spf(raw_email: str, sending_ip: str, from_domain: str, from_address: str) -> AuthCheck:
    """
    Check SPF record for the sender's domain.
    Uses pyspf library which handles recursive DNS includes/redirects.
    """
    try:
        # pyspf.check2 returns (result, code, explanation)
        # but some versions may return only 2 values — unpack safely
        result_tuple = spf.check2(
            i=sending_ip or "127.0.0.1",
            s=from_address,
            h=from_domain,
        )
        if len(result_tuple) >= 3:
            result, code, explanation = result_tuple[0], result_tuple[1], result_tuple[2]
        elif len(result_tuple) == 2:
            result, explanation = result_tuple[0], result_tuple[1]
        else:
            result = str(result_tuple[0]) if result_tuple else "temperror"
            explanation = "Unexpected SPF response"

        if result == "pass":
            return AuthCheck(
                name="SPF",
                status=CheckStatus.PASS,
                description="Your server is authorized to send emails for this domain.",
                details=f"SPF check passed. Sending IP {sending_ip} is permitted.",
            )
        elif result in ("softfail", "neutral", "none"):
            return AuthCheck(
                name="SPF",
                status=CheckStatus.WARNING,
                description="Your SPF record is weak or missing. Some servers may reject your emails.",
                details=f"SPF result: {result}. {explanation}",
            )
        else:
            return AuthCheck(
                name="SPF",
                status=CheckStatus.FAIL,
                description="Your server is NOT authorized to send emails for this domain.",
                details=f"SPF result: {result}. {explanation}",
            )
    except Exception as e:
        return AuthCheck(
            name="SPF",
            status=CheckStatus.WARNING,
            description="Could not verify SPF record.",
            details=f"SPF check error: {str(e)}",
        )


def check_dkim(raw_email: str) -> AuthCheck:
    """
    Verify DKIM signature on the email.
    Uses dkimpy which handles RSA crypto + DNS selector lookup + canonicalization.
    """
    try:
        raw_bytes = raw_email.encode("utf-8")
        result = dkim.verify(raw_bytes)

        if result:
            return AuthCheck(
                name="DKIM",
                status=CheckStatus.PASS,
                description="Your emails are digitally signed and verified.",
                details="DKIM signature is valid. Recipients can trust this email came from you.",
            )
        else:
            return AuthCheck(
                name="DKIM",
                status=CheckStatus.FAIL,
                description="Your emails are NOT digitally signed. They can be spoofed.",
                details="DKIM verification failed. The signature is missing or invalid.",
            )
    except dkim.DKIMException as e:
        return AuthCheck(
            name="DKIM",
            status=CheckStatus.FAIL,
            description="DKIM signature could not be verified.",
            details=f"DKIM error: {str(e)}",
        )
    except Exception as e:
        return AuthCheck(
            name="DKIM",
            status=CheckStatus.WARNING,
            description="Could not check DKIM signature.",
            details=f"DKIM check error: {str(e)}",
        )


def check_dmarc(from_domain: str) -> AuthCheck:
    """
    Check DMARC policy for the sender's domain.
    Uses checkdmarc which handles policy parsing, subdomain inheritance, and reporting URIs.
    """
    try:
        result = checkdmarc.check_domains([from_domain])

        if isinstance(result, list) and len(result) > 0:
            domain_result = result[0]
        else:
            domain_result = result

        # checkdmarc returns a dict or object with dmarc info
        dmarc_info = None
        if isinstance(domain_result, dict):
            dmarc_info = domain_result.get("dmarc", {})
        elif hasattr(domain_result, "get"):
            dmarc_info = domain_result.get("dmarc", {})

        if dmarc_info and dmarc_info.get("record"):
            policy = dmarc_info.get("policy", "none")
            record = dmarc_info.get("record", "")

            if policy in ("reject", "quarantine"):
                return AuthCheck(
                    name="DMARC",
                    status=CheckStatus.PASS,
                    description=f"DMARC policy is set to '{policy}'. Your domain is protected.",
                    details=f"Record: {record}",
                )
            else:
                return AuthCheck(
                    name="DMARC",
                    status=CheckStatus.WARNING,
                    description="DMARC policy is set to 'none'. No enforcement — spoofing is possible.",
                    details=f"Record: {record}. Consider upgrading to p=quarantine or p=reject.",
                )
        else:
            return AuthCheck(
                name="DMARC",
                status=CheckStatus.FAIL,
                description="No DMARC policy found. Your domain can be freely spoofed.",
                details="Add a DMARC TXT record to your domain DNS.",
            )

    except Exception as e:
        return AuthCheck(
            name="DMARC",
            status=CheckStatus.WARNING,
            description="Could not check DMARC record.",
            details=f"DMARC check error: {str(e)}",
        )


def parse_headers(raw_email: str) -> Tuple[AuthenticationResult, str, str, str, str]:
    """
    Main entry point: run all 3 authentication checks on a raw email.

    Returns:
        (AuthenticationResult, from_address, from_domain, sending_ip, subject)
    """
    # Extract sender info
    from_address, from_domain, sending_ip = _extract_sender_info(raw_email)

    # Extract subject
    msg = email.message_from_string(raw_email)
    subject = msg.get("Subject", "(no subject)")

    # Run all 3 checks
    spf_result = check_spf(raw_email, sending_ip, from_domain, from_address)
    dkim_result = check_dkim(raw_email)
    dmarc_result = check_dmarc(from_domain)

    checks = [spf_result, dkim_result, dmarc_result]

    # Calculate authentication section score (out of 100)
    score = 0.0
    for check in checks:
        if check.name == "SPF":
            score += 35 if check.status == CheckStatus.PASS else (15 if check.status == CheckStatus.WARNING else 0)
        elif check.name == "DKIM":
            score += 35 if check.status == CheckStatus.PASS else (15 if check.status == CheckStatus.WARNING else 0)
        elif check.name == "DMARC":
            score += 30 if check.status == CheckStatus.PASS else (10 if check.status == CheckStatus.WARNING else 0)

    auth_result = AuthenticationResult(checks=checks, score=score)

    return auth_result, from_address, from_domain, sending_ip, subject
