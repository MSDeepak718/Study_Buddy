import logging
from sqlalchemy.orm import Session
from app.models.interview import Question, Answer
from app.models.evaluation import Evaluation
from app.services.gemini_service import gemini_service
from app.utils.prompts import ANSWER_EVALUATION_PROMPT

logger = logging.getLogger(__name__)


class EvaluationService:
    def evaluate_answer(self, db: Session, question: Question, answer: Answer) -> Evaluation:
        context = ""
        if question.context_chunks:
            context = "\n\n".join([f"[Ref {i+1}]: {c}" for i, c in enumerate(question.context_chunks)])

        prompt = ANSWER_EVALUATION_PROMPT.format(
            question=question.question_text,
            context=context or "No specific reference context available.",
            answer=answer.answer_text,
        )

        try:
            result = gemini_service.generate_json(prompt, temperature=0.3)
        except Exception as e:
            logger.error(f"Evaluation failed: {e}")
            result = {"technical_accuracy": 5, "clarity": 5, "relevance": 5, "completeness": 5, "overall_score": 5, "feedback": "Auto-evaluation failed.", "strengths": "N/A", "weaknesses": "N/A"}

        scores = [float(result.get("technical_accuracy", 0)), float(result.get("clarity", 0)), float(result.get("relevance", 0)), float(result.get("completeness", 0))]

        evaluation = Evaluation(
            answer_id=answer.id, question_id=question.id, session_id=answer.session_id,
            technical_accuracy=round(scores[0], 2), clarity=round(scores[1], 2),
            relevance=round(scores[2], 2), completeness=round(scores[3], 2),
            overall_score=round(sum(scores) / 4, 2),
            feedback=result.get("feedback", ""), strengths=result.get("strengths", ""),
            weaknesses=result.get("weaknesses", ""),
        )
        db.add(evaluation)
        db.commit()
        db.refresh(evaluation)
        return evaluation

    def submit_and_evaluate(self, db: Session, session_id: str, question_id: str, answer_text: str):
        question = db.query(Question).filter(Question.id == question_id).first()
        if not question:
            raise ValueError(f"Question not found: {question_id}")
        existing = db.query(Answer).filter(Answer.question_id == question_id).first()
        if existing:
            raise ValueError(f"Question already answered")

        answer = Answer(question_id=question_id, session_id=session_id, answer_text=answer_text)
        db.add(answer)
        db.commit()
        db.refresh(answer)
        evaluation = self.evaluate_answer(db, question, answer)
        return answer, evaluation

evaluation_service = EvaluationService()
