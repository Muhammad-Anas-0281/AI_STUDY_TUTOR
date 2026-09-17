from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.project import ProjectResponse


class SpaceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class SpaceCreate(SpaceBase):
    pass


class SpaceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None


class SpaceResponse(SpaceBase):
    id: str
    user_id: str
    created_at: datetime
    projects_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)


class SpaceWithProjectsResponse(SpaceResponse):
    projects: List[ProjectResponse] = []
