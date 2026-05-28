import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getSession, generateQuestion, submitAnswer, completeInterview } from '../services/api';
import type { SessionInfo, QuestionData, EvaluationResult } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

interface ChatMessage {
  type: 'question' | 'answer' | 'evaluation' | 'system';
  content: string;
  evaluation?: EvaluationResult;
  questionNum?: number;
}

const formatTime = (sec: number) => {
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function InterviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const lastSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (sessionId && lastSessionIdRef.current !== sessionId) {
      lastSessionIdRef.current = sessionId;
      loadSession();
    }
  }, [sessionId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSession = async () => {
    if (!sessionId) return;
    try {
      const s = await getSession(sessionId);
      setSession(s);
      if (s.status === 'completed') {
        setFinished(true);
        // Map complete history
        const historyMsgs: ChatMessage[] = [];
        historyMsgs.push({ type: 'system', content: `Welcome to "${s.title}" \nDifficulty: ${s.difficulty} • ${s.total_questions} questions\n\nLet's begin!` });
        
        if (s.history) {
          s.history.forEach(hq => {
            historyMsgs.push({ type: 'question', content: hq.question_text, questionNum: hq.question_number });
            if (hq.answer_text) {
              historyMsgs.push({ type: 'answer', content: hq.answer_text });
            }
            if (hq.evaluation) {
              historyMsgs.push({ type: 'evaluation', content: hq.evaluation.feedback, evaluation: hq.evaluation, questionNum: hq.question_number });
            }
          });
        }
        historyMsgs.push({ type: 'system', content: 'Interview completed! View your analytics dashboard for detailed results.' });
        setMessages(historyMsgs);
        return;
      }

      // Session in progress
      const historyMsgs: ChatMessage[] = [];
      historyMsgs.push({ type: 'system', content: `Welcome to "${s.title}" \nDifficulty: ${s.difficulty} • ${s.total_questions} questions\n\nLet's begin!` });

      let activeQ: QuestionData | null = null;

      const history = s.history;
      if (history && history.length > 0) {
        history.forEach((hq, idx) => {
          historyMsgs.push({ type: 'question', content: hq.question_text, questionNum: hq.question_number });
          if (hq.answer_text) {
            historyMsgs.push({ type: 'answer', content: hq.answer_text });
          }
          if (hq.evaluation) {
            historyMsgs.push({ type: 'evaluation', content: hq.evaluation.feedback, evaluation: hq.evaluation, questionNum: hq.question_number });
          }

          // If this is the last question in history and it has no answer, it is the active question
          if (idx === history.length - 1 && !hq.answer_text) {
            activeQ = {
              question_id: hq.question_id,
              question_number: hq.question_number,
              question_text: hq.question_text,
              topic: hq.topic || 'General',
              difficulty: hq.difficulty,
              total_questions: s.total_questions
            };
          }
        });
      }

      setMessages(historyMsgs);

      if (activeQ) {
        setCurrentQuestion(activeQ);
      } else {
        // No active unanswered question, fetch the next one
        await fetchNextQuestion();
      }
    } catch (e) { console.error(e); }
  };

  const fetchNextQuestion = async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const q = await generateQuestion(sessionId);
      setCurrentQuestion(q);
      setMessages(prev => [...prev, { type: 'question', content: q.question_text, questionNum: q.question_number }]);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || '';
      if (detail.includes('All questions')) {
        await handleComplete();
      }
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!sessionId || !currentQuestion || !answerText.trim()) return;
    setSubmitting(true);
    setMessages(prev => [...prev, { type: 'answer', content: answerText }]);
    const savedAnswer = answerText;
    setAnswerText('');

    try {
      const res = await submitAnswer(sessionId, currentQuestion.question_id, savedAnswer);
      setMessages(prev => [...prev, {
        type: 'evaluation', content: res.evaluation.feedback,
        evaluation: res.evaluation, questionNum: res.question_number,
      }]);

      if (res.is_last_question) {
        await handleComplete();
      } else {
        await fetchNextQuestion();
      }
    } catch (e) { console.error(e); }
    setSubmitting(false);
  };

  const handleComplete = async (reason?: 'timeout') => {
    if (!sessionId) return;
    try {
      await completeInterview(sessionId);
      setFinished(true);
      const msgContent = reason === 'timeout'
        ? 'Time is up! The interview has been automatically completed. View your analytics dashboard for detailed results.'
        : 'Interview completed! View your analytics dashboard for detailed results.';
      setMessages(prev => [...prev, { type: 'system', content: msgContent }]);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (!session || finished || session.status === 'completed') return;

    const startTime = session.started_at ? new Date(session.started_at).getTime() : Date.now();
    const durationMs = (session.duration_minutes || 30) * 60 * 1000;
    const endTime = startTime + durationMs;

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((endTime - now) / 1000));
      setTimeLeft(diff);

      if (diff <= 0) {
        clearInterval(timerId);
        handleComplete('timeout');
      }
    };

    updateTimer();
    const timerId = setInterval(updateTimer, 1000);

    return () => clearInterval(timerId);
  }, [session, finished]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!session) return <LoadingSpinner text="Loading interview session..." />;

  const progressPercentage = Math.round((session.answered_questions / session.total_questions) * 100);

  return (
    <div className="max-w-4xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-4 mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{session.title}</h1>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {session.difficulty} • Q{finished ? session.total_questions : Math.min(session.answered_questions + 1, session.total_questions)}/{session.total_questions}
          </p>
        </div>
        <div className="flex items-center gap-6">
          {/* Timer Clock */}
          {!finished && timeLeft !== null && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono text-sm" 
                 style={{ 
                   borderColor: timeLeft < 60 ? 'var(--color-danger)' : 'var(--color-border)', 
                   color: timeLeft < 60 ? 'var(--color-danger)' : 'var(--color-text-primary)',
                   background: timeLeft < 60 ? 'rgba(239, 68, 68, 0.1)' : 'var(--color-bg-elevated)'
                 }}>
              <span className={timeLeft < 60 ? 'animate-pulse' : ''}>Time Left: </span>
              <span>{formatTime(timeLeft)}</span>
            </div>
          )}
          {/* Progress */}
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {progressPercentage}% Completed
            </span>
            <div className="w-32 h-2 rounded-full" style={{ background: 'var(--color-bg-input)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'var(--gradient-primary)' }}
                animate={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
          {finished && (
            <button onClick={() => navigate(`/analytics/${sessionId}`)}
              className="px-4 py-2 rounded-xl text-sm font-medium" style={{ background: 'var(--color-primary)', color: '#fff' }}>
              View Analytics →
            </button>
          )}
        </div>
      </motion.div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto glass rounded-2xl p-4 mb-4 space-y-4">
        <AnimatePresence>
          {messages.map((msg, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              {msg.type === 'system' && (
                <div className="text-center py-3">
                  <div className="inline-block px-6 py-3 rounded-2xl text-sm" style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}>
                    <pre className="whitespace-pre-wrap font-[inherit]">{msg.content}</pre>
                  </div>
                </div>
              )}

              {msg.type === 'question' && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm" style={{ background: 'var(--gradient-primary)' }}>AI</div>
                  <div className="max-w-[80%]">
                    <span className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-primary-light)' }}>Question {msg.questionNum}</span>
                    <div className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm" style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              )}

              {msg.type === 'answer' && (
                <div className="flex gap-3 justify-end">
                  <div className="max-w-[80%]">
                    <div className="px-4 py-3 rounded-2xl rounded-tr-sm text-sm" style={{ background: 'var(--color-primary)', color: '#fff' }}>
                      {msg.content}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm" style={{ background: 'var(--color-bg-elevated)' }}>👤</div>
                </div>
              )}

              {msg.type === 'evaluation' && msg.evaluation && (
                <div className="ml-11 max-w-[80%]">
                  <div className="p-4 rounded-2xl space-y-3" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{msg.evaluation.feedback}</p>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {(loading || submitting) && <LoadingSpinner text={loading ? 'Generating question...' : 'Evaluating answer...'} />}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      {!finished && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-3 flex gap-3">
          <textarea
            value={answerText}
            onChange={e => setAnswerText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer... (Enter to submit, Shift+Enter for new line)"
            rows={2}
            className="flex-1 px-4 py-3 rounded-xl text-sm outline-none resize-none"
            style={{ background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
            disabled={submitting || loading || !currentQuestion}
          />
          <button onClick={handleSubmit} disabled={submitting || loading || !answerText.trim()}
            className="px-6 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: 'var(--gradient-primary)', color: '#fff' }}>
            {submitting ? '...' : 'Send'}
          </button>
        </motion.div>
      )}
    </div>
  );
}
