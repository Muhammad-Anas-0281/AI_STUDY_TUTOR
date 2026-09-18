import asyncio
import os
import sys
import json
import fitz

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.session import async_session_maker
from app.db.models.user import User
from app.services.material_service import material_service
from sqlalchemy import delete


async def run_test():
    print("Running AI Tutor Grounded & Refusal Test...")
    pdf_path = "./test_tutor_sample.pdf"
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

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        email = "tutor_eval_direct@studycompanion.ai"
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

        # Create Space and Project
        sp = await ac.post("/api/v1/spaces", json={"name": "DL Notes"}, headers=headers)
        space_id = sp.json()["id"]

        pr = await ac.post("/api/v1/projects", json={
            "space_id": space_id,
            "name": "Transformer Notes",
            "goal": "Master Scaled Dot-Product Attention"
        }, headers=headers)
        proj_id = pr.json()["id"]

        # Upload & Process PDF
        with open(pdf_path, "rb") as f:
            up_res = await ac.post(
                f"/api/v1/projects/{proj_id}/documents/upload",
                files={"file": ("test_tutor_sample.pdf", f, "application/pdf")},
                headers=headers
            )
        doc_id = up_res.json()["id"]
        async with async_session_maker() as session:
            await material_service.process_document_async(doc_id, session)

        # 1. Grounded Question Test
        print("\n--- Testing Grounded Question ---")
        grounded_q = "How is the weight for each value computed in scaled dot-product attention?"
        res1 = await ac.post(
            f"/api/v1/projects/{proj_id}/tutor/ask",
            json={"question": grounded_q},
            headers=headers
        )
        assert res1.status_code == 200
        raw_events1 = res1.text.strip().split("\n\n")

        events1 = [json.loads(r[6:]) for r in raw_events1 if r.startswith("data: ")]
        full_text1 = "".join([e["token"] for e in events1 if e.get("type") == "token"])
        meta1 = next((e for e in events1 if e.get("type") == "meta"), {})
        done1 = next((e for e in events1 if e.get("type") == "done"), {})

        print(f"Confidence Score: {meta1.get('confidence_score')}")
        print(f"Insufficient Evidence Flag: {done1.get('insufficient_evidence')}")
        print(f"Citations: {done1.get('citations')}")
        print(f"Response Preview: {full_text1[:150]}...")
        assert done1.get("insufficient_evidence") is False
        assert len(done1.get("citations", [])) >= 1

        # 2. Out-of-Scope Refusal Test
        print("\n--- Testing Out-of-Scope Question (Insufficient Evidence Refusal) ---")
        out_of_scope_q = "What is the recipe for baking chocolate fudge cookies?"
        res2 = await ac.post(
            f"/api/v1/projects/{proj_id}/tutor/ask",
            json={"question": out_of_scope_q},
            headers=headers
        )
        assert res2.status_code == 200
        raw_events2 = res2.text.strip().split("\n\n")

        events2 = [json.loads(r[6:]) for r in raw_events2 if r.startswith("data: ")]
        full_text2 = "".join([e["token"] for e in events2 if e.get("type") == "token"])
        done2 = next((e for e in events2 if e.get("type") == "done"), {})

        print(f"Insufficient Evidence Flag: {done2.get('insufficient_evidence')}")
        print(f"Citations: {done2.get('citations')}")
        print(f"Refusal Response Preview: {full_text2[:150]}...")
        assert done2.get("insufficient_evidence") is True
        assert len(done2.get("citations", [])) == 0

    if os.path.exists(pdf_path):
        os.remove(pdf_path)

    print("\nALL AI TUTOR TESTS PASSED PERFECTLY!")


if __name__ == "__main__":
    asyncio.run(run_test())
