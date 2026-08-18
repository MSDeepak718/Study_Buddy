import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { listSessions } from '../services/api';
import type { SessionInfo } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { ChartBar, GraduationCap, Lightning, ClipboardText, ArrowRight, UserCheck, WarningOctagon } from '@phosphor-icons/react';

export default function SessionsPage() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listSessions()
      .then((s) => {
        setSessions(s);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner text="Loading sessions..." />;

  const getStatusBadge = (s: SessionInfo) => {
    if (s.is_disqualified || s.status === 'failed') {
      return (
        <span className="text-xs px-3 py-1 rounded-full font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
          <WarningOctagon size={14} weight="fill" /> Failed (Exceeded Exits)
        </span>
      );
    }
    if (s.status === 'completed') {
      return (
        <span className="text-xs px-3 py-1 rounded-full font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          Completed
        </span>
      );
    }
    return (
      <span className="text-xs px-3 py-1 rounded-full font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
        In Progress
      </span>
    );
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            {isAdmin ? <ChartBar size={28} color="var(--color-primary)" weight="bold" /> : <GraduationCap size={28} color="var(--color-accent)" weight="bold" />}
            <h1 className="text-3xl font-bold" style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {isAdmin ? 'All Candidate Assessment Sessions' : 'My Interview Sessions'}
            </h1>
            <span
              className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full"
              style={{
                background: isAdmin ? 'rgba(129, 255, 107, 0.15)' : 'rgba(77, 166, 255, 0.15)',
                color: isAdmin ? 'var(--color-success)' : 'var(--color-accent)',
                border: `1px solid ${isAdmin ? 'rgba(129, 255, 107, 0.3)' : 'rgba(77, 166, 255, 0.3)'}`,
              }}
            >
              {user?.role || 'User'}
            </span>
          </div>
          <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {isAdmin
              ? 'Monitor candidate attempts, view evaluation scores, and track test completions'
              : 'Track your ongoing assessments and view completed test analytics'}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all hover:opacity-90 cursor-pointer"
            style={{ background: 'var(--gradient-primary)', color: '#fff', boxShadow: '0 4px 15px rgba(129, 255, 107, 0.3)' }}
          >
            <Lightning size={16} weight="bold" />
            Configure Interview
          </button>
        )}
      </motion.div>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <div className="text-center py-20 glass rounded-2xl p-8" style={{ border: '1px solid var(--color-border)' }}>
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--color-bg-elevated)' }}>
            <ClipboardText size={36} color="var(--color-text-secondary)" weight="bold" />
          </div>
          <p className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            {isAdmin ? 'No Candidate Sessions Logged Yet' : 'No Active Interview Sessions'}
          </p>
          <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'var(--color-text-muted)' }}>
            {isAdmin
              ? 'Candidate test attempts and evaluation scores will appear here once candidates start tests.'
              : 'You do not have any assigned or active sessions. Please use an assessment invite link from your administrator.'}
          </p>
          {isAdmin && (
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer"
              style={{ background: 'var(--color-primary)', color: '#fff' }}
            >
              Go to Admin Dashboard
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s, idx) => {
            const handleItemClick = () => {
              if (isAdmin) {
                navigate(`/analytics/${s.session_id}`);
              } else {
                if (s.is_disqualified || s.status === 'failed' || s.status === 'completed') {
                  navigate(`/analytics/${s.session_id}`);
                } else if (s.interview_mode === 'dsa') {
                  navigate(`/dsa/workspace/${s.session_id}`);
                } else {
                  navigate(`/interview/${s.session_id}`);
                }
              }
            };

            return (
              <motion.div
                key={s.session_id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="glass rounded-2xl p-5 flex items-center justify-between cursor-pointer hover:border-[var(--color-primary)] transition-all"
                style={{ border: '1px solid var(--color-border)' }}
                onClick={handleItemClick}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-[var(--color-text-primary)]">
                      {s.title}
                    </h3>
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md bg-[var(--color-bg-input)] text-[var(--color-text-secondary)]">
                      {s.interview_mode || 'chat'} mode
                    </span>
                  </div>

                  {isAdmin && (
                    <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                      <UserCheck size={14} weight="bold" /> Candidate: {s.candidate_name || 'Student Candidate'} {s.candidate_email ? `(${s.candidate_email})` : ''}
                    </div>
                  )}

                  <p className="text-xs text-[var(--color-text-muted)]">
                    {s.topics?.join(', ') || 'General'} • {s.difficulty} • Attempts: {s.attempt_count ?? 1}/{s.max_attempts ?? 2}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span
                      className="text-lg font-bold block"
                      style={{
                        color: (s.overall_score ?? 0) >= 7 ? 'var(--color-success)' : (s.overall_score ?? 0) >= 4 ? 'var(--color-warning)' : 'var(--color-danger)'
                      }}
                    >
                      {s.overall_score !== null ? `${s.overall_score.toFixed(1)}/10` : 'Not Evaluated'}
                    </span>
                    <span className="text-[10px] text-[var(--color-text-muted)] block">
                      Overall Evaluation Score
                    </span>
                  </div>

                  {getStatusBadge(s)}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleItemClick();
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                    style={{
                      background: isAdmin || s.status === 'completed' || s.is_disqualified ? 'var(--color-bg-input)' : 'var(--gradient-primary)',
                      color: isAdmin || s.status === 'completed' || s.is_disqualified ? 'var(--color-text-primary)' : '#fff',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    {isAdmin ? 'View Evaluation' : s.status === 'completed' || s.is_disqualified ? 'View Scorecard' : 'Continue Test'}
                    <ArrowRight size={14} weight="bold" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
