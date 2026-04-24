'use client';

import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { GlassCard, Button, Badge, ProgressBar } from '@/components/ui';
import { useAffiliate, type SalaryClaimEvent, type SalaryHarvestEvent } from '@/hooks/useAffiliate';
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
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';

export default function RankDividendPage() {
  const { isConnected, address } = useAccount();
  const { allIncome, rankInfo, directReferrals, teamVolume, unlockedLevels, legVolumes, largestLegVolume, harvestIncome, checkRankChange, storedRank, liveRank, rankSalary, nextRankClaim, isRankChangePending, pendingRankSalary: pendingRankSalaryBn, totalRankHarvestable, salaryHistory, harvestHistory, historyLoading, totalHarvestedSalary, teamAnalytics, activeDirects, isLoading, isPending } = useAffiliate();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <h2 className="text-2xl font-orbitron font-bold text-surface-900">Connect Wallet</h2>
        <ConnectButton />
      </div>
    );
  }

  const currentRank = liveRank;
  const rankName = RANK_NAMES[currentRank] || 'USER';

  // Harvestable rank salary (auto-accrues every period, includes pending)
  const harvestableRank = totalRankHarvestable || (allIncome ? BigInt(allIncome[2] || 0) : 0n);
  const harvestableRankUsd = Number(formatUnits(harvestableRank, USDT_DECIMALS));

  const referralsList = (directReferrals as any[]) || [];
  const teamVolumeUsd = teamVolume ? Number(formatUnits(teamVolume, USDT_DECIMALS)) : 0;
  const largestLegUsd = largestLegVolume ? Number(formatUnits(largestLegVolume, USDT_DECIMALS)) : 0;

  // 50%-of-rank-target rule: for each rank, cap each leg at 50% of that rank's threshold
  // Compute qualifying volume for each rank level
  const legVolumeNumbers = legVolumes.map((l: any) => l.volumeUsd as number);

  function getQualifyingVolume(threshold: number): number {
    const maxPerLeg = threshold / 2;
    return legVolumeNumbers.reduce((sum: number, lv: number) => sum + Math.min(lv, maxPerLeg), 0);
  }

  // Next rank target
  const nextRankIdx = currentRank < 10 ? currentRank : 9;
  const nextThreshold = currentRank < 10 ? RANK_THRESHOLDS[nextRankIdx] : RANK_THRESHOLDS[9];
  const nextQualifyingVol = getQualifyingVolume(nextThreshold);
  const progressToNext = nextThreshold > 0 ? Math.min((nextQualifyingVol / nextThreshold) * 100, 100) : 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-orbitron font-bold gradient-text">Rank Dividend</h1>
        <p className="text-base text-surface-500 mt-1">Achieve ranks through team volume and earn periodic salary rewards</p>
      </div>

      {/* Rank Change Alert */}
      {isRankChangePending && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-warn-50 to-warn-100 border border-warn-300 shadow-sm">
          <ExclamationTriangleIcon className="w-6 h-6 text-warn-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-warn-800">
              Rank Change Detected: {RANK_NAMES[storedRank]} &rarr; {RANK_NAMES[liveRank]}
            </p>
            <p className="text-xs text-warn-600 mt-0.5">
              Your salary timer will reset when you confirm. Click below to update your rank.
            </p>
          </div>
          <Button size="sm" onClick={checkRankChange} loading={isPending}>
            Update Rank
          </Button>
        </div>
      )}

      {/* ─── Rank Dividend Dashboard ─── */}
      <GlassCard variant="gradient" padding="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Current Rank */}
          <div className="text-center p-4 rounded-2xl bg-white/60 border-2 border-primary-200/50 shadow-sm">
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mx-auto mb-3 shadow-lg shadow-primary-400/30">
              <TrophyIcon className="w-6 h-6 text-white" />
            </div>
            <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Current Rank</p>
            <p className="text-2xl font-orbitron font-bold gradient-text">{rankName}</p>
            <Badge tier="purple" size="sm">Level {currentRank} / 10</Badge>
          </div>

          {/* Rank Salary */}
          <div className="text-center p-4 rounded-2xl bg-white/60 border-2 border-accent-200/50 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-400 to-accent-300 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-accent-300/30">
              <CurrencyDollarIcon className="w-6 h-6 text-white" />
            </div>
            <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Rank Salary</p>
            <p className="text-2xl font-mono font-bold text-accent-700">
              ${rankSalary ? Number(formatUnits(rankSalary, USDT_DECIMALS)).toFixed(2) : '0.00'}
            </p>
            <p className="text-[10px] text-surface-400">per period</p>
          </div>

          {/* Harvestable Salary */}
          <div className="text-center p-4 rounded-2xl bg-white/60 border-2 border-success-200/50 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-success-400 to-success-300 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-success-300/30">
              <ArrowTrendingUpIcon className="w-6 h-6 text-white" />
            </div>
            <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Harvestable Salary</p>
            <p className="text-2xl font-mono font-bold text-success-700">
              ${harvestableRankUsd.toFixed(2)}
            </p>
            <p className="text-[10px] text-surface-400">auto-accumulates every period</p>
          </div>

          {/* Harvested Salary */}
          <div className="text-center p-4 rounded-2xl bg-white/60 border-2 border-secondary-200/50 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary-400 to-secondary-300 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-secondary-300/30">
              <ArrowDownTrayIcon className="w-6 h-6 text-white" />
            </div>
            <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Harvested Salary</p>
            <p className="text-2xl font-mono font-bold text-secondary-700">
              ${totalHarvestedSalary ? Number(formatUnits(totalHarvestedSalary, USDT_DECIMALS)).toFixed(2) : '0.00'}
            </p>
            <p className="text-[10px] text-surface-400">total claimed</p>
          </div>
        </div>

        {/* Rank Progress Bar */}
        <ProgressBar
          value={currentRank}
          max={10}
          label="Rank Progress"
          variant="purple"
          size="md"
          className="mb-4"
        />

        {/* Salary Info & Harvest Button */}
        {currentRank > 0 && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/50 border border-surface-200 mb-4">
            <div className="flex items-center gap-2">
              <CurrencyDollarIcon className="w-5 h-5 text-accent-500" />
              <span className="text-sm text-surface-600">Earning <span className="font-semibold text-accent-700">${rankSalary ? Number(formatUnits(rankSalary, USDT_DECIMALS)).toFixed(2) : '0'}</span> / period</span>
            </div>
            <p className="text-xs text-surface-400">Auto-accumulates every hour (test) / 7 days (prod)</p>
          </div>
        )}

        {/* Harvest Button */}
        <div className="grid grid-cols-1 gap-3">
          <Button
            onClick={() => harvestIncome(2)}
            loading={isPending}
            disabled={harvestableRank === 0n}
            icon={<ArrowDownTrayIcon className="w-4 h-4" />}
          >
            {harvestableRank > 0n
              ? `Harvest $${harvestableRankUsd.toFixed(2)}`
              : 'Nothing to Harvest'}
          </Button>
        </div>
      </GlassCard>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Team Volume & Progress */}
        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <ArrowTrendingUpIcon className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-surface-900">Team Volume</h3>
          </div>
          <div className="text-center p-5 rounded-2xl bg-gradient-to-br from-primary-50/60 to-white/60 border-2 border-primary-200/50 mb-4">
            <p className="text-3xl font-mono font-bold text-surface-900">
              ${formatCompact(teamVolumeUsd, 2)}
            </p>
            <p className="text-sm text-surface-500 mt-1">Total Team Volume</p>
          </div>

          {currentRank < 10 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Next: {RANK_NAMES[currentRank + 1]}</span>
                <span className="font-mono font-semibold text-primary-600">
                  ${formatCompact(nextThreshold, 2)}
                </span>
              </div>
              <ProgressBar value={progressToNext} label={`${progressToNext.toFixed(2)}% achieved`} variant="cyan" size="lg" />
              <p className="text-xs text-surface-400 mt-1">
                {nextQualifyingVol >= nextThreshold
                  ? 'Target met!'
                  : `Need $${formatCompact(nextThreshold - nextQualifyingVol, 2)} more qualifying volume`}
              </p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="p-3 rounded-xl bg-gradient-to-r from-primary-100 to-primary-50 border border-primary-200/50 text-center">
              <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Direct Referrals</p>
              <p className="text-lg font-mono font-bold text-primary-700">{referralsList.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-r from-success-100 to-success-50 border border-success-200/50 text-center">
              <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Active Directs</p>
              <p className="text-lg font-mono font-bold text-success-700">{activeDirects}</p>
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
        </GlassCard>
      </div>

      {/* 50%-of-Rank-Target Rule */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <ScaleIcon className="w-5 h-5 text-secondary-600" />
          <h3 className="text-lg font-semibold text-surface-900">50% Per-Leg Cap Rule</h3>
        </div>
        <p className="text-xs text-surface-500 mb-4">
          For each rank target, a maximum of 50% of that specific rank&apos;s threshold can be credited from any single leg.
          Your own personal volume does not count toward rank qualification.
          Even if a single leg has massive volume, only 50% of the rank target will be credited from it.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100/60 border border-primary-200/50 text-center">
            <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Total Team Volume</p>
            <p className="text-lg font-mono font-bold text-primary-700">${formatCompact(teamVolumeUsd, 2)}</p>
          </div>
          <div className="p-3 rounded-xl bg-gradient-to-br from-warn-50 to-warn-100/60 border border-warn-200/50 text-center">
            <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Largest Leg</p>
            <p className="text-lg font-mono font-bold text-warn-700">${formatCompact(largestLegUsd, 2)}</p>
          </div>
          <div className="p-3 rounded-xl bg-gradient-to-br from-secondary-50 to-secondary-100/60 border border-secondary-200/50 text-center">
            <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Number of Legs</p>
            <p className="text-lg font-mono font-bold text-secondary-700">{legVolumeNumbers.length}</p>
          </div>
        </div>

        {/* Per-leg breakdown */}
        {legVolumeNumbers.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-surface-600 mb-1">Leg Volume Breakdown</p>
            {legVolumes.map((leg: any, i: number) => {
              const maxForNextRank = nextThreshold / 2;
              const credited = Math.min(leg.volumeUsd, maxForNextRank);
              const isCapped = leg.volumeUsd > maxForNextRank;
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-16 text-surface-500 flex-shrink-0">Leg {i + 1}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-surface-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isCapped ? 'bg-warn-400' : 'bg-success-400'}`}
                      style={{ width: `${teamVolumeUsd > 0 ? Math.min((leg.volumeUsd / teamVolumeUsd) * 100, 100) : 0}%` }}
                    />
                  </div>
                  <span className="font-mono text-surface-700 w-28 text-right">${formatCompact(leg.volumeUsd, 2)}</span>
                  {isCapped && (
                    <span className="text-warn-600 text-[10px] flex-shrink-0">(max ${formatCompact(credited, 2)})</span>
                  )}
                </div>
              );
            })}
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
                const qualifyingVol = getQualifyingVolume(threshold);
                const qualifyingPct = Math.min((qualifyingVol / threshold) * 100, 100);

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
                      ${formatCompact(threshold, 2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-accent-600">
                      ${RANK_SALARIES_USD[i].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3">
                      <div className="w-full max-w-[120px] mx-auto">
                        <ProgressBar
                          value={qualifyingPct}
                          variant={isAchieved ? 'green' : isNext ? 'cyan' : 'amber'}
                          size="sm"
                          showValue={false}
                        />
                        <p className="text-[10px] text-center text-surface-400 mt-0.5">
                          {qualifyingPct >= 100 ? '100%' : `${qualifyingPct.toFixed(2)}%`}
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

      {/* Salary History */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CurrencyDollarIcon className="w-5 h-5 text-accent-600" />
            <h3 className="text-lg font-semibold text-surface-900">Salary History</h3>
          </div>
          <span className="text-sm font-mono text-surface-400">
            {salaryHistory.length + harvestHistory.length} records
          </span>
        </div>

        {historyLoading ? (
          <div className="flex items-center gap-2 text-surface-400 text-sm py-8 justify-center">
            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            Loading history...
          </div>
        ) : (salaryHistory.length === 0 && harvestHistory.length === 0) ? (
          <div className="text-center py-8">
            <CurrencyDollarIcon className="w-12 h-12 text-surface-300 mx-auto mb-3" />
            <p className="text-surface-500 text-sm">No salary history yet. Achieve a rank to start earning!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-surface-500">Type</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-surface-500">Date</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-surface-500">Rank</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-surface-500">Amount</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-surface-500">Tx</th>
                </tr>
              </thead>
              <tbody>
                {/* Merge claim and harvest events, sorted by time desc */}
                {[
                  ...salaryHistory.map(e => ({ ...e, type: 'claim' as const })),
                  ...harvestHistory.map(e => ({ ...e, type: 'harvest' as const })),
                ].sort((a, b) => b.timestamp - a.timestamp).map((event, idx) => {
                  const date = new Date(event.timestamp * 1000);
                  const isClaim = event.type === 'claim';
                  return (
                    <tr key={`${event.type}-${idx}`} className="border-b border-surface-100">
                      <td className="py-2.5 px-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          isClaim
                            ? 'text-accent-600 bg-accent-50 border-accent-200'
                            : 'text-success-600 bg-success-50 border-success-200'
                        }`}>
                          {isClaim ? 'Salary Credited' : 'Harvested'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-xs text-surface-500">
                        {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-2">
                        {isClaim && (event as SalaryClaimEvent).rankLevel > 0
                          ? <Badge tier="purple" size="sm">{RANK_NAMES[(event as SalaryClaimEvent).rankLevel] || `Rank ${(event as SalaryClaimEvent).rankLevel}`}</Badge>
                          : <span className="text-xs text-surface-400">—</span>
                        }
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-semibold">
                        <span className={isClaim ? 'text-accent-600' : 'text-success-600'}>
                          ${isClaim
                            ? Number((event as SalaryClaimEvent).salaryFormatted).toFixed(2)
                            : Number((event as SalaryHarvestEvent).amountFormatted).toFixed(2)
                          }
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <a
                          href={`https://opbnbscan.com/tx/${event.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary-500 hover:text-primary-700 font-mono"
                        >
                          {event.txHash.slice(0, 6)}...{event.txHash.slice(-4)}
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
