"""
IsMyEmailSpam.com — Backend API

FastAPI application entry point.
Combines all routes and middleware.
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.api.routes import test, webhook, report

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

# Create FastAPI app
app = FastAPI(
    title="IsMyEmailSpam API",
    description="Email deliverability diagnostic tool API",
    version="1.0.0",
    docs_url="/docs",       # Auto-generated API docs at /docs
    redoc_url="/redoc",
)

# CORS — allow frontend to call backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",     # Local dev
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(test.router)
app.include_router(webhook.router)
app.include_router(report.router)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "service": "IsMyEmailSpam API",
        "status": "healthy",
        "version": "1.0.0",
    }


@app.get("/health")
async def health():
    """Health check for Docker/Railway."""
    return {"status": "ok"}
