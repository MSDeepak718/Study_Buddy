import { motion } from 'framer-motion';

interface ScoreCardProps {
  label: string;
  score: number;
  maxScore?: number;
  icon?: string;
  color?: string;
}

export default function ScoreCard({ label, score, maxScore = 10, icon, color }: ScoreCardProps) {
  const safeScore = typeof score === 'number' && !isNaN(score) ? score : 0;
  const percentage = (safeScore / maxScore) * 100;
  const barColor = color || (percentage >= 70 ? 'var(--color-success)' : percentage >= 40 ? 'var(--color-warning)' : 'var(--color-danger)');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-2xl glass"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            {label}
          </span>
        </div>
        <span className="text-lg font-bold" style={{ color: barColor }}>
          {safeScore.toFixed(1)}
        </span>
      </div>
      <div className="w-full h-2 rounded-full" style={{ background: 'var(--color-bg-input)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: barColor }}
        />
      </div>
    </motion.div>
  );
}
