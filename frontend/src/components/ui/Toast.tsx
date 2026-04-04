'use client';

import { motion } from 'framer-motion';
import {
  CheckCircleIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

const typeStyles: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: 'text-emerald-400' },
  info: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: 'text-blue-400' },
  warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: 'text-amber-400' },
  error: { bg: 'bg-red-500/10', border: 'border-red-500/30', icon: 'text-red-400' },
};

const typeIcons: Record<ToastType, React.ElementType> = {
  success: CheckCircleIcon,
  info: InformationCircleIcon,
  warning: ExclamationTriangleIcon,
  error: XCircleIcon,
};

interface ToastItemProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

export function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const style = typeStyles[toast.type];
  const Icon = typeIcons[toast.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={cn(
        'pointer-events-auto w-80 rounded-xl border p-4 shadow-2xl backdrop-blur-xl',
        'bg-dark-800/90',
        style.border,
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('shrink-0 mt-0.5', style.icon)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-dark-50">{toast.title}</p>
          {toast.message && (
            <p className="text-xs text-dark-400 mt-0.5 line-clamp-2">{toast.message}</p>
          )}
        </div>
        <button
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 p-0.5 rounded hover:bg-dark-700 transition-colors"
        >
          <XMarkIcon className="w-4 h-4 text-dark-500" />
        </button>
      </div>
    </motion.div>
  );
}
