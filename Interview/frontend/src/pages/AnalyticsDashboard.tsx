import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { getDashboard } from '../services/api';
import type { DashboardData } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ScoreCard from '../components/ScoreCard';

export default function AnalyticsDashboard() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionId) {
      getDashboard(sessionId).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
    }
  }, [sessionId]);

  if (loading) return <LoadingSpinner text="Loading analytics..." />;
  if (!data) return <div className="text-center py-20" style={{ color: 'var(--color-text-muted)' }}>No data found for this session.</div>;

  const radarData = data.evaluation_summary ? [
    { metric: 'Technical Accuracy', score: data.evaluation_summary.technical_accuracy || 0 },
    { metric: 'Clarity', score: data.evaluation_summary.clarity || 0 },
    { metric: 'Relevance', score: data.evaluation_summary.relevance || 0 },
    { metric: 'Completeness', score: data.evaluation_summary.completeness || 0 },
  ] : [];

  const topicBarData = data.topic_scores.map(t => ({ name: t.topic, score: t.avg_score, questions: t.question_count }));

  const overallScore = data.overall_score || 0;
  const scoreColor = overallScore >= 7 ? 'var(--color-success)' : overallScore >= 4 ? 'var(--color-warning)' : 'var(--color-danger)';

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Analytics Dashboard
        </h1>
        <p style={{ color: 'var(--color-text-muted)' }}>{data.title} - {data.status.charAt(0).toUpperCase() + data.status.slice(1).toLowerCase()}</p>
      </motion.div>

      {/* Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass rounded-2xl p-6 flex flex-col items-center justify-center animate-pulse-glow">
          <p className="text-sm mb-2" style={{ color: 'var(--color-text-muted)' }}>Overall Score</p>
          <p className="text-5xl font-bold" style={{ color: scoreColor }}>{overallScore.toFixed(1)}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>out of 10</p>
        </motion.div>
        <ScoreCard label="Technical Accuracy" score={data.evaluation_summary?.technical_accuracy || 0}/>
        <ScoreCard label="Clarity" score={data.evaluation_summary?.clarity || 0}/>
        <ScoreCard label="Completeness" score={data.evaluation_summary?.completeness || 0}/>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Radar Chart */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="glass rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4">Performance Radar</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--color-border)" />
              //#86C232;
              <PolarAngleAxis dataKey="metric" tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
              <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
              <Radar name="Score" dataKey="score" stroke="#86C232" fill="#86C232" fillOpacity={0.3} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Topic Bar Chart */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="glass rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4">Topic-wise Scores</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topicBarData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
              <YAxis domain={[0, 10]} tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: '12px', color: 'var(--color-text-primary)' }} />
              <Bar dataKey="score" fill="#86C232" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Recommendations */}
      {data.recommendations && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Recommendations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-success)' }}>Strengths</h4>
              <ul className="space-y-2">
                {data.recommendations.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <span style={{ color: 'var(--color-success)' }}>•</span> {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-warning)' }}>Areas to Improve</h4>
              <ul className="space-y-2">
                {data.recommendations.weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <span style={{ color: 'var(--color-warning)' }}>•</span> {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-6">
            <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-accent)' }}>Recommendations</h4>
            <div className="space-y-2">
              {data.recommendations.recommendations.map((r, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl text-sm" style={{ background: 'var(--color-bg-elevated)' }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold" style={{ background: 'var(--color-primary)', color: '#fff' }}>{i + 1}</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{r}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Question-wise Analytics */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass rounded-2xl p-6">
        <h3 className="text-lg font-semibold mb-4">Question-wise Analysis</h3>
        <div className="space-y-4">
          {data.question_analytics.map((qa) => (
            <details key={qa.question_number} className="group rounded-xl overflow-hidden" style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}>
              <summary className="px-4 py-3 cursor-pointer flex items-center justify-between text-sm font-medium hover:opacity-80">
                <span>Q{qa.question_number}: {qa.question_text.slice(0, 80)}...</span>
                <span className="font-bold" style={{ color: qa.evaluation.overall_score >= 7 ? 'var(--color-success)' : qa.evaluation.overall_score >= 4 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                  {qa.evaluation.overall_score.toFixed(1)}/10
                </span>
              </summary>
              <div className="px-4 pb-4 space-y-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>

                <div><strong>Your Answer:</strong> {qa.answer_text}</div>
                <div><strong>Feedback:</strong> {qa.evaluation.feedback}</div>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {(['technical_accuracy', 'clarity', 'relevance', 'completeness'] as const).map(k => (
                    <div key={k} className="text-center p-2 rounded-lg" style={{ background: 'var(--color-bg-card)' }}>
                      <div className="text-xs capitalize" style={{ color: 'var(--color-text-muted)' }}>{k.replace('_', ' ')}</div>
                      <div className="font-bold" style={{ color: 'var(--color-accent)' }}>{qa.evaluation[k]}</div>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
