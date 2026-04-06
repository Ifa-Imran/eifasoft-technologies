'use client';

import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { getExplorerTxUrl } from '@/config/contracts';

type ToastType = 'success' | 'error' | 'info' | 'pending';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  txHash?: string;
}

interface ToastContextType {
  toast: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const icons: Record<ToastType, ReactNode> = {
  success: <CheckCircleIcon className="w-5 h-5 text-accent-500" />,
  error: <ExclamationCircleIcon className="w-5 h-5 text-danger-500" />,
  info: <InformationCircleIcon className="w-5 h-5 text-primary-500" />,
  pending: (
    <svg className="w-5 h-5 text-warn-500 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  ),
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...t, id }]);
    if (t.type !== 'pending') {
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 5000);
    }
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast, dismiss }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 100, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.95 }}
              className="card p-4 shadow-elevated flex items-start gap-3"
            >
              {icons[t.type]}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-900">{t.title}</p>
                {t.description && <p className="text-xs text-surface-500 mt-0.5">{t.description}</p>}
                {t.txHash && (
                  <a
                    href={getExplorerTxUrl(t.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary-600 hover:underline mt-1 inline-block"
                  >
                    View on Explorer
                  </a>
                )}
              </div>
              <button onClick={() => dismiss(t.id)} className="text-surface-400 hover:text-surface-700">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
