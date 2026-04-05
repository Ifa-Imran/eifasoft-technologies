'use client';

import { WebSocketProvider } from '@/providers/WebSocketProvider';
import { ToastProvider } from '@/providers/ToastProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ErrorBoundary fallback={<>{children}</>} section="WebSocket">
        <WebSocketProvider>
          {children}
        </WebSocketProvider>
      </ErrorBoundary>
    </ToastProvider>
  );
}
