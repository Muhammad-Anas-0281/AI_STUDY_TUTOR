from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.db.models.user import User
from app.db.models.project import Project
from app.db.models.assessment import QuizAttempt, Question, Answer
from app.db.models.concept import Concept
from app.core import deps
from app.services.concept_service import concept_service
from app.services.assessment_service import assessment_service
from app.schemas.concept import ConceptWithMastery, ConceptResponse
from app.schemas.quiz import (
    QuizGenerateRequest,
    QuizAttemptResponse,
    QuizSubmitRequest,
    QuizResultResponse,
    QuizHistorySummary,
    QuizQuestionItem,
    GradedAnswerFeedback,
    MasteryDelta,
)

router = APIRouter(tags=["Quiz & Assessment"])


# --- Concepts Endpoints ---

@router.post("/projects/{project_id}/concepts/extract", response_model=List[ConceptWithMastery])
async def extract_project_concepts(
    project_id: str,
    force: bool = False,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Extract 5-10 core concepts from project documents."""
    await deps.get_project_or_403(project_id, current_user, db)
    concepts = await concept_service.extract_concepts_for_project(
        db=db, project_id=project_id, user_id=current_user.id, force_refresh=force
    )
    return concepts


@router.get("/projects/{project_id}/concepts", response_model=List[ConceptWithMastery])
async def get_project_concepts(
    project_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all concepts and mastery levels for a project."""
    await deps.get_project_or_403(project_id, current_user, db)
    concepts = await concept_service.get_project_concepts(db, project_id)
    return concepts


# --- Quiz Endpoints ---

@router.post("/projects/{project_id}/quiz/generate", response_model=QuizAttemptResponse)
async def generate_quiz(
    project_id: str,
    payload: QuizGenerateRequest = QuizGenerateRequest(),
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate an adaptive quiz with questions grounded in the project's concepts & materials."""
    await deps.get_project_or_403(project_id, current_user, db)
    try:
        quiz_attempt = await assessment_service.generate_adaptive_quiz(
            db=db,
            project_id=project_id,
            user_id=current_user.id,
            num_questions=payload.num_questions,
            difficulty=payload.difficulty or "adaptive"
        )
        return quiz_attempt
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate adaptive quiz: {str(e)}"
        )


@router.get("/projects/{project_id}/quiz/history", response_model=List[QuizHistorySummary])
async def get_quiz_history(
    project_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get history of past quiz attempts for this project."""
    await deps.get_project_or_403(project_id, current_user, db)
    stmt = (
        select(QuizAttempt)
        .where(QuizAttempt.project_id == project_id)
        .order_by(QuizAttempt.started_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/projects/{project_id}/quiz/{attempt_id}")
async def get_quiz_attempt(
    project_id: str,
    attempt_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get quiz attempt details."""
    await deps.get_project_or_403(project_id, current_user, db)
    stmt = (
        select(QuizAttempt)
        .where(QuizAttempt.id == attempt_id, QuizAttempt.project_id == project_id)
        .options(selectinload(QuizAttempt.questions).selectinload(Question.answer))
    )
    res = await db.execute(stmt)
    attempt = res.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz attempt not found")

    # If still in progress, redact correct answers
    if attempt.status == "in_progress":
        return {
            "id": attempt.id,
            "project_id": attempt.project_id,
            "status": attempt.status,
            "total_questions": attempt.total_questions,
            "started_at": attempt.started_at,
            "questions": [
                {
                    "id": q.id,
                    "concept_id": q.concept_id,
                    "type": q.type,
                    "difficulty": q.difficulty,
                    "prompt": q.prompt,
                    "options": q.options,
                    "order_index": q.order_index,
                }
                for q in sorted(attempt.questions, key=lambda x: x.order_index)
            ]
        }

    # If completed, return full results
    return {
        "id": attempt.id,
        "project_id": attempt.project_id,
        "status": attempt.status,
        "score": attempt.score,
        "total_questions": attempt.total_questions,
        "started_at": attempt.started_at,
        "completed_at": attempt.completed_at,
        "questions": [
            {
                "id": q.id,
                "concept_id": q.concept_id,
                "type": q.type,
                "difficulty": q.difficulty,
                "prompt": q.prompt,
                "options": q.options,
                "correct_answer": q.correct_answer,
                "explanation": q.explanation,
                "order_index": q.order_index,
                "answer": {
                    "user_response": q.answer.user_response if q.answer else None,
                    "is_correct": q.answer.is_correct if q.answer else None,
                    "score": q.answer.score if q.answer else 0.0,
                    "feedback": q.answer.feedback if q.answer else {},
                } if q.answer else None
            }
            for q in sorted(attempt.questions, key=lambda x: x.order_index)
        ]
    }


@router.post("/projects/{project_id}/quiz/{attempt_id}/submit", response_model=QuizResultResponse)
async def submit_quiz(
    project_id: str,
    attempt_id: str,
    submission: QuizSubmitRequest,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Submit quiz answers, grade open-ended & MCQs, update mastery, and return detailed report."""
    await deps.get_project_or_403(project_id, current_user, db)
    try:
        results = await assessment_service.submit_quiz(
            db=db,
            project_id=project_id,
            attempt_id=attempt_id,
            submission=submission,
            user_id=current_user.id,
        )
        return results
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to grade and submit quiz: {str(e)}"
        )
