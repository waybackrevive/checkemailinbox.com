"""
Redis client using Upstash REST-based Redis.
All test data auto-expires with TTL — no cleanup needed.
"""

import json
from typing import Any, Optional

from upstash_redis import Redis

from backend.config import settings


# Singleton connection — initialized once, reused everywhere
_redis: Optional[Redis] = None


def get_redis() -> Redis:
    """Get or create the Upstash Redis connection."""
    global _redis
    if _redis is None:
        _redis = Redis(
            url=settings.UPSTASH_REDIS_URL,
            token=settings.UPSTASH_REDIS_TOKEN,
        )
    return _redis


# ---------------------------------------------------------------------------
# Test session helpers
# ---------------------------------------------------------------------------

def save_test_session(test_id: str, data: dict, ttl: int = settings.TEST_TTL_SECONDS) -> None:
    """Save a test session to Redis with auto-expire TTL."""
    r = get_redis()
    r.setex(f"test:{test_id}", ttl, json.dumps(data))


def get_test_session(test_id: str) -> Optional[dict]:
    """Get a test session from Redis. Returns None if expired or missing."""
    r = get_redis()
    raw = r.get(f"test:{test_id}")
    if raw is None:
        return None
    if isinstance(raw, dict):
        return raw
    return json.loads(raw)


def update_test_session(test_id: str, data: dict) -> None:
    """Update test session data, preserving the existing TTL."""
    r = get_redis()
    ttl = r.ttl(f"test:{test_id}")
    if ttl and ttl > 0:
        r.setex(f"test:{test_id}", ttl, json.dumps(data))


# ---------------------------------------------------------------------------
# Report helpers
# ---------------------------------------------------------------------------

def save_report(test_id: str, report: dict, ttl: int = settings.TEST_TTL_SECONDS) -> None:
    """Save a generated report. Same TTL as the test session."""
    r = get_redis()
    r.setex(f"report:{test_id}", ttl, json.dumps(report))


def get_report(test_id: str) -> Optional[dict]:
    """Get a report by test ID."""
    r = get_redis()
    raw = r.get(f"report:{test_id}")
    if raw is None:
        return None
    if isinstance(raw, dict):
        return raw
    return json.loads(raw)


# ---------------------------------------------------------------------------
# Rate limiting helpers
# ---------------------------------------------------------------------------

def check_rate_limit(ip: str) -> bool:
    """Check if an IP has exceeded the daily test limit. Returns True if allowed."""
    r = get_redis()
    key = f"rate:{ip}"
    count = r.get(key)
    if count is None:
        return True
    return int(count) < settings.MAX_TESTS_PER_DAY


def increment_rate_limit(ip: str) -> None:
    """Increment the daily test count for an IP."""
    r = get_redis()
    key = f"rate:{ip}"
    count = r.incr(key)
    if count == 1:
        # First test today — set expiry to 24 hours
        r.expire(key, settings.RATE_LIMIT_WINDOW_SECONDS)
