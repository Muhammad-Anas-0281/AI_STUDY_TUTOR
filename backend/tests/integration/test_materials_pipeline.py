import os
import fitz  # PyMuPDF
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.session import async_session_maker
from app.db.models.user import User
from app.db.models.space import Space
from app.db.models.project import Project
from app.db.models.material import Document, Chunk
from app.services.material_service import material_service
from app.services.retrieval_service import retrieval_service
from sqlalchemy import select, delete


@pytest.fixture
def sample_pdf_path(tmp_path):
    pdf_path = str(tmp_path / "machine_learning_notes.pdf")
    doc = fitz.open()
    
    # Page 1: Attention Mechanism
    p1 = doc.new_page()
    p1.insert_text(
        (50, 50),
        "Machine Learning Notes - Chapter 1: Attention Mechanisms.\n"
        "The Attention mechanism allows the model to dynamically focus on different parts "
        "of the input sequence when generating each word of the output sequence. "
        "Self-Attention computes compatibility scores between Query and Key vectors using dot-product."
    )

    # Page 2: Positional Encoding & Feed Forward
    p2 = doc.new_page()
    p2.insert_text(
        (50, 50),
        "Machine Learning Notes - Chapter 2: Positional Encodings.\n"
        "Since Transformer models contain no recurrence or convolution, positional encodings "
        "are added to the input embeddings to inject information about the relative or absolute position of tokens."
    )

    doc.save(pdf_path)
    doc.close()
    return pdf_path


@pytest.mark.asyncio
async def test_material_ingestion_and_retrieval(sample_pdf_path):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Register test user
        email = "pipeline_test@studycompanion.ai"
        async with async_session_maker() as session:
            await session.execute(delete(User).where(User.email == email))
            await session.commit()

        reg = await ac.post("/api/v1/auth/register", json={
            "email": email,
            "password": "password12345",
            "full_name": "Pipeline Tester"
        })
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Create Space & Project A
        space_res = await ac.post("/api/v1/spaces", json={"name": "AI Space"}, headers=headers)
        space_id = space_res.json()["id"]

        proj_a_res = await ac.post("/api/v1/projects", json={
            "space_id": space_id,
            "name": "Transformer Notes"
        }, headers=headers)
        proj_a_id = proj_a_res.json()["id"]

        # 3. Create Project B (for isolation test)
        proj_b_res = await ac.post("/api/v1/projects", json={
            "space_id": space_id,
            "name": "Biology Notes"
        }, headers=headers)
        proj_b_id = proj_b_res.json()["id"]

        # 4. Upload PDF to Project A
        with open(sample_pdf_path, "rb") as f:
            upload_res = await ac.post(
                f"/api/v1/projects/{proj_a_id}/documents/upload",
                files={"file": ("machine_learning_notes.pdf", f, "application/pdf")},
                headers=headers
            )
        assert upload_res.status_code == 202
        doc_data = upload_res.json()
        doc_id = doc_data["id"]

        # 5. Process document directly with material_service
        async with async_session_maker() as session:
            await material_service.process_document_async(doc_id, session)

        # 6. Check document details and chunks
        doc_detail_res = await ac.get(f"/api/v1/documents/{doc_id}", headers=headers)
        assert doc_detail_res.status_code == 200
        detail = doc_detail_res.json()
        assert detail["status"] == "ready"
        assert detail["page_count"] == 2
        assert len(detail["chunks"]) >= 2

        # 7. Semantic Vector Search Query
        search_res = await ac.post(f"/api/v1/projects/{proj_a_id}/search", json={
            "query": "How do Query and Key vectors calculate attention scores?",
            "top_k": 3
        }, headers=headers)
        assert search_res.status_code == 200
        results = search_res.json()
        assert len(results) > 0
        top_match = results[0]
        assert "Self-Attention" in top_match["content"] or "Attention" in top_match["content"]
        assert top_match["page_number"] == 1
        assert top_match["similarity"] > 0.4
        print(f"\n[OK] Semantic Search Success: Top match similarity = {top_match['similarity']}, Page = {top_match['page_number']}")

        # 8. Hard Data Isolation Check (Search in Project B should return 0 results)
        search_b_res = await ac.post(f"/api/v1/projects/{proj_b_id}/search", json={
            "query": "Attention mechanism Query Key",
            "top_k": 3
        }, headers=headers)
        assert search_b_res.status_code == 200
        results_b = search_b_res.json()
        assert len(results_b) == 0
        print("[OK] Project Isolation Check Success: 0 chunks leaked to Project B!")
