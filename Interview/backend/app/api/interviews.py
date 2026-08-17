from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.interview import (
    InterviewConfigRequest, InterviewConfigResponse, StartInterviewRequest,
    StartInterviewResponse, QuestionResponse, SubmitAnswerRequest, SubmitAnswerResponse, SessionInfoResponse,
    HistoricQuestionResponse,
)
from app.schemas.evaluation import EvaluationResult
from app.services.interview_service import interview_service
from app.services.evaluation_service import evaluation_service

from app.utils.deps import require_admin, get_current_user_optional, get_current_user

router = APIRouter(prefix="/interviews", tags=["Interviews"])


@router.post("/configure", response_model=InterviewConfigResponse)
def create_configuration(
    config: InterviewConfigRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Create a new interview configuration. Protected: Admin only."""
    result = interview_service.create_configuration(db, admin.id, config.model_dump())
    return InterviewConfigResponse(
        id=result.id, title=result.title, topics=result.topics or [],
        difficulty=result.difficulty.value, duration_minutes=result.duration_minutes,
        num_questions=result.num_questions, document_ids=result.document_ids or [],
        interview_mode=result.interview_mode.value if result.interview_mode else "chat",
        created_at=result.created_at,
    )


@router.get("/configurations")
def list_configurations(db: Session = Depends(get_db)):
    configs = interview_service.list_configurations(db)
    return [InterviewConfigResponse(
        id=c.id, title=c.title, topics=c.topics or [],
        difficulty=c.difficulty.value, duration_minutes=c.duration_minutes,
        num_questions=c.num_questions, document_ids=c.document_ids or [],
        interview_mode=c.interview_mode.value if c.interview_mode else "chat",
        created_at=c.created_at,
    ) for c in configs]


@router.delete("/configurations/{config_id}")
def delete_configuration(
    config_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Delete an interview configuration. Protected: Admin only."""
    success = interview_service.delete_configuration(db, config_id)
    if not success:
        raise HTTPException(404, "Configuration not found")
    return {"message": "Configuration deleted successfully"}


@router.put("/configurations/{config_id}", response_model=InterviewConfigResponse)
def update_configuration(
    config_id: str,
    config: InterviewConfigRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Update an interview configuration. Protected: Admin only."""
    try:
        updated = interview_service.update_configuration(db, config_id, config.model_dump())
        return InterviewConfigResponse(
            id=updated.id, title=updated.title, topics=updated.topics or [],
            difficulty=updated.difficulty.value, duration_minutes=updated.duration_minutes,
            num_questions=updated.num_questions, document_ids=updated.document_ids or [],
            interview_mode=updated.interview_mode.value if updated.interview_mode else "chat",
            created_at=updated.created_at,
        )
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.post("/start", response_model=StartInterviewResponse)
def start_interview(
    req: StartInterviewRequest,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    try:
        student_id = req.student_id
        if current_user:
            student_id = current_user.id
        elif student_id == "default":
            # Fallback for dev/unauthenticated candidate session creation
            student = db.query(User).filter(User.role == UserRole.STUDENT).first()
            if not student:
                student = User(name="Student Candidate", email="student@interview.ai", role=UserRole.STUDENT)
                db.add(student)
                db.commit()
                db.refresh(student)
            student_id = student.id
            
        session = interview_service.start_session(db, req.config_id, student_id)
        config = session.configuration
        return StartInterviewResponse(
            session_id=session.id, status=session.status.value,
            config=InterviewConfigResponse(
                id=config.id, title=config.title, topics=config.topics or [],
                difficulty=config.difficulty.value, duration_minutes=config.duration_minutes,
                num_questions=config.num_questions, document_ids=config.document_ids or [],
                interview_mode=config.interview_mode.value if config.interview_mode else "chat",
                created_at=config.created_at,
            ),
            message="Interview started",
        )
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.get("/{session_id}", response_model=SessionInfoResponse)
def get_session(session_id: str, db: Session = Depends(get_db)):
    session = interview_service.get_session(db, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    config = session.configuration
    answered = len([q for q in session.questions if q.answer])
    
    # Construct history
    history = []
    for q in session.questions:
        ans_text = q.answer.answer_text if q.answer else None
        eval_result = None
        if q.evaluation:
            eval_result = EvaluationResult(
                technical_accuracy=q.evaluation.technical_accuracy,
                clarity=q.evaluation.clarity,
                relevance=q.evaluation.relevance,
                completeness=q.evaluation.completeness,
                overall_score=q.evaluation.overall_score,
                feedback=q.evaluation.feedback or "",
                strengths=q.evaluation.strengths or "",
                weaknesses=q.evaluation.weaknesses or "",
            )
        history.append(HistoricQuestionResponse(
            question_id=q.id,
            question_number=q.question_number,
            question_text=q.question_text,
            topic=q.topic,
            difficulty=q.difficulty.value,
            answer_text=ans_text,
            evaluation=eval_result,
        ))

    return SessionInfoResponse(
        session_id=session.id, status=session.status.value, title=config.title,
        topics=config.topics or [], difficulty=config.difficulty.value,
        total_questions=config.num_questions, answered_questions=answered,
        duration_minutes=config.duration_minutes,
        interview_mode=config.interview_mode.value if config.interview_mode else "chat",
        overall_score=session.overall_score, started_at=session.started_at,
        completed_at=session.completed_at,
        history=history,
    )


@router.post("/{session_id}/question", response_model=QuestionResponse)
def generate_question(session_id: str, db: Session = Depends(get_db)):
    try:
        q = interview_service.generate_question(db, session_id)
        config = q.session.configuration
        return QuestionResponse(
            question_id=q.id, question_number=q.question_number,
            question_text=q.question_text, topic=q.topic,
            difficulty=q.difficulty.value, total_questions=config.num_questions,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/{session_id}/answer", response_model=SubmitAnswerResponse)
def submit_answer(session_id: str, req: SubmitAnswerRequest, db: Session = Depends(get_db)):
    try:
        answer, evaluation = evaluation_service.submit_and_evaluate(db, session_id, req.question_id, req.answer_text)
        session = interview_service.get_session(db, session_id)
        config = session.configuration
        answered = len([q for q in session.questions if q.answer])
        return SubmitAnswerResponse(
            answer_id=answer.id,
            evaluation=EvaluationResult(
                technical_accuracy=evaluation.technical_accuracy, clarity=evaluation.clarity,
                relevance=evaluation.relevance, completeness=evaluation.completeness,
                overall_score=evaluation.overall_score, feedback=evaluation.feedback or "",
                strengths=evaluation.strengths or "", weaknesses=evaluation.weaknesses or "",
            ),
            question_number=answer.question.question_number,
            total_questions=config.num_questions,
            is_last_question=(answered >= config.num_questions),
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/{session_id}/complete")
def complete_interview(session_id: str, db: Session = Depends(get_db)):
    try:
        session = interview_service.complete_session(db, session_id)
        return {"session_id": session.id, "status": session.status.value, "overall_score": session.overall_score}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/sessions/list")
def list_sessions(
    student_id: str = None,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    if current_user:
        if current_user.role == UserRole.STUDENT:
            student_id = current_user.id
    elif student_id == "default":
        student = db.query(User).filter(User.role == UserRole.STUDENT).first()
        if student:
            student_id = student.id

    sessions = interview_service.list_sessions(db, student_id)
    return [SessionInfoResponse(
        session_id=s.id, status=s.status.value, title=s.configuration.title,
        topics=s.configuration.topics or [], difficulty=s.configuration.difficulty.value,
        total_questions=s.configuration.num_questions,
        answered_questions=len([q for q in s.questions if q.answer]),
        duration_minutes=s.configuration.duration_minutes,
        interview_mode=s.configuration.interview_mode.value if s.configuration.interview_mode else "chat",
        overall_score=s.overall_score, started_at=s.started_at, completed_at=s.completed_at,
    ) for s in sessions]
