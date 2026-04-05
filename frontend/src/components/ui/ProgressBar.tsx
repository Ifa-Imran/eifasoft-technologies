'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type ProgressVariant = 'cyan' | 'success' | 'warning' | 'danger' | 'auto';
type ProgressSize = 'sm' | 'md' | 'lg';

interface ProgressBarProps {
  value: number;
  variant?: ProgressVariant;
  size?: ProgressSize;
  showLabel?: boolean;
  /** @deprecated Use showLabel instead */
  showPercentage?: boolean;
  label?: string;
  /** @deprecated Use variant instead */
  color?: string;
  glow?: boolean;
  className?: string;
}

const sizeStyles: Record<ProgressSize, string> = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

function getVariantColor(variant: ProgressVariant, value: number): { bar: string; glow: string } {
  if (variant === 'auto') {
    if (value < 50) return { bar: 'from-matrix-green to-[#00CC82]', glow: 'shadow-matrix-green/40' };
    if (value < 80) return { bar: 'from-solar-amber to-[#FF9500]', glow: 'shadow-solar-amber/40' };
    return { bar: 'from-neon-coral to-[#FF6B6B]', glow: 'shadow-neon-coral/40' };
  }

  const colors: Record<Exclude<ProgressVariant, 'auto'>, { bar: string; glow: string }> = {
    cyan: { bar: 'from-neon-cyan to-[#0080FF]', glow: 'shadow-neon-cyan/40' },
    success: { bar: 'from-matrix-green to-[#00CC82]', glow: 'shadow-matrix-green/40' },
    warning: { bar: 'from-solar-amber to-[#FF9500]', glow: 'shadow-solar-amber/40' },
    danger: { bar: 'from-neon-coral to-[#FF6B6B]', glow: 'shadow-neon-coral/40' },
  };

  return colors[variant];
}

export function ProgressBar({
  value,
  variant = 'cyan',
  size = 'md',
  showLabel = false,
  showPercentage,
  label,
  color,
  glow = false,
  className,
}: ProgressBarProps) {
  // Map legacy color prop to variant
  const resolvedVariant: ProgressVariant = color
    ? (color === 'primary' ? 'cyan' : color === 'accent' ? 'cyan' : color === 'danger' ? 'danger' : variant)
    : variant;
  const resolvedShowLabel = showLabel || showPercentage || false;
  const percentage = Math.min(Math.max(value, 0), 100);
  const colors = getVariantColor(resolvedVariant, percentage);

  return (
    <div className={cn('w-full', className)}>
      {(label || resolvedShowLabel) && (
        <div className="flex justify-between items-center mb-2">
          {label && <span className="text-sm text-gray-400">{label}</span>}
          {resolvedShowLabel && (
            <span className="text-sm font-mono text-gray-300">{percentage.toFixed(1)}%</span>
          )}
        </div>
      )}
      <div
        className={cn(
          'w-full rounded-full overflow-hidden bg-white/5 backdrop-blur-sm',
          sizeStyles[size],
        )}
        role="progressbar"
        aria-valuenow={Math.round(percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || `${percentage.toFixed(1)}% progress`}
      >
        <motion.div
          className={cn(
            'h-full rounded-full bg-gradient-to-r',
            colors.bar,
            glow && `shadow-lg ${colors.glow}`,
          )}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
