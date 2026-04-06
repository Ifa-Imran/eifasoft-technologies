'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { MouseEventHandler, forwardRef } from 'react';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit' | 'reset';
}

const variants = {
  primary: 'gradient-primary text-white hover:shadow-lg hover:shadow-primary-500/25',
  secondary: 'bg-white border border-surface-200 text-surface-700 hover:border-primary-300 hover:text-primary-600 hover:shadow-soft',
  danger: 'bg-danger-50 border border-danger-200 text-danger-600 hover:bg-danger-100',
  ghost: 'bg-transparent text-surface-500 hover:text-surface-900 hover:bg-surface-100',
  success: 'gradient-success text-white hover:shadow-lg hover:shadow-success-500/25',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-5 py-2.5 text-sm rounded-xl',
  lg: 'px-6 py-3 text-base rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = 'primary', size = 'md', loading, disabled, icon, className, onClick, type = 'button' }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.98 }}
        disabled={disabled || loading}
        type={type}
        onClick={onClick}
        className={cn(
          'font-semibold transition-all duration-200 inline-flex items-center justify-center gap-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className
        )}
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : icon ? (
          icon
        ) : null}
        {children}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
