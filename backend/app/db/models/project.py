import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    space_id: Mapped[str] = mapped_column(String(36), ForeignKey("spaces.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    goal: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    space: Mapped["Space"] = relationship("Space", back_populates="projects")
    documents: Mapped[List["Document"]] = relationship("Document", back_populates="project", cascade="all, delete-orphan")
    concepts: Mapped[List["Concept"]] = relationship("Concept", back_populates="project", cascade="all, delete-orphan")
    masteries: Mapped[List["Mastery"]] = relationship("Mastery", back_populates="project", cascade="all, delete-orphan")
    tutor_sessions: Mapped[List["TutorSession"]] = relationship("TutorSession", back_populates="project", cascade="all, delete-orphan")
    quiz_attempts: Mapped[List["QuizAttempt"]] = relationship("QuizAttempt", back_populates="project", cascade="all, delete-orphan")
    recommendations: Mapped[List["Recommendation"]] = relationship("Recommendation", back_populates="project", cascade="all, delete-orphan")
