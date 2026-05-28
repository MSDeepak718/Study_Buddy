import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    String, Integer, Float, Text, ForeignKey,
    DateTime, Enum as SAEnum, JSON
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum


class Difficulty(str, enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class SessionStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class InterviewConfiguration(Base):
    __tablename__ = "interview_configurations"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    created_by: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    topics: Mapped[dict] = mapped_column(JSON, default=list)
    difficulty: Mapped[Difficulty] = mapped_column(
        SAEnum(Difficulty), default=Difficulty.MEDIUM
    )
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30)
    num_questions: Mapped[int] = mapped_column(Integer, default=10)
    document_ids: Mapped[dict] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    creator = relationship("User", back_populates="configurations")
    sessions = relationship("InterviewSession", back_populates="configuration")

    def __repr__(self) -> str:
        return f"<InterviewConfiguration(id={self.id}, title={self.title})>"


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    config_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("interview_configurations.id"), nullable=False
    )
    student_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    status: Mapped[SessionStatus] = mapped_column(
        SAEnum(SessionStatus), default=SessionStatus.PENDING
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    overall_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    recommendations: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Relationships
    configuration = relationship("InterviewConfiguration", back_populates="sessions")
    student = relationship("User", back_populates="sessions")
    questions = relationship("Question", back_populates="session", order_by="Question.question_number")
    answers = relationship("Answer", back_populates="session")

    def __repr__(self) -> str:
        return f"<InterviewSession(id={self.id}, status={self.status})>"


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("interview_sessions.id"), nullable=False
    )
    question_number: Mapped[int] = mapped_column(Integer, nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    topic: Mapped[str] = mapped_column(String(255), nullable=True)
    difficulty: Mapped[Difficulty] = mapped_column(
        SAEnum(Difficulty), default=Difficulty.MEDIUM
    )
    context_chunks: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    session = relationship("InterviewSession", back_populates="questions")
    answer = relationship("Answer", back_populates="question", uselist=False)
    evaluation = relationship("Evaluation", back_populates="question", uselist=False)

    def __repr__(self) -> str:
        return f"<Question(id={self.id}, number={self.question_number})>"


class Answer(Base):
    __tablename__ = "answers"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    question_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("questions.id"), nullable=False, unique=True
    )
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("interview_sessions.id"), nullable=False
    )
    answer_text: Mapped[str] = mapped_column(Text, nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    question = relationship("Question", back_populates="answer")
    session = relationship("InterviewSession", back_populates="answers")
    evaluation = relationship("Evaluation", back_populates="answer", uselist=False)

    def __repr__(self) -> str:
        return f"<Answer(id={self.id}, question_id={self.question_id})>"
