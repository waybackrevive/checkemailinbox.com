"""
Score Calculator — combines all check results into a single 0-100 score.

Weighted formula from the plan:
  Authentication: 35%
  Reputation:     25%
  SpamAssassin:   25%
  Content Quality:15%

This is one of the ~4 files of custom code we actually write.
Everything else uses open-source libraries.
"""

from backend.models.schemas import (
    AuthenticationResult,
    ContentResult,
    ReputationResult,
    RiskLevel,
    SpamAssassinResult,
)


# Section weights (must sum to 1.0)
WEIGHT_AUTH = 0.35
WEIGHT_REPUTATION = 0.25
WEIGHT_SPAMASSASSIN = 0.25
WEIGHT_CONTENT_QUALITY = 0.15


def calculate_final_score(
    auth: AuthenticationResult,
    reputation: ReputationResult,
    spamassassin: SpamAssassinResult,
    content: ContentResult,
) -> int:
    """
    Combine all section scores into a single 0-100 score.

    Each section already has a 0-100 score calculated by its service.
    We just apply weights and sum.
    """
    weighted_auth = auth.score * WEIGHT_AUTH
    weighted_reputation = reputation.score * WEIGHT_REPUTATION
    weighted_sa = spamassassin.section_score * WEIGHT_SPAMASSASSIN
    weighted_content = content.score * WEIGHT_CONTENT_QUALITY

    final = weighted_auth + weighted_reputation + weighted_sa + weighted_content
    return max(0, min(100, round(final)))


def get_risk_level(score: int) -> RiskLevel:
    """Map score to risk level for display."""
    if score >= 80:
        return RiskLevel.LOW
    elif score >= 50:
        return RiskLevel.MEDIUM
    else:
        return RiskLevel.HIGH


def get_risk_summary(score: int, risk_level: RiskLevel, issue_count: int) -> str:
    """
    Generate the plain English summary shown at the top of the report.
    This is what makes us different from other tools — BUSINESS language.
    """
    if risk_level == RiskLevel.LOW:
        return "Your email looks great! It has a high chance of reaching the inbox."
    elif risk_level == RiskLevel.MEDIUM:
        return f"Your email has {issue_count} issue{'s' if issue_count != 1 else ''} that may prevent it from reaching the inbox. Fix the items below to improve delivery."
    else:
        return f"Your email has {issue_count} serious problem{'s' if issue_count != 1 else ''} that will likely cause it to land in spam. Review the action plan below."
