from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime
from app.schemas.evaluation import EvaluationResult


class InterviewConfigRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    topics: list[str] = Field(default_factory=list)
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")
    duration_minutes: int = Field(default=30, ge=5, le=180)
    num_questions: int = Field(default=10, ge=1, le=50)
    document_ids: list[str] = Field(default_factory=list)
    interview_mode: str = Field(default="chat", pattern="^(chat|voice|dsa|system_design|full_flow)$")
    dsa_problems: list[dict] = Field(default_factory=list)


class InterviewConfigResponse(BaseModel):
    id: str
    title: str
    topics: list[str]
    difficulty: str
    duration_minutes: int
    num_questions: int
    document_ids: list[str]
    interview_mode: str = "chat"
    invite_code: str = ""
    dsa_problems: list[dict] = Field(default_factory=list)
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
    dsa_problems: list[dict] = Field(default_factory=list)
    interview_mode: str = "chat"
    overall_score: float | None
    started_at: datetime | None
    completed_at: datetime | None
    candidate_name: str | None = None
    candidate_email: str | None = None
    attempt_count: int = 1
    max_attempts: int = 2
    is_disqualified: bool = False
    history: list[HistoricQuestionResponse] = Field(default_factory=list)


class VoiceTranscriptEntry(BaseModel):
    speaker: str
    text: str
    timestamp: int

class VoiceInterviewCompleteRequest(BaseModel):
    transcript: list[VoiceTranscriptEntry]


class RunDSACodeRequest(BaseModel):
    language: str
    code: str
    test_cases: list[dict]


class SubmitDSASolutionRequest(BaseModel):
    session_id: str
    problem_index: int = 0
    language: str
    code: str


class GenerateDSAProblemRequest(BaseModel):
    topic: str = "Arrays"
    difficulty: str = "Medium"


# Update forward reference
SubmitAnswerResponse.model_rebuild()
HistoricQuestionResponse.model_rebuild()
SessionInfoResponse.model_rebuild()

