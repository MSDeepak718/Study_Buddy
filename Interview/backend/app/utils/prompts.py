QUESTION_GENERATION_PROMPT = """You are an expert technical interviewer. Generate a high-quality interview question based on the provided context.

**CONTEXT FROM STUDY MATERIAL:**
{context}

**INTERVIEW PARAMETERS:**
- Topic: {topic}
- Difficulty Level: {difficulty}
- Question Number: {question_number} of {total_questions}

**PREVIOUSLY ASKED QUESTIONS (avoid duplicates):**
{previous_questions}

**RULES:**
1. Generate exactly ONE interview question.
2. The question must be directly related to the provided context.
3. Match the difficulty level:
   - EASY: Basic concept recall, definitions, simple explanations
   - MEDIUM: Application-level, "how" and "why" questions, comparisons
   - HARD: System design, edge cases, trade-offs, deep analysis
4. Make the question specific and interview-appropriate.
5. Do NOT ask yes/no questions.
6. Do NOT repeat any previously asked questions.
7. The question should test understanding, not just memorization.

**OUTPUT FORMAT:**
Return ONLY the question text. No numbering, no preamble, no explanation.
"""


ANSWER_EVALUATION_PROMPT = """You are an expert technical interviewer evaluating a candidate's answer.

**QUESTION:**
{question}

**CONTEXT (reference material):**
{context}

**CANDIDATE'S ANSWER:**
{answer}

**EVALUATION CRITERIA:**
Evaluate the answer on these dimensions (0-10 scale):

1. **Technical Accuracy** (0-10): Is the answer factually correct? Are technical concepts properly explained?
2. **Clarity** (0-10): Is the answer well-structured and easy to understand?
3. **Relevance** (0-10): Does the answer directly address the question asked?
4. **Completeness** (0-10): Does the answer cover all important aspects?

**SCORING GUIDE:**
- 0-2: Completely wrong or irrelevant
- 3-4: Partially correct but major gaps
- 5-6: Acceptable but missing important points
- 7-8: Good answer with minor improvements possible
- 9-10: Excellent, comprehensive answer

**OUTPUT FORMAT (respond ONLY with this JSON, no markdown code fences):**
{{
    "technical_accuracy": <score>,
    "clarity": <score>,
    "relevance": <score>,
    "completeness": <score>,
    "overall_score": <weighted_average>,
    "feedback": "<2-3 sentences of constructive feedback>",
    "strengths": "<what the candidate did well>",
    "weaknesses": "<areas for improvement>"
}}
"""


RECOMMENDATION_PROMPT = """Based on the following interview performance data, generate personalized recommendations.

**INTERVIEW SUMMARY:**
- Overall Score: {overall_score}/10
- Topic Scores: {topic_scores}
- Total Questions: {total_questions}

**QUESTION-WISE PERFORMANCE:**
{question_performance}

**GENERATE:**
1. Top 3 strengths demonstrated
2. Top 3 areas for improvement
3. 5 specific, actionable recommendations for improvement
4. 3-5 study resources or topics to focus on

**OUTPUT FORMAT (respond ONLY with this JSON, no markdown code fences):**
{{
    "strengths": ["strength1", "strength2", "strength3"],
    "weaknesses": ["weakness1", "weakness2", "weakness3"],
    "recommendations": ["rec1", "rec2", "rec3", "rec4", "rec5"],
    "study_resources": ["resource1", "resource2", "resource3"]
}}
"""


DSA_PROBLEM_GENERATION_PROMPT = """You are an expert DSA technical interviewer. Generate an authentic LeetCode problem (or LeetCode-style problem) based on the specified parameters.

**PARAMETERS:**
- Topic/Category: {topic} (e.g., Arrays, Strings, Dynamic Programming, Trees, Graphs, Two Pointers, Sliding Window, Heap)
- Difficulty Level: {difficulty} (Easy, Medium, Hard)

**RULES:**
1. Pull or format a real, authentic LeetCode problem corresponding to the topic and difficulty.
2. Provide a clear problem statement, input/output specifications, constraints, and examples.
3. Include starter code templates for both Python (3) and JavaScript.
4. Include at least 2 sample test cases (for candidate practice/run) and at least 3 hidden test cases (for grading).
5. Ensure the function signature in starter code matches the arguments used in test cases.

**OUTPUT FORMAT (respond ONLY with JSON, no markdown code fences):**
{{
    "title": "<LeetCode Problem Title, e.g. Two Sum>",
    "difficulty": "{difficulty}",
    "topic": "{topic}",
    "description": "<Full problem description with examples and rules>",
    "constraints": "<e.g., 1 <= nums.length <= 10^4>",
    "starter_code": {{
        "python": "def solution(nums, target):\n    # Write your solution here\n    pass",
        "javascript": "function solution(nums, target) {{\n    // Write your solution here\n}}"
    }},
    "sample_test_cases": [
        {{"input": "[2, 7, 11, 15], 9", "expected_output": "[0, 1]"}},
        {{"input": "[3, 2, 4], 6", "expected_output": "[1, 2]"}}
    ],
    "hidden_test_cases": [
        {{"input": "[3, 3], 6", "expected_output": "[0, 1]"}}
    ]
}}
"""


DSA_CODE_EVALUATION_PROMPT = """You are a senior LeetCode/DSA interviewer evaluating a candidate's code submission.

**PROBLEM:**
{problem_title} ({difficulty})
{problem_description}

**CANDIDATE CODE ({language}):**
{code}

**TEST CASE RESULTS:**
- Passed: {passed_test_cases}/{total_test_cases} test cases

**EVALUATION CRITERIA (0-10 scale):**
1. **Technical Accuracy**: Correctness, logic, correctness on edge cases.
2. **Clarity**: Code structure, variable naming, readability.
3. **Relevance**: Does the code solve the specific DSA problem cleanly?
4. **Completeness**: Efficient handling of constraints, time & space complexity.

**OUTPUT FORMAT (respond ONLY with JSON, no markdown code fences):**
{{
    "technical_accuracy": <score 0-10>,
    "clarity": <score 0-10>,
    "relevance": <score 0-10>,
    "completeness": <score 0-10>,
    "overall_score": <weighted_average 0-10>,
    "time_complexity": "<e.g., O(N) or O(N^2)>",
    "space_complexity": "<e.g., O(1) or O(N)>",
    "feedback": "<2-3 sentences of feedback>",
    "strengths": "<what the code did well>",
    "weaknesses": "<areas for optimization or edge case bugs>"
}}
"""

