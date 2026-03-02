"""
Test routes — create test sessions and check status.

POST /api/test/create → Generate a unique test email
GET  /api/test/{id}/status → Check if email has arrived
"""

from datetime import datetime

from fastapi import APIRouter, Request, HTTPException

from backend.models.schemas import CreateTestResponse, TestStatusResponse, TestStatus
from backend.services.email_generator import generate_test_id, create_test_session
from backend.storage.redis_client import (
    save_test_session,
    get_test_session,
    check_rate_limit,
    increment_rate_limit,
)

router = APIRouter(prefix="/api/test", tags=["test"])


@router.post("/create", response_model=CreateTestResponse)
async def create_test(request: Request):
    """
    Generate a unique test email address for the visitor.
    Rate limited to 3 tests per day per IP.
    """
    # Get client IP
    client_ip = request.client.host if request.client else "unknown"
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()

    # Rate limit check
    if not check_rate_limit(client_ip):
        raise HTTPException(
            status_code=429,
            detail="You've reached the limit of 3 tests per day. Come back tomorrow!",
        )

    # Generate test session
    test_id = generate_test_id()
    session_data = create_test_session(test_id)

    # Save to Redis with 1 hour TTL
    save_test_session(test_id, session_data)

    # Increment rate limit counter
    increment_rate_limit(client_ip)

    return CreateTestResponse(
        id=test_id,
        email=session_data["email"],
        expires_at=datetime.fromisoformat(session_data["expires_at"]),
    )


@router.get("/{test_id}/status", response_model=TestStatusResponse)
async def get_test_status(test_id: str):
    """
    Check the status of a test session.
    Polled by the frontend every 5 seconds on the waiting screen.
    """
    session = get_test_session(test_id)

    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Test session not found or expired. Please create a new test.",
        )

    return TestStatusResponse(
        id=test_id,
        status=TestStatus(session.get("status", "waiting")),
        email=session.get("email", ""),
    )
