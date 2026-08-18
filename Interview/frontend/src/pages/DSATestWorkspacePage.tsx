import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getSession, runDSACode, submitDSASolution, incrementAttempt } from '../services/api';
import type { SessionInfo, DSAProblem, TestCaseResult, EvaluationResult } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import {
  Code, Play, PaperPlaneRight, Sparkle, ShieldCheck, Cpu,
  ArrowLeft, Clock, CheckCircle, XCircle, TerminalWindow, Globe, CornersOut,
  WarningOctagon, Eye
} from '@phosphor-icons/react';

export default function DSATestWorkspacePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [problem, setProblem] = useState<DSAProblem | null>(null);
  const [loading, setLoading] = useState(true);

  // Active Compiler Tab: 'onlinecompiler' (onlinecompiler.io widget) | 'custom_editor'
  const [activeCompiler, setActiveCompiler] = useState<'onlinecompiler' | 'custom_editor'>('onlinecompiler');

  // Candidate Code State & Execution
  const [language, setLanguage] = useState<'python' | 'javascript'>('python');
  const [code, setCode] = useState('');
  const [runningCode, setRunningCode] = useState(false);
  const [testResults, setTestResults] = useState<TestCaseResult[]>([]);
  const [runSummary, setRunSummary] = useState<{ passed: number; total: number } | null>(null);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<{
    evaluation: EvaluationResult;
    timeComplexity: string;
    spaceComplexity: string;
  } | null>(null);

  // Load onlinecompiler.io widget script dynamically
  useEffect(() => {
    if (activeCompiler !== 'onlinecompiler') return;

    const scriptId = 'online-compiler-widget-script';
    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://onlinecompiler.io/widget.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      const s = document.getElementById(scriptId);
      if (s) s.remove();
    };
  }, [activeCompiler]);

  const [selectedProblemIndex, setSelectedProblemIndex] = useState(0);

  useEffect(() => {
    if (!sessionId) return;
    getSession(sessionId)
      .then((data) => {
        setSession(data);

        let activeProblem: DSAProblem;
        if (data.dsa_problems && data.dsa_problems.length > 0) {
          const rawProb = data.dsa_problems[selectedProblemIndex] || data.dsa_problems[0];
          activeProblem = {
            title: rawProb.title || data.title,
            difficulty: rawProb.difficulty || data.difficulty,
            description: rawProb.description || "",
            constraints: rawProb.constraints || "",
            starter_code: rawProb.starter_code || {
              python: "def solution():\n    # Write your solution here\n    pass",
              javascript: "function solution() {\n    // Write your solution here\n}"
            },
            sample_test_cases: rawProb.sample_test_cases || [],
            hidden_test_cases: rawProb.hidden_test_cases || [],
          };
        } else {
          activeProblem = {
            title: data.title || "Two Sum (LeetCode #1)",
            difficulty: data.difficulty || "Medium",
            description: "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.",
            constraints: "2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9",
            starter_code: {
              python: "def solution(nums, target):\n    # Write your solution here\n    seen = {}\n    for i, num in enumerate(nums):\n        diff = target - num\n        if diff in seen:\n            return [seen[diff], i]\n        seen[num] = i\n    return []\n",
              javascript: "function solution(nums, target) {\n    // Write your solution here\n    const seen = new Map();\n    for (let i = 0; i < nums.length; i++) {\n        const diff = target - nums[i];\n        if (seen.has(diff)) return [seen.get(diff), i];\n        seen.set(nums[i], i);\n    }\n    return [];\n}"
            },
            sample_test_cases: [
              { input: "[2, 7, 11, 15], 9", expected_output: "[0, 1]" },
              { input: "[3, 2, 4], 6", expected_output: "[1, 2]" }
            ]
          };
        }
        setProblem(activeProblem);
        setCode(activeProblem.starter_code?.python || '');
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [sessionId, selectedProblemIndex]);

  // Candidate Anti-Cheating & Tab Exit Listener
  useEffect(() => {
    if (!sessionId || isAdmin || !session) return;
    if (session.is_disqualified || session.status === 'completed' || session.status === 'failed') return;

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        try {
          const res = await incrementAttempt(sessionId);
          setSession((prev) => prev ? {
            ...prev,
            attempt_count: res.attempt_count,
            max_attempts: res.max_attempts,
            is_disqualified: res.is_disqualified,
            status: res.status,
          } : null);
        } catch (err) {
          console.error('Failed to update attempt count:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sessionId, isAdmin, session?.is_disqualified, session?.status]);

  const handleLanguageChange = (lang: 'python' | 'javascript') => {
    setLanguage(lang);
    if (problem?.starter_code) {
      setCode(lang === 'python' ? problem.starter_code.python || '' : problem.starter_code.javascript || '');
    }
  };

  const handleRunCode = async () => {
    if (!code.trim() || !problem) return;
    setRunningCode(true);
    try {
      const testCases = problem.sample_test_cases || [];
      const res = await runDSACode(language, code, testCases);
      setTestResults(res.test_results || []);
      setRunSummary({ passed: res.passed_count, total: res.total_count });
    } catch (err) {
      console.error(err);
    } finally {
      setRunningCode(false);
    }
  };

  const handleSubmitSolution = async () => {
    if (isAdmin) {
      navigate(`/analytics/${sessionId}`);
      return;
    }
    if (!sessionId || !code.trim()) return;
    setSubmitting(true);
    try {
      const res = await submitDSASolution(sessionId, language, code, 0);
      setSubmissionFeedback({
        evaluation: res.evaluation,
        timeComplexity: res.time_complexity,
        spaceComplexity: res.space_complexity,
      });
      setTimeout(() => {
        navigate(`/analytics/${sessionId}`);
      }, 2500);
    } catch (err) {
      console.error(err);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center">
        <LoadingSpinner text="Loading Compiler Workspace..." />
      </div>
    );
  }

  // Disqualification Card for Candidates Exceeding Attempts
  if (!isAdmin && session && (session.is_disqualified || session.status === 'failed' || (session.attempt_count && session.attempt_count > (session.max_attempts || 2)))) {
    return (
      <div className="max-w-xl mx-auto my-20 p-8 glass rounded-3xl text-center space-y-6 border border-rose-500/40 shadow-2xl">
        <div className="w-20 h-20 rounded-3xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto shadow-lg">
          <WarningOctagon size={48} weight="fill" />
        </div>
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Anti-Cheating Policy Violation</span>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">Assessment Disqualified & Failed</h2>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
          You have exceeded the maximum allowed window/tab exits (<strong>{session.attempt_count || 2} / {session.max_attempts || 2}</strong>). To preserve assessment integrity, your session has been terminated and marked as <strong>Failed (0/10)</strong>.
        </p>
        <button
          onClick={() => navigate(`/analytics/${sessionId}`)}
          className="w-full py-4 rounded-2xl text-base font-bold flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white cursor-pointer transition-all shadow-lg"
        >
          View Assessment Analytics & Report
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto py-4 px-2 space-y-4">
      {/* Admin Monitoring Banner */}
      {isAdmin && (
        <div className="glass rounded-xl p-3 bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2 font-bold">
            <Eye size={18} weight="bold" /> Admin Workspace Monitor Mode
            <span className="font-normal text-amber-200">
              • Viewing Candidate: <strong>{session?.candidate_name || 'Candidate'}</strong> ({session?.candidate_email})
            </span>
          </div>
          <button
            onClick={() => navigate(`/analytics/${sessionId}`)}
            className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold cursor-pointer transition-all"
          >
            Open Evaluation Scorecard
          </button>
        </div>
      )}

      {/* Workspace Top Header Bar */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 border border-[var(--color-border)]"
      >
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/sessions')} className="p-2 rounded-xl bg-[var(--color-bg-input)] hover:opacity-80 transition-all cursor-pointer">
            <ArrowLeft size={18} />
          </button>
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
            <Code size={24} weight="bold" />
          </div>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              {problem?.title || session?.title}
              <span className="text-xs px-2 py-0.5 rounded-full font-bold uppercase" style={{
                background: 'rgba(129, 255, 107, 0.15)', color: 'var(--color-primary)'
              }}>
                {problem?.difficulty || session?.difficulty}
              </span>
            </h1>
            <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-2">
              <span>OnlineCompiler.io Embedded Workspace • Session #{sessionId?.substring(0, 8)}</span>
              {!isAdmin && session?.attempt_count && (
                <span className="text-amber-400 font-bold">
                  (Tab Exits: {(session.attempt_count || 1) - 1} / {(session.max_attempts || 2) - 1})
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Workspace Tab Controls */}
          <div className="flex items-center bg-[var(--color-bg-input)] p-1 rounded-xl border border-[var(--color-border)] text-xs font-bold">
            <button onClick={() => setActiveCompiler('onlinecompiler')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeCompiler === 'onlinecompiler' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)]'
              }`}
            >
              <Globe size={16} /> OnlineCompiler.io Widget
            </button>
            <button onClick={() => setActiveCompiler('custom_editor')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeCompiler === 'custom_editor' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)]'
              }`}
            >
              <TerminalWindow size={16} /> Test Case Runner & Editor
            </button>
          </div>

          {activeCompiler === 'custom_editor' && (
            <div className="flex items-center bg-[var(--color-bg-input)] p-1 rounded-xl border border-[var(--color-border)]">
              <button onClick={() => handleLanguageChange('python')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  language === 'python' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)]'
                }`}
              >
                Python 3
              </button>
              <button onClick={() => handleLanguageChange('javascript')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  language === 'javascript' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)]'
                }`}
              >
                JavaScript
              </button>
            </div>
          )}

          {activeCompiler === 'custom_editor' && (
            <button onClick={handleRunCode} disabled={runningCode}
              className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all cursor-pointer"
            >
              <Play size={16} weight="fill" />
              {runningCode ? 'Running...' : 'Run Test Cases'}
            </button>
          )}

          <button
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
              } else {
                document.exitFullscreen().catch(() => {});
              }
            }}
            title="Toggle Full Screen Mode"
            className="p-2 rounded-xl bg-[var(--color-bg-input)] border border-[var(--color-border)] hover:text-white transition-all cursor-pointer text-[var(--color-text-secondary)]"
          >
            <CornersOut size={18} />
          </button>

          <button onClick={handleSubmitSolution} disabled={submitting}
            className="px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all hover:opacity-90 cursor-pointer shadow-lg"
            style={{ background: 'var(--gradient-primary)', color: '#fff' }}
          >
            <PaperPlaneRight size={16} weight="bold" />
            {isAdmin ? 'View Evaluation Score' : submitting ? 'Evaluating & Saving...' : 'Submit Assessment'}
          </button>
        </div>
      </motion.div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[75vh]">
        {/* Left Column: Problem Description & Constraints */}
        <div className="lg:col-span-5 glass rounded-2xl p-6 flex flex-col justify-between space-y-6 overflow-y-auto max-h-[80vh]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold flex items-center gap-2 text-[var(--color-primary)]">
                <ShieldCheck size={20} weight="bold" /> Problem Statement
              </h2>

              {session?.dsa_problems && session.dsa_problems.length > 1 && (
                <div className="flex items-center gap-1 bg-[var(--color-bg-input)] p-1 rounded-xl border border-[var(--color-border)] text-xs font-bold">
                  {session.dsa_problems.map((p, idx) => (
                    <button
                      key={idx}
                      title={p.title}
                      onClick={() => setSelectedProblemIndex(idx)}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        selectedProblemIndex === idx ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)]'
                      }`}
                    >
                      P{idx + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="text-sm space-y-3 leading-relaxed text-[var(--color-text-primary)] whitespace-pre-line">
              {problem?.description}
            </div>

            {problem?.constraints && (
              <div className="space-y-1.5 pt-4 border-t border-[var(--color-border)]">
                <h3 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Constraints</h3>
                <pre className="text-xs p-3 rounded-xl bg-[var(--color-bg-input)] text-emerald-300 font-mono overflow-x-auto">
                  {problem.constraints}
                </pre>
              </div>
            )}

            {problem?.sample_test_cases && (
              <div className="space-y-2 pt-4 border-t border-[var(--color-border)]">
                <h3 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Sample Inputs & Expected Outputs</h3>
                <div className="space-y-2">
                  {problem.sample_test_cases.map((tc, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-xs space-y-1">
                      <p><span className="text-[var(--color-text-muted)] font-mono">Input:</span> <code className="text-emerald-400 font-mono">{tc.input}</code></p>
                      <p><span className="text-[var(--color-text-muted)] font-mono">Expected:</span> <code className="text-emerald-400 font-mono">{tc.expected_output}</code></p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: OnlineCompiler Widget OR Custom Editor */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          {activeCompiler === 'onlinecompiler' ? (
            <div className="glass rounded-2xl p-4 flex-1 flex flex-col min-h-[680px]">
              <div className="flex items-center justify-between mb-3 px-2">
                <span className="text-xs font-bold text-[var(--color-text-secondary)] flex items-center gap-1.5 font-mono">
                  <Globe size={16} /> OnlineCompiler.io Embedded IDE
                </span>
                <span className="text-[11px] text-[var(--color-text-muted)]">All Languages Supported</span>
              </div>

              {/* OnlineCompiler.io Embedded Widget Container */}
              <div className="flex-1 w-full rounded-xl p-2 bg-[#0d1117] border border-[var(--color-border)] overflow-hidden min-h-[600px]">
                <div
                  className="runcode"
                  data-key={import.meta.env.VITE_ONLINE_COMPILER_WIDGET_KEY || ''}
                  style={{ width: '100%', height: '100%', minHeight: '580px' }}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Custom Code Editor */}
              <div className="glass rounded-2xl p-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[var(--color-text-secondary)] flex items-center gap-1 font-mono">
                    <Code size={14} /> main.{language === 'python' ? 'py' : 'js'}
                  </span>
                  <span className="text-[11px] text-[var(--color-text-muted)]">Auto-saved</span>
                </div>
                
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  spellCheck={false}
                  className="w-full flex-1 min-h-[380px] p-4 rounded-xl font-mono text-sm leading-relaxed outline-none resize-none"
                  style={{
                    background: '#0d1117',
                    color: '#e6edf3',
                    border: '1px solid var(--color-border)',
                  }}
                />
              </div>

              {/* Execution & Test Results Drawer */}
              <div className="glass rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-2">
                    <Cpu size={16} weight="bold" /> Test Case Execution Results
                  </h3>
                  {runSummary && (
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      runSummary.passed === runSummary.total ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      Passed {runSummary.passed} / {runSummary.total} Test Cases
                    </span>
                  )}
                </div>

                {testResults.length === 0 ? (
                  <p className="text-xs text-center py-3 text-[var(--color-text-muted)]">
                    Click <strong className="text-emerald-400 font-mono">"Run Test Cases"</strong> above to execute your solution against sample inputs.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {testResults.map((tr, idx) => (
                      <div key={idx} className={`p-3 rounded-xl border text-xs space-y-1 ${
                        tr.passed ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-rose-500/5 border-rose-500/30'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="font-bold font-mono text-[var(--color-text-secondary)]">Case #{idx + 1}</span>
                          <span className={`font-bold flex items-center gap-1 ${tr.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {tr.passed ? <CheckCircle size={14} weight="fill" /> : <XCircle size={14} weight="fill" />}
                            {tr.passed ? 'Passed' : 'Failed'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--color-text-muted)] font-mono">Input: {tr.input}</p>
                        <p className="text-[11px] text-emerald-400 font-mono">Output: {tr.actual_output || tr.error || 'N/A'}</p>
                        <p className="text-[10px] text-[var(--color-text-muted)] font-mono flex items-center gap-1">
                          <Clock size={12} /> {tr.execution_time_ms} ms
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {submissionFeedback && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-2 text-emerald-300"
            >
              <div className="flex items-center gap-2 font-bold text-emerald-400 text-sm">
                <Sparkle size={18} weight="fill" /> Assessment Evaluated & Saved to DB! Redirecting...
              </div>
              <p>Overall Score: <strong>{submissionFeedback.evaluation.overall_score}/10</strong></p>
              <p>Time Complexity: <strong>{submissionFeedback.timeComplexity}</strong> | Space Complexity: <strong>{submissionFeedback.spaceComplexity}</strong></p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
