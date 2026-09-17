from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models.user import User
from app.core import deps
from app.services.admin_service import admin_service
from app.schemas.admin import (
    AdminPlatformStats,
    AdminUserItem,
    AdminUserDetail,
    AIUsageSummary,
    BackgroundJobItem,
    SystemHealthResponse,
)

router = APIRouter(prefix="/admin", tags=["Admin & Observability"])


@router.get("/stats", response_model=AdminPlatformStats)
async def get_admin_stats(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Platform-level aggregate metrics for the admin dashboard."""
    return await admin_service.get_platform_stats(db)


@router.get("/users", response_model=List[AdminUserItem])
async def list_admin_users(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all registered users, their roles, and total spaces/projects."""
    return await admin_service.get_users_list(db)


@router.get("/users/{user_id}", response_model=AdminUserDetail)
async def get_admin_user_detail(
    user_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Drill-down view of a specific user's spaces, projects, and learning events."""
    detail = await admin_service.get_user_detail(db, user_id)
    if not detail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return detail


@router.get("/ai-usage", response_model=AIUsageSummary)
async def get_admin_ai_usage(
    feature: Optional[str] = Query(None, description="Filter by feature (tutor_chat, grading, etc.)"),
    provider: Optional[str] = Query(None, description="Filter by provider (groq, gemini, etc.)"),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Queryable AI observability logs and aggregated token/cost/latency metrics."""
    return await admin_service.get_ai_usage(db, feature=feature, provider=provider, limit=limit)


@router.get("/jobs", response_model=List[BackgroundJobItem])
async def list_admin_jobs(
    status: Optional[str] = Query(None, description="Filter by job status (queued, processing, ready, failed)"),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List background ingestion and processing jobs."""
    return await admin_service.get_jobs(db, status=status, limit=limit)


@router.post("/jobs/{job_id}/retry", response_model=BackgroundJobItem)
async def retry_admin_job(
    job_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually retry a failed background job."""
    retried = await admin_service.retry_job(db, job_id)
    if not retried:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return retried


@router.get("/system-health", response_model=SystemHealthResponse)
async def get_system_health(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Live system health checks: PostgreSQL ping, pgvector status, and Redis connection."""
    return await admin_service.check_system_health(db)
