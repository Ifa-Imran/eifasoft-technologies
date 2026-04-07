'use client';

import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { GlassCard, Button, Badge, ProgressBar } from '@/components/ui';
import { useAffiliate } from '@/hooks/useAffiliate';
import { RANK_NAMES, RANK_THRESHOLDS, RANK_SALARIES_USD, USDT_DECIMALS } from '@/config/contracts';
import { formatUnits } from 'viem';
import { shortenAddress, formatCompact } from '@/lib/utils';
import {
  TrophyIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  LockClosedIcon,
  ScaleIcon,
} from '@heroicons/react/24/outline';

export default function RankDividendPage() {
  const { isConnected, address } = useAccount();
  const { allIncome, rankInfo, directReferrals, freshBusiness, teamVolume, unlockedLevels, legVolumes, largestLegVolume, claimRankSalary, harvestIncome, isLoading, isPending } = useAffiliate();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <h2 className="text-2xl font-orbitron font-bold text-surface-900">Connect Wallet</h2>
        <ConnectButton />
      </div>
    );
  }

  const currentRank = rankInfo ? Number(rankInfo[0] || 0) : 0;
  const rankName = RANK_NAMES[currentRank] || 'None';
  const referralsList = (directReferrals as any[]) || [];
  const weeklyBiz = freshBusiness ? Number(formatUnits(BigInt(freshBusiness[0] || 0), USDT_DECIMALS)) : 0;
  const monthlyBiz = freshBusiness ? Number(formatUnits(BigInt(freshBusiness[1] || 0), USDT_DECIMALS)) : 0;
  const teamVolumeUsd = teamVolume ? Number(formatUnits(teamVolume, USDT_DECIMALS)) : 0;
  const largestLegUsd = largestLegVolume ? Number(formatUnits(largestLegVolume, USDT_DECIMALS)) : 0;

  // 50% max-leg rule calculation (mirrors contract logic)
  const maxLeg = teamVolumeUsd / 2;
  const adjustedVolume = largestLegUsd > maxLeg
    ? teamVolumeUsd - largestLegUsd + maxLeg
    : teamVolumeUsd;
  const otherLegsVolume = teamVolumeUsd - largestLegUsd;
  const isLegCapped = largestLegUsd > maxLeg;

  // Next rank target
  const nextRankIdx = currentRank < 10 ? currentRank : 9; // index into 0-based threshold array
  const nextThreshold = currentRank < 10 ? RANK_THRESHOLDS[nextRankIdx] : RANK_THRESHOLDS[9];
  const progressToNext = nextThreshold > 0 ? Math.min((adjustedVolume / nextThreshold) * 100, 100) : 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-orbitron font-bold gradient-text">Rank Dividend</h1>
        <p className="text-base text-surface-500 mt-1">Achieve ranks through team volume and earn periodic salary rewards</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Current Rank */}
        <GlassCard variant="gradient" className="text-center">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary-400/30">
            <TrophyIcon className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-sm text-surface-500 mb-2">Current Rank</h3>
          <div className="text-3xl font-orbitron font-bold gradient-text mb-2">{rankName}</div>
          <Badge tier="purple" size="md">Level {currentRank} / 10</Badge>

          <div className="mt-4">
            <ProgressBar
              value={currentRank}
              max={10}
              label="Rank Progress"
              variant="purple"
            />
          </div>

          <Button onClick={claimRankSalary} loading={isPending} className="w-full mt-4">
            Harvest Rank Salary
          </Button>
        </GlassCard>

        {/* Team Volume & Progress */}
        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <ArrowTrendingUpIcon className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-surface-900">Team Volume</h3>
          </div>
          <div className="text-center p-5 rounded-2xl bg-gradient-to-br from-primary-50/60 to-white/60 border-2 border-primary-200/50 mb-4">
            <p className="text-3xl font-mono font-bold text-surface-900">
              ${formatCompact(teamVolumeUsd, 0)}
            </p>
            <p className="text-sm text-surface-500 mt-1">Total Team Volume</p>
          </div>

          {currentRank < 10 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Next: {RANK_NAMES[currentRank + 1]}</span>
                <span className="font-mono font-semibold text-primary-600">
                  ${formatCompact(nextThreshold, 0)}
                </span>
              </div>
              <ProgressBar value={progressToNext} label={`${progressToNext.toFixed(1)}% achieved`} variant="cyan" size="lg" />
              <p className="text-xs text-surface-400 mt-1">
                {adjustedVolume >= nextThreshold
                  ? 'Target met!'
                  : `Need $${formatCompact(nextThreshold - adjustedVolume, 0)} more (adjusted)`}
              </p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="p-3 rounded-xl bg-gradient-to-r from-primary-100 to-primary-50 border border-primary-200/50 text-center">
              <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Direct Referrals</p>
              <p className="text-lg font-mono font-bold text-primary-700">{referralsList.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-r from-secondary-100 to-secondary-50 border border-secondary-200/50 text-center">
              <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Unlocked Levels</p>
              <p className="text-lg font-mono font-bold text-secondary-700">{unlockedLevels} / 15</p>
            </div>
          </div>
        </GlassCard>

        {/* Harvest Income */}
        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <CurrencyDollarIcon className="w-5 h-5 text-accent-600" />
            <h3 className="text-lg font-semibold text-surface-900">Harvest Income</h3>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Direct', color: 'bg-primary-500', text: 'text-primary-600' },
              { label: 'Team', color: 'bg-secondary-500', text: 'text-secondary-600' },
              { label: 'Rank', color: 'bg-accent-500', text: 'text-accent-600' },
              { label: 'Weekly', color: 'bg-success-500', text: 'text-success-600' },
              { label: 'Monthly', color: 'bg-warn-500', text: 'text-warn-600' },
            ].map((item, i) => {
              const income = allIncome ? Number(formatUnits(BigInt(allIncome[i] || 0), USDT_DECIMALS)) : 0;
              return (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-surface-50 to-primary-50/30 border border-primary-100/30 hover:border-primary-200 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${item.color}`} />
                    <span className="text-sm text-surface-600">{item.label}</span>
                    <span className={`font-mono font-semibold ${item.text}`}>${income.toFixed(2)}</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => harvestIncome(i)} disabled={income <= 0 || isPending}>
                    Harvest
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="p-2 rounded-xl bg-gradient-to-r from-success-50 to-success-100/60 border border-success-200/40">
              <p className="text-[10px] uppercase text-surface-400">Weekly Biz</p>
              <p className="font-mono font-bold text-success-700">${formatCompact(weeklyBiz, 0)}</p>
            </div>
            <div className="p-2 rounded-xl bg-gradient-to-r from-warn-50 to-warn-100/60 border border-warn-200/40">
              <p className="text-[10px] uppercase text-surface-400">Monthly Biz</p>
              <p className="font-mono font-bold text-warn-700">${formatCompact(monthlyBiz, 0)}</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* 50% Max-Leg Rule Condition */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <ScaleIcon className="w-5 h-5 text-secondary-600" />
          <h3 className="text-lg font-semibold text-surface-900">50% Max-Leg Rule</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isLegCapped ? 'bg-warn-100 text-warn-700' : 'bg-success-100 text-success-700'}`}>
            {isLegCapped ? 'Capped' : 'Balanced'}
          </span>
        </div>
        <p className="text-xs text-surface-500 mb-4">
          No single leg can count for more than 50% of your total team volume when calculating rank.
          If your largest leg exceeds 50%, the excess is excluded from the qualifying volume.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100/60 border border-primary-200/50 text-center">
            <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Total Volume</p>
            <p className="text-lg font-mono font-bold text-primary-700">${formatCompact(teamVolumeUsd, 0)}</p>
          </div>
          <div className="p-3 rounded-xl bg-gradient-to-br from-warn-50 to-warn-100/60 border border-warn-200/50 text-center">
            <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Largest Leg</p>
            <p className="text-lg font-mono font-bold text-warn-700">${formatCompact(largestLegUsd, 0)}</p>
          </div>
          <div className="p-3 rounded-xl bg-gradient-to-br from-secondary-50 to-secondary-100/60 border border-secondary-200/50 text-center">
            <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Other Legs</p>
            <p className="text-lg font-mono font-bold text-secondary-700">${formatCompact(otherLegsVolume, 0)}</p>
          </div>
          <div className={`p-3 rounded-xl border text-center ${isLegCapped ? 'bg-gradient-to-br from-warn-50 to-warn-100/60 border-warn-200/50' : 'bg-gradient-to-br from-success-50 to-success-100/60 border-success-200/50'}`}>
            <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Qualifying Volume</p>
            <p className={`text-lg font-mono font-bold ${isLegCapped ? 'text-warn-700' : 'text-success-700'}`}>${formatCompact(adjustedVolume, 0)}</p>
          </div>
        </div>

        {/* Leg distribution visual */}
        {teamVolumeUsd > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-surface-500">
              <span>Largest leg contribution</span>
              <span className="font-mono">{((largestLegUsd / teamVolumeUsd) * 100).toFixed(1)}% of total</span>
            </div>
            <div className="w-full h-3 rounded-full bg-surface-100 overflow-hidden flex">
              <div
                className={`h-full transition-all ${isLegCapped ? 'bg-warn-400' : 'bg-success-400'}`}
                style={{ width: `${Math.min((largestLegUsd / teamVolumeUsd) * 100, 100)}%` }}
              />
              <div
                className="h-full bg-primary-300 transition-all"
                style={{ width: `${Math.min((otherLegsVolume / teamVolumeUsd) * 100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px]">
              <span className={`flex items-center gap-1 ${isLegCapped ? 'text-warn-600' : 'text-success-600'}`}>
                <span className={`w-2 h-2 rounded-full ${isLegCapped ? 'bg-warn-400' : 'bg-success-400'}`} />
                Largest Leg {isLegCapped && '(50% cap applied)'}
              </span>
              <span className="flex items-center gap-1 text-primary-600">
                <span className="w-2 h-2 rounded-full bg-primary-300" />
                Other Legs
              </span>
            </div>
            {isLegCapped && (
              <p className="text-xs text-warn-600 mt-1 p-2 rounded-lg bg-warn-50 border border-warn-200">
                Your largest leg ({((largestLegUsd / teamVolumeUsd) * 100).toFixed(1)}%) exceeds the 50% limit.
                ${formatCompact(largestLegUsd - maxLeg, 0)} excluded from qualifying volume.
              </p>
            )}
          </div>
        )}
      </GlassCard>

      {/* Rank Table - Performance Targets & Salaries */}
      <GlassCard>
        <h3 className="text-lg font-semibold text-surface-900 mb-4">Rank Targets & Salaries</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200">
                <th className="text-left py-3 px-3 text-surface-500 font-medium">Rank</th>
                <th className="text-right py-3 px-3 text-surface-500 font-medium">Team Volume Target</th>
                <th className="text-right py-3 px-3 text-surface-500 font-medium">Salary / Period</th>
                <th className="text-center py-3 px-3 text-surface-500 font-medium">Progress</th>
                <th className="text-center py-3 px-3 text-surface-500 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {RANK_THRESHOLDS.map((threshold, i) => {
                const rankLevel = i + 1;
                const isAchieved = currentRank >= rankLevel;
                const isNext = currentRank === i; // next rank to achieve
                const adjustedProgressPct = Math.min((adjustedVolume / threshold) * 100, 100);

                return (
                  <tr
                    key={i}
                    className={`border-b border-surface-100 transition-colors ${
                      isAchieved
                        ? 'bg-success-50/40'
                        : isNext
                          ? 'bg-primary-50/40'
                          : ''
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isAchieved
                            ? 'bg-success-500 text-white'
                            : isNext
                              ? 'bg-primary-500 text-white'
                              : 'bg-surface-200 text-surface-500'
                        }`}>
                          {rankLevel}
                        </span>
                        <span className={`font-medium ${isAchieved ? 'text-success-700' : isNext ? 'text-primary-700' : 'text-surface-600'}`}>
                          {RANK_NAMES[rankLevel]}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-surface-700">
                      ${formatCompact(threshold, 0)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-accent-600">
                      ${RANK_SALARIES_USD[i].toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <div className="w-full max-w-[120px] mx-auto">
                        <ProgressBar
                          value={adjustedProgressPct}
                          variant={isAchieved ? 'green' : isNext ? 'cyan' : 'amber'}
                          size="sm"
                          showValue={false}
                        />
                        <p className="text-[10px] text-center text-surface-400 mt-0.5">
                          {adjustedProgressPct >= 100 ? '100%' : `${adjustedProgressPct.toFixed(1)}%`}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {isAchieved ? (
                        <span className="inline-flex items-center gap-1 text-success-600 text-xs font-semibold">
                          <CheckCircleIcon className="w-4 h-4" /> Achieved
                        </span>
                      ) : isNext ? (
                        <span className="inline-flex items-center gap-1 text-primary-600 text-xs font-semibold animate-pulse-soft">
                          <ArrowTrendingUpIcon className="w-4 h-4" /> Next Target
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-surface-400 text-xs">
                          <LockClosedIcon className="w-4 h-4" /> Locked
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Direct Referrals List */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-surface-900">Direct Referrals</h3>
          <Badge tier="cyan">{referralsList.length} members</Badge>
        </div>
        {referralsList.length === 0 ? (
          <div className="text-center py-8">
            <UserGroupIcon className="w-12 h-12 text-surface-300 mx-auto mb-3" />
            <p className="text-surface-500 text-sm">No referrals yet. Share your link to start earning!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {referralsList.map((ref: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-primary-50/60 to-secondary-50/30 border border-primary-100/30 hover:border-primary-200 transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center text-xs font-bold text-white shadow-sm shadow-primary-300/30">
                  {i + 1}
                </div>
                <span className="text-sm font-mono text-surface-600">{shortenAddress(String(ref))}</span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
