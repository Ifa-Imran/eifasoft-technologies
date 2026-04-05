'use client';

import { cn } from '@/lib/utils';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'warning' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: [
    'bg-gradient-to-r from-neon-cyan to-[#0080FF] text-black font-semibold',
    'shadow-lg shadow-neon-cyan/25',
  ].join(' '),
  secondary: [
    'bg-transparent border border-neon-cyan text-neon-cyan',
    'relative overflow-hidden',
  ].join(' '),
  warning: [
    'bg-gradient-to-r from-neon-coral to-[#FF6B6B] text-white font-semibold',
    'animate-glow-pulse shadow-lg shadow-neon-coral/25',
  ].join(' '),
  danger: [
    'bg-gradient-to-r from-neon-coral to-[#FF6B6B] text-white font-semibold',
    'shadow-lg shadow-neon-coral/25',
  ].join(' '),
  ghost: 'bg-transparent text-white hover:bg-white/5',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-7 py-3.5 text-base rounded-xl gap-2.5',
};

const Spinner = ({ className }: { className?: string }) => (
  <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, className, children, disabled, ...props }, ref) => {
    const isDisabled = disabled || loading;

    return (
      <motion.button
        ref={ref}
        whileHover={isDisabled ? undefined : { scale: 1.05 }}
        whileTap={isDisabled ? undefined : { scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-all duration-200',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/50 focus-visible:ring-offset-2 focus-visible:ring-offset-void',
          variantStyles[variant],
          sizeStyles[size],
          isDisabled && 'opacity-40 cursor-not-allowed saturate-0',
          className,
        )}
        disabled={isDisabled}
        {...props}
      >
        {/* Secondary fill hover effect */}
        {variant === 'secondary' && (
          <span className="absolute inset-0 bg-neon-cyan/10 scale-x-0 origin-left transition-transform duration-300 group-hover:scale-x-100 hover:scale-x-100 pointer-events-none" />
        )}
        {loading && <Spinner className="h-4 w-4 shrink-0" />}
        <span className="relative z-10">{children}</span>
      </motion.button>
    );
  },
);

Button.displayName = 'Button';
