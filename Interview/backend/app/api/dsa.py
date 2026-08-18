import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.interview import InterviewSession, Question, Answer
from app.models.evaluation import Evaluation
from app.models.user import User
from app.schemas.interview import (
    RunDSACodeRequest, SubmitDSASolutionRequest, GenerateDSAProblemRequest,
)
from app.schemas.evaluation import EvaluationResult
from app.services.dsa_executor import dsa_executor
from app.services.dsa_evaluator import dsa_evaluator
from app.services.interview_service import interview_service
from app.utils.deps import get_current_user_optional

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dsa", tags=["DSA"])


@router.post("/generate-problem")
def generate_dsa_problem(req: GenerateDSAProblemRequest):
    """Generate a LeetCode problem statement using Gemini."""
    try:
        problem = dsa_evaluator.generate_dsa_problem(topic=req.topic, difficulty=req.difficulty)
        return problem
    except Exception as e:
        logger.error(f"Error generating DSA problem: {e}")
        raise HTTPException(500, f"Failed to generate problem: {e}")


@router.post("/run-code")
def run_dsa_code(req: RunDSACodeRequest):
    """Execute code against provided test cases."""
    try:
        results = dsa_executor.execute_test_cases(
            language=req.language,
            code=req.code,
            test_cases=req.test_cases,
        )
        return results
    except Exception as e:
        logger.error(f"Error running DSA code: {e}")
        raise HTTPException(500, f"Execution failed: {e}")


@router.post("/submit-solution")
def submit_dsa_solution(
    req: SubmitDSASolutionRequest,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """
    Submit candidate DSA solution:
    1. Runs hidden test cases via dsa_executor
    2. Evaluates code with Gemini for time/space complexity & quality
    3. Saves result into unified Evaluation & InterviewSession schema for analytics
    """
    session = interview_service.get_session(db, req.session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    config = session.configuration
    dsa_problems = config.dsa_problems or []

    if not dsa_problems:
        # Fallback single problem if not explicitly defined
        problem = {
            "title": config.title or "DSA Coding Problem",
            "description": f"Solve the algorithm challenge for {', '.join(config.topics or ['DSA'])}",
            "difficulty": config.difficulty.value,
            "hidden_test_cases": [{"input": "sample", "expected_output": "sample"}],
        }
    else:
        idx = min(req.problem_index, len(dsa_problems) - 1)
        problem = dsa_problems[idx]

    # Combine sample and hidden test cases for full evaluation
    all_test_cases = problem.get("sample_test_cases", []) + problem.get("hidden_test_cases", [])
    if not all_test_cases:
        all_test_cases = [{"input": "1, 2", "expected_output": "3"}]

    # 1. Execute test cases
    exec_res = dsa_executor.execute_test_cases(
        language=req.language,
        code=req.code,
        test_cases=all_test_cases,
    )
    passed_count = exec_res["passed_count"]
    total_count = exec_res["total_count"]

    # 2. Evaluate solution with Gemini
    ai_eval = dsa_evaluator.evaluate_dsa_solution(
        problem_title=problem.get("title", "DSA Problem"),
        problem_description=problem.get("description", ""),
        difficulty=problem.get("difficulty", config.difficulty.value),
        language=req.language,
        code=req.code,
        passed_test_cases=passed_count,
        total_test_cases=total_count,
    )

    # 3. Save Question, Answer, and Evaluation into DB for unified analytics
    q_num = len(session.questions) + 1
    question = Question(
        session_id=session.id,
        question_number=q_num,
        question_text=f"DSA Problem: {problem.get('title', 'Coding Challenge')}\n{problem.get('description', '')}",
        topic="DSA",
        difficulty=config.difficulty,
    )
    db.add(question)
    db.commit()
    db.refresh(question)

    answer = Answer(
        question_id=question.id,
        session_id=session.id,
        answer_text=f"```{req.language}\n{req.code}\n```",
    )
    db.add(answer)
    db.commit()
    db.refresh(answer)

    evaluation = Evaluation(
        answer_id=answer.id,
        question_id=question.id,
        session_id=session.id,
        technical_accuracy=ai_eval["technical_accuracy"],
        clarity=ai_eval["clarity"],
        relevance=ai_eval["relevance"],
        completeness=ai_eval["completeness"],
        overall_score=ai_eval["overall_score"],
        feedback=f"[{ai_eval['time_complexity']} time | {ai_eval['space_complexity']} space] {ai_eval['feedback']}",
        strengths=ai_eval["strengths"],
        weaknesses=ai_eval["weaknesses"],
    )
    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)

    # Complete session
    interview_service.complete_session(db, session.id)

    return {
        "answer_id": answer.id,
        "evaluation": EvaluationResult(
            technical_accuracy=evaluation.technical_accuracy,
            clarity=evaluation.clarity,
            relevance=evaluation.relevance,
            completeness=evaluation.completeness,
            overall_score=evaluation.overall_score,
            feedback=evaluation.feedback or "",
            strengths=evaluation.strengths or "",
            weaknesses=evaluation.weaknesses or "",
        ),
        "test_results": exec_res,
        "time_complexity": ai_eval["time_complexity"],
        "space_complexity": ai_eval["space_complexity"],
        "is_last_question": True,
    }
