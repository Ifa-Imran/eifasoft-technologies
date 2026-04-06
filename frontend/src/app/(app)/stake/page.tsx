'use client';

import { useState, Suspense } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { GlassCard, Button, Input, Badge, ProgressBar } from '@/components/ui';
import { useStaking } from '@/hooks/useStaking';
import { useUserStakes } from '@/hooks/useUserStakes';
import { useApproval } from '@/hooks/useApproval';
import { useTokenBalances } from '@/hooks/useTokenBalances';
import { useRegistration } from '@/hooks/useRegistration';
import { useCMS } from '@/hooks/useCMS';
import { contracts, STAKING_TIERS, USDT_DECIMALS } from '@/config/contracts';
import { parseUnits, isAddress, zeroAddress } from 'viem';
import { formatCountdown } from '@/lib/utils';
import { useEffect } from 'react';
import { BoltIcon, ArrowDownTrayIcon, ClockIcon } from '@heroicons/react/24/outline';

function getTier(amount: number) {
  if (amount >= 5000) return STAKING_TIERS[2];
  if (amount >= 1000) return STAKING_TIERS[1];
  return STAKING_TIERS[0];
}

function StakePageInner() {
  const { isConnected } = useAccount();
  const [amount, setAmount] = useState('');
  const { stake, compound, harvest, isPending } = useStaking();
  const { activeStakes, isLoading } = useUserStakes();
  const { usdtFormatted } = useTokenBalances();
  const { storedReferrer, hasOnChainReferrer } = useRegistration();
  const { remainingSubscriptions } = useCMS();
  const approval = useApproval(contracts.usdt, contracts.stakingManager);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  const cmsActive = remainingSubscriptions > 0;

  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <h2 className="text-2xl font-orbitron font-bold text-surface-900">Connect Wallet to Stake</h2>
        <ConnectButton />
      </div>
    );
  }

  const numAmount = Number(amount) || 0;
  const tier = getTier(numAmount);
  const stakeAmountBigInt = numAmount > 0 ? parseUnits(amount, USDT_DECIMALS) : BigInt(0);
  const needsApproval = numAmount > 0 && !approval.hasAllowance(stakeAmountBigInt);

  const handleStake = () => {
    if (cmsActive) return;
    if (needsApproval) {
      approval.approve(stakeAmountBigInt);
      return;
    }
    const ref = hasOnChainReferrer
      ? zeroAddress
      : storedReferrer && isAddress(storedReferrer)
        ? (storedReferrer as `0x${string}`)
        : zeroAddress;
    stake(stakeAmountBigInt, ref);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-orbitron font-bold gradient-text">Staking</h1>

      {cmsActive && (
        <GlassCard variant="gradient">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-400 to-accent-300 flex items-center justify-center shadow-md shadow-accent-300/30">
              <ClockIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-surface-900">CMS Phase Active</h3>
              <p className="text-xs text-surface-500">
                Staking opens after all {remainingSubscriptions.toLocaleString()} remaining CMS subscriptions are sold.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Tier Comparison */}
      <div className="grid grid-cols-3 gap-4">
        {STAKING_TIERS.map((t, i) => {
          const isCurrentTier = numAmount >= 10 && tier.name === t.name;
          const tierBadge = t.name.toLowerCase() as 'bronze' | 'silver' | 'gold';
          return (
            <GlassCard
              key={t.name}
              variant={isCurrentTier ? (i === 2 ? 'gold' : i === 1 ? 'purple' : 'cyan') : 'default'}
              padding="p-5"
              className={isCurrentTier ? 'ring-2 ring-primary-300 shadow-lg' : 'opacity-60'}
            >
              <div className="text-center">
                <Badge tier={tierBadge} size="md">{t.name}</Badge>
                <p className="text-sm text-surface-400 mt-3">Min ${t.minAmount.toLocaleString()}</p>
                <p className="text-2xl font-mono font-bold text-surface-900 mt-1">{t.compoundInterval / 3600}h</p>
                <p className="text-sm text-surface-500">compound interval</p>
              </div>
            </GlassCard>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stake Form */}
        <GlassCard className={`lg:col-span-1 ${cmsActive ? 'opacity-50 pointer-events-none' : ''}`}>
          <h3 className="text-xl font-semibold text-surface-900">New Stake</h3>

          <div className="space-y-4">
            <Input
              label="Amount (USDT)"
              type="number"
              placeholder="Enter amount..."
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              helperText={`Balance: ${Number(usdtFormatted).toFixed(2)} USDT | Min: 10 USDT`}
            />

            {numAmount >= 10 && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-gradient-to-r from-primary-50 to-secondary-50 border border-primary-100">
                <Badge tier={tier.name.toLowerCase() as any}>{tier.name}</Badge>
                <span className="text-xs text-surface-500">
                  Compound every {tier.compoundInterval / 3600}h &middot; 3X FIFO Cap
                </span>
              </div>
            )}

            {numAmount >= 10 && (
              <div className="space-y-2 text-xs text-surface-500 p-3 rounded-xl bg-surface-50">
                <p className="text-xs font-semibold text-surface-700 mb-2">Distribution Breakdown</p>
                <div className="flex justify-between">
                  <span>Staking Pool (90%)</span>
                  <span className="font-mono text-surface-700">${(numAmount * 0.9).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Liquidity Pool (5%)</span>
                  <span className="font-mono text-surface-700">${(numAmount * 0.05).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Affiliates (5%)</span>
                  <span className="font-mono text-surface-700">${(numAmount * 0.05).toFixed(2)}</span>
                </div>
                <div className="border-t border-surface-200 pt-2 mt-2 flex justify-between font-semibold text-surface-900">
                  <span>Hard Cap (3X)</span>
                  <span className="font-mono">${(numAmount * 3).toFixed(2)}</span>
                </div>
              </div>
            )}

            <Button
              onClick={handleStake}
              loading={isPending || approval.isPending}
              disabled={numAmount < 10 || cmsActive}
              className="w-full"
            >
              {cmsActive ? 'Staking Not Yet Available' : needsApproval ? 'Approve USDT' : `Stake $${numAmount}`}
            </Button>
          </div>
        </GlassCard>

        {/* Active Stakes Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-surface-900">Your Stakes</h3>
            <span className="text-sm font-mono text-surface-400">{activeStakes.length} active</span>
          </div>

          {activeStakes.length === 0 ? (
            <GlassCard>
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-300/30">
                  <BoltIcon className="w-8 h-8 text-white" />
                </div>
                <p className="text-surface-500 text-sm">
                  {cmsActive
                    ? 'Staking will be available after the CMS phase completes.'
                    : 'No active stakes yet. Create your first stake to start earning!'}
                </p>
              </div>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeStakes.map((s) => {
                const timeToCompound = s.nextCompoundTime - now;
                const progressVariant = s.progress > 80 ? 'gold' : s.progress > 50 ? 'purple' : 'cyan';
                return (
                  <GlassCard key={s.index} padding="p-4" className="hover:shadow-card-hover">
                    <div className="flex items-center justify-between mb-3">
                      <Badge tier={s.tierName.toLowerCase() as any}>{s.tierName}</Badge>
                      <span className="text-xs font-mono text-surface-400">#{s.index}</span>
                    </div>
                    <p className="text-2xl font-mono font-bold text-surface-900 text-center mb-3">
                      ${s.amountFormatted}
                    </p>
                    <ProgressBar value={s.progress} label="3X Cap" variant={progressVariant} size="md" className="mb-3" />

                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-success-100 to-success-50 border-2 border-success-200/60 text-center">
                        <p className="font-mono font-bold text-success-700">${s.earnedFormatted}</p>
                        <p className="text-xs text-surface-400">earned</p>
                      </div>
                      <div className="p-2 rounded-xl bg-gradient-to-br from-accent-100 to-accent-50 border-2 border-accent-200/60 text-center">
                        <p className="font-mono font-bold text-accent-700">${s.harvestableFormatted}</p>
                        <p className="text-xs text-surface-400">claimable</p>
                      </div>
                    </div>

                    <div className="text-center text-sm mb-3">
                      {s.canCompound ? (
                        <span className="text-success-600 font-semibold animate-pulse-soft">Compound Ready!</span>
                      ) : (
                        <span className="font-mono text-surface-600">
                          {formatCountdown(timeToCompound > 0 ? timeToCompound : 0)}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => compound(BigInt(s.index))} disabled={!s.canCompound} className="flex-1" icon={<BoltIcon className="w-3.5 h-3.5" />}>
                        Compound
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => harvest(BigInt(s.index), s.harvestable)} className="flex-1" icon={<ArrowDownTrayIcon className="w-3.5 h-3.5" />}>
                        Claim
                      </Button>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StakePage() {
  return (
    <Suspense fallback={<div className="text-surface-500 text-center py-20">Loading...</div>}>
      <StakePageInner />
    </Suspense>
  );
}
