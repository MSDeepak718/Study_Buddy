import logging
from collections import defaultdict
from sqlalchemy.orm import Session
from app.models.interview import InterviewSession, Question, Answer
from app.models.evaluation import Evaluation
from app.services.gemini_service import gemini_service
from app.utils.prompts import RECOMMENDATION_PROMPT
from app.schemas.evaluation import TopicScore, QuestionAnalytics, EvaluationResult, RecommendationResponse, DashboardResponse

logger = logging.getLogger(__name__)


class AnalyticsService:
    def get_session_dashboard(self, db: Session, session_id: str) -> DashboardResponse:
        session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
        if not session:
            raise ValueError(f"Session not found: {session_id}")

        config = session.configuration
        questions = session.questions
        evaluations = db.query(Evaluation).filter(Evaluation.session_id == session_id).all()
        eval_map = {e.question_id: e for e in evaluations}

        # Topic-wise scores
        topic_scores_raw = defaultdict(lambda: {"total": 0, "count": 0})
        question_analytics = []

        for q in questions:
            ev = eval_map.get(q.id)
            ans = db.query(Answer).filter(Answer.question_id == q.id).first()
            if ev and ans:
                topic = q.topic or "General"
                topic_scores_raw[topic]["total"] += ev.overall_score
                topic_scores_raw[topic]["count"] += 1
                question_analytics.append(QuestionAnalytics(
                    question_number=q.question_number, question_text=q.question_text,
                    topic=q.topic, difficulty=q.difficulty.value, answer_text=ans.answer_text,
                    evaluation=EvaluationResult(
                        technical_accuracy=ev.technical_accuracy, clarity=ev.clarity,
                        relevance=ev.relevance, completeness=ev.completeness,
                        overall_score=ev.overall_score, feedback=ev.feedback or "",
                        strengths=ev.strengths or "", weaknesses=ev.weaknesses or "",
                    ),
                ))

        topic_scores = [
            TopicScore(topic=t, avg_score=round(d["total"] / d["count"], 2), question_count=d["count"])
            for t, d in topic_scores_raw.items()
        ]

        # Summary
        avg_metrics = {"technical_accuracy": 0, "clarity": 0, "relevance": 0, "completeness": 0}
        if evaluations:
            for e in evaluations:
                avg_metrics["technical_accuracy"] += e.technical_accuracy
                avg_metrics["clarity"] += e.clarity
                avg_metrics["relevance"] += e.relevance
                avg_metrics["completeness"] += e.completeness
            for k in avg_metrics:
                avg_metrics[k] = round(avg_metrics[k] / len(evaluations), 2)

        # Recommendations (only for completed sessions)
        recommendations = None
        if session.status.value == "completed" and evaluations:
            if session.recommendations:
                recommendations = RecommendationResponse(**session.recommendations)
            else:
                recommendations_dict = self.generate_and_save_recommendations(db, session)
                if recommendations_dict:
                    recommendations = RecommendationResponse(**recommendations_dict)

        return DashboardResponse(
            session_id=session_id, title=config.title, status=session.status.value,
            overall_score=session.overall_score, total_questions=config.num_questions,
            answered_questions=len([q for q in questions if eval_map.get(q.id)]),
            topic_scores=topic_scores, question_analytics=question_analytics,
            evaluation_summary=avg_metrics, recommendations=recommendations,
        )

    def generate_and_save_recommendations(self, db: Session, session: InterviewSession) -> dict:
        """Generate recommendations using AI and save them to the session."""
        evaluations = db.query(Evaluation).filter(Evaluation.session_id == session.id).all()
        if not evaluations:
            return {}

        eval_map = {e.question_id: e for e in evaluations}
        topic_scores_raw = defaultdict(lambda: {"total": 0, "count": 0})
        question_analytics = []

        for q in session.questions:
            ev = eval_map.get(q.id)
            ans = db.query(Answer).filter(Answer.question_id == q.id).first()
            if ev and ans:
                topic = q.topic or "General"
                topic_scores_raw[topic]["total"] += ev.overall_score
                topic_scores_raw[topic]["count"] += 1
                question_analytics.append(QuestionAnalytics(
                    question_number=q.question_number, question_text=q.question_text,
                    topic=q.topic, difficulty=q.difficulty.value, answer_text=ans.answer_text,
                    evaluation=EvaluationResult(
                        technical_accuracy=ev.technical_accuracy, clarity=ev.clarity,
                        relevance=ev.relevance, completeness=ev.completeness,
                        overall_score=ev.overall_score, feedback=ev.feedback or "",
                        strengths=ev.strengths or "", weaknesses=ev.weaknesses or "",
                    ),
                ))

        topic_scores = [
            TopicScore(topic=t, avg_score=round(d["total"] / d["count"], 2), question_count=d["count"])
            for t, d in topic_scores_raw.items()
        ]

        recommendations_res = self._generate_recommendations(session, topic_scores, question_analytics)
        recommendations_dict = recommendations_res.model_dump()
        session.recommendations = recommendations_dict
        db.add(session)
        db.commit()
        return recommendations_dict

    def _generate_recommendations(self, session, topic_scores, question_analytics) -> RecommendationResponse:
        topic_str = ", ".join([f"{t.topic}: {t.avg_score}/10" for t in topic_scores])
        perf_str = "\n".join([
            f"Q{qa.question_number} ({qa.topic}, {qa.difficulty}): {qa.evaluation.overall_score}/10 - {qa.evaluation.feedback}"
            for qa in question_analytics
        ])

        prompt = RECOMMENDATION_PROMPT.format(
            overall_score=session.overall_score or 0,
            topic_scores=topic_str,
            total_questions=len(question_analytics),
            question_performance=perf_str,
        )

        try:
            result = gemini_service.generate_json(prompt, temperature=0.5)
            return RecommendationResponse(**result)
        except Exception as e:
            logger.error(f"Recommendation generation failed: {e}")
            return RecommendationResponse(
                strengths=["Unable to generate"], weaknesses=["Unable to generate"],
                recommendations=["Review your answers and try again"],
                study_resources=["Review course materials"],
            )

analytics_service = AnalyticsService()
