'use client';

import { cn } from '@/lib/utils';
import { motion, type HTMLMotionProps, type TargetAndTransition } from 'framer-motion';
import { ReactNode } from 'react';

type CardVariant = 'default' | 'gradient' | 'outlined' | 'cyan' | 'purple' | 'gold';
type HoverEffect = 'lift' | 'glow' | 'scale' | 'none';

interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  variant?: CardVariant;
  hover?: HoverEffect;
  className?: string;
  padding?: string;
}

const variantStyles: Record<CardVariant, string> = {
  default: 'card',
  gradient: 'glass-card-gradient',
  outlined: 'bg-transparent border-2 border-primary-200 rounded-2xl',
  cyan: 'card !border-2 !border-primary-400/60 bg-gradient-to-br from-primary-100/80 via-primary-50/60 to-cyan-50/40 shadow-[0_6px_24px_-4px_rgba(6,182,212,0.25)]',
  purple: 'card !border-2 !border-secondary-400/60 bg-gradient-to-br from-secondary-100/80 via-secondary-50/60 to-violet-50/40 shadow-[0_6px_24px_-4px_rgba(139,92,246,0.25)]',
  gold: 'card !border-2 !border-accent-400/60 bg-gradient-to-br from-accent-100/80 via-accent-50/60 to-amber-50/40 shadow-[0_6px_24px_-4px_rgba(245,158,11,0.25)]',
};

const hoverVariants: Record<HoverEffect, TargetAndTransition> = {
  lift: { y: -4, transition: { duration: 0.2 } },
  glow: { boxShadow: '0 8px 32px -4px rgba(6, 182, 212, 0.35), 0 4px 16px -2px rgba(139, 92, 246, 0.15)' },
  scale: { scale: 1.03, transition: { duration: 0.2 } },
  none: {},
};

export function GlassCard({
  children,
  variant = 'default',
  hover = 'lift',
  className,
  padding = 'p-6',
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      className={cn(variantStyles[variant], padding, 'transition-all duration-300', className)}
      whileHover={hoverVariants[hover]}
      {...props}
    >
      {children}
    </motion.div>
  );
}
