export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'student';
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface DocumentInfo {
  id: string;
  filename: string;
  chunk_count: number;
  status: string;
  created_at: string;
}

export interface TestCase {
  input: string;
  expected_output: string;
}

export interface DSAProblem {
  title: string;
  difficulty: string;
  topic?: string;
  description: string;
  constraints?: string;
  starter_code?: {
    python?: string;
    javascript?: string;
  };
  sample_test_cases?: TestCase[];
  hidden_test_cases?: TestCase[];
}

export interface InterviewConfig {
  id: string;
  title: string;
  topics: string[];
  difficulty: string;
  duration_minutes: number;
  num_questions: number;
  document_ids: string[];
  interview_mode: 'chat' | 'voice' | 'dsa' | 'system_design' | 'full_flow';
  invite_code?: string;
  dsa_problems?: DSAProblem[];
  created_at: string;
}

export interface InterviewConfigRequest {
  title: string;
  topics: string[];
  difficulty: string;
  duration_minutes: number;
  num_questions: number;
  document_ids: string[];
  interview_mode: 'chat' | 'voice' | 'dsa' | 'system_design' | 'full_flow';
  dsa_problems?: DSAProblem[];
}

export interface StartInterviewRequest {
  config_id: string;
  student_id: string;
}

export interface HistoricQuestionData {
  question_id: string;
  question_number: number;
  question_text: string;
  topic: string | null;
  difficulty: string;
  answer_text: string | null;
  evaluation: EvaluationResult | null;
}

export interface SessionInfo {
  session_id: string;
  status: string;
  title: string;
  topics: string[];
  difficulty: string;
  total_questions: number;
  answered_questions: number;
  duration_minutes: number;
  interview_mode: string;
  overall_score: number | null;
  started_at: string | null;
  completed_at: string | null;
  candidate_name?: string;
  candidate_email?: string;
  attempt_count?: number;
  max_attempts?: number;
  is_disqualified?: boolean;
  dsa_problems?: DSAProblem[];
  history?: HistoricQuestionData[];
}

export interface QuestionData {
  question_id: string;
  question_number: number;
  question_text: string;
  topic: string | null;
  difficulty: string;
  total_questions: number;
}

export interface EvaluationResult {
  technical_accuracy: number;
  clarity: number;
  relevance: number;
  completeness: number;
  overall_score: number;
  feedback: string;
  strengths: string;
  weaknesses: string;
}

export interface SubmitAnswerResponse {
  answer_id: string;
  evaluation: EvaluationResult;
  question_number: number;
  total_questions: number;
  is_last_question: boolean;
}

export interface TopicScore {
  topic: string;
  avg_score: number;
  question_count: number;
}

export interface QuestionAnalytics {
  question_number: number;
  question_text: string;
  topic: string | null;
  difficulty: string;
  answer_text: string;
  evaluation: EvaluationResult;
}

export interface Recommendation {
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  study_resources: string[];
}

export interface DashboardData {
  session_id: string;
  title: string;
  status: string;
  overall_score: number | null;
  total_questions: number;
  answered_questions: number;
  topic_scores: TopicScore[];
  question_analytics: QuestionAnalytics[];
  evaluation_summary: Record<string, number>;
  recommendations: Recommendation | null;
}

export interface TestCaseResult {
  input: string;
  expected_output: string;
  actual_output: string;
  passed: boolean;
  error?: string | null;
  execution_time_ms: number;
}

export interface RunCodeResponse {
  passed_count: number;
  total_count: number;
  test_results: TestCaseResult[];
}

export interface SubmitDSAResponse {
  answer_id: string;
  evaluation: EvaluationResult;
  test_results: RunCodeResponse;
  time_complexity: string;
  space_complexity: string;
  is_last_question: boolean;
}

