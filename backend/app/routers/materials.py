import os
import shutil
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.session import get_db, async_session_maker
from app.db.models.user import User
from app.db.models.project import Project
from app.db.models.space import Space
from app.db.models.material import Document, Chunk
from app.schemas.material import DocumentResponse, DocumentDetailResponse, ChunkResponse, SearchQuery, SearchResult
from app.core.deps import get_current_user, get_project_or_403
from app.services.material_service import material_service
from app.services.retrieval_service import retrieval_service

router = APIRouter(tags=["Materials"])


async def run_document_processing_job(document_id: str):
    """Background task runner for document extraction and pgvector indexing."""
    async with async_session_maker() as session:
        await material_service.process_document_async(document_id, session)


@router.post("/projects/{project_id}/documents/upload", response_model=DocumentResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    project_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    project: Project = Depends(get_project_or_403),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF documents are supported at this time."
        )

    # Ensure upload directory exists
    os.makedirs(settings.STORAGE_LOCAL_DIR, exist_ok=True)
    saved_filename = f"{project_id}_{file.filename}"
    file_path = os.path.join(settings.STORAGE_LOCAL_DIR, saved_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    document = Document(
        project_id=project_id,
        filename=file.filename,
        file_path=file_path,
        status="queued"
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)

    # Log learning event
    from app.services.event_service import event_service
    await event_service.log_event(
        db=db,
        user_id=current_user.id,
        event_type="material_uploaded",
        project_id=project_id,
        payload={"filename": file.filename, "document_id": document.id},
    )

    # Trigger background worker for extraction, chunking, and vector indexing
    background_tasks.add_task(run_document_processing_job, document.id)

    return DocumentResponse(
        id=document.id,
        project_id=document.project_id,
        filename=document.filename,
        status=document.status,
        page_count=document.page_count,
        error_message=document.error_message,
        created_at=document.created_at,
        chunks_count=0
    )


@router.get("/projects/{project_id}/documents", response_model=List[DocumentResponse])
async def list_project_documents(
    project_id: str,
    project: Project = Depends(get_project_or_403),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(Document)
        .where(Document.project_id == project_id)
        .options(selectinload(Document.chunks))
        .order_by(Document.created_at.desc())
    )
    result = await db.execute(query)
    docs = result.scalars().all()

    return [
        DocumentResponse(
            id=d.id,
            project_id=d.project_id,
            filename=d.filename,
            status=d.status,
            page_count=d.page_count,
            error_message=d.error_message,
            created_at=d.created_at,
            chunks_count=len(d.chunks)
        )
        for d in docs
    ]


@router.get("/documents/{document_id}", response_model=DocumentDetailResponse)
async def get_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(Document)
        .join(Project, Document.project_id == Project.id)
        .join(Space, Project.space_id == Space.id)
        .where(Document.id == document_id, Space.user_id == current_user.id)
        .options(selectinload(Document.chunks))
    )
    result = await db.execute(query)
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or unauthorized"
        )

    chunks_resp = [
        ChunkResponse(
            id=c.id,
            document_id=c.document_id,
            project_id=c.project_id,
            page_number=c.page_number,
            chunk_index=c.chunk_index,
            content=c.content,
            metadata_json=c.metadata_json or {},
            created_at=c.created_at
        )
        for c in doc.chunks
    ]

    return DocumentDetailResponse(
        id=doc.id,
        project_id=doc.project_id,
        filename=doc.filename,
        status=doc.status,
        page_count=doc.page_count,
        error_message=doc.error_message,
        created_at=doc.created_at,
        chunks_count=len(doc.chunks),
        chunks=chunks_resp
    )


@router.post("/projects/{project_id}/search", response_model=List[SearchResult])
async def search_materials(
    project_id: str,
    search_in: SearchQuery,
    project: Project = Depends(get_project_or_403),
    db: AsyncSession = Depends(get_db)
):
    results = await retrieval_service.search(
        project_id=project_id,
        query=search_in.query,
        top_k=search_in.top_k or 5,
        db=db
    )
    return [SearchResult(**r) for r in results]


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(Document)
        .join(Project, Document.project_id == Project.id)
        .join(Space, Project.space_id == Space.id)
        .where(Document.id == document_id, Space.user_id == current_user.id)
    )
    result = await db.execute(query)
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or unauthorized"
        )

    # Remove physical file if exists
    if doc.file_path and os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception:
            pass

    await db.delete(doc)
    await db.commit()
    return None
