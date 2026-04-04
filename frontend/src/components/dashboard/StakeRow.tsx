'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatUnits } from 'viem';
import { cn } from '@/lib/utils';
import type { Stake } from '@/hooks/useStaking';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Button } from '@/components/ui/Button';

const TIER_NAMES = ['Tier 1', 'Tier 2', 'Tier 3'];
const TIER_COLORS = ['text-dark-300', 'text-accent-400', 'text-primary-400'];
const TIER_BG = ['bg-dark-700', 'bg-accent-500/10', 'bg-primary-500/10'];
const COMPOUND_INTERVALS = [8 * 3600, 6 * 3600, 4 * 3600]; // seconds

interface StakeRowProps {
  stake: Stake;
  index: number;
  onCompound: (id: bigint) => void;
  onHarvest: (id: bigint, amount: bigint) => void;
  onUnstake: (id: bigint) => void;
  isLoading?: boolean;
}

function useCountdown(targetTimestamp: number) {
  const calc = useCallback(() => {
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, targetTimestamp - now);
  }, [targetTimestamp]);

  const [remaining, setRemaining] = useState(calc);

  useEffect(() => {
    const timer = setInterval(() => setRemaining(calc()), 1000);
    return () => clearInterval(timer);
  }, [calc]);

  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  return { remaining, display: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` };
}

export function StakeRow({ stake, index, onCompound, onHarvest, onUnstake, isLoading }: StakeRowProps) {
  const amount = Number(formatUnits(stake.amount, 18));
  const originalAmount = Number(formatUnits(stake.originalAmount, 18));
  const totalEarned = Number(formatUnits(stake.totalEarned, 18));
  const harvestedRewards = Number(formatUnits(stake.harvestedRewards, 18));
  const cap = originalAmount * 3;
  const capPercent = cap > 0 ? (totalEarned / cap) * 100 : 0;
  const tier = stake.tier;

  const nextCompound = Number(stake.lastCompoundTime) + COMPOUND_INTERVALS[tier];
  const { remaining, display } = useCountdown(nextCompound);
  const canCompound = remaining === 0;

  const capColor = capPercent >= 80 ? 'danger' : capPercent >= 50 ? 'accent' : 'primary';
  const unharvested = totalEarned - harvestedRewards;
  const canHarvest = unharvested >= 10;

  return (
    <tr className="border-b border-dark-700/40 hover:bg-dark-800/30 transition-colors">
      <td className="py-3 px-3 text-sm text-dark-300 font-mono">{index + 1}</td>
      <td className="py-3 px-3">
        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', TIER_BG[tier], TIER_COLORS[tier])}>
          {TIER_NAMES[tier]}
        </span>
      </td>
      <td className="py-3 px-3 text-sm text-dark-100 font-mono">
        ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="py-3 px-3 text-sm text-primary-400 font-mono">
        ${totalEarned.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="py-3 px-3 min-w-[140px]">
        <ProgressBar value={capPercent} showPercentage={true} color={capColor} />
      </td>
      <td className="py-3 px-3">
        {canCompound ? (
          <span className="text-xs text-primary-400 font-semibold animate-pulse">Ready!</span>
        ) : (
          <span className="text-sm font-mono text-dark-300">{display}</span>
        )}
      </td>
      <td className="py-3 px-3">
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="primary"
            disabled={!canCompound || isLoading}
            onClick={() => onCompound(BigInt(index))}
          >
            Compound
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!canHarvest || isLoading}
            onClick={() => onHarvest(BigInt(index), stake.totalEarned - stake.harvestedRewards)}
          >
            Harvest
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={isLoading}
            onClick={() => onUnstake(BigInt(index))}
          >
            Unstake
          </Button>
        </div>
      </td>
    </tr>
  );
}
