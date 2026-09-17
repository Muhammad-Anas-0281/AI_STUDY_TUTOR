import uuid
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.db.models.event import LearningEvent


class EventService:
    @staticmethod
    async def log_event(
        db: AsyncSession,
        user_id: str,
        event_type: str,
        project_id: Optional[str] = None,
        payload: Optional[Dict[str, Any]] = None,
        idempotency_key: Optional[str] = None,
    ) -> Optional[LearningEvent]:
        """Logs a learning event with optional idempotency deduplication."""
        if idempotency_key:
            stmt = select(LearningEvent).where(LearningEvent.idempotency_key == idempotency_key)
            existing = (await db.execute(stmt)).scalar_one_or_none()
            if existing:
                return existing

        event = LearningEvent(
            id=str(uuid.uuid4()),
            user_id=user_id,
            project_id=project_id,
            type=event_type,
            payload=payload or {},
            idempotency_key=idempotency_key,
            created_at=datetime.now(timezone.utc),
        )
        db.add(event)
        try:
            await db.commit()
            await db.refresh(event)
            return event
        except Exception as e:
            await db.rollback()
            print(f"Warning: Error logging event {event_type}: {e}")
            return None

    @staticmethod
    async def get_project_events(
        db: AsyncSession,
        project_id: str,
        limit: int = 30
    ) -> List[LearningEvent]:
        """Fetch chronological learning events for a specific project."""
        stmt = (
            select(LearningEvent)
            .where(LearningEvent.project_id == project_id)
            .order_by(LearningEvent.created_at.desc())
            .limit(limit)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_user_recent_events(
        db: AsyncSession,
        user_id: str,
        limit: int = 50
    ) -> List[LearningEvent]:
        """Fetch recent learning events across all projects for a user."""
        stmt = (
            select(LearningEvent)
            .where(LearningEvent.user_id == user_id)
            .order_by(LearningEvent.created_at.desc())
            .limit(limit)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())


event_service = EventService()
