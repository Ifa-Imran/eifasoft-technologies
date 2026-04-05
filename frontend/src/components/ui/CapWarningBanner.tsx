'use client';

import { useState, useMemo } from 'react';
import { formatUnits } from 'viem';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useStaking, type Stake } from '@/hooks/useStaking';
import { useAccount } from 'wagmi';

export function CapWarningBanner() {
  const { address } = useAccount();
  const { stakes } = useStaking();
  const [dismissed, setDismissed] = useState(false);

  const hasImminentCap = useMemo(() => {
    if (!address || !stakes || stakes.length === 0) return false;
    return stakes.some((s: Stake) => {
      if (!s.active) return false;
      const original = Number(formatUnits(s.originalAmount, 18));
      const earned = Number(formatUnits(s.totalEarned, 18));
      const cap = original * 3;
      return cap > 0 && (earned / cap) >= 0.9;
    });
  }, [address, stakes]);

  if (!hasImminentCap || dismissed) return null;

  return (
    <div className="fixed top-16 left-0 right-0 z-40 bg-neon-coral/20 border-b border-neon-coral/40 backdrop-blur-sm animate-glow-pulse">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3">
        <ExclamationTriangleIcon className="w-5 h-5 text-neon-coral shrink-0" />
        <p className="text-sm text-neon-coral font-medium flex-1">
          <span className="font-bold">3X Cap Imminent</span> — One or more of your stakes is approaching the 3X limit. Compound or unstake to secure your rewards.
        </p>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 p-1 rounded-lg hover:bg-neon-coral/20 transition-colors"
          aria-label="Dismiss warning"
        >
          <XMarkIcon className="w-4 h-4 text-neon-coral" />
        </button>
      </div>
    </div>
  );
}
