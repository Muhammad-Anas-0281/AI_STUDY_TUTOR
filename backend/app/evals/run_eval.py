"""
Comprehensive AI Study Companion Evaluation Harness (run_eval.py).
Executes benchmark evaluations across:
1. Grounded RAG Tutor (Accuracy, Citations, Honest Refusal, Injection Resistance)
2. Semantic Retrieval Engine (Similarity Calibration, Thresholds)
3. Rubric Assessment & Grading (Scoring Calibration)
4. AI Recommendation System (Targeted Remediation)
"""

import json
import time
import asyncio
import sys
from pathlib import Path
from typing import List, Dict, Any

# Ensure UTF-8 stdout encoding on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Ensure backend root is in python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.db.session import async_session_maker
from app.db.models.project import Project
from app.db.models.user import User
from app.db.models.space import Space
from app.db.models.material import Document, Chunk
from app.core.security import get_password_hash
from app.services.retrieval_service import retrieval_service
from app.services.embedding_service import embedding_service
from app.services.tutor_service import tutor_service
from app.services.assessment_service import assessment_service
from app.services.recommendation_service import recommendation_service
from app.evals.judges import (
    judge_tutor_response,
    judge_grading_accuracy,
    judge_recommendation_relevance
)


DATASETS_DIR = Path(__file__).parent / "datasets"


def load_dataset(filename: str) -> List[Dict[str, Any]]:
    path = DATASETS_DIR / filename
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


async def run_evaluation_suite():
    print("=" * 75)
    print(">> EXECUTING PLATFORM EVALUATION HARNESS (run_eval.py)")
    print("=" * 75)

    total_tests = 0
    passed_tests = 0

    async with async_session_maker() as db:
        # Create isolated test harness project
        test_user = User(
            email=f"evaluator_{int(time.time())}@eval.local",
            hashed_password=get_password_hash("evalpass123"),
            full_name="AI Evaluator"
        )
        db.add(test_user)
        await db.flush()

        test_space = Space(user_id=test_user.id, name="Eval Space")
        db.add(test_space)
        await db.flush()

        test_project = Project(
            space_id=test_space.id,
            name="Transformer Deep Dive",
            goal="Master attention mechanisms and Transformer math"
        )
        db.add(test_project)
        await db.flush()

        # Seed knowledge material
        doc = Document(
            project_id=test_project.id,
            filename="AttentionIsAllYouNeed.pdf",
            storage_url="s3://eval/attention.pdf",
            status="ready",
            page_count=15
        )
        db.add(doc)
        await db.flush()

        raw_chunks = [
            "In scaled dot-product attention, queries and keys of dimension d_k are multiplied. The dot products grow large in magnitude for large values of d_k, pushing the softmax function into regions where it has extremely small gradients. To counteract this effect, dot products are scaled by 1/sqrt(d_k).",
            "Since the Transformer contains no recurrence and no convolution, in order for the model to make use of the order of the sequence, we must inject information about the relative or absolute position of tokens. We use sine and cosine functions of different frequencies.",
            "FastAPI has a very powerful but intuitive Dependency Injection system designed to be simple to use and make it very easy for any developer to integrate other components with FastAPI."
        ]

        for idx, text in enumerate(raw_chunks):
            vec = embedding_service.embed_text(text)
            c = Chunk(
                document_id=doc.id,
                project_id=test_project.id,
                page_number=idx + 1,
                chunk_index=idx,
                content=text,
                embedding=vec,
                metadata_json={"eval": True}
            )
            db.add(c)
        await db.commit()

        # -------------------------------------------------------------
        # 1. RETRIEVAL BENCHMARK
        # -------------------------------------------------------------
        print("\n--- 1. SEMANTIC RETRIEVAL BENCHMARK ---")
        retrieval_cases = load_dataset("retrieval_cases.json")
        for tc in retrieval_cases:
            total_tests += 1
            t0 = time.time()
            results = await retrieval_service.search(
                project_id=test_project.id,
                query=tc["query"],
                top_k=3,
                db=db
            )
            lat = int((time.time() - t0) * 1000)

            if tc.get("expected_insufficient"):
                top_sim = results[0]["similarity"] if results else 0.0
                pass_case = top_sim < tc["max_acceptable_similarity"] or len(results) == 0
                status = "[PASS]" if pass_case else "[FAIL]"
                if pass_case:
                    passed_tests += 1
                print(f"  {status} {tc['id']}: Insufficient evidence check (Sim={top_sim:.3f}, {lat}ms)")
            else:
                found = any(tc["target_substring"] in r["content"] for r in results)
                sim = results[0]["similarity"] if results else 0.0
                pass_case = found and sim >= tc.get("min_similarity", 0.20)
                status = "[PASS]" if pass_case else "[FAIL]"
                if pass_case:
                    passed_tests += 1
                print(f"  {status} {tc['id']}: Top similarity = {sim:.3f} | Substring matched: {found} ({lat}ms)")

        # -------------------------------------------------------------
        # 2. GROUNDED AI TUTOR BENCHMARK
        # -------------------------------------------------------------
        print("\n--- 2. GROUNDED AI TUTOR BENCHMARK ---")
        tutor_cases = load_dataset("tutor_cases.json")
        for tc in tutor_cases:
            total_tests += 1
            t0 = time.time()
            collected_response = ""
            async for event in tutor_service.ask_stream(
                project=test_project,
                user_id=test_user.id,
                question=tc["question"],
                session_id=None,
                db=db
            ):
                if event.get("type") == "token":
                    collected_response += event.get("token", "")
            lat = int((time.time() - t0) * 1000)

            eval_res = judge_tutor_response(
                response=collected_response,
                context=tc["context"],
                is_in_scope=tc["is_in_scope"],
                expected_keywords=tc.get("expected_keywords")
            )

            status = "[PASS]" if eval_res["passed"] else "[FAIL]"
            if eval_res["passed"]:
                passed_tests += 1

            print(f"  {status} {tc['id']} ({tc['topic']}): Score={eval_res['score']}/100 ({lat}ms)")
            if not eval_res["passed"]:
                print(f"       Deductions: {eval_res['deductions']}")
                print(f"       Actual Response: {collected_response[:200]}...")

        # -------------------------------------------------------------
        # 3. RUBRIC ASSESSMENT & GRADING BENCHMARK
        # -------------------------------------------------------------
        print("\n--- 3. RUBRIC ASSESSMENT & GRADING BENCHMARK ---")
        from app.db.models.assessment import Question
        grading_cases = load_dataset("grading_cases.json")
        for tc in grading_cases:
            total_tests += 1
            t0 = time.time()
            mock_q = Question(
                prompt=tc["question"],
                correct_answer=tc["expected_answer"],
                explanation="",
                type="open_ended",
                options=[]
            )
            grade_res = await assessment_service.grade_open_ended_response(
                question=mock_q,
                user_response=tc["student_response"]
            )
            lat = int((time.time() - t0) * 1000)

            score_pct = int(grade_res.score * 100) if grade_res.score <= 1.0 else int(grade_res.score)

            judge_res = judge_grading_accuracy(
                actual_score=score_pct,
                expected_score_min=tc.get("expected_score_min"),
                expected_score_max=tc.get("expected_score_max"),
                is_correct=grade_res.is_correct,
                expected_is_correct=tc.get("expected_is_correct")
            )

            status = "[PASS]" if judge_res["passed"] else "[FAIL]"
            if judge_res["passed"]:
                passed_tests += 1

            print(f"  {status} {tc['id']}: Score={score_pct}/100 (Correct={grade_res.is_correct}) ({lat}ms)")
            if not judge_res["passed"]:
                print(f"       Reasons: {judge_res['reasons']}")

        # -------------------------------------------------------------
        # 4. RECOMMENDATION ENGINE BENCHMARK
        # -------------------------------------------------------------
        print("\n--- 4. RECOMMENDATION RELEVANCE BENCHMARK ---")
        rec_cases = load_dataset("recommendation_cases.json")
        for tc in rec_cases:
            total_tests += 1
            t0 = time.time()
            recs = await recommendation_service.generate_recommendations(
                db=db,
                project_id=test_project.id,
                user_id=test_user.id
            )
            lat = int((time.time() - t0) * 1000)

            combined_rec_text = " ".join(r.text + " " + r.reason for r in recs)

            rec_eval = judge_recommendation_relevance(
                recommendation_text=combined_rec_text,
                weak_concepts=tc["weak_concepts"],
                expected_themes=tc["expected_themes"]
            )

            status = "[PASS]" if rec_eval["passed"] else "[FAIL]"
            if rec_eval["passed"]:
                passed_tests += 1

            print(f"  {status} {tc['id']}: Generated {len(recs)} recs | Matched themes: {rec_eval['matched_themes']} ({lat}ms)")
            if not rec_eval["passed"]:
                print(f"       Missing themes: {rec_eval['missing_themes']}")

    # -------------------------------------------------------------
    # HARNESS SUMMARY REPORT
    # -------------------------------------------------------------
    pass_rate = (passed_tests / max(total_tests, 1)) * 100
    print("\n" + "=" * 75)
    print(f">> EVALUATION SUMMARY: {passed_tests}/{total_tests} PASSED ({pass_rate:.1f}%)")
    print("=" * 75)

    assert pass_rate >= 85.0, f"Evaluation suite failed minimum 85% pass threshold (got {pass_rate:.1f}%)"


if __name__ == "__main__":
    asyncio.run(run_evaluation_suite())
