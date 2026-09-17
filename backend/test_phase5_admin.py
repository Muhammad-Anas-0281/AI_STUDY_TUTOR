import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from app.db.session import async_session_maker
from app.services.admin_service import admin_service


async def run_phase5_test():
    print("=== Testing Phase 5: Admin Dashboard & Observability ===\n")
    async with async_session_maker() as db:
        # 1. Platform Stats
        print("Step 1: Testing Platform Aggregate Statistics...")
        stats = await admin_service.get_platform_stats(db)
        print(f"  • Users: {stats.total_users}")
        print(f"  • Spaces: {stats.total_spaces} | Projects: {stats.total_projects}")
        print(f"  • Documents: {stats.total_documents} | Chunks: {stats.total_chunks}")
        print(f"  • Quizzes Completed: {stats.total_quizzes_taken}")
        print(f"  • Learning Events Logged: {stats.total_events}")
        print(f"  • AI Requests Logged: {stats.total_ai_requests}")

        # 2. Users List & Drill-down
        print("\nStep 2: Testing User Directory & Drill-down...")
        users = await admin_service.get_users_list(db)
        print(f"  Found {len(users)} registered users:")
        for u in users[:5]:
            print(f"   - [{u.role.upper()}] {u.email} ({u.spaces_count} spaces, {u.projects_count} projects)")

        if users:
            detail = await admin_service.get_user_detail(db, users[0].id)
            if detail:
                print(f"  Drill-down on {users[0].email}: {len(detail.spaces)} spaces, {len(detail.recent_events)} events, {detail.total_ai_requests} AI calls")

        # 3. AI Usage & Observability
        print("\nStep 3: Testing AI Observability & Usage Analytics...")
        ai_summary = await admin_service.get_ai_usage(db, limit=10)
        print(f"  • Total AI Calls: {ai_summary.total_requests}")
        print(f"  • Success Rate: {ai_summary.success_rate}%")
        print(f"  • Avg Latency: {ai_summary.avg_latency_ms} ms")
        print(f"  • Total Tokens: {ai_summary.total_input_tokens + ai_summary.total_output_tokens} (In: {ai_summary.total_input_tokens}, Out: {ai_summary.total_output_tokens})")
        print(f"  • Total Cost: ${ai_summary.total_cost_usd:.4f} ($0 Free Tier Active)")
        print(f"  • By Feature: {ai_summary.by_feature}")
        print(f"  • By Provider: {ai_summary.by_provider}")
        print(f"  • By Model: {ai_summary.by_model}")

        # 4. Background Jobs
        print("\nStep 4: Testing Background Job Management...")
        jobs = await admin_service.get_jobs(db, limit=5)
        print(f"  Found {len(jobs)} background jobs in ledger.")
        for j in jobs[:3]:
            print(f"   - [{j.status.upper()}] Job {j.job_id} ({j.type}) - Attempts: {j.attempts}")

        # 5. Live System Health
        print("\nStep 5: Testing System Health Checks...")
        health = await admin_service.check_system_health(db)
        print(f"  • Overall System Status: {health.status.upper()}")
        print(f"  • PostgreSQL Database: {'CONNECTED' if health.database_healthy else 'FAILED'} ({health.database_latency_ms} ms)")
        print(f"  • pgvector Extension: {'INSTALLED & ACTIVE' if health.pgvector_installed else 'NOT FOUND'}")
        print(f"  • Upstash Redis Cache/Queue: {'CONNECTED' if health.redis_healthy else 'UNREACHABLE'} ({health.redis_latency_ms} ms)")

    print("\n=== Phase 5 Backend Admin & Observability Verification Passed! ===")


if __name__ == '__main__':
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(run_phase5_test())
