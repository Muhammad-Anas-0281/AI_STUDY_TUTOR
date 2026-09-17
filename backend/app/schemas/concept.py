from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class ConceptBase(BaseModel):
    name: str = Field(..., description="Name of the concept")
    description: Optional[str] = Field(None, description="Detailed explanation of the concept")


class ConceptCreate(ConceptBase):
    pass


class ConceptResponse(ConceptBase):
    id: str
    project_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class ConceptMasteryInfo(BaseModel):
    score: float = 0.0
    evidence_count: int = 0
    status: str = "needs_attention"
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ConceptWithMastery(ConceptResponse):
    mastery: Optional[ConceptMasteryInfo] = None


class ExtractedConcept(BaseModel):
    name: str = Field(..., description="Concise title of the concept (e.g., 'Attention Mechanism')")
    description: str = Field(..., description="1-2 sentence definition of the concept in the material context")


class ExtractedConceptsList(BaseModel):
    concepts: List[ExtractedConcept] = Field(..., description="5 to 10 distinct concepts extracted from the project study materials")
