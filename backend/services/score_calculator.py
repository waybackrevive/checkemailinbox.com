"""
Score Calculator — FIXED v2
============================

Changes:
  - SpamAssassin unavailable: section_score=50 (neutral)
    Previously: 0.0 score gave section_score=100 (inflated!) OR
                showed 0/5 to user which looked like "perfect" or "broken"
  - Uses SpamAssassinResult.available flag to handle gracefully
"""

from models.schemas import (
    AuthenticationResult,
    ContentResult,
    ReputationResult,
    RiskLevel,
    SpamAssassinResult,
)

# Section weights (must sum to 1.0)
WEIGHT_AUTH             = 0.35
WEIGHT_REPUTATION       = 0.25
WEIGHT_SPAMASSASSIN     = 0.25
WEIGHT_CONTENT_QUALITY  = 0.15


def calculate_final_score(
    auth: AuthenticationResult,
    reputation: ReputationResult,
    spamassassin: SpamAssassinResult,
    content: ContentResult,
) -> int:
    """
    Combine all section scores into a single 0-100 score.

    SpamAssassin unavailable:
      section_score=50 → contributes 12.5 pts (neutral, not 0 or 25)
      This prevents score from being artificially inflated or deflated
      when the SpamAssassin Docker container isn't running.
    """
    weighted_auth       = auth.score * WEIGHT_AUTH
    weighted_reputation = reputation.score * WEIGHT_REPUTATION
    weighted_sa         = spamassassin.section_score * WEIGHT_SPAMASSASSIN
    weighted_content    = content.score * WEIGHT_CONTENT_QUALITY

    final = weighted_auth + weighted_reputation + weighted_sa + weighted_content
    return max(0, min(100, round(final)))


def get_risk_level(score: int) -> RiskLevel:
    if score >= 80:
        return RiskLevel.LOW
    elif score >= 50:
        return RiskLevel.MEDIUM
    else:
        return RiskLevel.HIGH


def get_risk_summary(score: int, risk_level: RiskLevel, issue_count: int) -> str:
    if risk_level == RiskLevel.LOW:
        return "Your email looks great! It has a high chance of reaching the inbox."
    elif risk_level == RiskLevel.MEDIUM:
        return (
            f"Your email has {issue_count} issue{'s' if issue_count != 1 else ''} "
            "that may prevent it from reaching the inbox. "
            "Fix the items below to improve delivery."
        )
    else:
        return (
            f"Your email has {issue_count} serious problem{'s' if issue_count != 1 else ''} "
            "that will likely cause it to land in spam. "
            "Review the action plan below."
        )
