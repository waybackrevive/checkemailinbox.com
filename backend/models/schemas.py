"""
Pydantic schemas — the data contract between backend and frontend.
Every field here maps directly to what the Report UI shows.
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class CheckStatus(str, Enum):
    PASS = "pass"
    FAIL = "fail"
    WARNING = "warning"


class TestStatus(str, Enum):
    WAITING = "waiting"
    RECEIVED = "received"
    PROCESSING = "processing"
    READY = "ready"
    EXPIRED = "expired"


class RiskLevel(str, Enum):
    LOW = "low"        # 80-100 score
    MEDIUM = "medium"  # 50-79
    HIGH = "high"      # 0-49


# ---------------------------------------------------------------------------
# API Request / Response models
# ---------------------------------------------------------------------------

class CreateTestResponse(BaseModel):
    """Returned when user visits homepage and gets a test email."""
    id: str
    email: str
    expires_at: datetime


class TestStatusResponse(BaseModel):
    """Polled by the waiting screen every 5 seconds."""
    id: str
    status: TestStatus
    email: str


# ---------------------------------------------------------------------------
# Report sub-sections (maps 1:1 to UI sections)
# ---------------------------------------------------------------------------

class AuthCheck(BaseModel):
    """Single authentication check result (SPF, DKIM, or DMARC)."""
    name: str                          # "SPF", "DKIM", "DMARC"
    status: CheckStatus                # pass / fail / warning
    description: str                   # Plain English: "Your server is authorized"
    details: Optional[str] = None      # Technical detail (expandable)


class AuthenticationResult(BaseModel):
    """🔐 AUTHENTICATION section of the report."""
    checks: List[AuthCheck]
    score: float                       # 0-100 for this section


class BlacklistEntry(BaseModel):
    """Single blacklist check result."""
    list_name: str
    listed: bool


class ReputationResult(BaseModel):
    """🌍 REPUTATION section of the report."""
    ip_blacklists: List[BlacklistEntry]
    domain_blacklists: List[BlacklistEntry]
    ip_blacklist_count: int
    domain_blacklist_count: int
    domain_age_days: Optional[int] = None
    domain_age_status: CheckStatus = CheckStatus.WARNING
    domain_age_description: str = ""
    sending_ip: Optional[str] = None
    score: float


class SpamWord(BaseModel):
    """A detected spam trigger word."""
    word: str
    category: str                      # "urgency", "money", "pressure", etc.


class ContentResult(BaseModel):
    """✉️ CONTENT ANALYSIS section of the report."""
    spam_trigger_words: List[SpamWord]
    spam_word_count: int
    subject_line: str
    subject_has_caps: bool
    image_to_text_ratio: float         # 0.0 to 1.0, where 1.0 = 100% images
    image_ratio_status: CheckStatus
    links_valid: bool
    broken_links: List[str]
    has_url_shorteners: bool
    url_shorteners_found: List[str]
    spamassassin_score: float          # Raw SA score (lower = better)
    spamassassin_status: CheckStatus
    score: float                       # 0-100 for content quality section


class SpamAssassinResult(BaseModel):
    """SpamAssassin engine result."""
    score: float                       # Raw numeric score
    threshold: float                   # Typically 5.0
    is_spam: bool
    rules_hit: List[str]               # Which SA rules triggered
    section_score: float               # 0-100 normalized for our formula


# ---------------------------------------------------------------------------
# Action Plan — the MOST IMPORTANT part
# ---------------------------------------------------------------------------

class ActionItem(BaseModel):
    """A single fix recommendation."""
    priority: int                      # 1 = most important
    status: CheckStatus                # fail = must fix, warning = should fix
    title: str                         # "Set up DKIM for your domain"
    why: str                           # Business impact explanation
    how: str                           # Step-by-step fix instructions
    impact: str                        # "Fixing this could improve your score by +15"


# ---------------------------------------------------------------------------
# Full Report — everything the frontend needs
# ---------------------------------------------------------------------------

class EmailReport(BaseModel):
    """The complete report returned by /api/report/{id}."""
    # Metadata
    id: str
    tested_at: datetime
    from_address: str
    from_domain: str
    subject: str

    # Overall score
    final_score: int                   # 0-100
    risk_level: RiskLevel
    risk_summary: str                  # "Your email has issues..."

    # Section results
    authentication: AuthenticationResult
    reputation: ReputationResult
    content: ContentResult
    spamassassin: SpamAssassinResult

    # The money section
    action_plan: List[ActionItem]
