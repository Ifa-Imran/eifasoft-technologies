'use client';

import { useState, Suspense, useRef, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { GlassCard, Button, Input, Badge, ProgressBar } from '@/components/ui';
import { useStaking } from '@/hooks/useStaking';
import { useUserStakes } from '@/hooks/useUserStakes';
import { useApproval } from '@/hooks/useApproval';
import { useTokenBalances } from '@/hooks/useTokenBalances';
import { useRegistration } from '@/hooks/useRegistration';
import { contracts, STAKING_TIERS, USDT_DECIMALS } from '@/config/contracts';
import { parseUnits, isAddress, zeroAddress, formatUnits } from 'viem';
import { useAffiliate } from '@/hooks/useAffiliate';
import { ArrowDownTrayIcon, ArrowPathIcon, ArrowUturnLeftIcon, ClockIcon, LockClosedIcon, LockOpenIcon, BoltIcon, CheckCircleIcon, XCircleIcon, FireIcon, CalculatorIcon } from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';

function getTier(amount: number) {
  if (amount >= 2000) return STAKING_TIERS[2];
  if (amount >= 500) return STAKING_TIERS[1];
  return STAKING_TIERS[0];
}

// Compounding frequencies per tier
const COMPOUND_TIERS = [
  { name: 'Bronze', min: 10, max: 499, interval: 480 },    // 8h
  { name: 'Silver', min: 500, max: 1999, interval: 360 },   // 6h
  { name: 'Gold', min: 2000, max: Infinity, interval: 300 }, // 5h
] as const;

function getCompoundTier(amount: number) {
  if (amount >= 2000) return COMPOUND_TIERS[2];
  if (amount >= 500) return COMPOUND_TIERS[1];
  return COMPOUND_TIERS[0];
}

const DURATION_OPTIONS = [1, 3, 6, 9, 12, 15, 18, 21, 24] as const;
const DAILY_RATE = 0.0015; // 0.15% per compound

function CompoundingCalculator() {
  const [principal, setPrincipal] = useState('1000');
  const [duration, setDuration] = useState(6);
  const t = useTranslations('staking');

  const result = useMemo(() => {
    const P = Number(principal) || 0;
    if (P <= 0) return { profit: 0, tierName: '', intervalLabel: '', totalCompounds: 0 };

    const tier = getCompoundTier(P);
    const intervalMinutes = tier.interval;
    const compoundsPerDay = (24 * 60) / intervalMinutes;
    const r = DAILY_RATE;

    // Duration in days (months * 30)
    const days = duration * 30;

    const totalCompounds = compoundsPerDay * days;
    const A = P * Math.pow(1 + r, totalCompounds);
    const profit = A - P;

    const intervalLabel = `${intervalMinutes / 60}h`;

    return {
      profit,
      tierName: tier.name,
      intervalLabel,
      totalCompounds: Math.floor(totalCompounds),
    };
  }, [principal, duration]);

  return (
    <div className="space-y-5">
      <div>
        <label className="text-xs font-semibold text-surface-600 mb-1.5 block">{t('calcStakeAmount')}</label>
        <input
          type="number"
          value={principal}
          onChange={(e) => setPrincipal(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border-2 border-surface-200 bg-white/70 font-mono text-surface-900 focus:border-primary-400 focus:outline-none transition-colors"
          placeholder={t('calcEnterAmount')}
          min={10}
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-surface-600 mb-1.5 block">
          {t('calcDuration', { count: duration })}
        </label>
        <input
          type="range"
          min={1}
          max={24}
          step={1}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary-500 bg-gradient-to-r from-primary-200 to-secondary-200"
        />
        <div className="flex justify-between mt-2">
          {DURATION_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDuration(d)}
              className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono transition-colors ${
                duration === d
                  ? 'bg-primary-500 text-white font-bold'
                  : 'text-surface-400 hover:text-primary-600'
              }`}
            >
              {d}m
            </button>
          ))}
        </div>
      </div>

      {Number(principal) >= 10 && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-gradient-to-br from-success-50 to-success-100/60 border-2 border-success-200/50 text-center">
            <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">{t('calcProjectedProfit')}</p>
            <p className="font-mono font-bold text-success-700 text-3xl">
              ${result.profit.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg bg-surface-50 border border-surface-200">
              <p className="text-[10px] uppercase text-surface-400">{t('calcTier')}</p>
              <p className="text-sm font-bold text-surface-800">{result.tierName}</p>
            </div>
            <div className="p-2 rounded-lg bg-surface-50 border border-surface-200">
              <p className="text-[10px] uppercase text-surface-400">{t('calcFrequency')}</p>
              <p className="text-sm font-bold text-surface-800">{result.intervalLabel}</p>
            </div>
            <div className="p-2 rounded-lg bg-surface-50 border border-surface-200">
              <p className="text-[10px] uppercase text-surface-400">{t('calcCompounds')}</p>
              <p className="text-sm font-bold text-surface-800">{result.totalCompounds}x</p>
            </div>
          </div>
        </div>
      )}

      <p className="text-[10px] text-surface-400 text-center">
        {t('calcNote')}
      </p>
    </div>
  );
}

function StakePageInner() {
  const { isConnected } = useAccount();
  const [amount, setAmount] = useState('');
  const { stake, harvestTier, compoundTier, unstake, isPending, isCompounding } = useStaking();
  const { tierGroups, activeStakes, stakes, isLoading } = useUserStakes();
  const { usdtFormatted } = useTokenBalances();
  const { storedReferrer, hasOnChainReferrer } = useRegistration();
  const { unlockedLevels, directReferrals: directRefs } = useAffiliate();
  const approval = useApproval(contracts.usdt, contracts.stakingManager);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const t = useTranslations('staking');

  // Real-time tick every second for accruing earnings display
  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <h2 className="text-2xl font-orbitron font-bold text-surface-900">{t('connectWalletTitle')}</h2>
        <ConnectButton />
      </div>
    );
  }

  const numAmount = Number(amount) || 0;
  const tier = getTier(numAmount);
  const stakeAmountBigInt = numAmount > 0 ? parseUnits(amount, USDT_DECIMALS) : BigInt(0);
  const needsApproval = numAmount > 0 && !approval.hasAllowance(stakeAmountBigInt);
  const pendingStakeRef = useRef(false);

  // Auto-stake after approval succeeds (one-click flow)
  useEffect(() => {
    if (pendingStakeRef.current && approval.hasAllowance(stakeAmountBigInt) && !isPending) {
      pendingStakeRef.current = false;
      const ref = storedReferrer && isAddress(storedReferrer) ? (storedReferrer as `0x${string}`) : zeroAddress;
      stake(stakeAmountBigInt, ref);
    }
  }, [approval.allowance]);

  const handleStake = () => {
    if (needsApproval) {
      pendingStakeRef.current = true;
      approval.approve(stakeAmountBigInt);
      return;
    }
    const ref = storedReferrer && isAddress(storedReferrer) ? (storedReferrer as `0x${string}`) : zeroAddress;
    stake(stakeAmountBigInt, ref);
  };

  /**
   * Confirm + trigger unstake for a single stake.
   * Uses client-side calculation: unstake returns 80% of current compounded amount in KAIRO.
   */
  const handleUnstake = (stakeIndex: number, originalUsdt: number, previewKairo: number) => {
    const previewUsd = previewKairo; // previewUnstake returns KAIRO (18 decimals, same as USDT)
    const ok = typeof window !== 'undefined' && window.confirm(
      t('unstakeConfirm', { index: stakeIndex + 1, original: originalUsdt.toFixed(2), preview: previewUsd.toFixed(2) })
    );
    if (!ok) return;
    unstake(BigInt(stakeIndex));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-orbitron font-bold gradient-text">{t('title')}</h1>

      {/* Tier Comparison */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {STAKING_TIERS.map((tTier, i) => {
          const isCurrentTier = numAmount >= 10 && tier.name === tTier.name;
          const tierBadge = tTier.name.toLowerCase() as 'bronze' | 'silver' | 'gold';
          return (
            <GlassCard
              key={tTier.name}
              variant={isCurrentTier ? (i === 2 ? 'gold' : i === 1 ? 'purple' : 'cyan') : 'default'}
              padding="p-3 sm:p-5"
              className={isCurrentTier ? 'ring-2 ring-primary-300 shadow-lg' : 'opacity-60'}
            >
              <div className="flex flex-col items-center text-center h-full">
                <Badge tier={tierBadge} size="md">{tTier.name}</Badge>
                <p className="text-[10px] sm:text-sm text-surface-400 mt-2 sm:mt-3 min-h-[1.25rem] sm:min-h-[1.5rem] flex items-center">
                  ${tTier.minAmount.toLocaleString()}{tTier.maxAmount === Infinity ? '+' : ` – $${tTier.maxAmount.toLocaleString()}`}
                </p>
                <p className="text-xl sm:text-2xl font-mono font-bold text-surface-900 mt-1">{tTier.compoundInterval >= 3600 ? `${tTier.compoundInterval / 3600}h` : `${tTier.compoundInterval / 60}m`}</p>
                <p className="text-xs sm:text-sm text-surface-500">{t('closingInterval')}</p>
              </div>
            </GlassCard>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stake Form */}
        <GlassCard className="lg:col-span-1">
          <h3 className="text-xl font-semibold text-surface-900">{t('newStake')}</h3>

          <div className="space-y-4">
            <Input
              label={t('amount')}
              type="number"
              placeholder={t('amountPlaceholder')}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              helperText={t('balanceHelper', { balance: Number(usdtFormatted).toFixed(2) })}
            />

            {numAmount >= 10 && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-gradient-to-r from-primary-50 to-secondary-50 border border-primary-100">
                <Badge tier={tier.name.toLowerCase() as any}>{tier.name}</Badge>
                <span className="text-xs text-surface-500">
                  {t('autoCompoundEvery', { interval: tier.compoundInterval >= 3600 ? `${tier.compoundInterval / 3600}h` : `${tier.compoundInterval / 60}m` })} &middot; 3X FIFO Cap
                </span>
              </div>
            )}


            <Button
              onClick={handleStake}
              loading={isPending || approval.isPending}
              disabled={numAmount < 10}
              className="w-full"
            >
              {needsApproval ? t('approveAndStake', { amount: numAmount }) : t('stakeBtn', { amount: numAmount })}
            </Button>
          </div>
        </GlassCard>

        {/* Tier-Grouped Stakes */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-surface-900">{t('yourStakes')}</h3>
            <span className="text-sm font-mono text-surface-400">{activeStakes.length} {t('active')}</span>
          </div>

          {tierGroups.length === 0 ? (
            <GlassCard>
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-300/30">
                  <BoltIcon className="w-8 h-8 text-white" />
                </div>
                <p className="text-surface-500 text-sm">
                  {t('noActiveStakesDesc')}
                </p>
              </div>
            </GlassCard>
          ) : (
            <div className="space-y-4">
              {tierGroups.map((tg) => {
                const progressVariant = tg.capProgress > 80 ? 'gold' : tg.capProgress > 50 ? 'purple' : 'cyan';
                return (
                  <GlassCard key={tg.tier} padding="p-5" className="hover:shadow-card-hover">
                    {/* Tier header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Badge tier={tg.tierName.toLowerCase() as any} size="md">{tg.tierName}</Badge>
                        <span className="text-xs text-surface-400">
                          {t('stakeCount', { count: tg.stakeCount })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-surface-500 font-medium">
                        <ClockIcon className="w-3.5 h-3.5" />
                        {t('autoCompound')} &middot; {tg.compoundInterval >= 3600 ? `${tg.compoundInterval / 3600}h` : `${tg.compoundInterval / 60}m`} {t('intervals')}
                      </div>
                    </div>

                    {/* Staked Amount (prominent) */}
                    <div className="text-center mb-4">
                      <p className="text-3xl font-mono font-bold text-surface-900">
                        ${tg.originalAmountFormatted}
                      </p>
                      <p className="text-xs text-surface-400 mt-1">{t('totalStaked')}</p>
                    </div>

                    {/* 3X Cap Progress */}
                    <ProgressBar
                      value={tg.capProgress}
                      label={t('tierHeader')}
                      variant={progressVariant}
                      size="md"
                      className="mb-4"
                    />

                    {/* Earnings: Harvestable | Harvested | Total Earned */}
                    <div className="grid grid-cols-3 gap-3 mb-4 items-center">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-accent-100 to-accent-50 border-2 border-accent-200/60 text-center">
                        <p className="font-mono font-bold text-accent-700 text-lg">${tg.displayHarvestableFormatted}</p>
                        <p className="text-[10px] text-surface-400 mt-0.5">{t('harvestable')}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-gradient-to-br from-secondary-100 to-secondary-50 border-2 border-secondary-200/60 text-center">
                        <p className="font-mono font-bold text-secondary-700 text-lg">${tg.totalHarvestedFormatted}</p>
                        <p className="text-[10px] text-surface-400 mt-0.5">{t('harvested')}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-gradient-to-br from-primary-100 to-primary-50 border-2 border-primary-200/60 text-center">
                        <p className="font-mono font-bold text-primary-700 text-lg">${tg.totalEarnedFormatted}</p>
                        <p className="text-[10px] text-surface-400 mt-0.5">{t('totalEarned')}</p>
                      </div>
                    </div>

                    {/* Pending compound (claimable on next compound() call) */}
                    {tg.pendingProfit > 0n && (
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary-50/60 border border-primary-200/60 mb-3">
                        <span className="text-[11px] text-surface-500">{t('pendingCompoundProfit')}</span>
                        <span className="font-mono font-semibold text-primary-700 text-sm">+${tg.pendingProfitFormatted}</span>
                      </div>
                    )}

                    {/* Action buttons: Compound (left) + Harvest (right) */}
                    {(() => {
                      const eligibleCount = tg.stakes.filter((s) => s.canCompound).length;
                      const canCompound = eligibleCount > 0;
                      return (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            onClick={() => compoundTier(tg.stakes)}
                            loading={isCompounding}
                            disabled={!canCompound || isPending}
                            className="w-full"
                            size="sm"
                            variant="secondary"
                            icon={<ArrowPathIcon className="w-4 h-4" />}
                          >
                            {canCompound ? t('autoCompoundBtn', { count: eligibleCount }) : t('accruing')}
                          </Button>
                          <Button
                            onClick={() => harvestTier(tg.stakes)}
                            loading={isPending && !isCompounding}
                            disabled={!tg.canHarvest || isCompounding}
                            className="w-full"
                            size="sm"
                            icon={<ArrowDownTrayIcon className="w-4 h-4" />}
                          >
                            {tg.canHarvest
                              ? t('harvestBtn', { amount: tg.actuallyHarvestableFormatted })
                              : tg.harvestable > 0n
                                ? t('minHarvestStake')
                                : t('minHarvestAmount')}
                          </Button>
                        </div>
                      );
                    })()}
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Staking History */}
      {stakes.length > 0 && (
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-surface-900">{t('stakingHistory')}</h3>
            <span className="text-sm font-mono text-surface-400">{stakes.length} {t('total')}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-surface-500">#</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-surface-500">{t('tierCol')}</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-surface-500">{t('stakedCol')}</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-surface-500">{t('earnedCol')}</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-surface-500">{t('harvestedCol')}</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-surface-500">{t('capCol')}</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-surface-500">{t('startedCol')}</th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-surface-500">{t('statusCol')}</th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-surface-500">{t('actionCol')}</th>
                </tr>
              </thead>
              <tbody>
                {stakes.map((s) => {
                  const capPct = s.hardCap > 0n ? Number((s.totalEarned * 100n) / s.hardCap) : 0;
                  const startDate = new Date(s.startTime * 1000);
                  const statusLabel = s.active ? t('statusActive') : capPct >= 100 ? t('statusCapped') : t('statusClosed');
                  const statusColor = s.active ? 'text-success-600 bg-success-50 border-success-200' : capPct >= 100 ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-surface-500 bg-surface-100 border-surface-200';
                  const StatusIcon = s.active ? BoltIcon : capPct >= 100 ? FireIcon : XCircleIcon;
                  return (
                    <tr key={s.index} className={`border-b border-surface-100 ${!s.active ? 'opacity-60' : ''}`}>
                      <td className="py-2.5 px-2 font-mono text-surface-400">{s.index + 1}</td>
                      <td className="py-2.5 px-2">
                        <Badge tier={s.tierName.toLowerCase() as any} size="sm">{s.tierName}</Badge>
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-semibold text-surface-900">
                        ${Number(formatUnits(s.originalAmount, USDT_DECIMALS)).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-primary-600">
                        ${Number(formatUnits(s.totalEarned, USDT_DECIMALS)).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-secondary-600">
                        ${Number(formatUnits(s.harvestedRewards, USDT_DECIMALS)).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-surface-200 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                capPct >= 100 ? 'bg-amber-500' : capPct > 50 ? 'bg-primary-500' : 'bg-accent-500'
                              }`}
                              style={{ width: `${Math.min(capPct, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-surface-400">{Math.min(capPct, 100)}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-xs text-surface-500">
                        {startDate.toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusColor}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusLabel}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        {!s.active ? (
                          <span className="text-[10px] text-surface-300">—</span>
                        ) : (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleUnstake(s.index, Number(formatUnits(s.originalAmount, USDT_DECIMALS)), Number(formatUnits(s.previewUnstakeAmount, USDT_DECIMALS)))}
                            disabled={isPending}
                            icon={<ArrowUturnLeftIcon className="w-3.5 h-3.5" />}
                          >
                            {t('unstake')}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Compounding Calculator */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center shadow-md shadow-primary-300/30">
            <CalculatorIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-surface-900">{t('calcTitle')}</h3>
            <p className="text-xs text-surface-500">{t('calcSubtitle')}</p>
          </div>
        </div>
        <CompoundingCalculator />
      </GlassCard>

      {/* Level Unlock Requirements */}
      <GlassCard>
        <h3 className="text-lg font-semibold text-surface-900 mb-3">{t('levelUnlockTitle')}</h3>
        <p className="text-xs text-surface-500 mb-4">{t('levelUnlockDesc', { count: ((directRefs as any[]) || []).length, unlocked: unlockedLevels })}</p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {Array.from({ length: 15 }, (_, i) => {
            const level = i + 1;
            const isUnlocked = level <= unlockedLevels;
            let directsNeeded: number;
            if (level <= 5) {
              directsNeeded = level;
            } else {
              directsNeeded = 5 + Math.ceil((level - 5) / 2);
            }
            return (
              <div
                key={i}
                className={`p-2 rounded-xl text-center border-2 transition-all ${
                  isUnlocked
                    ? 'bg-gradient-to-br from-success-50 to-success-100/60 border-success-300/60'
                    : 'bg-surface-50 border-surface-200 opacity-60'
                }`}
              >
                <div className="flex justify-center mb-1">
                  {isUnlocked ? (
                    <LockOpenIcon className="w-4 h-4 text-success-600" />
                  ) : (
                    <LockClosedIcon className="w-4 h-4 text-surface-400" />
                  )}
                </div>
                <p className={`text-sm font-bold ${isUnlocked ? 'text-success-700' : 'text-surface-500'}`}>L{level}</p>
                <p className="text-[10px] text-surface-400">{directsNeeded} {t('directs')}</p>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}

export default function StakePage() {
  const tCommon = useTranslations('common');
  return (
    <Suspense fallback={<div className="text-surface-500 text-center py-20">{tCommon('loading')}</div>}>
      <StakePageInner />
    </Suspense>
  );
}
