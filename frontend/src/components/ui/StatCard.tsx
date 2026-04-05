'use client';

import { cn } from '@/lib/utils';
import { GlassCard } from './GlassCard';
import { AnimatedCounter } from './AnimatedCounter';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline';

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: { value: number; label?: string };
  icon?: React.ReactNode;
  subtitle?: string;
  animated?: boolean;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  valueColor?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  trend,
  icon,
  subtitle,
  animated = false,
  prefix,
  suffix,
  decimals = 2,
  valueColor,
  className,
}: StatCardProps) {
  const isPositive = trend && trend.value >= 0;

  return (
    <GlassCard hover className={cn('', className)}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-2">
            {label}
          </p>
          <div className={cn('text-2xl lg:text-3xl font-semibold font-mono', valueColor || 'text-white')}>
            {animated && typeof value === 'number' ? (
              <AnimatedCounter
                value={value}
                prefix={prefix}
                suffix={suffix}
                decimals={decimals}
              />
            ) : (
              <span>{prefix}{value}{suffix}</span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="shrink-0 p-2.5 rounded-xl bg-neon-cyan/10 text-neon-cyan">
            {icon}
          </div>
        )}
      </div>
      {trend && (
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-glass-border">
          {isPositive ? (
            <ArrowTrendingUpIcon className="w-4 h-4 text-matrix-green" />
          ) : (
            <ArrowTrendingDownIcon className="w-4 h-4 text-neon-coral" />
          )}
          <span className={cn('text-sm font-medium', isPositive ? 'text-matrix-green' : 'text-neon-coral')}>
            {isPositive ? '+' : ''}{trend.value}%
          </span>
          {trend.label && <span className="text-xs text-gray-500 ml-1">{trend.label}</span>}
        </div>
      )}
    </GlassCard>
  );
}
