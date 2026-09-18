import os
import pymupdf as fitz
from typing import List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.db.models.material import Document, Chunk
from app.services.embedding_service import embedding_service


class MaterialService:
    @staticmethod
    def extract_pages(file_path: str) -> List[Tuple[int, str]]:
        """Extract text page by page from PDF using PyMuPDF."""
        pages = []
        doc = fitz.open(file_path)
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text = page.get_text("text").strip()
            if text:
                pages.append((page_num + 1, text))
        doc.close()
        return pages

    @staticmethod
    def chunk_text(pages: List[Tuple[int, str]], chunk_size: int = 400, overlap: int = 80) -> List[Dict[str, Any]]:
        """
        Split text into overlapping semantic chunks preserving page metadata.
        Each chunk contains ~400-500 words with 80 words overlap.
        """
        chunks = []
        chunk_idx = 0

        for page_num, text in pages:
            words = text.split()
            if not words:
                continue

            # If page text is small, store as a single chunk
            if len(words) <= chunk_size:
                chunks.append({
                    "chunk_index": chunk_idx,
                    "page_number": page_num,
                    "content": " ".join(words),
                    "metadata": {"word_count": len(words), "page": page_num}
                })
                chunk_idx += 1
                continue

            # Overlapping sliding window
            i = 0
            while i < len(words):
                chunk_words = words[i : i + chunk_size]
                chunk_content = " ".join(chunk_words)
                chunks.append({
                    "chunk_index": chunk_idx,
                    "page_number": page_num,
                    "content": chunk_content,
                    "metadata": {"word_count": len(chunk_words), "page": page_num}
                })
                chunk_idx += 1
                i += (chunk_size - overlap)

        return chunks

    async def process_document_async(self, document_id: str, db: AsyncSession):
        """Extract, chunk, embed, and persist a document in Supabase with pgvector."""
        result = await db.execute(select(Document).where(Document.id == document_id))
        document = result.scalar_one_or_none()
        if not document:
            return

        try:
            document.status = "processing"
            await db.commit()

            file_path = document.file_path
            if not file_path or not os.path.exists(file_path):
                raise FileNotFoundError(f"Document file not found at {file_path}")

            # 1. Extract text from PDF
            pages = self.extract_pages(file_path)
            if not pages:
                raise ValueError("No extractable text found in document (scanned/empty PDF)")

            document.page_count = len(pages)

            # 2. Chunk text
            raw_chunks = self.chunk_text(pages)
            if not raw_chunks:
                raise ValueError("Failed to generate chunks from document")

            # 3. Generate embeddings locally in batch
            texts = [c["content"] for c in raw_chunks]
            embeddings = embedding_service.embed_batch(texts)

            # 4. Insert Chunk records with pgvector
            for c_data, emb in zip(raw_chunks, embeddings):
                chunk_obj = Chunk(
                    document_id=document.id,
                    project_id=document.project_id,
                    page_number=c_data["page_number"],
                    chunk_index=c_data["chunk_index"],
                    content=c_data["content"],
                    embedding=emb,
                    metadata_json=c_data["metadata"]
                )
                db.add(chunk_obj)

            document.status = "ready"
            document.error_message = None
            await db.commit()
            print(f"Successfully processed document {document.filename} into {len(raw_chunks)} chunks.")

        except Exception as e:
            await db.rollback()
            document.status = "failed"
            document.error_message = str(e)
            await db.commit()
            print(f"Failed to process document {document.filename}: {e}")


material_service = MaterialService()
