from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class LearningEventBase(BaseModel):
    project_id: Optional[str] = None
    type: str = Field(..., description="Event type identifier, e.g. tutor_asked, quiz_completed, material_uploaded")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Metadata dictionary specific to the action")
    idempotency_key: Optional[str] = Field(None, description="Unique key to prevent duplicate event emission")


class LearningEventCreate(LearningEventBase):
    user_id: str


class LearningEventResponse(LearningEventBase):
    id: str
    user_id: str
    created_at: datetime

    class Config:
        from_attributes = True
