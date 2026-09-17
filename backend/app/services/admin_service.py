import time
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, text
from sqlalchemy.orm import selectinload

from app.db.models.user import User
from app.db.models.space import Space
from app.db.models.project import Project
from app.db.models.material import Document, Chunk
from app.db.models.assessment import QuizAttempt
from app.db.models.event import LearningEvent
from app.db.models.ai_usage import AIRequestLog
from app.db.models.job import BackgroundJob
from app.schemas.admin import (
    AdminPlatformStats,
    AdminUserItem,
    AdminUserDetail,
    AIUsageLogItem,
    AIUsageSummary,
    BackgroundJobItem,
    SystemHealthResponse,
)
from app.core.config import settings


class AdminService:
    @staticmethod
    async def get_platform_stats(db: AsyncSession) -> AdminPlatformStats:
        user_cnt = (await db.execute(select(func.count(User.id)))).scalar() or 0
        space_cnt = (await db.execute(select(func.count(Space.id)))).scalar() or 0
        proj_cnt = (await db.execute(select(func.count(Project.id)))).scalar() or 0
        doc_cnt = (await db.execute(select(func.count(Document.id)))).scalar() or 0
        chunk_cnt = (await db.execute(select(func.count(Chunk.id)))).scalar() or 0
        quiz_cnt = (await db.execute(select(func.count(QuizAttempt.id)))).scalar() or 0
        event_cnt = (await db.execute(select(func.count(LearningEvent.id)))).scalar() or 0
        ai_cnt = (await db.execute(select(func.count(AIRequestLog.id)))).scalar() or 0

        return AdminPlatformStats(
            total_users=user_cnt,
            total_spaces=space_cnt,
            total_projects=proj_cnt,
            total_documents=doc_cnt,
            total_chunks=chunk_cnt,
            total_quizzes_taken=quiz_cnt,
            total_events=event_cnt,
            total_ai_requests=ai_cnt,
        )

    @staticmethod
    async def get_users_list(db: AsyncSession) -> List[AdminUserItem]:
        res = await db.execute(
            select(User)
            .options(selectinload(User.spaces).selectinload(Space.projects))
            .order_by(User.created_at.desc())
        )
        users = res.scalars().all()

        items = []
        for u in users:
            spaces = u.spaces or []
            total_projects = sum(len(s.projects or []) for s in spaces)
            items.append(
                AdminUserItem(
                    id=u.id,
                    email=u.email,
                    full_name=u.full_name,
                    role=u.role,
                    created_at=u.created_at,
                    spaces_count=len(spaces),
                    projects_count=total_projects,
                )
            )
        return items

    @staticmethod
    async def get_user_detail(db: AsyncSession, user_id: str) -> Optional[AdminUserDetail]:
        res = await db.execute(
            select(User)
            .where(User.id == user_id)
            .options(selectinload(User.spaces).selectinload(Space.projects))
        )
        u = res.scalar_one_or_none()
        if not u:
            return None

        spaces_data = []
        for s in u.spaces or []:
            spaces_data.append({
                "id": s.id,
                "name": s.name,
                "description": s.description,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "projects": [
                    {
                        "id": p.id,
                        "name": p.name,
                        "goal": p.goal,
                        "created_at": p.created_at.isoformat() if p.created_at else None,
                    }
                    for p in (s.projects or [])
                ]
            })

        # Recent learning events
        ev_res = await db.execute(
            select(LearningEvent)
            .where(LearningEvent.user_id == user_id)
            .order_by(LearningEvent.created_at.desc())
            .limit(20)
        )
        recent_events = [
            {
                "id": ev.id,
                "type": ev.type,
                "project_id": ev.project_id,
                "payload": ev.payload,
                "created_at": ev.created_at.isoformat() if ev.created_at else None,
            }
            for ev in ev_res.scalars().all()
        ]

        # Total AI requests for user
        ai_cnt = (
            await db.execute(
                select(func.count(AIRequestLog.id)).where(AIRequestLog.user_id == user_id)
            )
        ).scalar() or 0

        user_item = AdminUserItem(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=u.role,
            created_at=u.created_at,
            spaces_count=len(u.spaces or []),
            projects_count=sum(len(s.projects or []) for s in (u.spaces or [])),
        )

        return AdminUserDetail(
            user=user_item,
            spaces=spaces_data,
            recent_events=recent_events,
            total_ai_requests=ai_cnt,
        )

    @staticmethod
    async def get_ai_usage(
        db: AsyncSession,
        feature: Optional[str] = None,
        provider: Optional[str] = None,
        limit: int = 50,
    ) -> AIUsageSummary:
        # Aggregated stats
        total_reqs = (await db.execute(select(func.count(AIRequestLog.id)))).scalar() or 0
        avg_lat = (await db.execute(select(func.avg(AIRequestLog.latency_ms)))).scalar() or 0.0
        success_cnt = (
            await db.execute(
                select(func.count(AIRequestLog.id)).where(AIRequestLog.success == True)
            )
        ).scalar() or 0
        total_in_tokens = (await db.execute(select(func.sum(AIRequestLog.input_tokens)))).scalar() or 0
        total_out_tokens = (await db.execute(select(func.sum(AIRequestLog.output_tokens)))).scalar() or 0
        total_cost = (await db.execute(select(func.sum(AIRequestLog.cost_usd)))).scalar() or 0.0

        success_rate = round((success_cnt / total_reqs * 100.0), 1) if total_reqs > 0 else 100.0

        # Group by feature
        f_res = await db.execute(
            select(AIRequestLog.feature, func.count(AIRequestLog.id)).group_by(AIRequestLog.feature)
        )
        by_feature = {row[0]: row[1] for row in f_res.all()}

        # Group by provider
        p_res = await db.execute(
            select(AIRequestLog.provider, func.count(AIRequestLog.id)).group_by(AIRequestLog.provider)
        )
        by_provider = {row[0]: row[1] for row in p_res.all()}

        # Group by model
        m_res = await db.execute(
            select(AIRequestLog.model, func.count(AIRequestLog.id)).group_by(AIRequestLog.model)
        )
        by_model = {row[0]: row[1] for row in m_res.all()}

        # Filtered recent logs
        query = select(AIRequestLog)
        if feature:
            query = query.where(AIRequestLog.feature == feature)
        if provider:
            query = query.where(AIRequestLog.provider == provider)

        query = query.order_by(AIRequestLog.created_at.desc()).limit(limit)
        logs_res = await db.execute(query)
        logs = logs_res.scalars().all()

        recent_logs = [
            AIUsageLogItem(
                id=log.id,
                user_id=log.user_id,
                project_id=log.project_id,
                feature=log.feature,
                provider=log.provider,
                model=log.model,
                latency_ms=log.latency_ms,
                input_tokens=log.input_tokens,
                output_tokens=log.output_tokens,
                cost_usd=log.cost_usd,
                success=log.success,
                error_message=log.error_message,
                created_at=log.created_at,
            )
            for log in logs
        ]

        return AIUsageSummary(
            total_requests=total_reqs,
            avg_latency_ms=round(float(avg_lat), 1),
            success_rate=success_rate,
            total_input_tokens=int(total_in_tokens),
            total_output_tokens=int(total_out_tokens),
            total_cost_usd=round(float(total_cost), 4),
            by_feature=by_feature,
            by_provider=by_provider,
            by_model=by_model,
            recent_logs=recent_logs,
        )

    @staticmethod
    async def get_jobs(
        db: AsyncSession,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> List[BackgroundJobItem]:
        query = select(BackgroundJob)
        if status:
            query = query.where(BackgroundJob.status == status)
        query = query.order_by(BackgroundJob.created_at.desc()).limit(limit)
        res = await db.execute(query)
        jobs = res.scalars().all()

        return [
            BackgroundJobItem(
                id=j.id,
                job_id=j.job_id,
                type=j.type,
                status=j.status,
                attempts=j.attempts,
                last_error=j.last_error,
                payload=j.payload,
                created_at=j.created_at,
                updated_at=j.updated_at,
            )
            for j in jobs
        ]

    @staticmethod
    async def retry_job(db: AsyncSession, job_id: str) -> Optional[BackgroundJobItem]:
        res = await db.execute(
            select(BackgroundJob).where((BackgroundJob.id == job_id) | (BackgroundJob.job_id == job_id))
        )
        job = res.scalar_one_or_none()
        if not job:
            return None

        job.status = "queued"
        job.attempts = 0
        job.last_error = None
        job.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(job)

        return BackgroundJobItem(
            id=job.id,
            job_id=job.job_id,
            type=job.type,
            status=job.status,
            attempts=job.attempts,
            last_error=job.last_error,
            payload=job.payload,
            created_at=job.created_at,
            updated_at=job.updated_at,
        )

    @staticmethod
    async def check_system_health(db: AsyncSession) -> SystemHealthResponse:
        # 1. Check PostgreSQL database latency
        db_healthy = False
        db_lat = 0.0
        try:
            t0 = time.time()
            await db.execute(text("SELECT 1;"))
            db_lat = round((time.time() - t0) * 1000, 2)
            db_healthy = True
        except Exception as e:
            print(f"Database health check error: {e}")

        # 2. Check pgvector extension
        pgvector_ok = False
        try:
            v_res = await db.execute(text("SELECT count(*) FROM pg_extension WHERE extname = 'vector';"))
            v_count = v_res.scalar() or 0
            pgvector_ok = bool(v_count > 0)
        except Exception as e:
            print(f"pgvector check error: {e}")

        # 3. Check Redis connection
        redis_healthy = False
        redis_lat = 0.0
        try:
            if settings.REDIS_URL:
                t0 = time.time()
                import redis.asyncio as aioredis
                r = aioredis.from_url(settings.REDIS_URL)
                await r.ping()
                redis_lat = round((time.time() - t0) * 1000, 2)
                redis_healthy = True
                await r.aclose()
        except Exception as e:
            print(f"Redis health check note: {e}")

        overall_status = "healthy" if (db_healthy and pgvector_ok) else "degraded"

        return SystemHealthResponse(
            status=overall_status,
            database_healthy=db_healthy,
            database_latency_ms=db_lat,
            pgvector_installed=pgvector_ok,
            redis_healthy=redis_healthy,
            redis_latency_ms=redis_lat,
            timestamp=datetime.now(timezone.utc),
        )


admin_service = AdminService()
