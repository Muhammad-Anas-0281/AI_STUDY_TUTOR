from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ConceptGrowthItem(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    score: float  # 0 to 100
    evidence_count: int
    status: str  # improving, stable, needs_attention
    updated_at: Optional[datetime] = None


class QuizTrendPoint(BaseModel):
    attempt_id: str
    date: str
    score: float
    total_questions: int


class WeakConceptAlert(BaseModel):
    concept_id: str
    concept_name: str
    current_score: float
    reason: str


class ProjectGrowthMetrics(BaseModel):
    project_id: str
    project_name: str
    average_mastery: float
    total_concepts: int
    improving_count: int
    stable_count: int
    needs_attention_count: int
    total_quizzes_taken: int
    recent_quiz_average: float
    concepts: List[ConceptGrowthItem]
    quiz_trend: List[QuizTrendPoint]
    weak_concept_alerts: List[WeakConceptAlert]
    activity_count: int


class GlobalAnalyticsSummary(BaseModel):
    total_spaces: int
    total_projects: int
    total_documents: int
    total_concepts: int
    total_quizzes_completed: int
    global_average_mastery: float
    learning_events_count: int
    recent_activity: List[Dict[str, Any]]
