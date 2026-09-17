import uuid
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone

from app.db.models.recommendation import Recommendation
from app.db.models.concept import Concept
from app.db.models.mastery import Mastery
from app.db.models.project import Project
from app.db.models.assessment import QuizAttempt, Question, Answer
from app.ai.providers.gemini_provider import gemini_provider
from app.ai.providers.groq_provider import groq_provider
from app.ai.prompts.recommendation_prompt import build_recommendation_prompt
from app.schemas.recommendation import GeneratedRecommendationsList
from app.services.event_service import event_service


class RecommendationService:
    @staticmethod
    async def get_project_recommendations(
        db: AsyncSession,
        project_id: str,
        status: Optional[str] = None
    ) -> List[Recommendation]:
        """Fetch recommendations for a project, optionally filtered by status."""
        stmt = select(Recommendation).where(Recommendation.project_id == project_id)
        if status:
            stmt = stmt.where(Recommendation.status == status)
        stmt = stmt.order_by(Recommendation.created_at.desc())
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def generate_recommendations(
        db: AsyncSession,
        project_id: str,
        user_id: str
    ) -> List[Recommendation]:
        """Analyzes weak concepts, recent mistakes, and goals to generate AI recommendations."""
        project = await db.get(Project, project_id)
        project_name = project.name if project else "Study Project"
        project_goal = project.goal or "Master all key concepts"

        # 1. Gather weak concepts (score < 75 or status == 'needs_attention')
        concept_stmt = (
            select(Concept)
            .where(Concept.project_id == project_id)
            .options(selectinload(Concept.mastery))
        )
        c_res = await db.execute(concept_stmt)
        concepts = c_res.scalars().all()

        weak_concepts = []
        for c in concepts:
            score = c.mastery.score if c.mastery else 0.0
            evidence_count = c.mastery.evidence_count if c.mastery else 0
            status_val = c.mastery.status if c.mastery else "needs_attention"
            if score < 75.0 or status_val == "needs_attention":
                weak_concepts.append({
                    "id": c.id,
                    "name": c.name,
                    "score": score,
                    "evidence_count": evidence_count,
                    "status": status_val,
                })

        # 2. Gather recent incorrect answers from quiz attempts
        ans_stmt = (
            select(Answer)
            .join(Question, Answer.question_id == Question.id)
            .join(QuizAttempt, Question.attempt_id == QuizAttempt.id)
            .where(QuizAttempt.project_id == project_id, Answer.is_correct == False)
            .options(selectinload(Answer.question))
            .order_by(Answer.evaluated_at.desc())
            .limit(6)
        )
        ans_res = await db.execute(ans_stmt)
        recent_wrong_answers = ans_res.scalars().all()

        recent_mistakes = []
        for a in recent_wrong_answers:
            if a.question:
                recent_mistakes.append({
                    "prompt": a.question.prompt,
                    "user_response": a.user_response,
                    "missing": a.feedback.get("missing", "") if isinstance(a.feedback, dict) else "",
                })

        # 3. Build Prompt and call LLM
        system_prompt, user_prompt = build_recommendation_prompt(
            project_name=project_name,
            project_goal=project_goal,
            weak_concepts=weak_concepts,
            recent_mistakes=recent_mistakes,
        )

        gen_recs: Optional[GeneratedRecommendationsList] = None
        try:
            gen_recs = await gemini_provider.generate_structured(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                response_schema=GeneratedRecommendationsList,
                temperature=0.3,
            )
        except Exception as e:
            print(f"Gemini recommendation generation failed, falling back to Groq: {e}")
            try:
                gen_recs = await groq_provider.generate_structured(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    response_schema=GeneratedRecommendationsList,
                    temperature=0.3,
                )
            except Exception as e2:
                print(f"Groq recommendation generation failed: {e2}")

        # 4. Fallback if LLM output was empty
        if not gen_recs or not gen_recs.recommendations:
            # Generate rule-based recommendation based on weakest concept
            target_name = weak_concepts[0]["name"] if weak_concepts else "Core Curriculum"
            recs_to_insert = [
                Recommendation(
                    id=str(uuid.uuid4()),
                    project_id=project_id,
                    text=f"Review and practice questions on '{target_name}' to reinforce foundation.",
                    reason=f"Current mastery is low based on recent assessment data.",
                    status="pending",
                )
            ]
        else:
            recs_to_insert = []
            for r in gen_recs.recommendations:
                recs_to_insert.append(
                    Recommendation(
                        id=str(uuid.uuid4()),
                        project_id=project_id,
                        text=f"**{r.title}**: {r.text}",
                        reason=r.reason,
                        status="pending",
                    )
                )

        for rec in recs_to_insert:
            db.add(rec)

        await db.commit()

        # 5. Log Learning Event
        await event_service.log_event(
            db=db,
            user_id=user_id,
            event_type="recommendation_generated",
            project_id=project_id,
            payload={"count": len(recs_to_insert)},
        )

        return await RecommendationService.get_project_recommendations(db, project_id)

    @staticmethod
    async def update_recommendation_status(
        db: AsyncSession,
        recommendation_id: str,
        project_id: str,
        user_id: str,
        status: str
    ) -> Recommendation:
        """Update status of a recommendation and emit completion event."""
        rec = await db.get(Recommendation, recommendation_id)
        if not rec or rec.project_id != project_id:
            raise ValueError("Recommendation not found")

        rec.status = status
        await db.commit()
        await db.refresh(rec)

        if status == "completed":
            await event_service.log_event(
                db=db,
                user_id=user_id,
                event_type="recommendation_completed",
                project_id=project_id,
                payload={"recommendation_id": recommendation_id, "text": rec.text[:60]},
            )

        return rec


recommendation_service = RecommendationService()
