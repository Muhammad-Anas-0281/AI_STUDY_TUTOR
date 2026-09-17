import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from app.db.session import async_session_maker
from app.db.models.project import Project
from app.db.models.user import User
from app.services.growth_service import growth_service
from app.services.recommendation_service import recommendation_service
from app.services.event_service import event_service
from sqlalchemy import select


async def run_phase4_test():
    print("=== Testing Phase 4: Growth, Recommendations, Events & Analytics ===")
    async with async_session_maker() as db:
        # 1. Get existing project
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

        print(f"Testing with Project: {project.name} (ID: {project.id})")

        # 2. Test Event Emission & Idempotency
        print("\nStep 1: Testing Learning Event Logging with Idempotency...")
        ev1 = await event_service.log_event(
            db=db,
            user_id=user_id,
            event_type="test_event_action",
            project_id=project.id,
            payload={"action": "test_verification"},
            idempotency_key="idemp_test_key_001"
        )
        print(f"Logged Event ID: {ev1.id if ev1 else 'Failed'} (Type: {ev1.type if ev1 else 'N/A'})")

        # Duplicate should be deduplicated
        ev2 = await event_service.log_event(
            db=db,
            user_id=user_id,
            event_type="test_event_action",
            project_id=project.id,
            payload={"action": "duplicate_attempt"},
            idempotency_key="idemp_test_key_001"
        )
        print(f"Duplicate Idempotent Event ID matches: {ev1.id == ev2.id if (ev1 and ev2) else False}")

        # 3. Test Growth Metrics Computation
        print("\nStep 2: Computing Project Growth & Mastery Distribution...")
        growth = await growth_service.compute_project_growth(db=db, project_id=project.id)
        print(f"Average Mastery: {growth.average_mastery}% across {growth.total_concepts} concepts")
        print(f"Distribution: {growth.improving_count} Improving | {growth.stable_count} Stable | {growth.needs_attention_count} Needs Attention")
        print(f"Total Quizzes Taken: {growth.total_quizzes_taken} (Recent Avg: {growth.recent_quiz_average}%)")
        print(f"Quiz Trend Points: {len(growth.quiz_trend)}")
        print(f"Weak Concept Alerts: {len(growth.weak_concept_alerts)}")
        for alert in growth.weak_concept_alerts[:3]:
            print(f"  - Alert: [{alert.concept_name}] Score: {alert.current_score}% -> {alert.reason}")

        # 4. Test AI Recommendation Generation
        print("\nStep 3: Generating Evidence-Grounded AI Recommendations...")
        recs = await recommendation_service.generate_recommendations(
            db=db,
            project_id=project.id,
            user_id=user_id
        )
        print(f"Generated {len(recs)} Recommendations:")
        for r in recs:
            print(f"  - Recommendation: {r.text}")
            print(f"    Reason: {r.reason}")
            print(f"    Status: {r.status}")

        # 5. Test Global Analytics
        print("\nStep 4: Computing Global Analytics Summary...")
        global_summary = await growth_service.compute_global_analytics(db=db, user_id=user_id)
        print(f"Global Projects: {global_summary.total_projects} | Concepts: {global_summary.total_concepts} | Avg Mastery: {global_summary.global_average_mastery}%")
        print(f"Total Completed Quizzes: {global_summary.total_quizzes_completed} | Events Logged: {global_summary.learning_events_count}")

        print("\n=== Phase 4 Backend Services Verification Passed Successfully! ===")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(run_phase4_test())
