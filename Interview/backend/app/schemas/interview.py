from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime
from app.schemas.evaluation import EvaluationResult


class InterviewConfigRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    topics: list[str] = Field(default_factory=list)
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")
    duration_minutes: int = Field(default=30, ge=5, le=60)
    num_questions: int = Field(default=10, ge=5, le=50)
    document_ids: list[str] = Field(default_factory=list)


class InterviewConfigResponse(BaseModel):
    id: str
    title: str
    topics: list[str]
    difficulty: str
    duration_minutes: int
    num_questions: int
    document_ids: list[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class StartInterviewRequest(BaseModel):
    config_id: str
    student_id: str


class StartInterviewResponse(BaseModel):
    session_id: str
    status: str
    config: InterviewConfigResponse
    message: str


class QuestionResponse(BaseModel):
    question_id: str
    question_number: int
    question_text: str
    topic: str | None
    difficulty: str
    total_questions: int


class SubmitAnswerRequest(BaseModel):
    question_id: str
    answer_text: str = Field(..., min_length=1)


class SubmitAnswerResponse(BaseModel):
    answer_id: str
    evaluation: "EvaluationResult"
    question_number: int
    total_questions: int
    is_last_question: bool


class HistoricQuestionResponse(BaseModel):
    question_id: str
    question_number: int
    question_text: str
    topic: str | None
    difficulty: str
    answer_text: Optional[str] = None
    evaluation: Optional[EvaluationResult] = None

    model_config = {"from_attributes": True}


class SessionInfoResponse(BaseModel):
    session_id: str
    status: str
    title: str
    topics: list[str]
    difficulty: str
    total_questions: int
    answered_questions: int
    duration_minutes: int
    overall_score: float | None
    started_at: datetime | None
    completed_at: datetime | None
    history: list[HistoricQuestionResponse] = Field(default_factory=list)


# Update forward reference
SubmitAnswerResponse.model_rebuild()
HistoricQuestionResponse.model_rebuild()
SessionInfoResponse.model_rebuild()
