import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.interview import (
    InterviewConfiguration, InterviewSession, Question, Answer,
    Difficulty, SessionStatus,
)
from app.models.user import User, UserRole
from app.services.rag_service import rag_service
from app.services.gemini_service import gemini_service
from app.utils.prompts import QUESTION_GENERATION_PROMPT

logger = logging.getLogger(__name__)


class InterviewService:
    """Service for interview session lifecycle management."""

    def create_configuration(
        self, db: Session, admin_id: str, config_data: dict
    ) -> InterviewConfiguration:
        """Create a new interview configuration."""
        from app.models.interview import InterviewMode
        config = InterviewConfiguration(
            created_by=admin_id,
            title=config_data["title"],
            topics=config_data.get("topics", []),
            difficulty=Difficulty(config_data.get("difficulty", "medium")),
            duration_minutes=config_data.get("duration_minutes", 30),
            num_questions=config_data.get("num_questions", 10),
            document_ids=config_data.get("document_ids", []),
            interview_mode=InterviewMode(config_data.get("interview_mode", "chat")),
            dsa_problems=config_data.get("dsa_problems", []),
        )
        db.add(config)
        db.commit()
        db.refresh(config)
        logger.info(f"Created interview config: {config.id} - {config.title}")
        return config

    def get_configuration_by_invite(self, db: Session, invite_code: str) -> InterviewConfiguration | None:
        """Find interview configuration by unique invite code."""
        return (
            db.query(InterviewConfiguration)
            .filter(InterviewConfiguration.invite_code == invite_code)
            .first()
        )

    def list_configurations(self, db: Session) -> list[InterviewConfiguration]:
        """List all interview configurations."""
        return (
            db.query(InterviewConfiguration)
            .order_by(InterviewConfiguration.created_at.desc())
            .all()
        )

    def update_configuration(
        self, db: Session, config_id: str, config_data: dict
    ) -> InterviewConfiguration:
        """Update an existing interview configuration."""
        config = (
            db.query(InterviewConfiguration)
            .filter(InterviewConfiguration.id == config_id)
            .first()
        )
        if not config:
            raise ValueError(f"Configuration not found: {config_id}")

        if "title" in config_data:
            config.title = config_data["title"]
        if "topics" in config_data:
            config.topics = config_data["topics"]
        if "difficulty" in config_data:
            config.difficulty = Difficulty(config_data["difficulty"])
        if "duration_minutes" in config_data:
            config.duration_minutes = config_data["duration_minutes"]
        if "num_questions" in config_data:
            config.num_questions = config_data["num_questions"]
        if "document_ids" in config_data:
            config.document_ids = config_data["document_ids"]
        if "interview_mode" in config_data:
            from app.models.interview import InterviewMode
            config.interview_mode = InterviewMode(config_data["interview_mode"])

        db.commit()
        db.refresh(config)
        logger.info(f"Updated interview config: {config.id}")
        return config

    def delete_configuration(self, db: Session, config_id: str) -> bool:
        """Delete an interview configuration and all its associated sessions, questions, answers, and evaluations."""
        config = (
            db.query(InterviewConfiguration)
            .filter(InterviewConfiguration.id == config_id)
            .first()
        )
        if not config:
            return False

        # Get all sessions associated with this configuration
        sessions = (
            db.query(InterviewSession)
            .filter(InterviewSession.config_id == config_id)
            .all()
        )

        for session in sessions:
            # Delete evaluations for this session
            from app.models.evaluation import Evaluation
            db.query(Evaluation).filter(Evaluation.session_id == session.id).delete()

            # Delete answers for this session
            db.query(Answer).filter(Answer.session_id == session.id).delete()

            # Delete questions for this session
            db.query(Question).filter(Question.session_id == session.id).delete()

            # Delete the session itself
            db.delete(session)

        # Delete the configuration
        db.delete(config)
        db.commit()
        logger.info(f"Deleted interview config: {config_id} and all related session data")
        return True

    def start_session(
        self, db: Session, config_id: str, student_id: str
    ) -> InterviewSession:
        """Start or retrieve an existing interview session for a candidate & configuration."""
        config = (
            db.query(InterviewConfiguration)
            .filter(InterviewConfiguration.id == config_id)
            .first()
        )
        if not config:
            raise ValueError(f"Configuration not found: {config_id}")

        # Check if an existing session already exists for this candidate & configuration
        existing_session = (
            db.query(InterviewSession)
            .filter(
                InterviewSession.config_id == config_id,
                InterviewSession.student_id == student_id,
            )
            .order_by(InterviewSession.started_at.desc())
            .first()
        )

        if existing_session:
            # Re-entry: Increment attempt count
            current_attempts = existing_session.attempt_count or 1
            new_attempts = current_attempts + 1
            existing_session.attempt_count = new_attempts

            max_att = existing_session.max_attempts or 2
            if new_attempts >= max_att:
                existing_session.is_disqualified = True
                existing_session.status = SessionStatus.FAILED
                existing_session.overall_score = 0.0

            db.commit()
            db.refresh(existing_session)
            logger.info(f"Re-entered existing interview session {existing_session.id}, attempt_count={existing_session.attempt_count}")
            return existing_session

        # First entry: Create new session
        session = InterviewSession(
            config_id=config_id,
            student_id=student_id,
            status=SessionStatus.IN_PROGRESS,
            started_at=datetime.now(timezone.utc),
            attempt_count=1,
            max_attempts=2,
            is_disqualified=False,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        logger.info(f"Started new interview session: {session.id}")
        return session

    def get_session(self, db: Session, session_id: str) -> InterviewSession | None:
        """Get session by ID."""
        return (
            db.query(InterviewSession)
            .filter(InterviewSession.id == session_id)
            .first()
        )

    def generate_question(self, db: Session, session_id: str) -> Question:
        """
        Generate the next interview question using RAG + Gemini.

        Pipeline:
        1. Determine question number and topic
        2. Retrieve relevant chunks from ChromaDB
        3. Generate question with Gemini using context
        4. Store and return question
        """
        # Lock the session row to prevent race conditions during concurrent/double requests
        session = (
            db.query(InterviewSession)
            .filter(InterviewSession.id == session_id)
            .with_for_update()
            .first()
        )
        if not session:
            raise ValueError(f"Session not found: {session_id}")

        config = session.configuration
        existing_questions = session.questions

        # Check if there is an active unanswered question already
        # If so, return it instead of generating a new one
        if existing_questions:
            last_q = existing_questions[-1]
            if not last_q.answer:
                logger.info(f"Returning existing unanswered question {last_q.question_number} for session {session_id}")
                return last_q

        question_number = len(existing_questions) + 1

        if question_number > config.num_questions:
            raise ValueError("All questions have been generated for this session")

        # Select topic (round-robin through configured topics)
        topics = config.topics if config.topics else ["General"]
        topic = topics[(question_number - 1) % len(topics)]

        # Retrieve relevant context from ChromaDB
        document_ids = config.document_ids if config.document_ids else None
        query = f"{topic} interview question {config.difficulty.value} difficulty"
        retrieved_chunks = rag_service.retrieve(
            query=query,
            n_results=5,
            document_ids=document_ids,
        )

        # Build context string
        context = "\n\n".join([
            f"[Chunk {i+1}]: {chunk['text']}"
            for i, chunk in enumerate(retrieved_chunks)
        ]) if retrieved_chunks else "No specific context available. Generate a general question on the topic."

        # Build previous questions list
        prev_questions = "\n".join([
            f"- {q.question_text}" for q in existing_questions
        ]) if existing_questions else "None"

        # Generate question with Gemini
        prompt = QUESTION_GENERATION_PROMPT.format(
            context=context,
            topic=topic,
            difficulty=config.difficulty.value.upper(),
            question_number=question_number,
            total_questions=config.num_questions,
            previous_questions=prev_questions,
        )

        question_text = gemini_service.generate_text(prompt, temperature=0.7)

        # Store question
        question = Question(
            session_id=session_id,
            question_number=question_number,
            question_text=question_text,
            topic=topic,
            difficulty=config.difficulty,
            context_chunks=[chunk["text"] for chunk in retrieved_chunks[:3]],
        )
        db.add(question)
        db.commit()
        db.refresh(question)

        logger.info(f"Generated question {question_number}/{config.num_questions} for session {session_id}")
        return question

    def complete_session(self, db: Session, session_id: str) -> InterviewSession:
        """Mark a session as completed and calculate overall score."""
        session = self.get_session(db, session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")

        # Calculate overall score from evaluations
        from app.models.evaluation import Evaluation
        evaluations = (
            db.query(Evaluation)
            .filter(Evaluation.session_id == session_id)
            .all()
        )

        if evaluations:
            overall_score = sum(e.overall_score for e in evaluations) / len(evaluations)
        else:
            overall_score = 0.0

        session.status = SessionStatus.COMPLETED
        session.completed_at = datetime.now(timezone.utc)
        session.overall_score = round(overall_score, 2)
        db.commit()
        db.refresh(session)

        # Generate and save recommendations once at completion
        try:
            from app.services.analytics_service import analytics_service
            analytics_service.generate_and_save_recommendations(db, session)
        except Exception as e:
            logger.error(f"Failed to generate recommendations at session completion: {e}")

        logger.info(f"Completed session {session_id} with score {overall_score:.2f}")
        return session

    def list_sessions(self, db: Session, student_id: str | None = None) -> list[InterviewSession]:
        """List sessions, optionally filtered by student."""
        query = db.query(InterviewSession).order_by(InterviewSession.started_at.desc())
        if student_id:
            query = query.filter(InterviewSession.student_id == student_id)
        return query.all()


# Singleton
interview_service = InterviewService()
