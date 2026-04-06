'use client';

import { cn } from '@/lib/utils';
import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';

interface StatCardProps {
  label: string;
  value: string;
  change?: number;
  icon?: ReactNode;
  className?: string;
  prefix?: string;
  suffix?: string;
  gradient?: 'cyan' | 'purple' | 'gold' | 'success';
}

const iconGradients = {
  cyan: 'bg-gradient-to-br from-primary-400 to-primary-300 text-white shadow-md shadow-primary-300/40',
  purple: 'bg-gradient-to-br from-secondary-400 to-secondary-300 text-white shadow-md shadow-secondary-300/40',
  gold: 'bg-gradient-to-br from-accent-400 to-accent-300 text-white shadow-md shadow-accent-300/40',
  success: 'bg-gradient-to-br from-success-400 to-success-300 text-white shadow-md shadow-success-300/40',
};

const cardBorders = {
  cyan: '!border-2 !border-primary-300/70',
  purple: '!border-2 !border-secondary-300/70',
  gold: '!border-2 !border-accent-300/70',
  success: '!border-2 !border-success-300/70',
};

const cardBgs = {
  cyan: 'bg-gradient-to-br from-primary-50/80 via-white/60 to-cyan-50/40',
  purple: 'bg-gradient-to-br from-secondary-50/80 via-white/60 to-violet-50/40',
  gold: 'bg-gradient-to-br from-accent-50/80 via-white/60 to-amber-50/40',
  success: 'bg-gradient-to-br from-success-50/80 via-white/60 to-emerald-50/40',
};

export function StatCard({ label, value, change, icon, className, prefix, suffix, gradient = 'cyan' }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('card p-6', cardBorders[gradient], cardBgs[gradient], className)}
    >
      <div className="flex items-start justify-between mb-4">
        <span className="text-surface-500 text-sm font-medium">{label}</span>
        {icon && (
          <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center', iconGradients[gradient])}>
            {icon}
          </div>
        )}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-mono font-bold text-surface-900">
          {prefix}{value}{suffix}
        </span>
        {change !== undefined && (
          <span
            className={cn(
              'flex items-center text-xs font-medium',
              change >= 0 ? 'text-success-600' : 'text-danger-500'
            )}
          >
            {change >= 0 ? (
              <ArrowUpIcon className="w-3 h-3 mr-0.5" />
            ) : (
              <ArrowDownIcon className="w-3 h-3 mr-0.5" />
            )}
            {Math.abs(change).toFixed(2)}%
          </span>
        )}
      </div>
    </motion.div>
  );
}
