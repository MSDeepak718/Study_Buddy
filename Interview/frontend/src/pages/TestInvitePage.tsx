import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getConfigByInvite, startInterviewByInvite } from '../services/api';
import type { InterviewConfig } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { Clock, Code, ArrowRight, ShieldCheck, CheckCircle, UserCheck, LockKey } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';

export default function TestInvitePage() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [config, setConfig] = useState<InterviewConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const { user, logout } = useAuth();

  useEffect(() => {
    if (!inviteCode) return;
    getConfigByInvite(inviteCode)
      .then(res => setConfig(res))
      .catch(err => setError(err?.response?.data?.detail || 'Invalid or expired assessment link.'))
      .finally(() => setLoading(false));
  }, [inviteCode]);

  const handleStartTest = async () => {
    if (!inviteCode) return;
    setStarting(true);
    try {
      // Trigger Full Screen Browser Mode for student test execution
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }

      const res = await startInterviewByInvite(inviteCode);
      const mode = res.config?.interview_mode || 'dsa';
      if (mode === 'dsa') {
        navigate(`/dsa/workspace/${res.session_id}`);
      } else {
        navigate(`/interview/${res.session_id}`);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to start test.');
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <LoadingSpinner text="Resolving Assessment Invite..." />
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 glass rounded-3xl text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto text-2xl font-bold">!</div>
        <h2 className="text-xl font-bold text-red-400">Invalid Link</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">{error || 'This invite link is invalid or has expired.'}</p>
        <button onClick={() => navigate('/')} className="px-6 py-2.5 rounded-xl text-sm font-bold bg-[var(--color-primary)] text-white cursor-pointer">
          Return Home
        </button>
      </div>
    );
  }

  // Admin Access Restriction Screen
  if (user && user.role === 'admin') {
    return (
      <div className="max-w-lg mx-auto my-20 p-8 glass rounded-3xl text-center space-y-5 border border-amber-500/30">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-lg">
          <LockKey size={36} weight="bold" />
        </div>
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Admin Restriction</span>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">Student Account Required</h2>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
          Assessment invite links are designed for <strong>student candidates</strong> to take tests. As an Admin, you can create and share test links from the Admin Dashboard, but you cannot attend them under an Admin account.
        </p>
        <div className="flex flex-col gap-3 pt-2">
          <button
            onClick={() => navigate('/')}
            className="w-full py-3.5 rounded-xl text-sm font-bold bg-[var(--color-primary)] text-white cursor-pointer hover:opacity-90 transition-all shadow-md"
          >
            Go to Admin Dashboard
          </button>
          <button
            onClick={() => {
              logout();
              navigate('/login', { state: { from: location.pathname } });
            }}
            className="w-full py-3.5 rounded-xl text-sm font-bold bg-[var(--color-bg-input)] border border-[var(--color-border)] text-[var(--color-text-primary)] cursor-pointer hover:bg-[var(--color-bg-elevated)] transition-all"
          >
            Log Out & Switch to Student Account
          </button>
        </div>
      </div>
    );
  }

  // Student Authentication Required Screen
  if (!user) {
    return (
      <div className="max-w-lg mx-auto my-20 p-8 glass rounded-3xl text-center space-y-5 border border-[var(--color-border)]">
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)]/20 text-[var(--color-primary)] flex items-center justify-center mx-auto shadow-lg">
          <UserCheck size={36} weight="bold" />
        </div>
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent)]">Assessment Portal</span>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">{config.title}</h2>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
          Please log in or create a <strong>Student Account</strong> to begin this assessment.
        </p>
        <button
          onClick={() => navigate('/login', { state: { from: location.pathname } })}
          className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 cursor-pointer shadow-lg"
          style={{ background: 'var(--gradient-primary)', color: '#fff' }}
        >
          Log In / Register as Student to Attend Test
          <ArrowRight size={20} weight="bold" />
        </button>
      </div>
    );
  }

  // Logged In Student Candidate Test Landing View
  return (
    <div className="max-w-2xl mx-auto my-12 px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-[var(--color-primary)]/20 text-[var(--color-primary)]">
            <ShieldCheck size={32} weight="bold" />
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider text-[var(--color-accent)] font-bold">Official Assessment Invite</span>
            <h1 className="text-2xl font-bold">{config.title}</h1>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Assessment Type</p>
            <p className="text-sm font-bold uppercase text-[var(--color-primary)] flex items-center gap-1.5 mt-1">
              <Code size={16} weight="bold" /> {config.interview_mode}
            </p>
          </div>

          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Time Limit</p>
            <p className="text-sm font-bold flex items-center gap-1.5 mt-1">
              <Clock size={16} weight="bold" /> {config.duration_minutes} Minutes
            </p>
          </div>

          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Difficulty Level</p>
            <p className="text-sm font-bold capitalize mt-1" style={{
              color: config.difficulty === 'hard' ? 'var(--color-danger)' : config.difficulty === 'medium' ? 'var(--color-warning)' : 'var(--color-success)'
            }}>
              {config.difficulty}
            </p>
          </div>
        </div>

        {config.topics && config.topics.length > 0 && (
          <div>
            <h3 className="text-sm font-bold mb-2 text-[var(--color-text-secondary)]">Covered Topics</h3>
            <div className="flex flex-wrap gap-2">
              {config.topics.map((t, idx) => (
                <span key={idx} className="px-3 py-1 rounded-lg text-xs font-semibold bg-[var(--color-bg-input)] border border-[var(--color-border)] text-[var(--color-text-primary)]">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
          <p className="font-bold flex items-center gap-1.5"><CheckCircle size={16} weight="fill" /> Important Test Rules:</p>
          <ul className="list-disc list-inside space-y-1 text-emerald-200/90 pl-1">
            <li>Full Screen Assessment Mode will activate automatically.</li>
            <li>Ensure you have a stable internet connection.</li>
            <li>Code execution will run against automated hidden test cases.</li>
            <li>Your solutions will be evaluated on complexity, correctness, and code quality.</li>
          </ul>
        </div>

        <button onClick={handleStartTest} disabled={starting}
          className="w-full py-4 rounded-2xl text-base font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 cursor-pointer shadow-lg"
          style={{ background: 'var(--gradient-primary)', color: '#fff' }}
        >
          {starting ? 'Initializing Full-Screen Test Environment...' : 'Begin Assessment Now'}
          <ArrowRight size={20} weight="bold" />
        </button>
      </motion.div>
    </div>
  );
}
