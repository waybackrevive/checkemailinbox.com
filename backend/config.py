"""
Application configuration — loaded from environment variables.
"""

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the backend directory
_env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(_env_path)

@dataclass
class Settings:
    # Domain for generating test email addresses
    MAIL_DOMAIN: str = field(
        default_factory=lambda: os.getenv("MAIL_DOMAIN", "checkemaildelivery.com")
    )

    # Upstash Redis
    UPSTASH_REDIS_URL: str = field(
        default_factory=lambda: os.getenv("UPSTASH_REDIS_URL", "")
    )
    UPSTASH_REDIS_TOKEN: str = field(
        default_factory=lambda: os.getenv("UPSTASH_REDIS_TOKEN", "")
    )

    # Cloudflare Email Worker — shared secret for webhook verification
    CLOUDFLARE_WORKER_SECRET: str = field(
        default_factory=lambda: os.getenv("CLOUDFLARE_WORKER_SECRET", "")
    )

    # SpamAssassin — runs inside the same container on Railway (localhost)
    SPAMASSASSIN_HOST: str = field(
        default_factory=lambda: os.getenv("SPAMASSASSIN_HOST", "127.0.0.1")
    )
    SPAMASSASSIN_PORT: int = field(
        default_factory=lambda: int(os.getenv("SPAMASSASSIN_PORT", "783"))
    )

    # Test session settings
    TEST_TTL_SECONDS: int = 3600  # 1 hour
    MAX_TESTS_PER_DAY: int = 5

    # CORS — frontend origin
    FRONTEND_URL: str = field(
        default_factory=lambda: os.getenv("FRONTEND_URL", "http://localhost:3000")
    )

    # Rate limiting
    RATE_LIMIT_WINDOW_SECONDS: int = 86400  # 24 hours

    # AI Email Writer — Groq API key (FREE tier available)
    # Get your free API key at: https://console.groq.com/keys
    GROQ_API_KEY: str = field(
        default_factory=lambda: os.getenv("GROQ_API_KEY", "")
    )
    
    # AI rate limits per IP
    AI_MAX_REQUESTS_PER_DAY: int = 10

    # Contact Form — SMTP Configuration
    # For Gmail: smtp.gmail.com:587 (use App Password, not regular password)
    # For SendGrid: smtp.sendgrid.net:587
    # For Mailgun: smtp.mailgun.org:587
    SMTP_HOST: str = field(
        default_factory=lambda: os.getenv("SMTP_HOST", "smtp.gmail.com")
    )
    SMTP_PORT: int = field(
        default_factory=lambda: int(os.getenv("SMTP_PORT", "587"))
    )
    SMTP_USER: str = field(
        default_factory=lambda: os.getenv("SMTP_USER", "")
    )
    SMTP_PASSWORD: str = field(
        default_factory=lambda: os.getenv("SMTP_PASSWORD", "")
    )
    CONTACT_EMAIL: str = field(
        default_factory=lambda: os.getenv("CONTACT_EMAIL", "contact@checkemaildelivery.com")
    )


settings = Settings()
