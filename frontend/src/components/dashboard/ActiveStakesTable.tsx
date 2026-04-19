'use client';

import { GlassCard, Badge, ProgressBar, Button } from '@/components/ui';
import { useUserStakes } from '@/hooks/useUserStakes';
import { useStaking } from '@/hooks/useStaking';
import { useEffect, useState } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

export function ActiveStakesTable() {
  const { tierGroups, isLoading } = useUserStakes();
  const { harvestTier, isPending } = useStaking();
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <GlassCard>
        <h3 className="text-lg font-semibold text-surface-900 mb-4">Active Stakes</h3>
        <div className="flex items-center gap-2 text-surface-400 text-sm">
          <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          Loading stakes...
        </div>
      </GlassCard>
    );
  }

  if (tierGroups.length === 0) {
    return (
      <GlassCard>
        <h3 className="text-lg font-semibold text-surface-900 mb-4">Active Stakes</h3>
        <div className="text-center py-8">
          <p className="text-surface-500 text-sm">No active stakes. Start staking to earn rewards!</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard padding="p-0">
      <div className="p-6 pb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-surface-900">Active Stakes</h3>
        <span className="text-xs font-mono text-surface-400">{tierGroups.length} tier(s)</span>
      </div>
      <div className="space-y-4 p-6 pt-0">
        {tierGroups.map((tg) => {
          const progressVariant = tg.capProgress > 80 ? 'gold' : tg.capProgress > 50 ? 'purple' : 'cyan';

          return (
            <div key={tg.tier} className="card p-4 space-y-3 hover:shadow-card-hover transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge tier={tg.tierName.toLowerCase() as 'bronze' | 'silver' | 'gold'}>{tg.tierName}</Badge>
                  <span className="text-xs text-surface-400">{tg.stakeCount} stake{tg.stakeCount > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-success-600 font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse" />
                  Auto
                </div>
              </div>

              <div className="text-center py-1">
                <p className="text-2xl font-mono font-bold text-surface-900">
                  ${tg.originalAmountFormatted}
                </p>
                <p className="text-xs text-surface-400 mt-0.5">Staked Amount</p>
              </div>

              <ProgressBar value={tg.capProgress} label="3X Cap Progress" variant={progressVariant} />

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-accent-50 text-center">
                  <p className="text-surface-400">Harvestable</p>
                  <p className="font-mono font-semibold text-accent-700">${tg.displayHarvestableFormatted}</p>
                </div>
                <div className="p-2 rounded-lg bg-secondary-50 text-center">
                  <p className="text-surface-400">Harvested</p>
                  <p className="font-mono font-semibold text-secondary-700">${tg.totalHarvestedFormatted}</p>
                </div>
                <div className="p-2 rounded-lg bg-primary-50 text-center">
                  <p className="text-surface-400">Total Earned</p>
                  <p className="font-mono font-semibold text-primary-700">${tg.totalEarnedFormatted}</p>
                </div>
              </div>

              <Button
                size="sm"
                variant="secondary"
                disabled={tg.displayHarvestable < BigInt(10) * BigInt(10 ** 18)}
                onClick={() => harvestTier(tg.stakes)}
                loading={isPending}
                className="w-full"
                icon={<ArrowDownTrayIcon className="w-3.5 h-3.5" />}
              >
                {tg.displayHarvestable >= BigInt(10) * BigInt(10 ** 18) ? `Harvest $${tg.displayHarvestableFormatted}` : 'Min $10 to Harvest'}
              </Button>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
