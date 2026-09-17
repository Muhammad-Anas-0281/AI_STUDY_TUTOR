from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.db.models.concept import Concept
from app.db.models.mastery import Mastery
from app.db.models.assessment import QuizAttempt
from app.db.models.event import LearningEvent
from app.db.models.project import Project
from app.db.models.space import Space
from app.db.models.material import Document
from app.schemas.growth import (
    ProjectGrowthMetrics,
    ConceptGrowthItem,
    QuizTrendPoint,
    WeakConceptAlert,
    GlobalAnalyticsSummary,
)


class GrowthService:
    @staticmethod
    async def compute_project_growth(
        db: AsyncSession,
        project_id: str,
    ) -> ProjectGrowthMetrics:
        """Computes comprehensive learning growth metrics for a project."""
        project = await db.get(Project, project_id)
        project_name = project.name if project else "Project"

        # 1. Fetch all concepts with mastery
        c_stmt = (
            select(Concept)
            .where(Concept.project_id == project_id)
            .options(selectinload(Concept.mastery))
            .order_by(Concept.name.asc())
        )
        c_res = await db.execute(c_stmt)
        concepts = c_res.scalars().all()

        concept_items: List[ConceptGrowthItem] = []
        improving_count = 0
        stable_count = 0
        needs_attention_count = 0
        total_score_sum = 0.0
        weak_alerts: List[WeakConceptAlert] = []

        for c in concepts:
            score = c.mastery.score if c.mastery else 0.0
            evidence = c.mastery.evidence_count if c.mastery else 0
            status_val = c.mastery.status if c.mastery else "needs_attention"
            updated = c.mastery.updated_at if c.mastery else None

            total_score_sum += score

            if status_val == "improving" or score >= 75.0:
                improving_count += 1
            elif status_val == "stable" or score >= 50.0:
                stable_count += 1
            else:
                needs_attention_count += 1
                weak_alerts.append(
                    WeakConceptAlert(
                        concept_id=c.id,
                        concept_name=c.name,
                        current_score=score,
                        reason=f"Current mastery is at {score:.0f}% with {evidence} assessment evaluations.",
                    )
                )

            concept_items.append(
                ConceptGrowthItem(
                    id=c.id,
                    name=c.name,
                    description=c.description,
                    score=score,
                    evidence_count=evidence,
                    status=status_val,
                    updated_at=updated,
                )
            )

        avg_mastery = round(total_score_sum / len(concepts), 1) if concepts else 0.0

        # 2. Fetch completed quiz attempts for trendline
        q_stmt = (
            select(QuizAttempt)
            .where(QuizAttempt.project_id == project_id, QuizAttempt.status == "completed")
            .order_by(QuizAttempt.started_at.asc())
        )
        q_res = await db.execute(q_stmt)
        quizzes = q_res.scalars().all()

        quiz_trends: List[QuizTrendPoint] = []
        total_quiz_score_sum = 0.0
        for q in quizzes:
            score = q.score or 0.0
            total_quiz_score_sum += score
            quiz_trends.append(
                QuizTrendPoint(
                    attempt_id=q.id,
                    date=q.started_at.strftime("%b %d, %H:%M"),
                    score=score,
                    total_questions=q.total_questions,
                )
            )

        recent_quiz_avg = (
            round(total_quiz_score_sum / len(quizzes), 1) if quizzes else 0.0
        )

        # 3. Fetch activity count
        e_stmt = select(func.count(LearningEvent.id)).where(LearningEvent.project_id == project_id)
        e_count = (await db.execute(e_stmt)).scalar() or 0

        return ProjectGrowthMetrics(
            project_id=project_id,
            project_name=project_name,
            average_mastery=avg_mastery,
            total_concepts=len(concepts),
            improving_count=improving_count,
            stable_count=stable_count,
            needs_attention_count=needs_attention_count,
            total_quizzes_taken=len(quizzes),
            recent_quiz_average=recent_quiz_avg,
            concepts=concept_items,
            quiz_trend=quiz_trends,
            weak_concept_alerts=weak_alerts,
            activity_count=e_count,
        )

    @staticmethod
    async def compute_global_analytics(
        db: AsyncSession,
        user_id: str
    ) -> GlobalAnalyticsSummary:
        """Computes global analytics across all spaces and projects for the user."""
        # Counts
        spaces_count = (await db.execute(select(func.count(Space.id)).where(Space.user_id == user_id))).scalar() or 0

        proj_stmt = select(Project).join(Space, Project.space_id == Space.id).where(Space.user_id == user_id)
        user_projects = (await db.execute(proj_stmt)).scalars().all()
        project_ids = [p.id for p in user_projects]

        if not project_ids:
            return GlobalAnalyticsSummary(
                total_spaces=spaces_count,
                total_projects=0,
                total_documents=0,
                total_concepts=0,
                total_quizzes_completed=0,
                global_average_mastery=0.0,
                learning_events_count=0,
                recent_activity=[],
            )

        docs_count = (
            await db.execute(select(func.count(Document.id)).where(Document.project_id.in_(project_ids)))
        ).scalar() or 0

        concepts_count = (
            await db.execute(select(func.count(Concept.id)).where(Concept.project_id.in_(project_ids)))
        ).scalar() or 0

        quizzes_count = (
            await db.execute(
                select(func.count(QuizAttempt.id)).where(
                    QuizAttempt.project_id.in_(project_ids),
                    QuizAttempt.status == "completed"
                )
            )
        ).scalar() or 0

        # Global average mastery
        m_stmt = select(func.avg(Mastery.score)).where(Mastery.project_id.in_(project_ids))
        global_avg_m = (await db.execute(m_stmt)).scalar() or 0.0

        # Events count and recent activity
        events_count = (
            await db.execute(select(func.count(LearningEvent.id)).where(LearningEvent.user_id == user_id))
        ).scalar() or 0

        recent_ev_stmt = (
            select(LearningEvent)
            .where(LearningEvent.user_id == user_id)
            .order_by(LearningEvent.created_at.desc())
            .limit(10)
        )
        recent_evs = (await db.execute(recent_ev_stmt)).scalars().all()
        recent_activity_data = [
            {
                "id": ev.id,
                "type": ev.type,
                "project_id": ev.project_id,
                "payload": ev.payload,
                "created_at": ev.created_at.isoformat(),
            }
            for ev in recent_evs
        ]

        return GlobalAnalyticsSummary(
            total_spaces=spaces_count,
            total_projects=len(user_projects),
            total_documents=docs_count,
            total_concepts=concepts_count,
            total_quizzes_completed=quizzes_count,
            global_average_mastery=round(float(global_avg_m), 1),
            learning_events_count=events_count,
            recent_activity=recent_activity_data,
        )


growth_service = GrowthService()
