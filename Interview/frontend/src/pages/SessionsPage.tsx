import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { listSessions } from '../services/api';
import type { SessionInfo } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { ChartBar, GraduationCap, Lightning, ClipboardText, ArrowRight } from '@phosphor-icons/react';

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

  const statusColors: Record<string, string> = {
    completed: 'var(--color-success)',
    in_progress: 'var(--color-warning)',
    pending: 'var(--color-text-muted)',
    abandoned: 'var(--color-danger)',
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            {isAdmin ? <ChartBar size={28} color="var(--color-primary)" weight="bold" /> : <GraduationCap size={28} color="var(--color-accent)" weight="bold" />}
            <h1 className="text-3xl font-bold" style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {isAdmin ? 'All Candidate Sessions' : 'My Interview Sessions'}
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
              ? 'Monitor and analyze performance across all candidate interview sessions'
              : 'Track your ongoing assessments and view completed interview scorecards'}
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
            {isAdmin ? 'No Candidate Sessions Found' : 'No Active Interview Sessions'}
          </p>
          <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'var(--color-text-muted)' }}>
            {isAdmin
              ? 'There are no candidate interview sessions logged yet. Create a configuration to start candidates.'
              : 'You do not have any assigned or active sessions. Please request an interview configuration from your administrator.'}
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
          {sessions.map((s, idx) => (
            <motion.div
              key={s.session_id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="glass rounded-2xl p-5 flex items-center justify-between cursor-pointer hover:opacity-95 transition-all"
              style={{ border: '1px solid var(--color-border)' }}
              onClick={() => {
                if (s.status === 'completed') navigate(`/analytics/${s.session_id}`);
                else navigate(`/interview/${s.session_id}`);
              }}
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>
                    {s.title}
                  </h3>
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md" style={{ background: 'var(--color-bg-input)', color: 'var(--color-text-secondary)' }}>
                    {s.interview_mode || 'chat'} mode
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {s.topics?.join(', ') || 'General'} • {s.difficulty} • {s.answered_questions}/{s.total_questions} questions answered
                </p>
              </div>

              <div className="flex items-center gap-4">
                {s.overall_score !== null && (
                  <div className="text-right">
                    <span
                      className="text-lg font-bold block"
                      style={{ color: s.overall_score >= 7 ? 'var(--color-success)' : s.overall_score >= 4 ? 'var(--color-warning)' : 'var(--color-danger)' }}
                    >
                      {s.overall_score.toFixed(1)}/10
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                      Overall Score
                    </span>
                  </div>
                )}
                <span
                  className="text-xs px-3 py-1 rounded-full font-semibold capitalize"
                  style={{
                    color: statusColors[s.status] || 'var(--color-text-muted)',
                    background: `${statusColors[s.status] || '#888'}15`,
                    border: `1px solid ${statusColors[s.status] || '#888'}30`,
                  }}
                >
                  {s.status.replace('_', ' ')}
                </span>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  style={{
                    background: s.status === 'completed' ? 'var(--color-bg-input)' : 'var(--color-primary)',
                    color: '#fff',
                  }}
                >
                  {s.status === 'completed' ? 'View Report' : 'Continue'}
                  <ArrowRight size={14} weight="bold" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
