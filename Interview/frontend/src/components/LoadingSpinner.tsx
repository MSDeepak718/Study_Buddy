import { motion } from 'framer-motion';

export default function LoadingSpinner({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <motion.div
        className="w-12 h-12 rounded-full"
        style={{
          border: '3px solid var(--color-border)',
          borderTopColor: 'var(--color-primary)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
        {text}
      </p>
    </div>
  );
}
