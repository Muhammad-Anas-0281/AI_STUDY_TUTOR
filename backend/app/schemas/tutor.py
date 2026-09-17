from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict


class TutorAskRequest(BaseModel):
    question: str
    session_id: Optional[str] = None


class CitationItem(BaseModel):
    filename: str
    page_number: int
    similarity: float


class TutorMessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    citations: List[Dict[str, Any]] = []
    confidence_score: float = 1.0
    insufficient_evidence: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TutorSessionResponse(BaseModel):
    id: str
    project_id: str
    title: str
    created_at: datetime
    messages: List[TutorMessageResponse] = []

    model_config = ConfigDict(from_attributes=True)
