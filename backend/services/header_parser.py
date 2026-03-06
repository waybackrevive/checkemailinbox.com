"""
Header Parser — v4 (Cloudflare Email Workers)
================================================

ARCHITECTURE:
Cloudflare Email Workers give us the ACTUAL raw RFC-2822 email as originally sent.
Unlike Resend (which reconstructed emails, breaking DKIM), we now receive the
authentic email with intact DKIM signatures.

VERIFICATION STRATEGY:
1. DKIM: Verify signature using dkimpy on the raw email
2. SPF:  Check DNS record exists + structure is valid (can't do IP check in Workers)
3. DMARC: Check DNS record policy (p=none/quarantine/reject)
"""

import email
import re
import logging
from typing import Optional, Tuple

import dkim
import dns.resolver
import checkdmarc

from models.schemas import AuthCheck, AuthenticationResult, CheckStatus

logger = logging.getLogger(__name__)


# DKIM Verification - Live crypto check on raw email

def _verify_dkim(raw_email: str) -> Tuple[CheckStatus, str]:
    """
    Verify DKIM signature using dkimpy.
    Since we receive the actual raw email from Cloudflare (not reconstructed),
    the DKIM signature should be intact and verifiable.
    """
    try:
        msg = email.message_from_string(raw_email)
        dkim_header = msg.get("DKIM-Signature")

        if not dkim_header:
            return (
                CheckStatus.FAIL,
                "No DKIM signature found. Enable DKIM signing in your email provider "
                "(Gmail, Outlook, SendGrid, etc.)."
            )

        email_bytes = raw_email.encode("utf-8")
        result = dkim.verify(email_bytes)

        if result:
            domain_match = re.search(r"\bd=([a-zA-Z0-9.-]+)", dkim_header)
            signing_domain = domain_match.group(1) if domain_match else "unknown"
            return (
                CheckStatus.PASS,
                f"DKIM signature verified successfully. Email is cryptographically "
                f"authenticated by {signing_domain}."
            )
        else:
            return (
                CheckStatus.FAIL,
                "DKIM signature verification failed. The signature doesn't match the "
                "email content. This could mean the email was modified in transit, or "
                "there's a DNS/key configuration issue."
            )

    except dkim.DKIMException as e:
        logger.warning(f"DKIM verification exception: {e}")
        return (
            CheckStatus.WARNING,
            f"DKIM signature present but verification inconclusive: {str(e)[:100]}"
        )
    except Exception as e:
        logger.warning(f"DKIM verification error: {e}")
        return (
            CheckStatus.WARNING,
            "DKIM check could not be completed. If you've set up DKIM, "
            "verify your DNS records are correctly configured."
        )


# SPF Check - DNS record validation

def _check_spf(from_domain: str, sender_ip: Optional[str] = None) -> Tuple[CheckStatus, str]:
    """
    Check SPF record via DNS.
    """
    try:
        spf_record = None
        try:
            answers = dns.resolver.resolve(from_domain, "TXT")
            for rdata in answers:
                txt_value = "".join([s.decode("utf-8") if isinstance(s, bytes) else s for s in rdata.strings])
                if txt_value.startswith("v=spf1"):
                    spf_record = txt_value
                    break
        except dns.resolver.NXDOMAIN:
            return (
                CheckStatus.FAIL,
                f"Domain '{from_domain}' has no DNS records. Cannot verify SPF."
            )
        except dns.resolver.NoAnswer:
            pass

        if not spf_record:
            return (
                CheckStatus.FAIL,
                f"No SPF record found for '{from_domain}'. "
                "Add a TXT record starting with 'v=spf1' to authorize your mail servers."
            )

        # Analyze the SPF record policy
        if "-all" in spf_record:
            return (
                CheckStatus.PASS,
                f"SPF record found with strict policy (-all). "
                f"Your domain properly restricts who can send email."
            )
        elif "~all" in spf_record:
            return (
                CheckStatus.WARNING,
                f"SPF record found but uses soft fail (~all). "
                f"Consider changing to '-all' for better protection."
            )
        elif "?all" in spf_record or "+all" in spf_record:
            return (
                CheckStatus.WARNING,
                f"SPF record found but policy is too permissive. "
                f"This doesn't effectively prevent spoofing."
            )
        else:
            return (
                CheckStatus.PASS,
                f"SPF record found and configured."
            )

    except Exception as e:
        logger.warning(f"SPF check error for {from_domain}: {e}")
        return (
            CheckStatus.WARNING,
            f"SPF check could not be completed: {str(e)[:80]}"
        )


# DMARC Check - DNS record for policy

def _check_dmarc(domain: str) -> Tuple[CheckStatus, str]:
    """Query DNS for DMARC record and evaluate the policy."""
    try:
        result = checkdmarc.check_domains([domain])
        domain_result = result[0] if isinstance(result, list) and result else result

        dmarc_info = None
        if isinstance(domain_result, dict):
            dmarc_info = domain_result.get("dmarc", {})

        if dmarc_info and dmarc_info.get("record"):
            policy = dmarc_info.get("policy", "none")

            if policy == "reject":
                return (
                    CheckStatus.PASS,
                    "DMARC policy is 'reject' - your domain is strongly protected. "
                    "Unauthenticated emails are rejected."
                )
            elif policy == "quarantine":
                return (
                    CheckStatus.PASS,
                    "DMARC policy is 'quarantine' - unauthenticated emails go to spam. "
                    "Good protection level."
                )
            else:
                return (
                    CheckStatus.WARNING,
                    "DMARC policy is 'none' (monitoring only) - no enforcement. "
                    "Upgrade to p=quarantine or p=reject for real protection."
                )
        else:
            return (
                CheckStatus.FAIL,
                "No DMARC record found. Add a _dmarc TXT record to your domain DNS. "
                "Example: v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com"
            )

    except Exception as e:
        logger.warning(f"DMARC check failed for {domain}: {e}")
        return (
            CheckStatus.WARNING,
            f"DMARC check could not be completed: {str(e)[:80]}"
        )


# Extract sender info from raw email

def _extract_sender_info(raw_email: str) -> Tuple[str, str, str]:
    """Extract from_address, from_domain, sending_ip from raw email."""
    msg = email.message_from_string(raw_email)

    from_header = msg.get("From", "")
    match = re.search(r"[\w.+-]+@[\w.-]+\.\w+", from_header)
    from_address = match.group(0) if match else from_header
    from_domain = from_address.split("@")[-1] if "@" in from_address else ""

    received_headers = msg.get_all("Received", [])
    sending_ip = ""
    if received_headers:
        for received in reversed(received_headers):
            ip_match = re.search(r"\[(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\]", received)
            if ip_match:
                ip = ip_match.group(1)
                if not ip.startswith(("10.", "192.168.", "127.", "172.")):
                    sending_ip = ip
                    break

    return from_address, from_domain, sending_ip


# MAIN ENTRY POINT

def parse_headers(raw_email: str) -> Tuple[AuthenticationResult, str, str, str, str]:
    """
    Parse and verify all authentication checks from the raw email.

    Cloudflare Email Workers Strategy:
    Since Cloudflare forwards the ACTUAL raw email (not reconstructed),
    we can perform live cryptographic verification:

    1. DKIM: Verify signature using dkimpy (crypto check on raw email)
    2. SPF:  Check DNS record exists and policy
    3. DMARC: Check DNS record policy (p=none/quarantine/reject)

    Returns: (AuthenticationResult, from_address, from_domain, sending_ip, subject)
    """
    from_address, from_domain, sending_ip = _extract_sender_info(raw_email)

    msg = email.message_from_string(raw_email)
    subject = msg.get("Subject", "(no subject)")

    logger.info(f"Verifying authentication for {from_address} (IP: {sending_ip or 'unknown'})")

    # DKIM - Live verification
    dkim_status, dkim_detail = _verify_dkim(raw_email)

    # SPF - DNS check
    spf_status, spf_detail = _check_spf(from_domain, sending_ip)

    # DMARC - DNS policy check
    dmarc_status, dmarc_detail = _check_dmarc(from_domain)

    # Build result objects
    spf_check = AuthCheck(
        name="SPF",
        status=spf_status,
        description=_status_to_description("SPF", spf_status),
        details=spf_detail,
    )

    dkim_check = AuthCheck(
        name="DKIM",
        status=dkim_status,
        description=_status_to_description("DKIM", dkim_status),
        details=dkim_detail,
    )

    dmarc_check = AuthCheck(
        name="DMARC",
        status=dmarc_status,
        description=_status_to_description("DMARC", dmarc_status),
        details=dmarc_detail,
    )

    checks = [spf_check, dkim_check, dmarc_check]

    # Section score (0-100)
    score = 0.0
    for check in checks:
        if check.name == "SPF":
            score += 35 if check.status == CheckStatus.PASS else (15 if check.status == CheckStatus.WARNING else 0)
        elif check.name == "DKIM":
            score += 35 if check.status == CheckStatus.PASS else (15 if check.status == CheckStatus.WARNING else 0)
        elif check.name == "DMARC":
            score += 30 if check.status == CheckStatus.PASS else (10 if check.status == CheckStatus.WARNING else 0)

    logger.info(
        f"[Auth] {from_address}: "
        f"SPF={spf_status} DKIM={dkim_status} DMARC={dmarc_status} "
        f"score={score:.0f}/100"
    )

    return (
        AuthenticationResult(checks=checks, score=score),
        from_address,
        from_domain,
        sending_ip,
        subject,
    )


def _status_to_description(check_name: str, status: CheckStatus) -> str:
    """Short plain-English description for each check result."""
    descriptions = {
        "SPF": {
            CheckStatus.PASS:    "Your server is authorized to send emails for this domain.",
            CheckStatus.WARNING: "SPF is configured but may have issues.",
            CheckStatus.FAIL:    "Your server is NOT authorized to send emails for this domain.",
        },
        "DKIM": {
            CheckStatus.PASS:    "Your emails are digitally signed and verified.",
            CheckStatus.WARNING: "DKIM could not be fully verified.",
            CheckStatus.FAIL:    "Your emails are NOT digitally signed. They can be spoofed.",
        },
        "DMARC": {
            CheckStatus.PASS:    "DMARC policy protects your domain from spoofing.",
            CheckStatus.WARNING: "DMARC exists but has weak enforcement (p=none).",
            CheckStatus.FAIL:    "No DMARC policy. Your domain can be freely spoofed.",
            CheckStatus.MISSING: "No DMARC record found. Your domain can be freely spoofed.",
        },
    }
    return descriptions.get(check_name, {}).get(status, str(status))
