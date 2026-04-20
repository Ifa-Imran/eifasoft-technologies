'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  variant?: 'cyan' | 'purple' | 'green' | 'amber' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  circular?: boolean;
  circularSize?: number;
}

const gradients = {
  cyan: 'from-primary-400 to-primary-500',
  purple: 'from-secondary-400 to-primary-500',
  green: 'from-success-400 to-primary-500',
  amber: 'from-warn-400 to-accent-500',
  gold: 'from-accent-400 to-warn-500',
};

const heights = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

const circularColors = {
  cyan: { start: '#06B6D4', end: '#0891B2' },
  purple: { start: '#8B5CF6', end: '#06B6D4' },
  green: { start: '#10B981', end: '#06B6D4' },
  amber: { start: '#F97316', end: '#F59E0B' },
  gold: { start: '#F59E0B', end: '#F97316' },
};

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = true,
  variant = 'cyan',
  size = 'md',
  className,
  circular = false,
  circularSize = 80,
}: ProgressBarProps) {
  const percent = Math.min((value / max) * 100, 100);

  if (circular) {
    const radius = (circularSize - 8) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percent / 100) * circumference;
    const colors = circularColors[variant];

    return (
      <div className={cn('relative inline-flex items-center justify-center', className)}>
        <svg width={circularSize} height={circularSize} className="-rotate-90">
          <circle
            cx={circularSize / 2}
            cy={circularSize / 2}
            r={radius}
            stroke="#E2E8F0"
            strokeWidth="6"
            fill="none"
          />
          <motion.circle
            cx={circularSize / 2}
            cy={circularSize / 2}
            r={radius}
            stroke={`url(#progressGradient-${variant})`}
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
          <defs>
            <linearGradient id={`progressGradient-${variant}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={colors.start} />
              <stop offset="100%" stopColor={colors.end} />
            </linearGradient>
          </defs>
        </svg>
        {showValue && (
          <span className="absolute text-sm font-mono font-bold text-surface-900">
            {percent.toFixed(2)}%
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-sm text-surface-500">{label}</span>}
          {showValue && (
            <span className="text-sm font-mono text-surface-600">
              {percent.toFixed(2)}%
            </span>
          )}
        </div>
      )}
      <div className={cn('w-full rounded-full bg-gradient-to-r from-surface-100 to-surface-200 overflow-hidden', heights[size])}>
        <motion.div
          className={cn('h-full rounded-full bg-gradient-to-r', gradients[variant])}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
