"""
Pydantic schemas — FIXED v2
===========================
Changes:
  - SpamAssassinResult: added `available` and `status` fields
  - AuthCheck: added MISSING to CheckStatus (for DMARC not found case)
  - All other schemas unchanged — frontend compatibility preserved
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel


# ─────────────────────────────────────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────────────────────────────────────

class CheckStatus(str, Enum):
    PASS    = "pass"
    FAIL    = "fail"
    WARNING = "warning"
    MISSING = "missing"   # Added: for DMARC not found (distinct from FAIL)


class TestStatus(str, Enum):
    WAITING    = "waiting"
    RECEIVED   = "received"
    PROCESSING = "processing"
    READY      = "ready"
    EXPIRED    = "expired"


class RiskLevel(str, Enum):
    LOW    = "low"     # 80-100
    MEDIUM = "medium"  # 50-79
    HIGH   = "high"    # 0-49


# ─────────────────────────────────────────────────────────────────────────────
# API request/response
# ─────────────────────────────────────────────────────────────────────────────

class CreateTestResponse(BaseModel):
    id: str
    email: str
    expires_at: datetime


class TestStatusResponse(BaseModel):
    id: str
    status: TestStatus
    email: str


# ─────────────────────────────────────────────────────────────────────────────
# Report sub-sections
# ─────────────────────────────────────────────────────────────────────────────

class AuthCheck(BaseModel):
    """Single authentication check result (SPF, DKIM, or DMARC)."""
    name: str                          # "SPF", "DKIM", "DMARC"
    status: CheckStatus
    description: str                   # Plain English headline
    details: Optional[str] = None      # Technical detail (expandable in UI)


class AuthenticationResult(BaseModel):
    """Email Authentication section."""
    checks: List[AuthCheck]
    score: float                       # 0-100


class BlacklistEntry(BaseModel):
    list_name: str
    listed: bool


class ReputationResult(BaseModel):
    """Sender Reputation section."""
    ip_blacklists: List[BlacklistEntry]
    domain_blacklists: List[BlacklistEntry]
    ip_blacklist_count: int
    domain_blacklist_count: int
    domain_age_days: Optional[int] = None
    domain_age_status: CheckStatus = CheckStatus.WARNING
    domain_age_description: str = ""
    sending_ip: Optional[str] = None
    score: float                       # 0-100


class SpamWord(BaseModel):
    word: str
    category: str


class ContentResult(BaseModel):
    """Content Analysis section."""
    spam_trigger_words: List[SpamWord]
    spam_word_count: int
    subject_line: str
    subject_has_caps: bool
    image_to_text_ratio: float
    image_ratio_status: CheckStatus
    links_valid: bool
    broken_links: List[str]
    has_url_shorteners: bool
    url_shorteners_found: List[str]
    spamassassin_score: float
    spamassassin_status: CheckStatus
    score: float                       # 0-100


class SpamAssassinResult(BaseModel):
    """SpamAssassin engine result — FIXED: added available + status."""
    available: bool = True             # False = spamd unreachable, don't show score in UI
    score: float                       # Raw numeric score (0.0 when unavailable)
    threshold: float                   # Typically 5.0
    is_spam: bool
    rules_hit: List[str]
    section_score: float               # 0-100 normalized (50 when unavailable = neutral)
    status: CheckStatus = CheckStatus.PASS  # pass/warning/fail based on score


# ─────────────────────────────────────────────────────────────────────────────
# Action Plan
# ─────────────────────────────────────────────────────────────────────────────

class ActionItem(BaseModel):
    priority: int
    status: CheckStatus
    title: str
    why: str
    how: str
    impact: str


# ─────────────────────────────────────────────────────────────────────────────
# Full Report
# ─────────────────────────────────────────────────────────────────────────────

class EmailReport(BaseModel):
    """Complete report returned by GET /api/report/{id}."""
    id: str
    tested_at: datetime
    from_address: str
    from_domain: str
    subject: str

    final_score: int                   # 0-100
    risk_level: RiskLevel
    risk_summary: str

    authentication: AuthenticationResult
    reputation: ReputationResult
    content: ContentResult
    spamassassin: SpamAssassinResult

    action_plan: List[ActionItem]
