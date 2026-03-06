"""
AI Email Writer API Route

Transforms raw thoughts into polished, spam-free emails using AI.
Server-side API key - no user authentication required.
"""

import logging
from typing import Literal
from datetime import datetime

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field
import httpx

from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Email Writer"])

# Simple in-memory rate limiting (for production, use Redis)
_rate_limits: dict[str, list[datetime]] = {}


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
    
    # Clean old entries
    if rate_key not in _rate_limits:
        _rate_limits[rate_key] = []
    
    # Remove old entries (older than 24h)
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


@router.post("/write-email", response_model=EmailWriteResponse)
async def write_email(request: Request, body: EmailWriteRequest):
    """
    Generate a polished, spam-free email from raw thoughts.
    
    - **thoughts**: What you want to communicate (required)
    - **tone**: professional, warm, concise, formal, casual, or persuasive
    - **context**: Optional email you're replying to
    
    Rate limited to 10 requests per day per IP.
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
    
    # Check if API key is configured
    if not settings.GROQ_API_KEY:
        logger.error("GROQ_API_KEY not configured")
        return EmailWriteResponse(
            success=False,
            error="AI service temporarily unavailable. Please try again later.",
            remaining_requests=remaining
        )
    
    # Build the prompt
    context_part = ""
    if body.context and body.context.strip():
        context_part = f"\n\nContext - I am responding to this email:\n\"{body.context.strip()}\"\n"
    
    prompt = f"""You are an expert email writer who specializes in writing emails that avoid spam filters. Transform the following raw thoughts into a well-crafted email with a {body.tone} tone.

Raw thoughts: "{body.thoughts}"{context_part}

IMPORTANT GUIDELINES:
- Write a complete, professional email body
- Use a {body.tone} tone throughout
- Make it clear, engaging, and well-structured
- Ensure proper email etiquette
- AVOID spam trigger words like: FREE, URGENT, ACT NOW, CLICK HERE, LIMITED TIME, GUARANTEED, etc.
- Use natural, conversational language
- Don't use ALL CAPS for emphasis
- Don't make unrealistic promises
- Keep it genuine and trustworthy

Do NOT include a subject line. Respond with ONLY the email body content. No explanations or additional text."""

    try:
        # Call Groq API (FREE tier - OpenAI-compatible format)
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama3-70b-8192",  # FREE & high quality (confirmed model name)
                    "messages": [
                        {"role": "system", "content": "You are an expert email writer who creates spam-free, professional emails. You write naturally and avoid spam trigger words."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 1000
                }
            )
            
            if response.status_code != 200:
                error_detail = response.text[:500] if response.text else "No details"
                logger.error(f"Groq API error: {response.status_code} - {error_detail}")
                # Return more specific error for debugging
                if response.status_code == 401:
                    return EmailWriteResponse(
                        success=False,
                        error="API key invalid. Please check configuration.",
                        remaining_requests=remaining
                    )
                elif response.status_code == 429:
                    return EmailWriteResponse(
                        success=False,
                        error="Rate limit exceeded. Please try again in a minute.",
                        remaining_requests=remaining
                    )
                return EmailWriteResponse(
                    success=False,
                    error=f"AI service error ({response.status_code}). Please try again.",
                    remaining_requests=remaining
                )
            
            data = response.json()
            generated_email = data["choices"][0]["message"]["content"].strip()
            
            # Record successful request
            _record_request(ip)
            new_remaining = remaining - 1
            
            return EmailWriteResponse(
                success=True,
                email=generated_email,
                remaining_requests=new_remaining
            )
            
    except httpx.TimeoutException:
        logger.error("Groq API timeout")
        return EmailWriteResponse(
            success=False,
            error="Request timed out. Please try again.",
            remaining_requests=remaining
        )
    except Exception as e:
        logger.error(f"Error generating email: {str(e)}")
        return EmailWriteResponse(
            success=False,
            error="Unable to generate email. Please try again.",
            remaining_requests=remaining
        )
