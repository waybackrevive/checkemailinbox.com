"""
Report route — returns the full analysis report.

GET /api/report/{id} → Full report JSON for the frontend to render
"""

from fastapi import APIRouter, HTTPException

from backend.models.schemas import EmailReport
from backend.storage.redis_client import get_report

router = APIRouter(prefix="/api/report", tags=["report"])


@router.get("/{test_id}", response_model=EmailReport)
async def get_email_report(test_id: str):
    """
    Get the full email health report for a test.
    This is the JSON the frontend Report Dashboard page renders.
    """
    report_data = get_report(test_id)

    if report_data is None:
        raise HTTPException(
            status_code=404,
            detail="Report not found. The test may have expired or the email hasn't been analyzed yet.",
        )

    return EmailReport(**report_data)
