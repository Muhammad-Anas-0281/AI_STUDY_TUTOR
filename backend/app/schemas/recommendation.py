from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field


# --- LLM Structured Output Models ---

class GeneratedRecommendation(BaseModel):
    title: str = Field(..., description="Actionable title for the study recommendation (e.g., 'Master Self-Attention Formula')")
    text: str = Field(..., description="Detailed, evidence-grounded study instruction based on student mistakes and context")
    reason: str = Field(..., description="Transparent explanation of why this was recommended (e.g., 'Scored 0% on Q2 during last quiz')")
    action_type: Literal["tutor", "quiz", "materials"] = Field(
        default="tutor",
        description="Suggested action mode: tutor (ask deep question), quiz (take targeted quiz), or materials (review notes)"
    )
    target_concept: Optional[str] = Field(None, description="Name of the specific concept to review")


class GeneratedRecommendationsList(BaseModel):
    recommendations: List[GeneratedRecommendation] = Field(..., description="2 to 4 high-priority study recommendations")


# --- API Models ---

class RecommendationResponse(BaseModel):
    id: str
    project_id: str
    text: str
    reason: Optional[str] = None
    status: str  # pending, completed, dismissed
    created_at: datetime

    class Config:
        from_attributes = True


class RecommendationStatusUpdate(BaseModel):
    status: Literal["pending", "completed", "dismissed"]
