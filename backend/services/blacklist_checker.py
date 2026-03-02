"""
Blacklist Checker — queries DNS-based Real-time Blackhole Lists (RBLs).

Uses dnspython for async DNS lookups.
Checks both IP-based and domain-based blacklists.

Also uses python-whois for domain age lookup.
"""

import json
import os
from datetime import datetime, timezone
from typing import List, Optional, Tuple

import dns.resolver
import dns.reversename

from backend.models.schemas import BlacklistEntry, CheckStatus, ReputationResult


# Load blacklists config
_BLACKLISTS_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "blacklists.json")
_blacklists_db: dict = {}


def _load_blacklists() -> dict:
    """Load blacklist DNS server configurations."""
    global _blacklists_db
    if not _blacklists_db:
        try:
            with open(_BLACKLISTS_PATH, "r", encoding="utf-8") as f:
                _blacklists_db = json.load(f)
        except FileNotFoundError:
            _blacklists_db = {
                "ip_blacklists": [],
                "domain_blacklists": [],
            }
    return _blacklists_db


def _reverse_ip(ip: str) -> str:
    """Reverse an IP address for DNSBL lookup. 1.2.3.4 → 4.3.2.1"""
    parts = ip.split(".")
    return ".".join(reversed(parts))


def check_ip_blacklists(ip: str) -> List[BlacklistEntry]:
    """
    Check if an IP is listed on any DNS-based blacklist.
    Queries each RBL by doing a DNS A lookup for: reversed_ip.rbl.domain
    If an A record exists → listed. If NXDOMAIN → clean.
    """
    if not ip:
        return []

    db = _load_blacklists()
    reversed_ip = _reverse_ip(ip)
    results: List[BlacklistEntry] = []

    for rbl in db.get("ip_blacklists", []):
        query = f"{reversed_ip}.{rbl['dns']}"
        listed = False
        try:
            dns.resolver.resolve(query, "A")
            listed = True  # A record found → IP is blacklisted
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.NoNameservers):
            listed = False
        except Exception:
            listed = False  # DNS error — assume not listed

        results.append(BlacklistEntry(
            list_name=rbl["name"],
            listed=listed,
        ))

    return results


def check_domain_blacklists(domain: str) -> List[BlacklistEntry]:
    """
    Check if a domain is listed on any domain-based blacklist (URIBL/SURBL).
    Queries: domain.dbl.server
    """
    if not domain:
        return []

    db = _load_blacklists()
    results: List[BlacklistEntry] = []

    for dbl in db.get("domain_blacklists", []):
        query = f"{domain}.{dbl['dns']}"
        listed = False
        try:
            dns.resolver.resolve(query, "A")
            listed = True
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.NoNameservers):
            listed = False
        except Exception:
            listed = False

        results.append(BlacklistEntry(
            list_name=dbl["name"],
            listed=listed,
        ))

    return results


def get_domain_age(domain: str) -> Optional[int]:
    """
    Get domain age in days using python-whois.
    Returns None if WHOIS lookup fails (common for some TLDs).
    """
    try:
        import whois
        w = whois.whois(domain)
        creation_date = w.creation_date

        if isinstance(creation_date, list):
            creation_date = creation_date[0]

        if creation_date and isinstance(creation_date, datetime):
            age_days = (datetime.now() - creation_date).days
            return max(0, age_days)
    except Exception:
        pass

    return None


def check_reputation(sending_ip: str, from_domain: str) -> ReputationResult:
    """
    Main entry point: run all reputation checks.
    Returns a ReputationResult with blacklist status + domain age.
    """
    # Run blacklist checks
    ip_results = check_ip_blacklists(sending_ip)
    domain_results = check_domain_blacklists(from_domain)

    ip_listed_count = sum(1 for r in ip_results if r.listed)
    domain_listed_count = sum(1 for r in domain_results if r.listed)

    # Domain age
    domain_age = get_domain_age(from_domain)

    # Domain age status
    if domain_age is None:
        age_status = CheckStatus.WARNING
        age_description = "Could not determine domain age."
    elif domain_age < 30:
        age_status = CheckStatus.FAIL
        age_description = f"Domain is only {domain_age} days old. Very new domains are treated with high suspicion by mail servers."
    elif domain_age < 90:
        age_status = CheckStatus.WARNING
        age_description = f"Domain is {domain_age} days old. Newer domains may face some deliverability challenges."
    else:
        age_status = CheckStatus.PASS
        age_description = f"Domain is {domain_age} days old. Established domain — good reputation signal."

    # Calculate reputation score (out of 100)
    score = 100.0

    # Blacklist penalties
    score -= ip_listed_count * 20
    score -= domain_listed_count * 20

    # Domain age penalties
    if domain_age is not None:
        if domain_age < 30:
            score -= 20
        elif domain_age < 90:
            score -= 10

    score = max(0, score)

    return ReputationResult(
        ip_blacklists=ip_results,
        domain_blacklists=domain_results,
        ip_blacklist_count=ip_listed_count,
        domain_blacklist_count=domain_listed_count,
        domain_age_days=domain_age,
        domain_age_status=age_status,
        domain_age_description=age_description,
        sending_ip=sending_ip,
        score=score,
    )
