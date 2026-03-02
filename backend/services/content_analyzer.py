"""
Content Analyzer — checks email body for spam triggers.

Uses beautifulsoup4 for HTML parsing (don't use regex for HTML).
Uses our curated spam_words.json for trigger word detection.

Checks:
  1. Spam trigger words in subject + body
  2. ALL CAPS in subject line
  3. Image-to-text ratio (60/40 rule)
  4. Broken/suspicious links
  5. URL shorteners
"""

import email
import json
import os
import re
from typing import List, Tuple
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from backend.models.schemas import CheckStatus, ContentResult, SpamWord


# Load spam words database once at module level
_SPAM_WORDS_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "spam_words.json")
_spam_words_db: dict = {}

# Known URL shortener domains
URL_SHORTENERS = {
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd",
    "buff.ly", "adf.ly", "bl.ink", "lnkd.in", "shorturl.at",
    "rebrand.ly", "cutt.ly", "short.io",
}


def _load_spam_words() -> dict:
    """Load spam trigger words from JSON file."""
    global _spam_words_db
    if not _spam_words_db:
        try:
            with open(_SPAM_WORDS_PATH, "r", encoding="utf-8") as f:
                _spam_words_db = json.load(f)
        except FileNotFoundError:
            _spam_words_db = {}
    return _spam_words_db


def _get_email_body(raw_email: str) -> Tuple[str, str]:
    """
    Extract plain text AND HTML body from a raw email.
    Returns: (text_body, html_body)
    """
    msg = email.message_from_string(raw_email)

    text_body = ""
    html_body = ""

    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            try:
                payload = part.get_payload(decode=True)
                if payload is None:
                    continue
                charset = part.get_content_charset() or "utf-8"
                decoded = payload.decode(charset, errors="replace")
            except Exception:
                continue

            if content_type == "text/plain":
                text_body += decoded
            elif content_type == "text/html":
                html_body += decoded
    else:
        content_type = msg.get_content_type()
        try:
            payload = msg.get_payload(decode=True)
            if payload:
                charset = msg.get_content_charset() or "utf-8"
                decoded = payload.decode(charset, errors="replace")
                if content_type == "text/html":
                    html_body = decoded
                else:
                    text_body = decoded
        except Exception:
            pass

    return text_body, html_body


def detect_spam_words(text: str, subject: str) -> List[SpamWord]:
    """
    Find spam trigger words in subject and body text.
    Matches are case-insensitive.
    """
    db = _load_spam_words()
    combined_text = f"{subject} {text}".lower()
    found: List[SpamWord] = []
    seen = set()

    for category, words in db.items():
        for word in words:
            word_lower = word.lower()
            if word_lower in combined_text and word_lower not in seen:
                found.append(SpamWord(word=word, category=category))
                seen.add(word_lower)

    return found


def check_subject_caps(subject: str) -> bool:
    """
    Check if subject line has ALL CAPS words (2+ consecutive CAPS words).
    "Check out our NEW OFFER" → True
    "Check out our offer" → False
    """
    words = subject.split()
    caps_count = sum(1 for w in words if w.isupper() and len(w) > 1)
    return caps_count >= 2


def calculate_image_ratio(html_body: str, text_body: str) -> float:
    """
    Calculate image-to-text ratio.
    Returns 0.0 (all text) to 1.0 (all images).
    """
    if not html_body and not text_body:
        return 0.0

    soup = BeautifulSoup(html_body, "html.parser") if html_body else None

    # Count images
    image_count = 0
    if soup:
        image_count = len(soup.find_all("img"))

    # Get visible text length
    text_length = len(text_body)
    if soup:
        visible_text = soup.get_text(separator=" ", strip=True)
        text_length = max(text_length, len(visible_text))

    if text_length == 0 and image_count == 0:
        return 0.0

    if text_length == 0 and image_count > 0:
        return 1.0

    # Approximate: each image "weighs" ~500 chars of content space
    image_weight = image_count * 500
    total = text_length + image_weight

    return round(image_weight / total, 2) if total > 0 else 0.0


def extract_links(html_body: str) -> List[str]:
    """Extract all href links from HTML body."""
    if not html_body:
        return []

    soup = BeautifulSoup(html_body, "html.parser")
    links = []
    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"]
        if href.startswith(("http://", "https://")):
            links.append(href)

    return links


def find_url_shorteners(links: List[str]) -> List[str]:
    """Find links that use URL shortener services."""
    shorteners_found = []
    for link in links:
        try:
            parsed = urlparse(link)
            domain = parsed.netloc.lower().lstrip("www.")
            if domain in URL_SHORTENERS:
                shorteners_found.append(link)
        except Exception:
            continue

    return shorteners_found


def find_broken_links(links: List[str]) -> List[str]:
    """
    Quick check for obviously broken links (malformed URLs).
    Note: We do NOT make HTTP requests to check if links are live
    (that would be slow + could trigger spam traps).
    """
    broken = []
    for link in links:
        try:
            parsed = urlparse(link)
            if not parsed.scheme or not parsed.netloc:
                broken.append(link)
            elif "." not in parsed.netloc:
                broken.append(link)
        except Exception:
            broken.append(link)

    return broken


def analyze_content(raw_email: str) -> ContentResult:
    """
    Main entry point: run all content analysis checks on a raw email.
    Returns a ContentResult with all findings.
    """
    # Extract email parts
    msg = email.message_from_string(raw_email)
    subject = msg.get("Subject", "(no subject)")
    text_body, html_body = _get_email_body(raw_email)

    # Run all checks
    spam_words = detect_spam_words(text_body or "", subject)
    subject_has_caps = check_subject_caps(subject)
    image_ratio = calculate_image_ratio(html_body, text_body)
    links = extract_links(html_body)
    broken_links = find_broken_links(links)
    shorteners = find_url_shorteners(links)

    # Image ratio status
    if image_ratio < 0.4:
        image_status = CheckStatus.PASS
    elif image_ratio < 0.6:
        image_status = CheckStatus.WARNING
    else:
        image_status = CheckStatus.FAIL

    # Calculate content quality score (out of 100)
    score = 0.0

    # Spam words: start at 40, lose 5 per word (min 0)
    spam_word_score = max(0, 40 - (len(spam_words) * 5))
    score += spam_word_score

    # Image ratio
    if image_ratio < 0.4:
        score += 30
    elif image_ratio < 0.6:
        score += 15
    # else: 0

    # Subject line caps
    if not subject_has_caps:
        score += 15

    # URL shorteners
    if not shorteners:
        score += 15

    return ContentResult(
        spam_trigger_words=spam_words,
        spam_word_count=len(spam_words),
        subject_line=subject,
        subject_has_caps=subject_has_caps,
        image_to_text_ratio=image_ratio,
        image_ratio_status=image_status,
        links_valid=len(broken_links) == 0,
        broken_links=broken_links,
        has_url_shorteners=len(shorteners) > 0,
        url_shorteners_found=shorteners,
        spamassassin_score=0.0,       # Filled later by SpamAssassin service
        spamassassin_status=CheckStatus.PASS,  # Filled later
        score=score,
    )
