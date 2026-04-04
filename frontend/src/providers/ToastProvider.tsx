'use client';

import { createContext, useContext, useCallback, useState, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ToastItem, type ToastData, type ToastType } from '@/components/ui/Toast';

interface ToastContextValue {
  addToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const counterRef = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, title: string, message?: string, duration = 5000) => {
      const id = `toast-${++counterRef.current}-${Date.now()}`;
      const toast: ToastData = { id, type, title, message, duration };
      setToasts((prev) => [...prev.slice(-4), toast]); // max 5 toasts
      if (duration > 0) {
        setTimeout(() => dismissToast(id), duration);
      }
    },
    [dismissToast],
  );

  return (
    <ToastContext.Provider value={{ addToast, dismissToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
