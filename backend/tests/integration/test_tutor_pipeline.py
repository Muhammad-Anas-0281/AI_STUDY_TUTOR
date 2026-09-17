import json
import fitz
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.session import async_session_maker
from app.db.models.user import User
from app.services.material_service import material_service
from sqlalchemy import delete


@pytest.fixture
def test_document_path(tmp_path):
    pdf_path = str(tmp_path / "deep_learning_transformers.pdf")
    doc = fitz.open()
    
    page = doc.new_page()
    page.insert_text(
        (50, 50),
        "Deep Learning Notes: Scaled Dot-Product Attention.\n"
        "In the Transformer architecture, Scaled Dot-Product Attention computes the attention weights "
        "by taking the dot product of the query vector with all key vectors, dividing each by the square root "
        "of the dimension of the key vectors (sqrt(d_k)), and applying a softmax function to obtain weights on values."
    )
    doc.save(pdf_path)
    doc.close()
    return pdf_path


@pytest.mark.asyncio
async def test_tutor_grounded_and_refusal_behavior(test_document_path):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Register test user
        email = "tutor_eval@studycompanion.ai"
        async with async_session_maker() as session:
            await session.execute(delete(User).where(User.email == email))
            await session.commit()

        reg = await ac.post("/api/v1/auth/register", json={
            "email": email,
            "password": "strongpassword123",
            "full_name": "Tutor Student"
        })
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Create Space and Project
        sp = await ac.post("/api/v1/spaces", json={"name": "DL Notes"}, headers=headers)
        space_id = sp.json()["id"]

        pr = await ac.post("/api/v1/projects", json={
            "space_id": space_id,
            "name": "Transformer Notes",
            "goal": "Master Scaled Dot-Product Attention"
        }, headers=headers)
        proj_id = pr.json()["id"]

        # 3. Upload & Index PDF
        with open(test_document_path, "rb") as f:
            up_res = await ac.post(
                f"/api/v1/projects/{proj_id}/documents/upload",
                files={"file": ("deep_learning_transformers.pdf", f, "application/pdf")},
                headers=headers
            )
        doc_id = up_res.json()["id"]
        async with async_session_maker() as session:
            await material_service.process_document_async(doc_id, session)

        # 4. TEST CASE 1: Grounded Question (Sufficient Evidence)
        grounded_question = "How is the weight for each value computed in scaled dot-product attention?"
        res1 = await ac.post(
            f"/api/v1/projects/{proj_id}/tutor/ask",
            json={"question": grounded_question},
            headers=headers
        )
        assert res1.status_code == 200
        raw_events = res1.text.strip().split("\n\n")

        events = []
        full_text = ""
        for raw in raw_events:
            if raw.startswith("data: "):
                payload = json.loads(raw[6:])
                events.append(payload)
                if payload.get("type") == "token":
                    full_text += payload["token"]

        meta_event = next((e for e in events if e.get("type") == "meta"), None)
        done_event = next((e for e in events if e.get("type") == "done"), None)

        assert meta_event is not None
        assert done_event is not None
        assert done_event["insufficient_evidence"] is False
        assert len(done_event["citations"]) >= 1
        assert done_event["citations"][0]["filename"] == "deep_learning_transformers.pdf"
        assert len(full_text) > 10
        print(f"\n[OK] Grounded Question Passed! Streamed text length: {len(full_text)}, Citations: {done_event['citations']}")

        # 5. TEST CASE 2: Out of Scope Question (Insufficient Evidence Refusal)
        out_of_scope_question = "How do you bake a triple chocolate fudge cake at home?"
        res2 = await ac.post(
            f"/api/v1/projects/{proj_id}/tutor/ask",
            json={"question": out_of_scope_question},
            headers=headers
        )
        assert res2.status_code == 200
        raw_events2 = res2.text.strip().split("\n\n")

        events2 = []
        refusal_text = ""
        for raw in raw_events2:
            if raw.startswith("data: "):
                payload = json.loads(raw[6:])
                events2.append(payload)
                if payload.get("type") == "token":
                    refusal_text += payload["token"]

        done_event2 = next((e for e in events2 if e.get("type") == "done"), None)
        assert done_event2 is not None
        assert done_event2["insufficient_evidence"] is True
        assert len(done_event2["citations"]) == 0
        print(f"[OK] Insufficient Evidence Refusal Passed! Refusal flag triggered, citations: 0.")
