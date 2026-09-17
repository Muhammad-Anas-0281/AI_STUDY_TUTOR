import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.db.models.user import User
from app.db.models.project import Project
from app.db.models.space import Space
from app.db.models.conversation import TutorSession, TutorMessage
from app.schemas.tutor import TutorAskRequest, TutorSessionResponse, TutorMessageResponse
from app.core.deps import get_current_user, get_project_or_403
from app.services.tutor_service import tutor_service

router = APIRouter(tags=["AI Tutor"])


@router.post("/projects/{project_id}/tutor/ask")
async def ask_tutor_stream(
    project_id: str,
    body: TutorAskRequest,
    current_user: User = Depends(get_current_user),
    project: Project = Depends(get_project_or_403),
    db: AsyncSession = Depends(get_db)
):
    if not body.question.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty"
        )

    async def sse_event_stream():
        async for event in tutor_service.ask_stream(
            project=project,
            user_id=current_user.id,
            question=body.question.strip(),
            session_id=body.session_id,
            db=db
        ):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        sse_event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/projects/{project_id}/tutor/sessions", response_model=List[TutorSessionResponse])
async def list_tutor_sessions(
    project_id: str,
    project: Project = Depends(get_project_or_403),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(TutorSession)
        .where(TutorSession.project_id == project_id)
        .options(selectinload(TutorSession.messages))
        .order_by(TutorSession.created_at.desc())
    )
    result = await db.execute(query)
    sessions = result.scalars().all()

    resp = []
    for s in sessions:
        msgs = [
            TutorMessageResponse(
                id=m.id,
                session_id=m.session_id,
                role=m.role,
                content=m.content,
                citations=m.citations or [],
                confidence_score=m.confidence_score,
                insufficient_evidence=m.insufficient_evidence,
                created_at=m.created_at
            )
            for m in s.messages
        ]
        resp.append(TutorSessionResponse(
            id=s.id,
            project_id=s.project_id,
            title=s.title,
            created_at=s.created_at,
            messages=msgs
        ))
    return resp
