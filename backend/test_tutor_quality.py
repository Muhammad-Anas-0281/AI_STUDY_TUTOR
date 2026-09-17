import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from app.db.session import async_session_maker
from app.db.models.project import Project
from app.db.models.user import User
from app.services.tutor_service import tutor_service
from sqlalchemy import select


async def run_tutor_quality_eval():
    print("=== AI Tutor Quality & Groundedness Evaluation ===\n")
    async with async_session_maker() as db:
        proj_stmt = select(Project).limit(1)
        res = await db.execute(proj_stmt)
        project = res.scalar_one_or_none()

        if not project:
            print("No project found to test against.")
            return

        user_stmt = select(User).limit(1)
        u_res = await db.execute(user_stmt)
        user = u_res.scalar_one_or_none()
        user_id = user.id if user else "test-user"

        print(f"Project: {project.name} (Goal: {project.goal})")

        test_queries = [
            ("Grounded Question 1", "Why do we scale the dot products by 1/sqrt(d_k) in the Attention mechanism?"),
            ("Grounded Question 2", "Why do Transformers require positional encodings instead of recurrent connections?"),
            ("Out-of-Scope Question", "What is the best recipe for baking chocolate chip cookies?"),
        ]

        for label, question in test_queries:
            print(f"\n" + "="*70)
            print(f"TEST: {label}")
            print(f"QUESTION: {question}")
            print("-" * 70)

            full_tokens = ""
            citations = []
            insufficient_ev = False
            conf_score = 0.0

            async for event in tutor_service.ask_stream(
                project=project,
                user_id=user_id,
                question=question,
                session_id=None,
                db=db
            ):
                if event["type"] == "meta":
                    citations = event.get("citations", [])
                    insufficient_ev = event.get("insufficient_evidence", False)
                    conf_score = event.get("confidence_score", 0.0)
                elif event["type"] == "token":
                    full_tokens += event["token"]

            print(f"Evidence Confidence: {conf_score:.3f} | Insufficient Evidence Flag: {insufficient_ev}")
            print(f"Citations Extracted: {len(citations)}")
            for c in citations:
                print(f"   • {c['filename']} (p.{c['page_number']}) - Rel: {c['similarity']:.2f}")

            print(f"\nTUTOR RESPONSE:\n{full_tokens}\n")

    print("=== Tutor Quality Evaluation Complete ===")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(run_tutor_quality_eval())
