'use client';

import { GlassCard, Badge, ProgressBar, Button } from '@/components/ui';
import { useUserStakes } from '@/hooks/useUserStakes';
import { useStaking } from '@/hooks/useStaking';
import { formatCountdown } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { BoltIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

export function ActiveStakesTable() {
  const { activeStakes, isLoading } = useUserStakes();
  const { compound, harvest } = useStaking();
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

  if (activeStakes.length === 0) {
    return (
      <GlassCard>
        <h3 className="text-lg font-semibold text-surface-900 mb-4">Active Stakes</h3>
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-100 to-secondary-50 flex items-center justify-center mx-auto mb-4">
            <BoltIcon className="w-8 h-8 text-primary-500" />
          </div>
          <p className="text-surface-500 text-sm">No active stakes. Start staking to earn rewards!</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard padding="p-0">
      <div className="p-6 pb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-surface-900">Active Stakes</h3>
        <span className="text-xs font-mono text-surface-400">{activeStakes.length} active</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-6 pt-0">
        {activeStakes.map((stake) => {
          const timeToCompound = stake.nextCompoundTime - now;
          const tierBadge = stake.tierName.toLowerCase() as 'bronze' | 'silver' | 'gold';

          // Dynamic progress color based on 3X cap progress
          const progressVariant = stake.progress > 80 ? 'gold' : stake.progress > 50 ? 'purple' : 'cyan';

          return (
            <div key={stake.index} className="card p-4 space-y-3 hover:shadow-card-hover transition-all duration-300">
              <div className="flex items-center justify-between">
                <Badge tier={tierBadge}>{stake.tierName}</Badge>
                <span className="text-xs font-mono text-surface-400">#{stake.index}</span>
              </div>

              <div className="text-center py-1">
                <p className="text-2xl font-mono font-bold text-surface-900">
                  ${stake.amountFormatted}
                </p>
                <p className="text-xs text-surface-400 mt-0.5">Staked Amount</p>
              </div>

              {/* 3X Cap Progress */}
              <ProgressBar
                value={stake.progress}
                label="3X Cap Progress"
                variant={progressVariant}
              />

              {/* Earnings breakdown */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-success-50 text-center">
                  <p className="text-surface-400">Earned</p>
                  <p className="font-mono font-semibold text-success-700">${stake.earnedFormatted}</p>
                </div>
                <div className="p-2 rounded-lg bg-accent-50 text-center">
                  <p className="text-surface-400">Claimable</p>
                  <p className="font-mono font-semibold text-accent-700">${stake.harvestableFormatted}</p>
                </div>
              </div>

              {/* Compound countdown */}
              <div className="text-center py-1">
                {stake.canCompound ? (
                  <span className="text-sm font-semibold text-success-600 animate-pulse-soft">Ready to compound!</span>
                ) : (
                  <div>
                    <p className="text-xs text-surface-400 mb-0.5">Next compound in</p>
                    <p className="text-sm font-mono font-semibold text-surface-700">
                      {formatCountdown(timeToCompound > 0 ? timeToCompound : 0)}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!stake.canCompound}
                  onClick={() => compound(BigInt(stake.index))}
                  className="flex-1"
                  icon={<BoltIcon className="w-3.5 h-3.5" />}
                >
                  Compound
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={stake.harvestable === BigInt(0)}
                  onClick={() => harvest(BigInt(stake.index), stake.harvestable)}
                  className="flex-1"
                  icon={<ArrowDownTrayIcon className="w-3.5 h-3.5" />}
                >
                  Claim
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
