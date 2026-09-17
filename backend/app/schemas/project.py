from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    goal: Optional[str] = None


class ProjectCreate(ProjectBase):
    space_id: str


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    goal: Optional[str] = None


class ProjectResponse(ProjectBase):
    id: str
    space_id: str
    created_at: datetime
    document_count: Optional[int] = 0
    concept_count: Optional[int] = 0
    average_mastery: Optional[float] = 0.0

    model_config = ConfigDict(from_attributes=True)
