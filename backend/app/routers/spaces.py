from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.db.models.user import User
from app.db.models.space import Space
from app.schemas.space import SpaceCreate, SpaceUpdate, SpaceResponse, SpaceWithProjectsResponse
from app.schemas.project import ProjectResponse
from app.core.deps import get_current_user

router = APIRouter(prefix="/spaces", tags=["Spaces"])


@router.get("", response_model=List[SpaceResponse])
async def list_spaces(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(Space)
        .where(Space.user_id == current_user.id)
        .options(selectinload(Space.projects))
        .order_by(Space.created_at.desc())
    )
    result = await db.execute(query)
    spaces = result.scalars().all()
    
    response = []
    for s in spaces:
        item = SpaceResponse(
            id=s.id,
            user_id=s.user_id,
            name=s.name,
            description=s.description,
            created_at=s.created_at,
            projects_count=len(s.projects)
        )
        response.append(item)
    return response


@router.post("", response_model=SpaceResponse, status_code=status.HTTP_201_CREATED)
async def create_space(
    space_in: SpaceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    space = Space(
        user_id=current_user.id,
        name=space_in.name,
        description=space_in.description
    )
    db.add(space)
    await db.commit()
    await db.refresh(space)
    return SpaceResponse(
        id=space.id,
        user_id=space.user_id,
        name=space.name,
        description=space.description,
        created_at=space.created_at,
        projects_count=0
    )


@router.get("/{space_id}", response_model=SpaceWithProjectsResponse)
async def get_space(
    space_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(Space)
        .where(Space.id == space_id, Space.user_id == current_user.id)
        .options(selectinload(Space.projects))
    )
    result = await db.execute(query)
    space = result.scalar_one_or_none()
    if not space:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Space not found"
        )
    
    projects_resp = [
        ProjectResponse(
            id=p.id,
            space_id=p.space_id,
            name=p.name,
            description=p.description,
            goal=p.goal,
            created_at=p.created_at
        ) for p in space.projects
    ]

    return SpaceWithProjectsResponse(
        id=space.id,
        user_id=space.user_id,
        name=space.name,
        description=space.description,
        created_at=space.created_at,
        projects_count=len(space.projects),
        projects=projects_resp
    )


@router.patch("/{space_id}", response_model=SpaceResponse)
async def update_space(
    space_id: str,
    space_in: SpaceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Space).where(Space.id == space_id, Space.user_id == current_user.id).options(selectinload(Space.projects))
    result = await db.execute(query)
    space = result.scalar_one_or_none()
    if not space:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Space not found"
        )
    
    if space_in.name is not None:
        space.name = space_in.name
    if space_in.description is not None:
        space.description = space_in.description

    await db.commit()
    await db.refresh(space)
    return SpaceResponse(
        id=space.id,
        user_id=space.user_id,
        name=space.name,
        description=space.description,
        created_at=space.created_at,
        projects_count=len(space.projects)
    )


@router.delete("/{space_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_space(
    space_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Space).where(Space.id == space_id, Space.user_id == current_user.id)
    result = await db.execute(query)
    space = result.scalar_one_or_none()
    if not space:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Space not found"
        )
    
    await db.delete(space)
    await db.commit()
    return None
