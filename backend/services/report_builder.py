"""
Report Builder — assembles all analysis results into the final EmailReport.

Also generates the Action Plan — the MOST IMPORTANT part of the tool.
Every ❌ and ⚠️ gets a WHY (business impact) + HOW (fix instructions).

This is the second key file of custom code we write.
"""

from datetime import datetime, timezone
from typing import List

from backend.models.schemas import (
    ActionItem,
    AuthenticationResult,
    CheckStatus,
    ContentResult,
    EmailReport,
    ReputationResult,
    SpamAssassinResult,
)
from backend.services.score_calculator import (
    calculate_final_score,
    get_risk_level,
    get_risk_summary,
)


def _build_action_plan(
    auth: AuthenticationResult,
    reputation: ReputationResult,
    content: ContentResult,
    spamassassin: SpamAssassinResult,
) -> List[ActionItem]:
    """
    Build the action plan — maps every failure to a fix recommendation.
    Ordered by priority (most impactful first).

    THE SECRET SAUCE: Other tools say "DKIM: FAIL".
    We say WHY it matters + HOW to fix it + what IMPACT the fix will have.
    """
    actions: List[ActionItem] = []
    priority = 0

    # --- Authentication fixes ---

    for check in auth.checks:
        if check.status == CheckStatus.FAIL:
            priority += 1

            if check.name == "SPF":
                actions.append(ActionItem(
                    priority=priority,
                    status=CheckStatus.FAIL,
                    title="Configure SPF record for your domain",
                    why=(
                        "Without SPF, mail servers can't verify that your sending server "
                        "is authorized to send emails for your domain. Gmail, Outlook, and "
                        "Yahoo will flag or reject your emails."
                    ),
                    how=(
                        "1. Log into your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)\n"
                        "2. Go to DNS settings\n"
                        "3. Add a TXT record:\n"
                        "   Name: @\n"
                        "   Value: v=spf1 include:_spf.google.com ~all\n"
                        "   (Replace with your email provider's SPF include)\n"
                        "4. Wait 24-48 hours for DNS propagation\n"
                        "5. Come back and test again"
                    ),
                    impact="Fixing SPF alone could improve your score by +12 points.",
                ))

            elif check.name == "DKIM":
                actions.append(ActionItem(
                    priority=priority,
                    status=CheckStatus.FAIL,
                    title="Set up DKIM signing for your domain",
                    why=(
                        "Without DKIM, Gmail and Outlook can't verify your emails are really "
                        "from you. This alone can reduce inbox placement by up to 40%. "
                        "Google now REQUIRES DKIM for bulk senders (2024+ policy)."
                    ),
                    how=(
                        "1. Log into your email provider (Google Workspace, Zoho, Mailgun, etc.)\n"
                        "2. Find DKIM settings and generate your DKIM key\n"
                        "3. Copy the DKIM DNS record provided\n"
                        "4. Add a TXT record to your domain DNS:\n"
                        "   Name: [selector]._domainkey\n"
                        "   Value: v=DKIM1; k=rsa; p=[your public key]\n"
                        "5. Activate DKIM in your email provider settings\n"
                        "6. Wait 24-48 hours and test again"
                    ),
                    impact="Fixing DKIM could improve your score by +12 points.",
                ))

            elif check.name == "DMARC":
                actions.append(ActionItem(
                    priority=priority,
                    status=CheckStatus.FAIL,
                    title="Add a DMARC policy to your domain",
                    why=(
                        "Without DMARC, anyone can send emails pretending to be you. "
                        "Major email providers (Gmail, Yahoo, Microsoft) now require DMARC "
                        "for all bulk senders. Missing DMARC = lower trust."
                    ),
                    how=(
                        "1. Add a TXT record to your domain DNS:\n"
                        "   Name: _dmarc\n"
                        "   Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com\n"
                        "2. Start with p=quarantine (safer than p=reject initially)\n"
                        "3. Monitor DMARC reports at the rua email address\n"
                        "4. After 2 weeks with no issues, upgrade to p=reject"
                    ),
                    impact="Adding DMARC could improve your score by +10 points.",
                ))

        elif check.status == CheckStatus.WARNING:
            priority += 1

            if check.name == "DMARC":
                actions.append(ActionItem(
                    priority=priority,
                    status=CheckStatus.WARNING,
                    title="Strengthen your DMARC policy",
                    why=(
                        "Your DMARC policy is set to 'none', which means it only monitors "
                        "but doesn't protect. Spoofed emails can still reach recipients."
                    ),
                    how=(
                        "1. Update your _dmarc TXT record:\n"
                        "   Change p=none to p=quarantine\n"
                        "2. After 2 weeks with no issues, upgrade to p=reject"
                    ),
                    impact="Strengthening DMARC could improve your score by +7 points.",
                ))

            elif check.name == "SPF":
                actions.append(ActionItem(
                    priority=priority,
                    status=CheckStatus.WARNING,
                    title="Improve your SPF record",
                    why=(
                        "Your SPF record exists but uses a soft fail (~all) or has issues. "
                        "Some strict mail servers may still question your authorization."
                    ),
                    how=(
                        "1. Review your SPF record in DNS settings\n"
                        "2. Make sure all your email services are included\n"
                        "3. Consider using -all instead of ~all for stricter enforcement"
                    ),
                    impact="Improving SPF could improve your score by +5 points.",
                ))

    # --- Reputation fixes ---

    if reputation.ip_blacklist_count > 0:
        priority += 1
        actions.append(ActionItem(
            priority=priority,
            status=CheckStatus.FAIL,
            title=f"Your sending IP is on {reputation.ip_blacklist_count} blacklist(s)",
            why=(
                "When your IP is blacklisted, most mail servers will reject your emails "
                "outright. This is one of the most damaging deliverability issues."
            ),
            how=(
                "1. Check which blacklists flagged you (shown above)\n"
                "2. Visit each blacklist's website and request delisting\n"
                "3. Identify why you were listed (compromised account, spam complaints)\n"
                "4. Fix the root cause before requesting delisting\n"
                "5. If using shared hosting, contact your provider"
            ),
            impact=f"Getting delisted could improve your score by +{min(reputation.ip_blacklist_count * 5, 20)} points.",
        ))

    if reputation.domain_blacklist_count > 0:
        priority += 1
        actions.append(ActionItem(
            priority=priority,
            status=CheckStatus.FAIL,
            title=f"Your domain is on {reputation.domain_blacklist_count} blacklist(s)",
            why=(
                "Domain blacklisting means your domain itself is flagged as a spam source. "
                "All emails from this domain will be heavily scrutinized."
            ),
            how=(
                "1. Check which lists flagged your domain (shown above)\n"
                "2. Visit each blacklist's site and submit a delisting request\n"
                "3. Stop all email campaigns until resolved\n"
                "4. Clean your email lists to remove invalid addresses"
            ),
            impact=f"Clearing domain blacklists could improve your score by +{min(reputation.domain_blacklist_count * 5, 20)} points.",
        ))

    if reputation.domain_age_status == CheckStatus.FAIL:
        priority += 1
        actions.append(ActionItem(
            priority=priority,
            status=CheckStatus.WARNING,
            title="Your domain is very new",
            why=(
                f"Your domain is only {reputation.domain_age_days} days old. Mail servers "
                "treat new domains with suspicion. This is temporary but real."
            ),
            how=(
                "1. Warm up your domain gradually — start with 10-20 emails/day\n"
                "2. Send to engaged contacts first (people who reply)\n"
                "3. Avoid cold outreach until domain is 90+ days old\n"
                "4. Set up SPF, DKIM, DMARC immediately to build trust faster"
            ),
            impact="Domain age will improve naturally over time. Focus on other fixes first.",
        ))

    # --- Content fixes ---

    if content.subject_has_caps:
        priority += 1
        actions.append(ActionItem(
            priority=priority,
            status=CheckStatus.FAIL,
            title="Remove ALL CAPS from your subject line",
            why=(
                "Subject lines with ALL CAPS words are flagged by 85% of spam filters. "
                "Gmail and Outlook both penalize this heavily."
            ),
            how=(
                f"Your subject: \"{content.subject_line}\"\n"
                "Change to sentence case (capitalize only the first word).\n"
                "Example: \"Check out our new offer\" instead of \"CHECK OUT OUR NEW OFFER\""
            ),
            impact="Fixing your subject line could improve your score by +5 points.",
        ))

    if content.spam_word_count > 0:
        priority += 1
        words_list = ", ".join([f'"{w.word}"' for w in content.spam_trigger_words[:5]])
        actions.append(ActionItem(
            priority=priority,
            status=CheckStatus.WARNING,
            title=f"Remove {content.spam_word_count} spam trigger word(s)",
            why=(
                f"Words like {words_list} are commonly used in spam and trigger content filters. "
                "Even legitimate emails get flagged when they include these."
            ),
            how=(
                "Replace spam trigger words with neutral alternatives:\n"
                "• \"Free\" → \"Complimentary\" or \"No charge\"\n"
                "• \"Act now\" → \"Get started\" or \"Learn more\"\n"
                "• \"Limited time\" → \"Available until [date]\"\n"
                "• \"Click here\" → \"Read more\" or link the relevant text\n"
                "• \"Guaranteed\" → \"We're confident\" or \"Our promise\""
            ),
            impact=f"Removing spam words could improve your score by +{min(content.spam_word_count * 2, 8)} points.",
        ))

    if content.image_to_text_ratio > 0.6:
        priority += 1
        pct = round(content.image_to_text_ratio * 100)
        actions.append(ActionItem(
            priority=priority,
            status=CheckStatus.FAIL,
            title=f"Reduce image-to-text ratio (currently {pct}% images)",
            why=(
                "Emails with more than 60% images look like marketing spam to filters. "
                "The ideal ratio is 60% text / 40% images or better."
            ),
            how=(
                "1. Add more text content to your email body\n"
                "2. Use HTML text instead of text-in-images\n"
                "3. Always include a plain text version of your email\n"
                "4. Aim for at least 500 characters of visible text"
            ),
            impact="Fixing image ratio could improve your score by +5 points.",
        ))
    elif content.image_to_text_ratio > 0.4:
        priority += 1
        pct = round(content.image_to_text_ratio * 100)
        actions.append(ActionItem(
            priority=priority,
            status=CheckStatus.WARNING,
            title=f"Consider reducing image ratio ({pct}% images)",
            why="Your image-to-text ratio is borderline. Some strict filters may flag this.",
            how="Add more text content or reduce the number of images.",
            impact="Improving image ratio could improve your score by +3 points.",
        ))

    if content.has_url_shorteners:
        priority += 1
        actions.append(ActionItem(
            priority=priority,
            status=CheckStatus.WARNING,
            title="Remove URL shortener links",
            why=(
                "URL shorteners (bit.ly, tinyurl, etc.) hide the real destination. "
                "Spam filters heavily flag these because they're commonly used in phishing."
            ),
            how=(
                "Replace shortened URLs with full, direct links.\n"
                f"Found: {', '.join(content.url_shorteners_found[:3])}"
            ),
            impact="Removing shorteners could improve your score by +3 points.",
        ))

    if content.broken_links:
        priority += 1
        actions.append(ActionItem(
            priority=priority,
            status=CheckStatus.WARNING,
            title=f"Fix {len(content.broken_links)} broken link(s)",
            why="Broken links signal poor quality content and can hurt deliverability.",
            how=f"Check and fix these links: {', '.join(content.broken_links[:3])}",
            impact="Fixing broken links contributes to overall email quality.",
        ))

    # --- SpamAssassin score ---

    if spamassassin.score >= 5:
        priority += 1
        actions.append(ActionItem(
            priority=priority,
            status=CheckStatus.FAIL,
            title=f"High spam score ({spamassassin.score}/5.0 threshold)",
            why=(
                "SpamAssassin, the industry-standard spam filter, gave your email a score "
                f"of {spamassassin.score}. Anything above 5.0 is considered spam by most servers."
            ),
            how=(
                "This score is affected by multiple factors above. Fix the authentication "
                "and content issues listed above, and your SpamAssassin score will improve "
                "automatically."
            ),
            impact="Reducing SA score below 5.0 significantly improves inbox placement.",
        ))

    # Sort by priority
    actions.sort(key=lambda a: (
        0 if a.status == CheckStatus.FAIL else 1,
        a.priority,
    ))

    # Re-number priorities
    for i, action in enumerate(actions):
        action.priority = i + 1

    return actions


def build_report(
    test_id: str,
    raw_email: str,
    auth: AuthenticationResult,
    reputation: ReputationResult,
    content: ContentResult,
    spamassassin: SpamAssassinResult,
    from_address: str,
    from_domain: str,
    subject: str,
) -> EmailReport:
    """
    Build the complete EmailReport from all analysis results.
    This is the final JSON that the frontend receives and renders.
    """
    # Calculate final score
    final_score = calculate_final_score(auth, reputation, spamassassin, content)
    risk_level = get_risk_level(final_score)

    # Build action plan
    action_plan = _build_action_plan(auth, reputation, content, spamassassin)
    issue_count = len(action_plan)

    risk_summary = get_risk_summary(final_score, risk_level, issue_count)

    return EmailReport(
        id=test_id,
        tested_at=datetime.now(timezone.utc),
        from_address=from_address,
        from_domain=from_domain,
        subject=subject,
        final_score=final_score,
        risk_level=risk_level,
        risk_summary=risk_summary,
        authentication=auth,
        reputation=reputation,
        content=content,
        spamassassin=spamassassin,
        action_plan=action_plan,
    )
