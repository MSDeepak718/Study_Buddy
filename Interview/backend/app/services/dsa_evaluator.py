import logging
from app.services.gemini_service import gemini_service
from app.utils.prompts import DSA_PROBLEM_GENERATION_PROMPT, DSA_CODE_EVALUATION_PROMPT

logger = logging.getLogger(__name__)


class DSAEvaluatorService:
    """Service using Gemini to generate LeetCode DSA problems and evaluate code submissions."""

    def generate_dsa_problem(self, topic: str = "Arrays", difficulty: str = "Medium") -> dict:
        """
        Generate a LeetCode problem statement with starter code & test cases using Gemini.
        """
        prompt = DSA_PROBLEM_GENERATION_PROMPT.format(topic=topic, difficulty=difficulty)
        try:
            res = gemini_service.generate_json(prompt, temperature=0.4)
            return res
        except Exception as e:
            logger.error(f"Failed to generate DSA problem: {e}")
            # Fallback mock LeetCode problem if Gemini is offline/rate limited
            return {
                "title": "Two Sum",
                "difficulty": difficulty,
                "topic": topic,
                "description": "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.",
                "constraints": "2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9",
                "starter_code": {
                    "python": "def solution(nums, target):\n    # Return indices of the two numbers\n    pass",
                    "javascript": "function solution(nums, target) {\n    // Return indices of the two numbers\n}"
                },
                "sample_test_cases": [
                    {"input": "[2, 7, 11, 15], 9", "expected_output": "[0, 1]"},
                    {"input": "[3, 2, 4], 6", "expected_output": "[1, 2]"}
                ],
                "hidden_test_cases": [
                    {"input": "[3, 3], 6", "expected_output": "[0, 1]"},
                    {"input": "[1, 5, 8, 3], 11", "expected_output": "[2, 3]"}
                ]
            }

    def evaluate_dsa_solution(
        self,
        problem_title: str,
        problem_description: str,
        difficulty: str,
        language: str,
        code: str,
        passed_test_cases: int,
        total_test_cases: int,
    ) -> dict:
        """
        Evaluate candidate code submission using Gemini AI to score technical accuracy, clarity, relevance,
        completeness, and provide time/space complexity and feedback.
        """
        prompt = DSA_CODE_EVALUATION_PROMPT.format(
            problem_title=problem_title,
            difficulty=difficulty,
            problem_description=problem_description,
            code=code,
            language=language,
            passed_test_cases=passed_test_cases,
            total_test_cases=total_test_cases,
        )

        try:
            eval_res = gemini_service.generate_json(prompt, temperature=0.3)
            # Ensure proper defaults for schema compatibility
            return {
                "technical_accuracy": float(eval_res.get("technical_accuracy", (passed_test_cases / max(total_test_cases, 1)) * 10)),
                "clarity": float(eval_res.get("clarity", 8.0)),
                "relevance": float(eval_res.get("relevance", 8.0)),
                "completeness": float(eval_res.get("completeness", (passed_test_cases / max(total_test_cases, 1)) * 10)),
                "overall_score": float(eval_res.get("overall_score", (passed_test_cases / max(total_test_cases, 1)) * 10)),
                "time_complexity": eval_res.get("time_complexity", "O(N)"),
                "space_complexity": eval_res.get("space_complexity", "O(N)"),
                "feedback": eval_res.get("feedback", f"Passed {passed_test_cases}/{total_test_cases} test cases."),
                "strengths": eval_res.get("strengths", "Good initial approach."),
                "weaknesses": eval_res.get("weaknesses", "Check edge cases and constraint boundaries."),
            }
        except Exception as e:
            logger.error(f"Failed to evaluate DSA solution with Gemini: {e}")
            ratio = (passed_test_cases / max(total_test_cases, 1)) * 10
            return {
                "technical_accuracy": round(ratio, 1),
                "clarity": 7.5,
                "relevance": 8.0,
                "completeness": round(ratio, 1),
                "overall_score": round(ratio, 1),
                "time_complexity": "O(N)",
                "space_complexity": "O(1)",
                "feedback": f"Code executed and passed {passed_test_cases} out of {total_test_cases} test cases.",
                "strengths": "Submitted solution passed automated test execution.",
                "weaknesses": "Review failed test cases if any.",
            }


dsa_evaluator = DSAEvaluatorService()
