'use client';

import dynamic from 'next/dynamic';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { ParticleBackground } from './ParticleBackground';
import { CapWarningBanner } from '@/components/ui/CapWarningBanner';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const NeuralBackground = dynamic(
  () => import('./NeuralBackground'),
  { ssr: false },
);

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="relative min-h-screen bg-void">
      {/* Background effects */}
      <ParticleBackground />
      <ErrorBoundary fallback={null} section="NeuralBackground">
        <NeuralBackground />
      </ErrorBoundary>

      {/* 3X Cap Warning Banner */}
      <CapWarningBanner />

      {/* Sidebar — desktop/tablet only */}
      <Sidebar />

      {/* Main content area */}
      <main className="relative z-10 ml-0 md:ml-16 3xl:ml-60 pb-20 md:pb-0">
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  );
}
