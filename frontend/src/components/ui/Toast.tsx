'use client';

import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

export type ToastVariant = 'pending' | 'success' | 'error' | 'warning' | 'urgent';

/** @deprecated Use ToastVariant instead */
export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastData {
  id: string;
  message?: string;
  variant?: ToastVariant;
  duration?: number;
  /** @deprecated Use message instead */
  title?: string;
  /** @deprecated Use variant instead */
  type?: string;
}

interface ToastConfig {
  borderColor: string;
  iconColor: string;
  bgAccent: string;
  icon: React.ReactNode;
  defaultDuration: number;
}

const SpinnerIcon = ({ className }: { className?: string }) => (
  <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

function getToastConfig(variant: ToastVariant): ToastConfig {
  switch (variant) {
    case 'pending':
      return {
        borderColor: 'border-l-neon-cyan',
        iconColor: 'text-neon-cyan',
        bgAccent: 'bg-neon-cyan/5',
        icon: <SpinnerIcon className="w-5 h-5" />,
        defaultDuration: 0, // no auto-dismiss for pending
      };
    case 'success':
      return {
        borderColor: 'border-l-matrix-green',
        iconColor: 'text-matrix-green',
        bgAccent: 'bg-matrix-green/5',
        icon: <CheckCircleIcon className="w-5 h-5" />,
        defaultDuration: 5000,
      };
    case 'error':
      return {
        borderColor: 'border-l-red-500',
        iconColor: 'text-red-500',
        bgAccent: 'bg-red-500/5',
        icon: <XCircleIcon className="w-5 h-5" />,
        defaultDuration: 5000,
      };
    case 'warning':
      return {
        borderColor: 'border-l-solar-amber',
        iconColor: 'text-solar-amber',
        bgAccent: 'bg-solar-amber/5',
        icon: <ExclamationTriangleIcon className="w-5 h-5" />,
        defaultDuration: 5000,
      };
    case 'urgent':
      return {
        borderColor: 'border-l-neon-coral',
        iconColor: 'text-neon-coral',
        bgAccent: 'bg-neon-coral/5',
        icon: <ExclamationTriangleIcon className="w-5 h-5 animate-glow-pulse" />,
        defaultDuration: 10000,
      };
  }
}

interface ToastItemProps {
  toast: ToastData;
  onClose?: (id: string) => void;
  /** @deprecated Use onClose instead */
  onDismiss?: (id: string) => void;
}

export function Toast({ toast, onClose, onDismiss }: ToastItemProps) {
  const closeHandler = onClose || onDismiss || (() => {});
  // Support legacy fields
  const resolvedVariant: ToastVariant = (toast.variant || toast.type || 'success') as ToastVariant;
  const resolvedMessage = toast.message || toast.title || '';
  const config = getToastConfig(resolvedVariant === ('info' as ToastVariant) ? 'pending' : resolvedVariant);
  const duration = toast.duration ?? config.defaultDuration;

  const handleClose = useCallback(() => {
    closeHandler(toast.id);
  }, [closeHandler, toast.id]);

  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(handleClose, duration);
    return () => clearTimeout(timer);
  }, [duration, handleClose]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={cn(
        'pointer-events-auto w-80 rounded-xl border border-glass-border border-l-4 p-4',
        'shadow-2xl backdrop-blur-xl bg-glass',
        config.borderColor,
        config.bgAccent,
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('shrink-0 mt-0.5', config.iconColor)}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{resolvedMessage}</p>
        </div>
        <button
          onClick={handleClose}
          className="shrink-0 p-0.5 rounded hover:bg-white/5 transition-colors"
        >
          <XMarkIcon className="w-4 h-4 text-gray-500" />
        </button>
      </div>
    </motion.div>
  );
}

/** @deprecated Use Toast instead */
export const ToastItem = Toast;

/** Container to render toasts - place once in layout */
export function ToastContainer({ toasts, onClose }: { toasts: ToastData[]; onClose: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={onClose} />
        ))}
      </AnimatePresence>
    </div>
  );
}
