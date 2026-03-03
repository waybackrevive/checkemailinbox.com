"""
Header Parser — FIXED v3
========================

ROOT CAUSE OF ALL 3 FALSE POSITIVES:
──────────────────────────────────────────────────────────────────────────────
Your tool uses Resend for inbound email. Resend sends a JSON webhook, and
_build_raw_email_from_resend() reconstructs a fake MIME email from that JSON.

Problem 1 — DKIM always FAILS:
  dkimpy verifies the DKIM signature CRYPTOGRAPHICALLY on the raw bytes.
  The reconstructed email body is different from the original — so the
  RSA signature will never match. dkimpy fails even on perfectly signed email.

Problem 2 — SPF always WARNS:
  pyspf needs the real originating IP. Your reconstructed email has no
  Received headers with real IPs, so pyspf gets "127.0.0.1" or empty string.
  This makes SPF fail even for domains with perfect SPF records.

THE FIX:
──────────────────────────────────────────────────────────────────────────────
Read the "Authentication-Results" header as the PRIMARY source of truth.

When Resend receives your email, its own MX server runs SPF/DKIM/DMARC
verification and writes the result into the Authentication-Results header.
This header is passed through in Resend's webhook payload → headers array
→ included in the reconstructed email by _build_raw_email_from_resend().

This IS the real result. It's what Gmail, Outlook, etc. would have seen.
"""

import email
import re
import logging
from typing import Optional, Tuple

import checkdmarc

from models.schemas import AuthCheck, AuthenticationResult, CheckStatus

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Read Authentication-Results header (ground truth)
# ─────────────────────────────────────────────────────────────────────────────

def _parse_auth_results_header(raw_email: str) -> dict:
    """
    Parse Authentication-Results + ARC-Authentication-Results headers.

    Real example written by Resend's MX server:
      Authentication-Results: mx.resend.com;
         spf=pass smtp.mailfrom=support@waybackrevive.com;
         dkim=pass header.i=@waybackrevive.com header.s=resend;
         dmarc=pass header.from=waybackrevive.com

    We read this — not try to re-verify the crypto ourselves.
    """
    out = {
        "spf":   {"status": None, "detail": ""},
        "dkim":  {"status": None, "detail": ""},
        "dmarc": {"status": None, "detail": ""},
    }

    # Collect all relevant headers — unfold multiline folding
    msg = email.message_from_string(raw_email)
    header_values = (
        msg.get_all("Authentication-Results", []) +
        msg.get_all("ARC-Authentication-Results", [])
    )

    if not header_values:
        logger.warning("No Authentication-Results header in email — Resend may not be passing headers")
        return out

    full_text = " ".join(header_values).lower()
    logger.debug(f"Auth-Results text: {full_text[:300]}")

    # ── SPF ──────────────────────────────────────────────────────────────────
    m = re.search(r"\bspf=(pass|fail|softfail|neutral|none|temperror|permerror)\b", full_text)
    if m:
        v = m.group(1)
        if v == "pass":
            out["spf"] = {
                "status": CheckStatus.PASS,
                "detail": "SPF pass — your sending server is authorized to send email for this domain.",
            }
        elif v == "softfail":
            out["spf"] = {
                "status": CheckStatus.WARNING,
                "detail": (
                    "SPF soft fail (~all) — email was accepted but flagged with a minor warning. "
                    "Consider changing your SPF record from '~all' to '-all' for stricter enforcement."
                ),
            }
        elif v in ("fail", "permerror"):
            out["spf"] = {
                "status": CheckStatus.FAIL,
                "detail": (
                    "SPF hard fail — this sending server is not authorized. "
                    "Your SPF record needs to include this sending service."
                ),
            }
        elif v == "none":
            out["spf"] = {
                "status": CheckStatus.FAIL,
                "detail": "No SPF record found for this domain. Add one to authorize your sending server.",
            }
        else:
            out["spf"] = {
                "status": CheckStatus.WARNING,
                "detail": f"SPF returned '{v}' — review your SPF record configuration.",
            }

    # ── DKIM ─────────────────────────────────────────────────────────────────
    m = re.search(r"\bdkim=(pass|fail|none|neutral|policy|temperror|permerror)\b", full_text)
    if m:
        v = m.group(1)
        if v == "pass":
            out["dkim"] = {
                "status": CheckStatus.PASS,
                "detail": (
                    "DKIM signature verified — your email is cryptographically authenticated "
                    "and has not been tampered with in transit."
                ),
            }
        elif v in ("fail", "permerror"):
            out["dkim"] = {
                "status": CheckStatus.FAIL,
                "detail": (
                    "DKIM signature invalid — the signature doesn't match. "
                    "Check that DKIM is properly set up in your email provider."
                ),
            }
        elif v == "none":
            out["dkim"] = {
                "status": CheckStatus.FAIL,
                "detail": (
                    "No DKIM signature on this email. "
                    "Enable DKIM signing in your email provider (Google Workspace, Resend, etc.)."
                ),
            }
        else:
            out["dkim"] = {
                "status": CheckStatus.WARNING,
                "detail": f"DKIM result: '{v}' — check your DKIM configuration.",
            }

    # ── DMARC ─────────────────────────────────────────────────────────────────
    m = re.search(r"\bdmarc=(pass|fail|none|bestguesspass)\b", full_text)
    if m:
        v = m.group(1)
        if v in ("pass", "bestguesspass"):
            out["dmarc"] = {
                "status": CheckStatus.PASS,
                "detail": "DMARC aligned — your From domain aligns with SPF and/or DKIM.",
            }
        elif v == "fail":
            out["dmarc"] = {
                "status": CheckStatus.FAIL,
                "detail": (
                    "DMARC failed — your From domain does not align with SPF/DKIM. "
                    "Check that your sending domain matches your authenticated domain."
                ),
            }
        elif v == "none":
            out["dmarc"] = {
                "status": CheckStatus.MISSING,
                "detail": "No DMARC record found. Add a DMARC TXT record to your DNS.",
            }

    logger.info(
        f"Auth-Results parsed: "
        f"SPF={out['spf']['status']} "
        f"DKIM={out['dkim']['status']} "
        f"DMARC={out['dmarc']['status']}"
    )
    return out


# ─────────────────────────────────────────────────────────────────────────────
# DMARC DNS check — fallback + policy details
# ─────────────────────────────────────────────────────────────────────────────

def _check_dmarc_dns(domain: str) -> Tuple[CheckStatus, str]:
    """
    Query DNS for DMARC record.
    Used when Authentication-Results doesn't have DMARC, or to get policy details.
    """
    try:
        result = checkdmarc.check_domains([domain])
        domain_result = result[0] if isinstance(result, list) and result else result

        dmarc_info = None
        if isinstance(domain_result, dict):
            dmarc_info = domain_result.get("dmarc", {})

        if dmarc_info and dmarc_info.get("record"):
            policy = dmarc_info.get("policy", "none")
            record = dmarc_info.get("record", "")

            if policy in ("reject", "quarantine"):
                return (
                    CheckStatus.PASS,
                    f"DMARC policy is '{policy}'. Your domain is protected against spoofing.",
                )
            else:  # p=none
                return (
                    CheckStatus.WARNING,
                    (
                        "DMARC policy is 'none' (monitoring only) — no enforcement. "
                        "Spoofed emails can still reach recipients. "
                        "Upgrade to p=quarantine for real protection."
                    ),
                )
        else:
            return (
                CheckStatus.FAIL,
                "No DMARC record found. Add a _dmarc TXT record to your domain DNS.",
            )

    except Exception as e:
        logger.warning(f"DMARC DNS check failed for {domain}: {e}")
        return (
            CheckStatus.WARNING,
            f"DMARC check could not be completed: {str(e)[:80]}",
        )


# ─────────────────────────────────────────────────────────────────────────────
# Extract sender info from reconstructed email
# ─────────────────────────────────────────────────────────────────────────────

def _extract_sender_info(raw_email: str) -> Tuple[str, str, str]:
    """Extract from_address, from_domain, sending_ip."""
    msg = email.message_from_string(raw_email)

    from_header = msg.get("From", "")
    match = re.search(r"[\w.+-]+@[\w.-]+\.\w+", from_header)
    from_address = match.group(0) if match else from_header
    from_domain = from_address.split("@")[-1] if "@" in from_address else ""

    # IP from Received headers (best effort — may not be in reconstructed email)
    received_headers = msg.get_all("Received", [])
    sending_ip = ""
    if received_headers:
        last_received = received_headers[-1]
        ip_match = re.search(r"\[(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\]", last_received)
        if ip_match:
            sending_ip = ip_match.group(1)

    return from_address, from_domain, sending_ip


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def parse_headers(raw_email: str) -> Tuple[AuthenticationResult, str, str, str, str]:
    """
    Parse all authentication checks from a raw (reconstructed) email.

    Strategy:
    1. Read Authentication-Results header (GROUND TRUTH from Resend's MX)
    2. DMARC: also query DNS for policy details
    3. Never report FAIL from live crypto checks (causes false positives)

    Returns: (AuthenticationResult, from_address, from_domain, sending_ip, subject)
    """
    from_address, from_domain, sending_ip = _extract_sender_info(raw_email)

    msg = email.message_from_string(raw_email)
    subject = msg.get("Subject", "(no subject)")

    # Parse Authentication-Results (primary source)
    ar = _parse_auth_results_header(raw_email)

    # ── SPF ──────────────────────────────────────────────────────────────────
    if ar["spf"]["status"] is not None:
        spf_status = ar["spf"]["status"]
        spf_detail = ar["spf"]["detail"]
    else:
        # Header missing — don't falsely fail, mark unknown
        spf_status = CheckStatus.WARNING
        spf_detail = (
            "SPF result not found in email headers. "
            "This may be a configuration issue with your inbound email setup."
        )

    # ── DKIM ─────────────────────────────────────────────────────────────────
    if ar["dkim"]["status"] is not None:
        dkim_status = ar["dkim"]["status"]
        dkim_detail = ar["dkim"]["detail"]
    else:
        dkim_status = CheckStatus.WARNING
        dkim_detail = (
            "DKIM result not found in email headers. "
            "Check that DKIM signing is enabled in your email provider."
        )

    # ── DMARC: header first, DNS fallback ────────────────────────────────────
    if ar["dmarc"]["status"] is not None:
        dmarc_status = ar["dmarc"]["status"]
        dmarc_detail = ar["dmarc"]["detail"]
    else:
        # No header result — check DNS directly
        dmarc_status, dmarc_detail = _check_dmarc_dns(from_domain)

    # ── Build result objects ──────────────────────────────────────────────────
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
