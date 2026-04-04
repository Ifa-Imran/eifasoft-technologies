'use client';

import { WebSocketProvider } from '@/providers/WebSocketProvider';
import { ToastProvider } from '@/providers/ToastProvider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <WebSocketProvider>
        {children}
      </WebSocketProvider>
    </ToastProvider>
  );
}
