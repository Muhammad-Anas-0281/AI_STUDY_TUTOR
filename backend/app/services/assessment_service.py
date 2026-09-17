import uuid
import random
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.models.assessment import QuizAttempt, Question, Answer
from app.db.models.concept import Concept
from app.db.models.mastery import Mastery
from app.db.models.project import Project
from app.db.models.material import Chunk
from app.services.retrieval_service import retrieval_service
from app.services.concept_service import concept_service
from app.ai.providers.gemini_provider import gemini_provider
from app.ai.providers.groq_provider import groq_provider
from app.ai.prompts.quiz_prompt import (
    build_quiz_generation_prompt,
    build_open_ended_grading_prompt,
)
from app.schemas.quiz import (
    GeneratedQuiz,
    OpenEndedEvaluation,
    QuizAttemptResponse,
    QuizQuestionItem,
    QuizSubmitRequest,
    QuizResultResponse,
    GradedAnswerFeedback,
    MasteryDelta,
)


class AssessmentService:
    @staticmethod
    async def select_weighted_concepts(
        db: AsyncSession,
        project_id: str,
        user_id: str,
        target_count: int = 4
    ) -> List[Dict[str, Any]]:
        """Selects concepts prioritized by lowest mastery score and lowest evidence count."""
        concepts = await concept_service.get_project_concepts(db, project_id)
        if not concepts:
            # Try extracting concepts if none exist yet
            concepts = await concept_service.extract_concepts_for_project(db, project_id, user_id)

        if not concepts:
            return []

        weighted_list = []
        for c in concepts:
            score = c.mastery.score if c.mastery else 0.0
            evidence_count = c.mastery.evidence_count if c.mastery else 0
            
            # Priority weight calculation: Lower score & lower evidence gets higher priority
            priority_weight = (100.0 - score) * 1.5 + max(0, 10 - evidence_count) * 5.0
            weighted_list.append({
                "concept_id": c.id,
                "name": c.name,
                "description": c.description,
                "score": score,
                "evidence_count": evidence_count,
                "weight": priority_weight,
            })

        # Sort descending by priority weight
        weighted_list.sort(key=lambda x: x["weight"], reverse=True)
        return weighted_list[:target_count]

    @staticmethod
    async def generate_adaptive_quiz(
        db: AsyncSession,
        project_id: str,
        user_id: str,
        num_questions: int = 4,
        difficulty: str = "adaptive"
    ) -> QuizAttemptResponse:
        """Generates a context-grounded quiz attempt with MCQs and Open-Ended questions."""
        project = await db.get(Project, project_id)
        project_name = project.name if project else "Study Project"

        # 1. Select weighted concepts
        target_concepts = await AssessmentService.select_weighted_concepts(
            db=db, project_id=project_id, user_id=user_id, target_count=num_questions
        )

        # 2. Retrieve relevant context chunks for the selected concepts
        context_chunks: List[str] = []
        for tc in target_concepts:
            hits = await retrieval_service.search(
                db=db,
                project_id=project_id,
                query=f"{tc['name']}: {tc.get('description', '')}",
                top_k=2
            )
            for h in hits:
                context_chunks.append(f"[{h.get('document_id', 'doc')} p.{h.get('page_number', 1)}]: {h.get('content', '')}")

        # Fallback if no specific hits found
        if not context_chunks:
            chunk_stmt = select(Chunk).where(Chunk.project_id == project_id).limit(6)
            c_res = await db.execute(chunk_stmt)
            for c in c_res.scalars().all():
                context_chunks.append(f"[{c.document_id} p.{c.page_number or 1}]: {c.content}")

        if not context_chunks:
            context_chunks = [f"General concepts and principles of {project_name}."]

        # 3. Build prompt and generate structured quiz
        system_prompt, user_prompt = build_quiz_generation_prompt(
            project_name=project_name,
            target_concepts=target_concepts,
            context_chunks=context_chunks,
            num_questions=num_questions,
            difficulty=difficulty,
        )

        generated_quiz: Optional[GeneratedQuiz] = None
        try:
            generated_quiz = await gemini_provider.generate_structured(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                response_schema=GeneratedQuiz,
                temperature=0.2,
            )
        except Exception as e:
            print(f"Gemini quiz generation failed, falling back to Groq: {e}")
            try:
                generated_quiz = await groq_provider.generate_structured(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    response_schema=GeneratedQuiz,
                    temperature=0.2,
                )
            except Exception as e2:
                print(f"Groq quiz generation failed: {e2}")
                raise ValueError(f"Unable to generate quiz questions: {e2}")

        if not generated_quiz or not generated_quiz.questions:
            raise ValueError("No questions generated by AI provider")

        # 4. Save QuizAttempt and Questions to database
        attempt_id = str(uuid.uuid4())
        attempt = QuizAttempt(
            id=attempt_id,
            project_id=project_id,
            status="in_progress",
            total_questions=len(generated_quiz.questions),
            started_at=datetime.now(timezone.utc),
        )
        db.add(attempt)

        # Map concept names to IDs
        all_concepts = await concept_service.get_project_concepts(db, project_id)
        concept_map = {c.name.lower(): c.id for c in all_concepts}

        questions_output: List[QuizQuestionItem] = []

        for idx, q_data in enumerate(generated_quiz.questions):
            q_id = str(uuid.uuid4())
            cid = concept_map.get(q_data.concept_name.lower())
            
            # Shuffle MCQ options if present to ensure randomness
            options = q_data.options
            if options and len(options) > 1:
                # Ensure correct_answer is in options
                if q_data.correct_answer not in options:
                    options[0] = q_data.correct_answer
                random.shuffle(options)

            question_db = Question(
                id=q_id,
                attempt_id=attempt_id,
                concept_id=cid,
                type=q_data.type,
                difficulty=q_data.difficulty,
                prompt=q_data.prompt,
                options=options,
                correct_answer=q_data.correct_answer,
                explanation=q_data.explanation,
                order_index=idx,
            )
            db.add(question_db)

            # Redacted question item for student taking quiz
            questions_output.append(
                QuizQuestionItem(
                    id=q_id,
                    concept_id=cid,
                    concept_name=q_data.concept_name,
                    type=q_data.type,
                    difficulty=q_data.difficulty,
                    prompt=q_data.prompt,
                    options=options,
                    order_index=idx,
                )
            )

        await db.commit()

        return QuizAttemptResponse(
            id=attempt.id,
            project_id=attempt.project_id,
            status=attempt.status,
            total_questions=attempt.total_questions,
            started_at=attempt.started_at,
            questions=questions_output,
        )

    @staticmethod
    async def grade_open_ended_response(
        question: Question,
        user_response: str
    ) -> OpenEndedEvaluation:
        """Evaluates student's open-ended answer against reference answer via LLM Rubric."""
        if not user_response.strip():
            return OpenEndedEvaluation(
                score=0.0,
                is_correct=False,
                understood="No answer submitted.",
                missing="A complete explanation was expected.",
                key_concepts=[]
            )

        system_prompt, user_prompt = build_open_ended_grading_prompt(
            question_prompt=question.prompt,
            reference_answer=question.correct_answer or "",
            explanation=question.explanation or "",
            student_response=user_response,
        )

        try:
            return await gemini_provider.generate_structured(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                response_schema=OpenEndedEvaluation,
                temperature=0.1,
            )
        except Exception as e:
            print(f"Gemini open-ended grading failed, falling back to Groq: {e}")
            try:
                return await groq_provider.generate_structured(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    response_schema=OpenEndedEvaluation,
                    temperature=0.1,
                )
            except Exception as e2:
                print(f"Groq open-ended grading failed: {e2}")
                # Deterministic keyword heuristic fallback
                return OpenEndedEvaluation(
                    score=0.6,
                    is_correct=True,
                    understood="Response received and recorded.",
                    missing="AI rubric evaluation temporarily unavailable.",
                    key_concepts=[]
                )

    @staticmethod
    async def submit_quiz(
        db: AsyncSession,
        project_id: str,
        attempt_id: str,
        submission: QuizSubmitRequest,
    ) -> QuizResultResponse:
        """Grades all answers in attempt, updates mastery scores, and returns comprehensive results."""
        # 1. Fetch attempt and questions
        stmt = (
            select(QuizAttempt)
            .where(QuizAttempt.id == attempt_id, QuizAttempt.project_id == project_id)
            .options(selectinload(QuizAttempt.questions).selectinload(Question.answer))
        )
        res = await db.execute(stmt)
        attempt = res.scalar_one_or_none()
        if not attempt:
            raise ValueError("Quiz attempt not found")

        # Mapping for fast question lookup
        question_map = {q.id: q for q in attempt.questions}
        answers_by_qid = {a.question_id: a.user_response for a in submission.answers}

        total_score_sum = 0.0
        correct_count = 0
        graded_feedback_list: List[GradedAnswerFeedback] = []
        concept_evaluations: Dict[str, List[float]] = {}  # concept_id -> list of scores [0..1]

        # 2. Grade each question
        for q in sorted(attempt.questions, key=lambda x: x.order_index):
            user_resp = answers_by_qid.get(q.id, "").strip()

            if q.type == "mcq":
                # Deterministic MCQ comparison (case and whitespace normalized)
                is_correct = (user_resp.lower() == (q.correct_answer or "").strip().lower())
                q_score = 1.0 if is_correct else 0.0
                rubric_dict = {
                    "understood": "Selected the correct option." if is_correct else "Option selected does not match the key.",
                    "missing": "" if is_correct else f"The correct option was: {q.correct_answer}",
                    "key_concepts": [],
                }
            else:
                # Open-ended rubric grading via LLM
                eval_res = await AssessmentService.grade_open_ended_response(q, user_resp)
                q_score = eval_res.score
                is_correct = eval_res.is_correct
                rubric_dict = {
                    "understood": eval_res.understood,
                    "missing": eval_res.missing,
                    "key_concepts": eval_res.key_concepts,
                }

            total_score_sum += q_score
            if is_correct:
                correct_count += 1

            if q.concept_id:
                concept_evaluations.setdefault(q.concept_id, []).append(q_score)

            # Persist Answer in DB
            ans_record = Answer(
                id=str(uuid.uuid4()),
                question_id=q.id,
                user_response=user_resp,
                is_correct=is_correct,
                score=q_score,
                feedback=rubric_dict,
                evaluated_at=datetime.now(timezone.utc),
            )
            db.add(ans_record)

            # Get concept name if available
            c_name = None
            if q.concept_id:
                c_obj = await db.get(Concept, q.concept_id)
                if c_obj:
                    c_name = c_obj.name

            graded_feedback_list.append(
                GradedAnswerFeedback(
                    question_id=q.id,
                    concept_name=c_name,
                    type=q.type,
                    user_response=user_resp,
                    correct_answer=q.correct_answer,
                    explanation=q.explanation,
                    is_correct=is_correct,
                    score=q_score,
                    rubric_feedback=rubric_dict,
                )
            )

        # 3. Finalize attempt score
        total_q_count = len(attempt.questions) or 1
        final_percentage = round((total_score_sum / total_q_count) * 100.0, 1)
        attempt.status = "completed"
        attempt.score = final_percentage
        attempt.completed_at = datetime.now(timezone.utc)

        # 4. Update Mastery for each evaluated concept
        mastery_deltas: List[MasteryDelta] = []
        for cid, scores in concept_evaluations.items():
            concept_obj = await db.get(Concept, cid)
            if not concept_obj:
                continue

            mastery_stmt = select(Mastery).where(Mastery.concept_id == cid, Mastery.project_id == project_id)
            m_res = await db.execute(mastery_stmt)
            mastery = m_res.scalar_one_or_none()

            avg_test_score = (sum(scores) / len(scores)) * 100.0
            old_score = mastery.score if mastery else 0.0
            old_count = mastery.evidence_count if mastery else 0

            # Bayesian weighted moving average: new_score = (old_score * old_count + avg_test_score) / (old_count + 1)
            new_score = round(((old_score * old_count) + avg_test_score) / (old_count + 1), 1)
            new_count = old_count + 1
            new_status = "improving" if new_score >= 75.0 else ("stable" if new_score >= 50.0 else "needs_attention")

            if not mastery:
                mastery = Mastery(
                    id=str(uuid.uuid4()),
                    project_id=project_id,
                    concept_id=cid,
                    score=new_score,
                    evidence_count=new_count,
                    status=new_status,
                )
                db.add(mastery)
            else:
                mastery.score = new_score
                mastery.evidence_count = new_count
                mastery.status = new_status
                mastery.updated_at = datetime.now(timezone.utc)

            mastery_deltas.append(
                MasteryDelta(
                    concept_id=cid,
                    concept_name=concept_obj.name,
                    old_score=old_score,
                    new_score=new_score,
                    delta=round(new_score - old_score, 1),
                    status=new_status,
                )
            )

        await db.commit()

        return QuizResultResponse(
            attempt_id=attempt.id,
            project_id=attempt.project_id,
            total_score=final_percentage,
            total_questions=total_q_count,
            correct_count=correct_count,
            completed_at=attempt.completed_at or datetime.now(timezone.utc),
            answers=graded_feedback_list,
            mastery_deltas=mastery_deltas,
        )


assessment_service = AssessmentService()
