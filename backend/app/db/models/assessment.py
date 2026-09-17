import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import String, Float, Boolean, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="in_progress", nullable=False)  # in_progress, completed
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    total_questions: Mapped[int] = mapped_column(default=0)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    project: Mapped["Project"] = relationship("Project", back_populates="quiz_attempts")
    questions: Mapped[List["Question"]] = relationship("Question", back_populates="attempt", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    attempt_id: Mapped[str] = mapped_column(String(36), ForeignKey("quiz_attempts.id", ondelete="CASCADE"), index=True, nullable=False)
    concept_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("concepts.id", ondelete="SET NULL"), nullable=True)
    type: Mapped[str] = mapped_column(String(50), default="mcq", nullable=False)  # mcq, open_ended
    difficulty: Mapped[str] = mapped_column(String(50), default="medium", nullable=False)  # easy, medium, hard
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)  # for MCQ
    correct_answer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(default=0)

    attempt: Mapped["QuizAttempt"] = relationship("QuizAttempt", back_populates="questions")
    answer: Mapped[Optional["Answer"]] = relationship("Answer", back_populates="question", uselist=False, cascade="all, delete-orphan")


class Answer(Base):
    __tablename__ = "answers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    question_id: Mapped[str] = mapped_column(String(36), ForeignKey("questions.id", ondelete="CASCADE"), index=True, nullable=False)
    user_response: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    score: Mapped[float] = mapped_column(Float, default=0.0)  # 0.0 to 1.0 or percentage
    feedback: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)  # structured feedback: understood, missing, key_concepts
    evaluated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    question: Mapped["Question"] = relationship("Question", back_populates="answer")
