'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useRegistration } from '@/hooks/useRegistration';
import { HeroSection } from '@/components/landing/HeroSection';

import { FeatureGrid } from '@/components/landing/FeatureGrid';
import { GlassCard } from '@/components/ui';

export default function Home() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { isRegistered, isLoading } = useRegistration();

  useEffect(() => {
    if (!isConnected || isLoading) return;
    if (isRegistered) {
      router.replace('/dashboard');
    } else {
      router.replace('/register');
    }
  }, [isConnected, isRegistered, isLoading, router]);

  // Connected but still checking — show spinner
  if (isConnected && isLoading) {
    return (
      <main className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-surface-500">Checking your account...</p>
        </div>
      </main>
    );
  }

  // Connected and redirect is happening
  if (isConnected && !isLoading) {
    return null;
  }

  // Not connected — show landing page with connect wallet prompt
  return (
    <main className="min-h-screen bg-surface-50">
      <HeroSection />
      <FeatureGrid />

      {/* Connect Wallet CTA */}
      <section className="py-16 flex justify-center">
        <GlassCard className="max-w-md w-full mx-4 text-center" variant="gradient">
          <h2 className="text-2xl font-orbitron font-bold gradient-text mb-3">Get Started</h2>
          <p className="text-surface-500 text-sm mb-6">Connect your wallet to access the KAIRO DAO Aurora Financial Ecosystem.</p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </GlassCard>
      </section>

      <footer className="py-8 text-center border-t border-surface-200">
        <p className="text-surface-400 text-sm">
          &copy; {new Date().getFullYear()} KAIRO DAO &middot; Aurora Financial Ecosystem
        </p>
      </footer>
    </main>
  );
}
