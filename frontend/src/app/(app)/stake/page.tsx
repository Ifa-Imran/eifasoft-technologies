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
import { useCMS } from '@/hooks/useCMS';
import { contracts, STAKING_TIERS, USDT_DECIMALS } from '@/config/contracts';
import { parseUnits, isAddress, zeroAddress, formatUnits } from 'viem';
import { useAffiliate } from '@/hooks/useAffiliate';
import { ArrowDownTrayIcon, ClockIcon, LockClosedIcon, LockOpenIcon, BoltIcon, CheckCircleIcon, XCircleIcon, FireIcon, CalculatorIcon } from '@heroicons/react/24/outline';

function getTier(amount: number) {
  if (amount >= 2000) return STAKING_TIERS[2];
  if (amount >= 500) return STAKING_TIERS[1];
  return STAKING_TIERS[0];
}

// Compounding frequencies per tier
const COMPOUND_TIERS = [
  { name: 'Bronze', min: 10, max: 499, testInterval: 15, prodInterval: 480 },    // 15m test, 8h prod
  { name: 'Silver', min: 500, max: 1999, testInterval: 10, prodInterval: 360 },   // 10m test, 6h prod
  { name: 'Gold', min: 2000, max: Infinity, testInterval: 5, prodInterval: 240 }, // 5m test, 4h prod
] as const;

function getCompoundTier(amount: number) {
  if (amount >= 2000) return COMPOUND_TIERS[2];
  if (amount >= 500) return COMPOUND_TIERS[1];
  return COMPOUND_TIERS[0];
}

const DURATION_OPTIONS_TEST = [1, 2, 4, 6, 8, 12, 16, 20, 24] as const;
const DURATION_OPTIONS_PROD = [1, 3, 6, 9, 12, 15, 18, 21, 24] as const;
const DAILY_RATE = 0.0015; // 0.15% per compound

function CompoundingCalculator() {
  const [principal, setPrincipal] = useState('1000');
  const [duration, setDuration] = useState(6);
  const [mode, setMode] = useState<'test' | 'prod'>('test');

  const durationOptions = mode === 'test' ? DURATION_OPTIONS_TEST : DURATION_OPTIONS_PROD;
  const durationLabel = mode === 'test' ? 'hour' : 'month';
  const durationSuffix = mode === 'test' ? 'h' : 'm';

  const result = useMemo(() => {
    const P = Number(principal) || 0;
    if (P <= 0) return { profit: 0, tierName: '', intervalLabel: '', totalCompounds: 0 };

    const tier = getCompoundTier(P);
    const intervalMinutes = mode === 'test' ? tier.testInterval : tier.prodInterval;
    const compoundsPerDay = (24 * 60) / intervalMinutes;
    const r = DAILY_RATE;

    // Duration in days
    const days = mode === 'test' ? duration / 24 : duration * 30;

    const totalCompounds = compoundsPerDay * days;
    const A = P * Math.pow(1 + r, totalCompounds);
    const profit = A - P;

    const intervalLabel = intervalMinutes >= 60
      ? `${intervalMinutes / 60}h`
      : `${intervalMinutes}m`;

    return {
      profit,
      tierName: tier.name,
      intervalLabel,
      totalCompounds: Math.floor(totalCompounds),
    };
  }, [principal, duration, mode]);

  return (
    <div className="space-y-5">
      {/* Mode Toggle */}
      <div className="flex rounded-xl border-2 border-surface-200 overflow-hidden">
        <button
          onClick={() => { setMode('test'); setDuration(6); }}
          className={`flex-1 py-2 text-xs font-semibold transition-colors ${
            mode === 'test' ? 'bg-primary-500 text-white' : 'bg-white text-surface-500 hover:bg-surface-50'
          }`}
        >
          Testing
        </button>
        <button
          onClick={() => { setMode('prod'); setDuration(6); }}
          className={`flex-1 py-2 text-xs font-semibold transition-colors ${
            mode === 'prod' ? 'bg-primary-500 text-white' : 'bg-white text-surface-500 hover:bg-surface-50'
          }`}
        >
          Production
        </button>
      </div>

      <div>
        <label className="text-xs font-semibold text-surface-600 mb-1.5 block">Stake Amount (USDT)</label>
        <input
          type="number"
          value={principal}
          onChange={(e) => setPrincipal(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border-2 border-surface-200 bg-white/70 font-mono text-surface-900 focus:border-primary-400 focus:outline-none transition-colors"
          placeholder="Enter stake amount..."
          min={10}
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-surface-600 mb-1.5 block">
          Duration: {duration} {durationLabel}{duration > 1 ? 's' : ''}
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
          {durationOptions.map((d) => (
            <button
              key={d}
              onClick={() => setDuration(d)}
              className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono transition-colors ${
                duration === d
                  ? 'bg-primary-500 text-white font-bold'
                  : 'text-surface-400 hover:text-primary-600'
              }`}
            >
              {d}{durationSuffix}
            </button>
          ))}
        </div>
      </div>

      {Number(principal) >= 10 && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-gradient-to-br from-success-50 to-success-100/60 border-2 border-success-200/50 text-center">
            <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Projected Profit</p>
            <p className="font-mono font-bold text-success-700 text-3xl">
              ${result.profit.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg bg-surface-50 border border-surface-200">
              <p className="text-[10px] uppercase text-surface-400">Tier</p>
              <p className="text-sm font-bold text-surface-800">{result.tierName}</p>
            </div>
            <div className="p-2 rounded-lg bg-surface-50 border border-surface-200">
              <p className="text-[10px] uppercase text-surface-400">Frequency</p>
              <p className="text-sm font-bold text-surface-800">{result.intervalLabel}</p>
            </div>
            <div className="p-2 rounded-lg bg-surface-50 border border-surface-200">
              <p className="text-[10px] uppercase text-surface-400">Compounds</p>
              <p className="text-sm font-bold text-surface-800">{result.totalCompounds}x</p>
            </div>
          </div>
        </div>
      )}

      <p className="text-[10px] text-surface-400 text-center">
        0.1% per compound &middot; Tier &amp; frequency auto-detected from amount
      </p>
    </div>
  );
}

function StakePageInner() {
  const { isConnected } = useAccount();
  const [amount, setAmount] = useState('');
  const { stake, harvestTier, isPending } = useStaking();
  const { tierGroups, activeStakes, stakes, isLoading } = useUserStakes();
  const { usdtFormatted } = useTokenBalances();
  const { storedReferrer, hasOnChainReferrer } = useRegistration();
  const { remainingSubscriptions, isSubscriptionEnded, subscribeDeadline } = useCMS();
  const { unlockedLevels, directReferrals: directRefs } = useAffiliate();
  const approval = useApproval(contracts.usdt, contracts.stakingManager);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  // CMS phase is active only if subscriptions remain AND deadline hasn't passed
  const cmsActive = remainingSubscriptions > 0 && !isSubscriptionEnded;

  // CMS countdown
  const cmsTimeLeft = subscribeDeadline > 0 ? Math.max(0, subscribeDeadline - now) : 0;
  const cmsDays = Math.floor(cmsTimeLeft / 86400);
  const cmsHours = Math.floor((cmsTimeLeft % 86400) / 3600);
  const cmsMinutes = Math.floor((cmsTimeLeft % 3600) / 60);
  const cmsSeconds = cmsTimeLeft % 60;

  // Real-time tick every second for accruing earnings display
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
    if (cmsActive) return;
    if (needsApproval) {
      pendingStakeRef.current = true;
      approval.approve(stakeAmountBigInt);
      return;
    }
    const ref = storedReferrer && isAddress(storedReferrer) ? (storedReferrer as `0x${string}`) : zeroAddress;
    stake(stakeAmountBigInt, ref);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-orbitron font-bold gradient-text">Staking</h1>

      {cmsActive && (
        <GlassCard variant="gradient">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-accent-400 to-accent-300 flex items-center justify-center shadow-md shadow-accent-300/30">
                <ClockIcon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-surface-900">CMS Phase Active</h3>
                <p className="text-xs text-surface-500">
                  Staking opens after all {remainingSubscriptions.toLocaleString()} remaining CMS subscriptions are sold or the deadline passes.
                </p>
              </div>
            </div>
            {cmsTimeLeft > 0 && (
              <div className="flex items-center justify-center gap-1.5">
                {cmsDays > 0 && (
                  <div className="text-center px-2 py-1.5 rounded-lg bg-white/70 border border-accent-200">
                    <p className="text-lg font-mono font-bold text-accent-700">{cmsDays}</p>
                    <p className="text-[9px] text-surface-400">DAYS</p>
                  </div>
                )}
                <div className="text-center px-2 py-1.5 rounded-lg bg-white/70 border border-accent-200">
                  <p className="text-lg font-mono font-bold text-accent-700">{String(cmsHours).padStart(2, '0')}</p>
                  <p className="text-[9px] text-surface-400">HRS</p>
                </div>
                <span className="text-accent-400 font-bold">:</span>
                <div className="text-center px-2 py-1.5 rounded-lg bg-white/70 border border-accent-200">
                  <p className="text-lg font-mono font-bold text-accent-700">{String(cmsMinutes).padStart(2, '0')}</p>
                  <p className="text-[9px] text-surface-400">MIN</p>
                </div>
                <span className="text-accent-400 font-bold">:</span>
                <div className="text-center px-2 py-1.5 rounded-lg bg-white/70 border border-accent-200">
                  <p className="text-lg font-mono font-bold text-accent-700">{String(cmsSeconds).padStart(2, '0')}</p>
                  <p className="text-[9px] text-surface-400">SEC</p>
                </div>
              </div>
            )}
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
                <p className="text-sm text-surface-400 mt-3">${t.minAmount.toLocaleString()}{t.maxAmount === Infinity ? '+' : ` – $${t.maxAmount.toLocaleString()}`}</p>
                <p className="text-2xl font-mono font-bold text-surface-900 mt-1">{t.compoundInterval / 60}m</p>
                <p className="text-sm text-surface-500">closing interval</p>
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
              helperText={`Balance: ${Number(usdtFormatted).toFixed(2)} USDT | Min: 10 USDT | No Max Limit`}
            />

            {numAmount >= 10 && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-gradient-to-r from-primary-50 to-secondary-50 border border-primary-100">
                <Badge tier={tier.name.toLowerCase() as any}>{tier.name}</Badge>
                <span className="text-xs text-surface-500">
                  Auto-compound every {tier.compoundInterval / 60}m &middot; 3X FIFO Cap
                </span>
              </div>
            )}


            <Button
              onClick={handleStake}
              loading={isPending || approval.isPending}
              disabled={numAmount < 10 || cmsActive}
              className="w-full"
            >
              {cmsActive ? 'Staking Not Yet Available' : needsApproval ? `Approve & Stake $${numAmount}` : `Stake $${numAmount}`}
            </Button>
          </div>
        </GlassCard>

        {/* Tier-Grouped Stakes */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-surface-900">Your Stakes</h3>
            <span className="text-sm font-mono text-surface-400">{activeStakes.length} active</span>
          </div>

          {tierGroups.length === 0 ? (
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
                          {tg.stakeCount} stake{tg.stakeCount > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-success-600 font-medium">
                        <div className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
                        Auto-Compounding
                      </div>
                    </div>

                    {/* Staked Amount (prominent) */}
                    <div className="text-center mb-4">
                      <p className="text-3xl font-mono font-bold text-surface-900">
                        ${tg.originalAmountFormatted}
                      </p>
                      <p className="text-xs text-surface-400 mt-1">Total Staked</p>
                    </div>

                    {/* 3X Cap Progress */}
                    <ProgressBar
                      value={tg.capProgress}
                      label="3X Cap"
                      variant={progressVariant}
                      size="md"
                      className="mb-4"
                    />

                    {/* Earnings: Harvestable | Harvested | Total Earned */}
                    <div className="grid grid-cols-3 gap-3 mb-4 items-center">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-accent-100 to-accent-50 border-2 border-accent-200/60 text-center">
                        <p className="font-mono font-bold text-accent-700 text-lg">${tg.displayHarvestableFormatted}</p>
                        <p className="text-[10px] text-surface-400 mt-0.5">Harvestable</p>
                      </div>
                      <div className="p-3 rounded-xl bg-gradient-to-br from-secondary-100 to-secondary-50 border-2 border-secondary-200/60 text-center">
                        <p className="font-mono font-bold text-secondary-700 text-lg">${tg.totalHarvestedFormatted}</p>
                        <p className="text-[10px] text-surface-400 mt-0.5">Harvested</p>
                      </div>
                      <div className="p-3 rounded-xl bg-gradient-to-br from-primary-100 to-primary-50 border-2 border-primary-200/60 text-center">
                        <p className="font-mono font-bold text-primary-700 text-lg">${tg.totalEarnedFormatted}</p>
                        <p className="text-[10px] text-surface-400 mt-0.5">Total Earned</p>
                      </div>
                    </div>

                    {/* Harvest Button — enabled when displayHarvestable >= $10 */}
                    <Button
                      onClick={() => harvestTier(tg.stakes)}
                      loading={isPending}
                      disabled={tg.displayHarvestable < BigInt(10) * BigInt(10 ** 18)}
                      className="w-full"
                      size="sm"
                      icon={<ArrowDownTrayIcon className="w-4 h-4" />}
                    >
                      {tg.displayHarvestable >= BigInt(10) * BigInt(10 ** 18) ? `Harvest $${tg.displayHarvestableFormatted}` : 'Min $10 to Harvest'}
                    </Button>
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
            <h3 className="text-lg font-semibold text-surface-900">Staking History</h3>
            <span className="text-sm font-mono text-surface-400">{stakes.length} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-surface-500">#</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-surface-500">Tier</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-surface-500">Staked</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-surface-500">Earned</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-surface-500">Harvested</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-surface-500">3X Cap</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-surface-500">Started</th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-surface-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {stakes.map((s) => {
                  const capPct = s.hardCap > 0n ? Number((s.totalEarned * 100n) / s.hardCap) : 0;
                  const startDate = new Date(s.startTime * 1000);
                  const statusLabel = s.active ? 'Active' : capPct >= 100 ? 'Capped' : 'Closed';
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
            <h3 className="text-lg font-semibold text-surface-900">Compounding Calculator</h3>
            <p className="text-xs text-surface-500">Project potential profit accumulation over time</p>
          </div>
        </div>
        <CompoundingCalculator />
      </GlassCard>

      {/* Level Unlock Requirements */}
      <GlassCard>
        <h3 className="text-lg font-semibold text-surface-900 mb-3">Team Dividend Level Unlock</h3>
        <p className="text-xs text-surface-500 mb-4">Unlock more team dividend levels by adding direct referrals. You currently have <span className="font-semibold text-primary-600">{((directRefs as any[]) || []).length}</span> direct referrals and <span className="font-semibold text-primary-600">{unlockedLevels} / 15</span> levels unlocked.</p>
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
                <p className="text-[10px] text-surface-400">{directsNeeded} directs</p>
              </div>
            );
          })}
        </div>
      </GlassCard>
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
