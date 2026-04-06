'use client';

import { Web3Provider } from './Web3Provider';
import { ToastProvider } from '@/components/ui/Toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Web3Provider>
      <ToastProvider>{children}</ToastProvider>
    </Web3Provider>
  );
}
