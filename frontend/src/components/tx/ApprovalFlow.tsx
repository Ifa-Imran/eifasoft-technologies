'use client';

import { cn } from '@/lib/utils';
import { CheckIcon } from '@heroicons/react/24/solid';

interface Step {
  label: string;
  status: 'pending' | 'active' | 'complete';
}

interface ApprovalFlowProps {
  steps: Step[];
  className?: string;
}

export function ApprovalFlow({ steps, className }: ApprovalFlowProps) {
  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-2">
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
              step.status === 'complete' && 'bg-success-500 text-white',
              step.status === 'active' && 'bg-primary-500 text-white animate-pulse',
              step.status === 'pending' && 'bg-surface-100 text-surface-400'
            )}
          >
            {step.status === 'complete' ? (
              <CheckIcon className="w-4 h-4" />
            ) : (
              i + 1
            )}
          </div>
          <span
            className={cn(
              'text-xs font-medium',
              step.status === 'complete' && 'text-success-600',
              step.status === 'active' && 'text-surface-900',
              step.status === 'pending' && 'text-surface-400'
            )}
          >
            {step.label}
          </span>
          {i < steps.length - 1 && (
            <div className={cn(
              'w-8 h-0.5 mx-1',
              step.status === 'complete' ? 'bg-success-500' : 'bg-surface-200'
            )} />
          )}
        </div>
      ))}
    </div>
  );
}
