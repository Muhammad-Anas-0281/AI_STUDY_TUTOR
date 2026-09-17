from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.db.models.user import User
from app.db.models.space import Space
from app.db.models.project import Project
from app.db.models.material import Document
from app.db.models.concept import Concept
from app.db.models.mastery import Mastery
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.core.deps import get_current_user, get_project_or_403

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=List[ProjectResponse])
async def list_user_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(Project)
        .join(Space, Project.space_id == Space.id)
        .where(Space.user_id == current_user.id)
        .options(
            selectinload(Project.documents),
            selectinload(Project.concepts),
            selectinload(Project.masteries)
        )
        .order_by(Project.created_at.desc())
    )
    result = await db.execute(query)
    projects = result.scalars().all()

    response = []
    for p in projects:
        avg_mastery = (
            sum(m.score for m in p.masteries) / len(p.masteries)
            if p.masteries else 0.0
        )
        response.append(ProjectResponse(
            id=p.id,
            space_id=p.space_id,
            name=p.name,
            description=p.description,
            goal=p.goal,
            created_at=p.created_at,
            document_count=len(p.documents),
            concept_count=len(p.concepts),
            average_mastery=round(avg_mastery, 1)
        ))
    return response


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_in: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify space belongs to current user
    space_query = select(Space).where(Space.id == project_in.space_id, Space.user_id == current_user.id)
    space_res = await db.execute(space_query)
    space = space_res.scalar_one_or_none()
    if not space:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Space not found or unauthorized"
        )

    project = Project(
        space_id=project_in.space_id,
        name=project_in.name,
        description=project_in.description,
        goal=project_in.goal
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)

    return ProjectResponse(
        id=project.id,
        space_id=project.space_id,
        name=project.name,
        description=project.description,
        goal=project.goal,
        created_at=project.created_at,
        document_count=0,
        concept_count=0,
        average_mastery=0.0
    )


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    project: Project = Depends(get_project_or_403),
    db: AsyncSession = Depends(get_db)
):
    # Load relationships for counts
    query = (
        select(Project)
        .where(Project.id == project_id)
        .options(
            selectinload(Project.documents),
            selectinload(Project.concepts),
            selectinload(Project.masteries)
        )
    )
    res = await db.execute(query)
    p = res.scalar_one()

    avg_mastery = (
        sum(m.score for m in p.masteries) / len(p.masteries)
        if p.masteries else 0.0
    )

    return ProjectResponse(
        id=p.id,
        space_id=p.space_id,
        name=p.name,
        description=p.description,
        goal=p.goal,
        created_at=p.created_at,
        document_count=len(p.documents),
        concept_count=len(p.concepts),
        average_mastery=round(avg_mastery, 1)
    )


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_in: ProjectUpdate,
    project: Project = Depends(get_project_or_403),
    db: AsyncSession = Depends(get_db)
):
    if project_in.name is not None:
        project.name = project_in.name
    if project_in.description is not None:
        project.description = project_in.description
    if project_in.goal is not None:
        project.goal = project_in.goal

    await db.commit()
    await db.refresh(project)

    return ProjectResponse(
        id=project.id,
        space_id=project.space_id,
        name=project.name,
        description=project.description,
        goal=project.goal,
        created_at=project.created_at
    )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    project: Project = Depends(get_project_or_403),
    db: AsyncSession = Depends(get_db)
):
    await db.delete(project)
    await db.commit()
    return None
