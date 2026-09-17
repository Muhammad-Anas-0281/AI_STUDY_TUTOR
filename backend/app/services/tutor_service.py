import time
from typing import AsyncGenerator, Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.db.models.project import Project
from app.db.models.conversation import TutorSession, TutorMessage
from app.db.models.event import LearningEvent
from app.services.retrieval_service import retrieval_service
from app.ai.providers.groq_provider import groq_provider
from app.ai.providers.gemini_provider import gemini_provider
from app.ai.prompts.tutor_prompt import get_tutor_system_prompt, format_tutor_context
from app.ai.usage_tracker import usage_tracker


class TutorService:
    @staticmethod
    async def get_or_create_session(project_id: str, session_id: Optional[str], db: AsyncSession) -> TutorSession:
        if session_id:
            res = await db.execute(select(TutorSession).where(TutorSession.id == session_id, TutorSession.project_id == project_id))
            session = res.scalar_one_or_none()
            if session:
                return session

        new_session = TutorSession(project_id=project_id, title="Study Session")
        db.add(new_session)
        await db.commit()
        await db.refresh(new_session)
        return new_session

    async def ask_stream(
        self,
        project: Project,
        user_id: str,
        question: str,
        session_id: Optional[str],
        db: AsyncSession
    ) -> AsyncGenerator[Dict[str, Any], None]:
        start_time = time.time()
        session = await self.get_or_create_session(project.id, session_id, db)

        # 1. Save Learner Question
        user_msg = TutorMessage(
            session_id=session.id,
            role="user",
            content=question,
            citations=[]
        )
        db.add(user_msg)
        await db.commit()

        # 2. Retrieve Relevant Project Materials via pgvector
        chunks = await retrieval_service.search(
            project_id=project.id,
            query=question,
            top_k=4,
            db=db
        )

        # 3. Compute Evidence Confidence Score
        top_similarity = chunks[0]["similarity"] if chunks else 0.0
        # If top similarity is below 0.28 or no chunks found, confidence is LOW
        insufficient_evidence = bool(not chunks or top_similarity < 0.28)
        confidence_level = "LOW" if insufficient_evidence else "HIGH"

        # Prepare Citations
        citations = []
        if not insufficient_evidence:
            seen = set()
            for c in chunks:
                if c["similarity"] >= 0.28:
                    key = (c["filename"], c["page_number"])
                    if key not in seen:
                        seen.add(key)
                        citations.append({
                            "filename": c["filename"],
                            "page_number": c["page_number"],
                            "similarity": c["similarity"]
                        })

        # 4. Fetch recent conversation history
        hist_res = await db.execute(
            select(TutorMessage)
            .where(TutorMessage.session_id == session.id)
            .order_by(TutorMessage.created_at.desc())
            .limit(6)
        )
        recent_msgs = list(reversed([
            {"role": m.role, "content": m.content}
            for m in hist_res.scalars().all()
        ]))

        # 5. Build System & Context Prompts
        system_prompt = get_tutor_system_prompt(
            project_name=project.name,
            goal=project.goal or "",
            confidence_level=confidence_level
        )
        context_prompt = format_tutor_context(
            retrieved_chunks=chunks if not insufficient_evidence else [],
            conversation_summary="",
            recent_messages=recent_msgs,
            user_question=question
        )

        # 6. Stream tokens via Groq (with automatic fallback to Gemini)
        full_response = ""
        provider_used = "groq"
        model_used = groq_provider.model_name

        # Yield metadata first (sources & confidence)
        yield {
            "type": "meta",
            "session_id": session.id,
            "citations": citations,
            "confidence_score": top_similarity,
            "insufficient_evidence": insufficient_evidence
        }

        try:
            async for token in groq_provider.generate_stream(system_prompt, context_prompt):
                full_response += token
                yield {"type": "token", "token": token}
        except Exception as groq_err:
            print(f"Groq stream error, falling back to Gemini: {groq_err}")
            provider_used = "gemini"
            model_used = gemini_provider.model_name
            try:
                async for token in gemini_provider.generate_stream(system_prompt, context_prompt):
                    full_response += token
                    yield {"type": "token", "token": token}
            except Exception as gemini_err:
                full_response = (
                    "I am currently unable to reach the AI models. "
                    "Please verify your API keys or try again shortly."
                )
                yield {"type": "token", "token": full_response}

        latency_ms = int((time.time() - start_time) * 1000)

        # 7. Save Assistant Message in Database
        asst_msg = TutorMessage(
            session_id=session.id,
            role="assistant",
            content=full_response,
            citations=citations,
            confidence_score=top_similarity,
            insufficient_evidence=insufficient_evidence
        )
        db.add(asst_msg)

        # 8. Record Learning Event
        event = LearningEvent(
            user_id=user_id,
            project_id=project.id,
            type="tutor_asked",
            payload={
                "session_id": session.id,
                "confidence_score": top_similarity,
                "insufficient_evidence": insufficient_evidence,
                "citations_count": len(citations)
            }
        )
        db.add(event)
        await db.commit()

        # 9. Asynchronous Observability Logging
        await usage_tracker.log_request(
            feature="tutor_chat",
            provider=provider_used,
            model=model_used,
            latency_ms=latency_ms,
            user_id=user_id,
            project_id=project.id,
            input_tokens=len(context_prompt.split()),
            output_tokens=len(full_response.split()),
            cost_usd=0.0,
            success=True
        )

        yield {
            "type": "done",
            "message_id": asst_msg.id,
            "session_id": session.id,
            "citations": citations,
            "insufficient_evidence": insufficient_evidence
        }


tutor_service = TutorService()
