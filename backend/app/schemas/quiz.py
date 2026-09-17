from datetime import datetime
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field


# --- Generation Models for LLM Structured Output ---

class GeneratedQuestion(BaseModel):
    concept_name: str = Field(..., description="Concept this question evaluates")
    type: Literal["mcq", "open_ended"] = Field(..., description="Type of question")
    difficulty: Literal["easy", "medium", "hard"] = Field(..., description="Difficulty level")
    prompt: str = Field(..., description="Clear and precise question statement grounded strictly in provided context")
    options: Optional[List[str]] = Field(None, description="4 distinct options for MCQ (first option does NOT have to be the correct one)")
    correct_answer: str = Field(..., description="The correct option string for MCQ, or the ideal reference answer for open-ended")
    explanation: str = Field(..., description="Detailed explanation of why the correct answer is true, referencing context")


class GeneratedQuiz(BaseModel):
    title: str = Field(..., description="Title of the quiz session")
    questions: List[GeneratedQuestion] = Field(..., description="List of generated questions")


class OpenEndedEvaluation(BaseModel):
    score: float = Field(..., description="Score from 0.0 to 1.0 based on correctness, depth, and precision")
    is_correct: bool = Field(..., description="True if score >= 0.65")
    understood: str = Field(..., description="What key concepts the student accurately explained")
    missing: str = Field(..., description="Key nuances, facts, or errors in the student's answer")
    key_concepts: List[str] = Field(default_factory=list, description="Core keywords/concepts the student should review")


# --- API Request & Response Schemas ---

class QuizGenerateRequest(BaseModel):
    num_questions: int = Field(default=4, ge=2, le=8, description="Number of questions to generate")
    difficulty: Optional[str] = Field(default="adaptive", description="easy, medium, hard, or adaptive")


class QuizQuestionItem(BaseModel):
    id: str
    concept_id: Optional[str] = None
    concept_name: Optional[str] = None
    type: str  # mcq or open_ended
    difficulty: str
    prompt: str
    options: Optional[List[str]] = None
    order_index: int

    class Config:
        from_attributes = True


class QuizAttemptResponse(BaseModel):
    id: str
    project_id: str
    status: str
    total_questions: int
    started_at: datetime
    questions: List[QuizQuestionItem]


class SingleAnswerSubmit(BaseModel):
    question_id: str
    user_response: str


class QuizSubmitRequest(BaseModel):
    answers: List[SingleAnswerSubmit]


class GradedAnswerFeedback(BaseModel):
    question_id: str
    concept_name: Optional[str] = None
    type: str
    user_response: str
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None
    is_correct: bool
    score: float  # 0.0 to 1.0
    rubric_feedback: Optional[Dict[str, Any]] = None


class MasteryDelta(BaseModel):
    concept_id: str
    concept_name: str
    old_score: float
    new_score: float
    delta: float
    status: str


class QuizResultResponse(BaseModel):
    attempt_id: str
    project_id: str
    total_score: float  # percentage 0 to 100
    total_questions: int
    correct_count: int
    completed_at: datetime
    answers: List[GradedAnswerFeedback]
    mastery_deltas: List[MasteryDelta]


class QuizHistorySummary(BaseModel):
    id: str
    project_id: str
    status: str
    score: Optional[float] = None
    total_questions: int
    started_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
