'use client';

import { cn } from '@/lib/utils';
import { forwardRef, InputHTMLAttributes, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, startAdornment, endAdornment, helperText, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-surface-600 mb-1.5">{label}</label>
        )}
        <div className="relative">
          {startAdornment && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">
              {startAdornment}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'input-field w-full',
              startAdornment && 'pl-10',
              endAdornment && 'pr-10',
              error && 'border-danger-400 focus:border-danger-500 focus:ring-danger-200',
              className
            )}
            {...props}
          />
          {endAdornment && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400">
              {endAdornment}
            </div>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-danger-500">{error}</p>}
        {helperText && !error && <p className="mt-1 text-xs text-surface-400">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
