'use client';

import { useRegistration } from '@/hooks/useRegistration';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const { isRegistered, isLoading, isConnected } = useRegistration();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isConnected && !isRegistered) {
      router.replace('/register');
    }
  }, [isRegistered, isLoading, isConnected, router]);

  // Show loading while checking registration
  if (isLoading && isConnected) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-surface-500">Verifying registration...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // If not connected, let individual pages handle the connect wallet prompt
  // If not registered, redirect is happening via useEffect
  if (isConnected && !isRegistered && !isLoading) {
    return null; // Will redirect
  }

  return <AppLayout>{children}</AppLayout>;
}
