"""
IsMyEmailSpam.com — Backend API

FastAPI application entry point.
Combines all routes and middleware.
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from api.routes import test, webhook, report, ai, contact
from storage.redis_client import get_redis

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

# Create FastAPI app
app = FastAPI(
    title="CheckEmailDelivery API",
    description="Email deliverability diagnostic tool API",
    version="1.0.0",
    docs_url="/docs",       # Auto-generated API docs at /docs
    redoc_url="/redoc",
)

# CORS — allow frontend to call backend
# Support multiple origins from comma-separated FRONTEND_URL env var
allowed_origins = [
    origin.strip() 
    for origin in settings.FRONTEND_URL.split(",")
    if origin.strip()
]
# Always allow localhost for local dev
if "http://localhost:3000" not in allowed_origins:
    allowed_origins.append("http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(test.router)
app.include_router(webhook.router)
app.include_router(report.router)
app.include_router(ai.router)
app.include_router(contact.router)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "service": "CheckEmailDelivery API",
        "status": "healthy",
        "version": "1.0.0",
    }


@app.get("/health")
async def health():
    """Health check for Docker/Render. Also pings Redis to keep Upstash free tier active."""
    redis_ok = False
    try:
        r = get_redis()
        r.set("_health_ping", "1", ex=60)  # ping with 60s TTL, no junk left behind
        redis_ok = True
    except Exception:
        pass  # Redis down shouldn't kill the health check response
    return {"status": "ok", "redis": "ok" if redis_ok else "error"}
