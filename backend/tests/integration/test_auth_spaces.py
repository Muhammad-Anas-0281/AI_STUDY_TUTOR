import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.session import async_session_maker
from app.db.models.user import User
from sqlalchemy import select, delete


@pytest.mark.asyncio
async def test_auth_and_spaces_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Health check
        res = await ac.get("/health")
        assert res.status_code == 200
        assert res.json()["status"] == "healthy"

        # Register test user
        test_email = "teststudent@studycompanion.ai"
        # Cleanup if exists
        async with async_session_maker() as session:
            await session.execute(delete(User).where(User.email == test_email))
            await session.commit()

        reg_res = await ac.post("/api/v1/auth/register", json={
            "email": test_email,
            "password": "strongpassword123",
            "full_name": "Test Learner"
        })
        assert reg_res.status_code == 201
        data = reg_res.json()
        assert "access_token" in data
        token = data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Check me
        me_res = await ac.get("/api/v1/auth/me", headers=headers)
        assert me_res.status_code == 200
        assert me_res.json()["email"] == test_email

        # Create Space
        space_res = await ac.post("/api/v1/spaces", json={
            "name": "Machine Learning",
            "description": "Deep Learning & NLP Roadmaps"
        }, headers=headers)
        assert space_res.status_code == 201
        space_id = space_res.json()["id"]

        # Create Project in Space
        proj_res = await ac.post("/api/v1/projects", json={
            "space_id": space_id,
            "name": "Transformer Architectures",
            "goal": "Understand Multi-Head Attention"
        }, headers=headers)
        assert proj_res.status_code == 201
        assert proj_res.json()["name"] == "Transformer Architectures"

        # List Spaces
        list_spaces_res = await ac.get("/api/v1/spaces", headers=headers)
        assert list_spaces_res.status_code == 200
        assert len(list_spaces_res.json()) >= 1

        print("\nAll Phase 0 Auth, Spaces, and Projects API tests passed!")
