'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatUnits } from 'viem';
import {
  SparklesIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useCMS } from '@/hooks/useCMS';
import { useStaking } from '@/hooks/useStaking';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/providers/ToastProvider';

export function CMSStatusWidget() {
  const {
    claimableRewards,
    excessToDelete,
    subscriptionCount,
    canClaimResult,
    hasClaimed,
    claimRewards,
    isWritePending,
    isConfirming,
  } = useCMS();
  const { stakes } = useStaking();
  const { addToast } = useToast();
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [burnConfirmed, setBurnConfirmed] = useState(false);

  const activeStakes = useMemo(() => stakes.filter((s) => s.active), [stakes]);
  const hasActiveStake = activeStakes.length > 0;
  const isLoading = isWritePending || isConfirming;

  const subCount = subscriptionCount ? Number(subscriptionCount as bigint) : 0;

  const rewards = useMemo(() => {
    if (!claimableRewards) return { loyalty: 0, leadership: 0, total: 0 };
    const [l, ld, t] = claimableRewards as unknown as bigint[];
    return {
      loyalty: Number(formatUnits(l, 18)),
      leadership: Number(formatUnits(ld, 18)),
      total: Number(formatUnits(t, 18)),
    };
  }, [claimableRewards]);

  const excess = excessToDelete ? Number(formatUnits(excessToDelete as bigint, 18)) : 0;

  const canClaimEligible = canClaimResult
    ? (canClaimResult as [boolean, string])[0]
    : false;
  const canClaimReason = canClaimResult
    ? (canClaimResult as [boolean, string])[1]
    : '';
  const alreadyClaimed = hasClaimed as boolean | undefined;

  // Claim status indicator
  let statusDot: 'green' | 'red' | 'gray' = 'gray';
  let statusText = 'No Rewards';
  if (rewards.total > 0 && hasActiveStake) {
    statusDot = 'green';
    statusText = 'Ready to Claim';
  } else if (rewards.total > 0 && !hasActiveStake) {
    statusDot = 'red';
    statusText = 'NO ACTIVE STAKE — REWARDS WILL BE FORFEITED';
  }

  const handleClaim = () => {
    claimRewards();
    addToast('info', 'Claiming CMS Rewards', 'Transaction submitted...');
    setShowClaimModal(false);
  };

  const dotColor = {
    green: 'bg-matrix-green shadow-matrix-green/50',
    red: 'bg-neon-coral shadow-neon-coral/50 animate-pulse',
    gray: 'bg-gray-600',
  };

  return (
    <GlassCard padding="lg" className="mb-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg md:text-xl font-orbitron font-bold text-white tracking-wide">
          Core Membership
        </h2>
        <Link
          href="/dashboard/cms"
          className="text-xs text-neon-cyan hover:text-neon-cyan/80 flex items-center gap-1 transition-colors"
        >
          Buy More <ArrowRightIcon className="w-3.5 h-3.5" />
        </Link>
      </div>

      {!claimableRewards ? (
        <div className="space-y-3">
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="card" height={80} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Subscription count + Claim Status */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-neon-purple" />
              <span className="text-sm text-gray-300">
                You own <span className="font-bold text-white font-mono">{subCount}</span> subscription{subCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              <div className={`w-2 h-2 rounded-full shadow-lg ${dotColor[statusDot]}`} />
              <span className={`text-xs font-semibold ${statusDot === 'red' ? 'text-neon-coral' : statusDot === 'green' ? 'text-matrix-green' : 'text-gray-500'}`}>
                {statusText}
              </span>
            </div>
          </div>

          {/* Reward Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="glass-card rounded-xl p-4">
              <p className="text-[10px] text-gray-500 uppercase mb-1">Loyalty Rewards</p>
              <p className="text-lg font-mono font-bold text-white">
                {rewards.loyalty.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                <span className="text-xs text-gray-500 ml-1">KAIRO</span>
              </p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="text-[10px] text-gray-500 uppercase mb-1">Leadership Rewards</p>
              <p className="text-lg font-mono font-bold text-white">
                {rewards.leadership.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                <span className="text-xs text-gray-500 ml-1">KAIRO</span>
              </p>
            </div>
            <div className="glass-card rounded-xl p-4 border border-neon-cyan/20">
              <p className="text-[10px] text-gray-500 uppercase mb-1">Total Claimable</p>
              <p className="text-2xl font-mono font-bold text-neon-cyan">
                {rewards.total.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                <span className="text-xs text-gray-500 ml-1">KAIRO</span>
              </p>
            </div>
          </div>

          {/* Excess Warning */}
          {excess > 0 && (
            <div className="p-3 rounded-xl bg-neon-coral/10 border border-neon-coral/20 flex items-start gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-neon-coral shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-neon-coral">Excess Warning</p>
                <p className="text-xs text-neon-coral/80 mt-0.5">
                  {excess.toLocaleString('en-US', { maximumFractionDigits: 2 })} KAIRO exceeds your cap and will be permanently burned on claim.
                </p>
              </div>
            </div>
          )}

          {/* Claim Button */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="primary"
              size="md"
              disabled={!canClaimEligible || isLoading || alreadyClaimed === true}
              loading={isLoading}
              onClick={() => setShowClaimModal(true)}
              className="flex-1"
            >
              {alreadyClaimed ? 'Already Claimed' : 'Claim CMS Rewards'}
            </Button>
            <Link href="/dashboard/cms" className="flex-1">
              <Button variant="secondary" size="md" className="w-full">
                Buy More Subscriptions
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Claim Confirmation Modal */}
      <Modal
        open={showClaimModal}
        onOpenChange={(v) => { setShowClaimModal(v); if (!v) setBurnConfirmed(false); }}
        title="Confirm CMS Claim"
        description="Review your reward amounts before claiming"
      >
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Loyalty Rewards</span>
              <span className="font-mono text-white">{rewards.loyalty.toFixed(2)} KAIRO</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Leadership Rewards</span>
              <span className="font-mono text-white">{rewards.leadership.toFixed(2)} KAIRO</span>
            </div>
            {excess > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-neon-coral">Excess (burned)</span>
                <span className="font-mono text-neon-coral">-{excess.toFixed(2)} KAIRO</span>
              </div>
            )}
            <div className="border-t border-glass-border pt-2 flex justify-between text-sm font-bold">
              <span className="text-gray-300">You Receive <span className="font-normal text-xs text-gray-500">(90% after 10% system share)</span></span>
              <span className="font-mono text-neon-cyan">
                {Math.max(0, (rewards.total - excess) * 0.9).toFixed(2)} KAIRO
              </span>
            </div>
          </div>

          {excess > 0 && (
            <div className="p-4 rounded-xl bg-neon-coral/10 border-2 border-neon-coral/30 space-y-3">
              <div className="flex items-start gap-2">
                <ExclamationTriangleIcon className="w-6 h-6 text-neon-coral shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-neon-coral">BURN WARNING</p>
                  <p className="text-xs text-neon-coral/90 mt-1">
                    {excess.toLocaleString('en-US', { maximumFractionDigits: 2 })} KAIRO exceeds your stake cap and will be <span className="font-bold uppercase">permanently burned</span>. This cannot be undone.
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={burnConfirmed}
                  onChange={(e) => setBurnConfirmed(e.target.checked)}
                  className="w-4 h-4 rounded border-glass-border bg-glass text-neon-coral focus:ring-neon-coral/50"
                />
                <span className="text-xs text-neon-coral/80">
                  I understand that {excess.toFixed(2)} KAIRO will be permanently burned
                </span>
              </label>
            </div>
          )}

          {!hasActiveStake && (
            <div className="p-3 rounded-lg bg-neon-coral/10 border border-neon-coral/20 flex items-start gap-2">
              <XCircleIcon className="w-5 h-5 text-neon-coral shrink-0" />
              <p className="text-xs text-neon-coral">
                You have no active stake. Claiming without an active stake may forfeit rewards.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="ghost" size="md" className="flex-1" onClick={() => { setShowClaimModal(false); setBurnConfirmed(false); }}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              className="flex-1"
              loading={isLoading}
              disabled={!canClaimEligible || alreadyClaimed === true || (excess > 0 && !burnConfirmed) || isLoading}
              onClick={handleClaim}
            >
              Confirm Claim
            </Button>
          </div>
        </div>
      </Modal>
    </GlassCard>
  );
}
