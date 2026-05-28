from pydantic import BaseModel, Field


class EvaluationResult(BaseModel):
    technical_accuracy: float = Field(ge=0, le=10)
    clarity: float = Field(ge=0, le=10)
    relevance: float = Field(ge=0, le=10)
    completeness: float = Field(ge=0, le=10)
    overall_score: float = Field(ge=0, le=10)
    feedback: str = ""
    strengths: str = ""
    weaknesses: str = ""

    model_config = {"from_attributes": True}


class QuestionAnalytics(BaseModel):
    question_number: int
    question_text: str
    topic: str | None
    difficulty: str
    answer_text: str
    evaluation: EvaluationResult


class TopicScore(BaseModel):
    topic: str
    avg_score: float
    question_count: int


class RecommendationResponse(BaseModel):
    strengths: list[str]
    weaknesses: list[str]
    recommendations: list[str]
    study_resources: list[str]


class DashboardResponse(BaseModel):
    session_id: str
    title: str
    status: str
    overall_score: float | None
    total_questions: int
    answered_questions: int
    topic_scores: list[TopicScore]
    question_analytics: list[QuestionAnalytics]
    evaluation_summary: dict
    recommendations: RecommendationResponse | None
