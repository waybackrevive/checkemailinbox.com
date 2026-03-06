"""
AI Email Writer API Route

Transforms raw thoughts into polished, spam-free emails using Groq's FREE API.
Production-ready with model fallback and proper error handling.
"""

import logging
from typing import Literal
from datetime import datetime

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
import httpx

from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Email Writer"])

# Simple in-memory rate limiting (for production, use Redis)
_rate_limits: dict[str, list[datetime]] = {}

# Groq models to try in order (all FREE tier)
GROQ_MODELS = [
    "llama-3.3-70b-versatile",      # Latest Llama 3.3 70B
    "llama-3.1-70b-versatile",      # Llama 3.1 70B  
    "llama-3.1-8b-instant",         # Fast fallback
    "mixtral-8x7b-32768",           # Mixtral fallback
]


class EmailWriteRequest(BaseModel):
    """Request body for email generation."""
    
    thoughts: str = Field(
        ...,
        min_length=10,
        max_length=2000,
        description="Raw thoughts to transform into an email"
    )
    tone: Literal["professional", "warm", "concise", "formal", "casual", "persuasive"] = Field(
        default="professional",
        description="Desired tone of the email"
    )
    context: str | None = Field(
        default=None,
        max_length=3000,
        description="Optional: email being replied to"
    )


class EmailWriteResponse(BaseModel):
    """Response with generated email."""
    
    success: bool
    email: str | None = None
    error: str | None = None
    remaining_requests: int = 0


def _check_rate_limit(ip: str) -> tuple[bool, int]:
    """Check if IP has exceeded daily rate limit."""
    now = datetime.now()
    today_key = now.strftime("%Y-%m-%d")
    rate_key = f"{ip}:{today_key}"
    
    if rate_key not in _rate_limits:
        _rate_limits[rate_key] = []
    
    # Remove entries older than 24h
    _rate_limits[rate_key] = [
        t for t in _rate_limits[rate_key]
        if (now - t).total_seconds() < 86400
    ]
    
    current_count = len(_rate_limits[rate_key])
    remaining = max(0, settings.AI_MAX_REQUESTS_PER_DAY - current_count)
    
    if current_count >= settings.AI_MAX_REQUESTS_PER_DAY:
        return False, 0
    
    return True, remaining


def _record_request(ip: str):
    """Record a request for rate limiting."""
    now = datetime.now()
    today_key = now.strftime("%Y-%m-%d")
    rate_key = f"{ip}:{today_key}"
    
    if rate_key not in _rate_limits:
        _rate_limits[rate_key] = []
    
    _rate_limits[rate_key].append(now)


async def _call_groq_api(prompt: str, system_prompt: str) -> tuple[bool, str]:
    """
    Call Groq API with model fallback.
    Returns (success, result_or_error)
    """
    api_key = settings.GROQ_API_KEY
    
    if not api_key:
        return False, "API key not configured"
    
    last_error = ""
    
    for model in GROQ_MODELS:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": model,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.7,
                        "max_tokens": 1024
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    if content:
                        logger.info(f"Groq API success with model: {model}")
                        return True, content.strip()
                    else:
                        last_error = "Empty response from API"
                        continue
                
                # Handle specific errors
                if response.status_code == 401:
                    return False, "Invalid API key"
                
                if response.status_code == 429:
                    return False, "Rate limit exceeded. Please try again in a minute."
                
                # Try to extract error message from response
                try:
                    error_data = response.json()
                    error_msg = error_data.get("error", {}).get("message", "")
                    if "model" in error_msg.lower():
                        # Model not found, try next
                        logger.warning(f"Model {model} not available: {error_msg}")
                        last_error = error_msg
                        continue
                    last_error = error_msg or f"HTTP {response.status_code}"
                except:
                    last_error = f"HTTP {response.status_code}: {response.text[:200]}"
                
                logger.warning(f"Groq API error with {model}: {last_error}")
                
        except httpx.TimeoutException:
            last_error = "Request timeout"
            logger.warning(f"Timeout with model {model}")
            continue
        except Exception as e:
            last_error = str(e)
            logger.error(f"Error with model {model}: {e}")
            continue
    
    return False, last_error or "All models failed"


@router.post("/write-email", response_model=EmailWriteResponse)
async def write_email(request: Request, body: EmailWriteRequest):
    """
    Generate a polished, spam-free email from raw thoughts.
    
    - **thoughts**: What you want to communicate (required, min 10 chars)
    - **tone**: professional, warm, concise, formal, casual, or persuasive
    - **context**: Optional email you're replying to
    
    Rate limited to 10 requests per day per IP. FREE service.
    """
    
    # Get client IP
    ip = request.client.host if request.client else "unknown"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        ip = forwarded.split(",")[0].strip()
    
    # Check rate limit
    allowed, remaining = _check_rate_limit(ip)
    if not allowed:
        return EmailWriteResponse(
            success=False,
            error="Daily limit reached (10 emails/day). Try again tomorrow!",
            remaining_requests=0
        )
    
    # Check API key
    if not settings.GROQ_API_KEY:
        logger.error("GROQ_API_KEY not configured in environment")
        return EmailWriteResponse(
            success=False,
            error="AI service temporarily unavailable.",
            remaining_requests=remaining
        )
    
    # Build the prompt
    context_part = ""
    if body.context and body.context.strip():
        context_part = f"\n\nI am responding to this email:\n\"\"\"\n{body.context.strip()}\n\"\"\"\n"
    
    system_prompt = """You are an expert email copywriter who writes HIGH-DELIVERABILITY emails that NEVER trigger spam filters.

CRITICAL RULES - NEVER USE THESE WORDS:
- FREE, free, complimentary, no cost, zero cost
- URGENT, immediately, act now, limited time, expires
- Click here, click below, click now
- Guaranteed, promise, 100%
- Winner, congratulations, selected
- Opportunity, exclusive, special offer
- Deal, discount, bonus, credit
- Money, cash, earnings, profit

WRITING STYLE:
- Sound 100% natural and human
- Use conversational language
- Keep sentences varied in length
- Use proper paragraphs (2-4 sentences each)
- Be genuine and trustworthy
- Match the requested tone exactly

OUTPUT: Only the email body. No subject line. No explanations. No markdown formatting."""

    user_prompt = f"""Write a {body.tone} email from these thoughts:

"{body.thoughts}"{context_part}

MANDATORY:
1. Tone: {body.tone}
2. NO spam trigger words (especially: free, urgent, opportunity, guaranteed, click here)
3. Sound like a real person wrote it
4. Just the email body, nothing else"""

    # Call Groq API
    success, result = await _call_groq_api(user_prompt, system_prompt)
    
    if success:
        _record_request(ip)
        return EmailWriteResponse(
            success=True,
            email=result,
            remaining_requests=remaining - 1
        )
    else:
        logger.error(f"AI generation failed: {result}")
        return EmailWriteResponse(
            success=False,
            error=f"Could not generate email: {result}",
            remaining_requests=remaining
        )


@router.get("/health")
async def ai_health():
    """Check if AI service is configured and basic health."""
    has_key = bool(settings.GROQ_API_KEY)
    key_preview = settings.GROQ_API_KEY[:10] + "..." if has_key else "NOT SET"
    
    return {
        "status": "ok" if has_key else "error",
        "api_key_configured": has_key,
        "api_key_preview": key_preview,
        "models_configured": GROQ_MODELS
    }
