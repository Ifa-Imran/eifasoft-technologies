'use client';

import { useRegistration } from '@/hooks/useRegistration';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { AppLayout } from '@/components/layout/AppLayout';

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const { isRegistered, isLoading, isConnected } = useRegistration();
  const { address } = useAccount();
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    // Only redirect when we have a definitive answer: loaded, connected, have address, not registered
    if (!isLoading && isConnected && address && !isRegistered && !redirecting) {
      setRedirecting(true);
      router.replace('/register');
    }
  }, [isRegistered, isLoading, isConnected, address, router, redirecting]);

  // Show loading while checking registration
  if ((isLoading || !address) && isConnected) {
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
