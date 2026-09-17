from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models.user import User
from app.core import deps
from app.services.growth_service import growth_service
from app.services.recommendation_service import recommendation_service
from app.services.event_service import event_service
from app.schemas.growth import ProjectGrowthMetrics, GlobalAnalyticsSummary
from app.schemas.recommendation import (
    RecommendationResponse,
    RecommendationStatusUpdate,
)
from app.schemas.event import LearningEventResponse

router = APIRouter(tags=["Growth, Recommendations & Analytics"])


# --- Growth & Trend Endpoints ---

@router.get("/projects/{project_id}/growth", response_model=ProjectGrowthMetrics)
async def get_project_growth(
    project_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get project learning growth trends, concept mastery distributions, and weak concept alerts."""
    await deps.get_project_or_403(project_id, current_user.id, db)
    return await growth_service.compute_project_growth(db=db, project_id=project_id)


# --- Recommendations Endpoints ---

@router.get("/projects/{project_id}/recommendations", response_model=List[RecommendationResponse])
async def get_project_recommendations(
    project_id: str,
    status: Optional[str] = None,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch all study recommendations for this project."""
    await deps.get_project_or_403(project_id, current_user.id, db)
    return await recommendation_service.get_project_recommendations(
        db=db, project_id=project_id, status=status
    )


@router.post("/projects/{project_id}/recommendations/generate", response_model=List[RecommendationResponse])
async def generate_project_recommendations(
    project_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate new AI study recommendations grounded in weak concepts, mistakes, and project goals."""
    await deps.get_project_or_403(project_id, current_user.id, db)
    try:
        return await recommendation_service.generate_recommendations(
            db=db, project_id=project_id, user_id=current_user.id
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate study recommendations: {str(e)}"
        )


@router.patch("/projects/{project_id}/recommendations/{rec_id}/status", response_model=RecommendationResponse)
async def update_recommendation_status(
    project_id: str,
    rec_id: str,
    payload: RecommendationStatusUpdate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update recommendation status (pending -> completed / dismissed)."""
    await deps.get_project_or_403(project_id, current_user.id, db)
    try:
        return await recommendation_service.update_recommendation_status(
            db=db,
            recommendation_id=rec_id,
            project_id=project_id,
            user_id=current_user.id,
            status=payload.status,
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))


# --- Learning Events Endpoints ---

@router.get("/projects/{project_id}/events", response_model=List[LearningEventResponse])
async def get_project_events(
    project_id: str,
    limit: int = 30,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get chronological activity and learning event stream for a project."""
    await deps.get_project_or_403(project_id, current_user.id, db)
    return await event_service.get_project_events(db=db, project_id=project_id, limit=limit)


# --- Global Analytics & Activity Stream ---

@router.get("/analytics/summary", response_model=GlobalAnalyticsSummary)
async def get_global_analytics(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get global learning analytics across all spaces and projects for the current user."""
    return await growth_service.compute_global_analytics(db=db, user_id=current_user.id)


@router.get("/events/recent", response_model=List[LearningEventResponse])
async def get_recent_user_events(
    limit: int = 50,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get recent activity stream across all projects for current user."""
    return await event_service.get_user_recent_events(db=db, user_id=current_user.id, limit=limit)
