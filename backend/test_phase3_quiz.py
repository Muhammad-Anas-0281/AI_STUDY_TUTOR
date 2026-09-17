import asyncio
import os
import sys

# Ensure backend path is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from app.db.session import async_session_maker
from app.db.models.user import User
from app.db.models.project import Project
from app.db.models.material import Document, Chunk
from app.services.concept_service import concept_service
from app.services.assessment_service import assessment_service
from app.schemas.quiz import SingleAnswerSubmit, QuizSubmitRequest
from sqlalchemy import select


async def run_phase3_test():
    print("=== Testing Phase 3: Adaptive Quiz & Assessment Pipeline ===")
    async with async_session_maker() as db:
        # 1. Get existing project
        proj_stmt = select(Project).limit(1)
        res = await db.execute(proj_stmt)
        project = res.scalar_one_or_none()

        if not project:
            print("No existing project found to test against.")
            return

        print(f"Testing with Project ID: {project.id} - Name: {project.name}")

        # 2. Extract Concepts
        print("\nStep 1: Testing Concept Extraction...")
        concepts = await concept_service.extract_concepts_for_project(
            db=db, project_id=project.id, user_id="test-user", force_refresh=True
        )
        print(f"Extracted/Found {len(concepts)} concepts:")
        for c in concepts:
            mastery_score = c.mastery.score if c.mastery else 0.0
            print(f"  - [{c.name}]: {c.description[:80]}... (Mastery: {mastery_score}%)")

        # 3. Generate Adaptive Quiz
        print("\nStep 2: Generating Adaptive Quiz...")
        quiz_response = await assessment_service.generate_adaptive_quiz(
            db=db,
            project_id=project.id,
            user_id="test-user",
            num_questions=3,
            difficulty="adaptive"
        )
        print(f"Generated Quiz Attempt ID: {quiz_response.id}")
        print(f"Total Questions Generated: {len(quiz_response.questions)}")
        for idx, q in enumerate(quiz_response.questions):
            print(f"  Q{idx+1} [{q.type.upper()}] ({q.difficulty}): {q.prompt}")
            if q.options:
                print(f"      Options: {q.options}")

        # 4. Submit Mock Answers (MCQ + Open Ended)
        print("\nStep 3: Submitting Answers and Evaluating (Deterministic MCQ + AI Rubric)...")
        submissions = []
        for q in quiz_response.questions:
            if q.type == "mcq" and q.options:
                # Pick first option as answer
                submissions.append(SingleAnswerSubmit(question_id=q.id, user_response=q.options[0]))
            else:
                submissions.append(SingleAnswerSubmit(
                    question_id=q.id,
                    user_response="The core mechanism works by applying self-attention to weigh the relevance of tokens dynamically in context."
                ))

        submit_req = QuizSubmitRequest(answers=submissions)
        result = await assessment_service.submit_quiz(
            db=db,
            project_id=project.id,
            attempt_id=quiz_response.id,
            submission=submit_req,
        )

        print(f"\nQuiz Evaluated Successfully!")
        print(f"Total Score: {result.total_score}% ({result.correct_count}/{result.total_questions} correct)")
        print("\nMastery Deltas:")
        for delta in result.mastery_deltas:
            print(f"  - Concept [{delta.concept_name}]: {delta.old_score}% -> {delta.new_score}% (Delta: {delta.delta:+}%) [{delta.status}]")

        print("\nQuestion Feedback Samples:")
        for ans in result.answers:
            print(f"  - [{ans.type.upper()}] Correct: {ans.is_correct} (Score: {ans.score})")
            if ans.rubric_feedback:
                print(f"      Understood: {ans.rubric_feedback.get('understood')}")
                print(f"      Missing: {ans.rubric_feedback.get('missing')}")

        print("\n=== Phase 3 Backend Verification Passed Successfully! ===")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(run_phase3_test())
