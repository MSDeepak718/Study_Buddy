import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { listSessions } from '../services/api';
import type { SessionInfo } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

export default function SessionsPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listSessions().then(s => { setSessions(s); setLoading(false); }).catch(() => setLoading(false));
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
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Interview Sessions
        </h1>
        <p style={{ color: 'var(--color-text-muted)' }}>View all past and ongoing interview sessions</p>
      </motion.div>

      {sessions.length === 0 ? (
        <div className="text-center py-20 glass rounded-2xl">
          <p className="text-lg mb-2" style={{ color: 'var(--color-text-muted)' }}>No sessions yet</p>
          <button onClick={() => navigate('/')} className="px-6 py-2 rounded-xl text-sm font-medium" style={{ background: 'var(--color-primary)', color: '#fff' }}>
            Create an Interview
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s, idx) => (
            <motion.div key={s.session_id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
              className="glass rounded-xl p-4 flex items-center justify-between cursor-pointer hover:opacity-90 transition-all"
              onClick={() => s.status === 'completed' ? navigate(`/analytics/${s.session_id}`) : s.status === 'in_progress' ? navigate(`/interview/${s.session_id}`) : null}
            >
              <div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  {s.topics?.join(', ') || 'General'} • {s.difficulty} • {s.answered_questions}/{s.total_questions} answered
                </p>
              </div>
              <div className="flex items-center gap-4">
                {s.overall_score !== null && (
                  <span className="text-lg font-bold" style={{ color: s.overall_score >= 7 ? 'var(--color-success)' : s.overall_score >= 4 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                    {s.overall_score.toFixed(1)}/10
                  </span>
                )}
                <span className="text-xs px-3 py-1 rounded-full font-medium capitalize" style={{ color: statusColors[s.status], background: `${statusColors[s.status]}15`, border: `1px solid ${statusColors[s.status]}30` }}>
                  {s.status.replace('_', ' ')}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
