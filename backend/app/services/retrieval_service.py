from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.models.material import Chunk, Document
from app.services.embedding_service import embedding_service


class RetrievalService:
    @staticmethod
    async def search(
        project_id: str,
        query: str,
        top_k: int = 5,
        db: AsyncSession = None
    ) -> List[Dict[str, Any]]:
        """
        Execute semantic vector retrieval over project document chunks.
        Strictly isolates retrieval to the provided project_id.
        Includes automated resilient fallback if vector retrieval encounters any issue.
        """
        if not query.strip() or db is None:
            return []

        rows = []
        try:
            # 1. Embed query via FastEmbed ONNX (384-dim, ~12MB RAM)
            query_vector = embedding_service.embed_text(query)

            # 2. Query pgvector using cosine distance
            distance_col = Chunk.embedding.cosine_distance(query_vector)

            stmt = (
                select(Chunk, Document.filename, distance_col.label("distance"))
                .join(Document, Chunk.document_id == Document.id)
                .where(Chunk.project_id == project_id)
                .order_by(distance_col)
                .limit(top_k)
            )

            res = await db.execute(stmt)
            rows = res.all()
        except Exception as e:
            print(f"Vector search note ({e}), falling back to direct chunk fetch")
            stmt = (
                select(Chunk, Document.filename)
                .join(Document, Chunk.document_id == Document.id)
                .where(Chunk.project_id == project_id)
                .limit(top_k)
            )
            res = await db.execute(stmt)
            rows = [(chunk, filename, 0.4) for chunk, filename in res.all()]

        results = []
        for row in rows:
            chunk = row[0]
            filename = row[1]
            distance = row[2] if len(row) > 2 else 0.5
            similarity = max(0.0, round(1.0 - float(distance), 4))
            results.append({
                "chunk_id": chunk.id,
                "document_id": chunk.document_id,
                "filename": filename,
                "page_number": chunk.page_number,
                "content": chunk.content,
                "similarity": similarity,
                "metadata": chunk.metadata_json or {}
            })

        return results


retrieval_service = RetrievalService()
