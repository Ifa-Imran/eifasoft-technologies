'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { formatUnits } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  BoltIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useStaking, type Stake } from '@/hooks/useStaking';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tooltip } from '@/components/ui/Tooltip';
import { useToast } from '@/providers/ToastProvider';

// ---- Tier config ----
const TIER_LABELS = ['Tier 0', 'Tier 1', 'Tier 2'];
const TIER_RANGES = ['$10 – $499', '$500 – $1,999', '$2,000+'];
const TIER_COMPOUND = ['Every 8h', 'Every 6h', 'Every 4h'];
const TIER_CLOSINGS = ['3 daily', '4 daily', '6 daily'];
const COMPOUND_SECS = [8 * 3600, 6 * 3600, 4 * 3600];
const TIER_ACCENT = [
  'border-gray-500/30 text-gray-400',
  'border-neon-purple/40 text-neon-purple',
  'border-neon-cyan/40 text-neon-cyan',
];

// ---- Countdown hook ----
function useCountdown(targetTimestamp: number) {
  const calc = useCallback(() => {
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, targetTimestamp - now);
  }, [targetTimestamp]);
  const [remaining, setRemaining] = useState(calc);
  useEffect(() => {
    setRemaining(calc());
    const t = setInterval(() => setRemaining(calc()), 1000);
    return () => clearInterval(t);
  }, [calc]);
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  return {
    remaining,
    display: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
  };
}

// ---- Compound sparkle effect ----
function CompoundSparkle({ amount, onDone }: { amount: string; onDone: () => void }) {
  return (
    <motion.span
      initial={{ opacity: 1, y: 0 }}
      animate={{ opacity: 0, y: -40 }}
      transition={{ duration: 1.2, ease: 'easeOut' }}
      onAnimationComplete={onDone}
      className="absolute -top-2 right-0 text-matrix-green font-mono text-sm font-bold pointer-events-none z-10"
    >
      +{amount} USDT
    </motion.span>
  );
}

// ---- Single stake row ----
function StakeRowCard({
  stake,
  index,
  onCompound,
  onHarvest,
  onUnstake,
  isLoading,
}: {
  stake: Stake;
  index: number;
  onCompound: (id: bigint) => void;
  onHarvest: (id: bigint, amount: bigint) => void;
  onUnstake: (id: number) => void;
  isLoading?: boolean;
}) {
  const amount = Number(formatUnits(stake.amount, 18));
  const originalAmount = Number(formatUnits(stake.originalAmount, 18));
  const totalEarned = Number(formatUnits(stake.totalEarned, 18));
  const harvestedRewards = Number(formatUnits(stake.harvestedRewards, 18));
  const cap = originalAmount * 3;
  const capPct = cap > 0 ? (totalEarned / cap) * 100 : 0;
  const tier = stake.tier;
  const nextCompound = Number(stake.lastCompoundTime) + COMPOUND_SECS[tier];
  const { remaining, display } = useCountdown(nextCompound);
  const canCompound = remaining === 0;
  const unharvested = totalEarned - harvestedRewards;
  const canHarvest = unharvested >= 10;
  const progressVariant: 'success' | 'warning' | 'danger' =
    capPct >= 80 ? 'danger' : capPct >= 50 ? 'warning' : 'success';
  const currentValue = originalAmount + totalEarned;

  const [sparkle, setSparkle] = useState<string | null>(null);

  const handleCompound = () => {
    onCompound(BigInt(index));
    // optimistic sparkle
    const profit = (amount * 0.001).toFixed(2);
    setSparkle(profit);
  };

  return (
    <>
      {/* Desktop row */}
      <tr className="hidden md:table-row border-b border-glass-border/40 hover:bg-white/[0.02] transition-colors">
        <td className="py-3 px-3 text-xs text-gray-500 font-mono">#{index + 1}</td>
        <td className="py-3 px-3 text-sm font-mono text-white">
          ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
        <td className="py-3 px-3">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TIER_ACCENT[tier]}`}>
            {TIER_LABELS[tier]}
          </span>
        </td>
        <td className="py-3 px-3 text-sm font-mono text-neon-cyan">
          ${currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
        <td className="py-3 px-3">
          {canCompound ? (
            <span className="text-xs text-matrix-green font-bold animate-pulse">Ready!</span>
          ) : (
            <span className="text-sm font-mono text-gray-400">{display}</span>
          )}
        </td>
        <td className="py-3 px-3 min-w-[120px]">
          <ProgressBar value={capPct} variant={progressVariant} size="sm" showLabel />
        </td>
        <td className="py-3 px-3 relative">
          <AnimatePresence>
            {sparkle && <CompoundSparkle amount={sparkle} onDone={() => setSparkle(null)} />}
          </AnimatePresence>
          <div className="flex gap-1.5">
            <Button size="sm" variant="primary" disabled={!canCompound || isLoading} onClick={handleCompound}>
              Compound
            </Button>
            <Tooltip content={canHarvest ? 'Harvest to your wallet' : 'Minimum $10 required'}>
              <span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!canHarvest || isLoading}
                  onClick={() => onHarvest(BigInt(index), stake.totalEarned - stake.harvestedRewards)}
                >
                  Harvest
                </Button>
              </span>
            </Tooltip>
            <Button size="sm" variant="ghost" disabled={isLoading} onClick={() => onUnstake(index)}>
              Unstake
            </Button>
          </div>
        </td>
      </tr>

      {/* Mobile card */}
      <div className="md:hidden glass-card rounded-xl p-4 space-y-3 relative">
        <AnimatePresence>
          {sparkle && <CompoundSparkle amount={sparkle} onDone={() => setSparkle(null)} />}
        </AnimatePresence>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 font-mono">Stake #{index + 1}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TIER_ACCENT[tier]}`}>
            {TIER_LABELS[tier]}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-gray-500 uppercase">Amount</p>
            <p className="font-mono text-sm text-white">
              ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase">Current Value</p>
            <p className="font-mono text-sm text-neon-cyan">
              ${currentValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase">Next Compound</p>
            {canCompound ? (
              <p className="text-xs text-matrix-green font-bold animate-pulse">Ready!</p>
            ) : (
              <p className="font-mono text-sm text-gray-400">{display}</p>
            )}
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase mb-1">3X Cap</p>
            <ProgressBar value={capPct} variant={progressVariant} size="sm" />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="primary" disabled={!canCompound || isLoading} onClick={handleCompound} className="flex-1">
            Compound
          </Button>
          <Button size="sm" variant="secondary" disabled={!canHarvest || isLoading} onClick={() => onHarvest(BigInt(index), stake.totalEarned - stake.harvestedRewards)} className="flex-1">
            Harvest
          </Button>
          <Button size="sm" variant="ghost" disabled={isLoading} onClick={() => onUnstake(index)}>
            Unstake
          </Button>
        </div>
      </div>
    </>
  );
}

// ---- Main component ----
export function StakingControlCenter() {
  const { stakes, isLoadingStakes, compound, harvest, unstake, isWritePending, isConfirming, refetchStakes } = useStaking();
  const { addToast } = useToast();
  const activeStakes = useMemo(
    () =>
      stakes
        .map((s, stakeId) => ({ stake: s, stakeId }))
        .filter(({ stake }) => stake.active),
    [stakes],
  );
  const isLoading = isWritePending || isConfirming;

  // Unstake modal state
  const [unstakeTarget, setUnstakeTarget] = useState<number | null>(null);
  const [unstakeConfirmed, setUnstakeConfirmed] = useState(false);

  const targetEntry = unstakeTarget !== null ? activeStakes.find(({ stakeId }) => stakeId === unstakeTarget) : null;
  const targetStake = targetEntry?.stake ?? null;
  const targetCurrent = targetStake ? Number(formatUnits(targetStake.amount, 18)) : 0;
  const targetOriginal = targetStake ? Number(formatUnits(targetStake.originalAmount, 18)) : 0;
  const targetEarned = targetStake ? Number(formatUnits(targetStake.totalEarned, 18)) : 0;
  const targetHarvested = targetStake ? Number(formatUnits(targetStake.harvestedRewards, 18)) : 0;
  const grossReturn = targetCurrent * 0.8;
  const returnAmount = Math.max(0, grossReturn - targetHarvested);
  const penaltyAmount = targetCurrent - grossReturn; // 20% of current
  const forfeitAmount = penaltyAmount + targetHarvested;

  const handleUnstakeConfirm = () => {
    if (unstakeTarget === null) return;
    unstake(BigInt(unstakeTarget));
    addToast('info', 'Unstaking', 'Transaction submitted...');
    setUnstakeTarget(null);
    setUnstakeConfirmed(false);
  };

  return (
    <GlassCard padding="lg" className="mb-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg md:text-xl font-orbitron font-bold text-white tracking-wide">
          Staking Control Center
        </h2>
        <Link
          href="/dashboard/staking"
          className="text-xs text-neon-cyan hover:text-neon-cyan/80 flex items-center gap-1 transition-colors"
        >
          Full View <ArrowRightIcon className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Tier Info Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {[0, 1, 2].map((t) => (
          <div
            key={t}
            className={`glass-card rounded-xl p-3 border ${TIER_ACCENT[t].split(' ')[0]} transition-colors`}
          >
            <p className={`text-xs font-bold mb-1 ${TIER_ACCENT[t].split(' ')[1]}`}>{TIER_LABELS[t]}</p>
            <p className="text-xs text-gray-400">{TIER_RANGES[t]}</p>
            <p className="text-[10px] text-gray-500 mt-1">{TIER_COMPOUND[t]} &middot; {TIER_CLOSINGS[t]}</p>
          </div>
        ))}
      </div>

      {/* Stakes Table */}
      {isLoadingStakes ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="card" height={60} />
          ))}
        </div>
      ) : activeStakes.length === 0 ? (
        <div className="text-center py-12">
          <BoltIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No active stakes</p>
          <p className="text-xs text-gray-500 mt-1 mb-4">Create your first stake to start earning compound returns</p>
          <Link href="/dashboard/staking">
            <Button size="md" variant="primary">Stake Now</Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-glass-border/60">
                  {['ID', 'Amount', 'Tier', 'Value', 'Next Compound', '3X Cap', 'Actions'].map((h) => (
                    <th key={h} className="pb-3 px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeStakes.map(({ stake, stakeId }, rowIndex) => (
                  <StakeRowCard
                    key={stakeId}
                    stake={stake}
                    index={stakeId}
                    onCompound={(id) => { compound(id); }}
                    onHarvest={(id, amt) => harvest(id, amt)}
                    onUnstake={(sid) => { setUnstakeTarget(sid); setUnstakeConfirmed(false); }}
                    isLoading={isLoading}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {activeStakes.map(({ stake, stakeId }, rowIndex) => (
              <StakeRowCard
                key={stakeId}
                stake={stake}
                index={stakeId}
                onCompound={(id) => compound(id)}
                onHarvest={(id, amt) => harvest(id, amt)}
                onUnstake={(sid) => { setUnstakeTarget(sid); setUnstakeConfirmed(false); }}
                isLoading={isLoading}
              />
            ))}
          </div>
        </>
      )}

      {/* Unstake Confirmation Modal */}
      <Modal
        open={unstakeTarget !== null}
        onOpenChange={(v) => { if (!v) { setUnstakeTarget(null); setUnstakeConfirmed(false); } }}
        title="Confirm Unstake"
        description="Early unstaking incurs a 20% penalty"
      >
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Original Stake</span>
              <span className="font-mono text-white">
                ${targetOriginal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Total Earned So Far</span>
              <span className="font-mono text-matrix-green">
                +${targetEarned.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Already Harvested</span>
              <span className="font-mono text-solar-amber">
                -${targetHarvested.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="h-px bg-glass-border" />
            <div className="flex justify-between text-sm">
              <span className="text-neon-coral">Penalty (20% of current)</span>
              <span className="font-mono text-neon-coral">
                -${penaltyAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-neon-coral">Total Forfeited</span>
              <span className="font-mono text-neon-coral">
                -${forfeitAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="border-t border-glass-border pt-2 flex justify-between text-sm font-bold">
              <span className="text-gray-300">You Receive (80% of current − harvested)</span>
              <span className="font-mono text-neon-cyan">
                ${returnAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-neon-coral/10 border border-neon-coral/20 flex items-start gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-neon-coral shrink-0 mt-0.5" />
            <p className="text-xs text-neon-coral/90">
              You will receive 80% of current stake value minus already harvested rewards. This action is irreversible.
            </p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={unstakeConfirmed}
              onChange={(e) => setUnstakeConfirmed(e.target.checked)}
              className="w-4 h-4 rounded border-glass-border bg-glass text-neon-cyan focus:ring-neon-cyan/50"
            />
            <span className="text-xs text-gray-400">I understand the penalty and wish to proceed</span>
          </label>

          <div className="flex gap-3">
            <Button
              variant="ghost"
              size="md"
              className="flex-1"
              onClick={() => { setUnstakeTarget(null); setUnstakeConfirmed(false); }}
            >
              Cancel
            </Button>
            <Button
              variant="warning"
              size="md"
              className="flex-1"
              disabled={!unstakeConfirmed || isLoading}
              loading={isLoading}
              onClick={handleUnstakeConfirm}
            >
              Unstake
            </Button>
          </div>
        </div>
      </Modal>
    </GlassCard>
  );
}
