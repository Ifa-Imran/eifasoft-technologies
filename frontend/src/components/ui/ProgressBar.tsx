'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number; // 0-100
  max?: number;
  label?: string;
  showPercentage?: boolean;
  color?: 'primary' | 'accent' | 'danger';
  className?: string;
}

const colorStyles = {
  primary: 'bg-primary-500',
  accent: 'bg-accent-500',
  danger: 'bg-red-500',
};

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercentage = true,
  color = 'primary',
  className,
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className={cn('w-full', className)}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {label && <span className="text-sm text-dark-300">{label}</span>}
          {showPercentage && (
            <span className="text-sm font-mono text-dark-200">{percentage.toFixed(1)}%</span>
          )}
        </div>
      )}
      <div className="w-full h-2 bg-dark-700 rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', colorStyles[color])}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
