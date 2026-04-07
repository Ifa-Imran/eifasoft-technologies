'use client';

import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { GlassCard, Button, ProgressBar } from '@/components/ui';
import { useAffiliate } from '@/hooks/useAffiliate';
import { USDT_DECIMALS } from '@/config/contracts';
import { formatUnits } from 'viem';
import {
  CalendarDaysIcon,
  CalendarIcon,
  TrophyIcon,
  BoltIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

const WEEKLY_THRESHOLD = 50000;
const MONTHLY_THRESHOLD = 500000;
const WEEKLY_POOL_SHARE = '3%';
const MONTHLY_POOL_SHARE = '2%';

export default function QualifiersPage() {
  const { isConnected } = useAccount();
  const { freshBusiness, claimWeeklyQualifier, claimMonthlyQualifier, isPending } = useAffiliate();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center mb-2 shadow-xl shadow-primary-300/30">
          <TrophyIcon className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-orbitron font-bold text-surface-900">Connect Wallet</h2>
        <p className="text-surface-500 text-sm">Qualify for bonus reward pools</p>
        <ConnectButton />
      </div>
    );
  }

  const weeklyBiz = freshBusiness ? Number(formatUnits(BigInt(freshBusiness[0] || 0), USDT_DECIMALS)) : 0;
  const monthlyBiz = freshBusiness ? Number(formatUnits(BigInt(freshBusiness[1] || 0), USDT_DECIMALS)) : 0;
  const weeklyQualified = weeklyBiz >= WEEKLY_THRESHOLD;
  const monthlyQualified = monthlyBiz >= MONTHLY_THRESHOLD;
  const weeklyPercent = Math.min((weeklyBiz / WEEKLY_THRESHOLD) * 100, 100);
  const monthlyPercent = Math.min((monthlyBiz / MONTHLY_THRESHOLD) * 100, 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-orbitron font-bold gradient-text">Qualifier Pools</h1>
        <p className="text-base text-surface-500 mt-1">Earn bonus rewards from global staking pools</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <GlassCard padding="p-4">
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Weekly Pool</p>
          <p className="text-lg font-mono font-bold text-primary-600">{WEEKLY_POOL_SHARE}</p>
          <p className="text-xs text-surface-400">of global volume</p>
        </GlassCard>
        <GlassCard padding="p-4">
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Monthly Pool</p>
          <p className="text-lg font-mono font-bold text-secondary-600">{MONTHLY_POOL_SHARE}</p>
          <p className="text-xs text-surface-400">of global volume</p>
        </GlassCard>
        <GlassCard padding="p-4">
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Weekly Target</p>
          <p className="text-lg font-mono font-bold text-surface-900">${WEEKLY_THRESHOLD.toLocaleString()}</p>
          <p className="text-xs text-surface-400">fresh business</p>
        </GlassCard>
        <GlassCard padding="p-4">
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Monthly Target</p>
          <p className="text-lg font-mono font-bold text-surface-900">${MONTHLY_THRESHOLD.toLocaleString()}</p>
          <p className="text-xs text-surface-400">fresh business</p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Weekly Pool */}
        <GlassCard variant="cyan">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-400 flex items-center justify-center shadow-lg shadow-primary-400/30">
              <CalendarIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-surface-900">Weekly Qualifier</h3>
              <p className="text-xs text-surface-500">{WEEKLY_POOL_SHARE} of weekly staking volume pool</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="text-center p-5 rounded-2xl bg-gradient-to-br from-primary-50/60 to-white/60 border-2 border-primary-200/50">
              <p className="text-4xl font-mono font-bold text-surface-900">
                ${weeklyBiz.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-sm text-surface-500 mt-1">Fresh Business This Week</p>
              <p className="text-xs font-mono text-surface-400 mt-0.5">{weeklyPercent.toFixed(1)}% of target</p>
            </div>

            <ProgressBar
              value={weeklyBiz}
              max={WEEKLY_THRESHOLD}
              label={`$${weeklyBiz.toLocaleString()} / $${WEEKLY_THRESHOLD.toLocaleString()}`}
              variant="cyan"
              size="lg"
            />

            <div className={`p-4 rounded-xl text-center ${
              weeklyQualified
                ? 'bg-success-50 border border-success-200'
                : 'bg-surface-50 border border-surface-200'
            }`}>
              {weeklyQualified ? (
                <div className="flex items-center justify-center gap-2">
                  <CheckCircleIcon className="w-5 h-5 text-success-600" />
                  <span className="text-success-600 font-semibold">Qualified! Harvest your reward</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <ExclamationTriangleIcon className="w-4 h-4 text-surface-400" />
                  <span className="text-surface-500 text-sm">
                    Need <span className="font-mono font-semibold text-surface-700">${(WEEKLY_THRESHOLD - weeklyBiz).toLocaleString()}</span> more
                  </span>
                </div>
              )}
            </div>

            <Button
              onClick={claimWeeklyQualifier}
              loading={isPending}
              disabled={!weeklyQualified}
              className="w-full"
              icon={<BoltIcon className="w-4 h-4" />}
            >
              Harvest Weekly Reward
            </Button>
          </div>
        </GlassCard>

        {/* Monthly Pool */}
        <GlassCard variant="purple">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-secondary-500 to-secondary-400 flex items-center justify-center shadow-lg shadow-secondary-400/30">
              <CalendarDaysIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-surface-900">Monthly Qualifier</h3>
              <p className="text-xs text-surface-500">{MONTHLY_POOL_SHARE} of monthly staking volume pool</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="text-center p-5 rounded-2xl bg-gradient-to-br from-secondary-50/60 to-white/60 border-2 border-secondary-200/50">
              <p className="text-4xl font-mono font-bold text-surface-900">
                ${monthlyBiz.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-sm text-surface-500 mt-1">Fresh Business This Month</p>
              <p className="text-xs font-mono text-surface-400 mt-0.5">{monthlyPercent.toFixed(1)}% of target</p>
            </div>

            <ProgressBar
              value={monthlyBiz}
              max={MONTHLY_THRESHOLD}
              label={`$${monthlyBiz.toLocaleString()} / $${MONTHLY_THRESHOLD.toLocaleString()}`}
              variant="purple"
              size="lg"
            />

            <div className={`p-4 rounded-xl text-center ${
              monthlyQualified
                ? 'bg-success-50 border border-success-200'
                : 'bg-surface-50 border border-surface-200'
            }`}>
              {monthlyQualified ? (
                <div className="flex items-center justify-center gap-2">
                  <CheckCircleIcon className="w-5 h-5 text-success-600" />
                  <span className="text-success-600 font-semibold">Qualified! Harvest your reward</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <ExclamationTriangleIcon className="w-4 h-4 text-surface-400" />
                  <span className="text-surface-500 text-sm">
                    Need <span className="font-mono font-semibold text-surface-700">${(MONTHLY_THRESHOLD - monthlyBiz).toLocaleString()}</span> more
                  </span>
                </div>
              )}
            </div>

            <Button
              onClick={claimMonthlyQualifier}
              loading={isPending}
              disabled={!monthlyQualified}
              variant="secondary"
              className="w-full"
              icon={<BoltIcon className="w-4 h-4" />}
            >
              Harvest Monthly Reward
            </Button>
          </div>
        </GlassCard>
      </div>

      {/* How It Works */}
      <GlassCard variant="gradient">
        <h3 className="text-sm font-semibold text-surface-900 mb-3">How Qualifier Pools Work</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-surface-600">
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">1</span>
            <span>Generate fresh business volume through your referral network each period.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-secondary-100 text-secondary-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">2</span>
            <span>Meet the threshold ($50K weekly / $500K monthly) to qualify for the pool.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-accent-100 text-accent-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">3</span>
            <span>Harvest your share of the pool distributed equally among all qualifiers.</span>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
