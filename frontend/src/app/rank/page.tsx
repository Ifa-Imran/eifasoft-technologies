'use client';

import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import {
  TrophyIcon,
  ArrowTrendingUpIcon,
  CalendarDaysIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ChartPieIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { GlassCard } from '@/components/ui/GlassCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { Skeleton } from '@/components/ui/Skeleton';
import { RankPyramid } from '@/components/rank/RankPyramid';
import { LegDistributionChart } from '@/components/rank/LegDistributionChart';
import { useRankData, RANKS } from '@/hooks/useRankData';

// ── Helpers ──
function formatCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function daysUntilNextWeekday(target: number): number {
  // target: 0=Sun, 1=Mon, ...
  const now = new Date();
  const day = now.getUTCDay();
  const diff = (target - day + 7) % 7;
  return diff === 0 ? 7 : diff;
}

function daysUntilEndOfMonth(): number {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return end.getUTCDate() - now.getUTCDate();
}

// ── Section Fade Wrapper ──
function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Main Page ──
export default function RankPage() {
  const { address, isConnected } = useAccount();
  const {
    isLoading,
    currentRankLevel,
    currentRank,
    nextRank,
    teamVolumeUSD,
    adjustedVolumeUSD,
    directCountNum,
    weeklySalaryUSD,
    volumeProgress,
    volumeNeeded,
    legs,
    legOverLimit,
    qualifyingVolumeUSD,
    qualifierWeekly,
    qualifierMonthly,
    rankDividends,
  } = useRankData();

  const daysToWeekly = daysUntilNextWeekday(1); // Monday
  const daysToMonthly = daysUntilEndOfMonth();

  const directProgress = useMemo(() => {
    if (!nextRank) return 100;
    // Direct count thresholds aren't in contract — use volume only
    return Math.min(100, volumeProgress);
  }, [nextRank, volumeProgress]);

  // ── Not Connected ──
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <TrophyIcon className="w-16 h-16 text-gray-700 mb-4" />
        <h2 className="text-xl font-semibold text-gray-300 mb-2">Connect Your Wallet</h2>
        <p className="text-gray-500 text-sm">Connect your wallet to view your rank and qualifiers</p>
      </div>
    );
  }

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton variant="rect" height={120} />
        <Skeleton variant="rect" height={400} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton variant="rect" height={200} />
          <Skeleton variant="rect" height={200} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ═══════════ SECTION 1: Current Rank Display ═══════════ */}
      <FadeIn>
        <GlassCard className="text-center relative overflow-hidden">
          {/* Background glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-neon-cyan/[0.03] via-transparent to-transparent pointer-events-none" />

          <div className="relative z-10">
            {/* Rank badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-cyan/10 border border-neon-cyan/20 mb-4">
              <TrophyIcon className="w-4 h-4 text-neon-cyan" />
              <span className="text-xs font-semibold text-neon-cyan uppercase tracking-wider">
                Level {currentRankLevel >= 0 ? currentRankLevel : '—'}
              </span>
            </div>

            {/* Rank name */}
            <h1
              className="text-3xl md:text-5xl font-orbitron font-bold text-white mb-2"
              style={{
                textShadow: currentRank
                  ? '0 0 30px rgba(0,240,255,0.3), 0 0 60px rgba(0,240,255,0.1)'
                  : 'none',
              }}
            >
              {currentRank?.name ?? 'Unranked'}
            </h1>

            {/* Salary */}
            <div className="flex items-center justify-center gap-2 mt-3">
              <CurrencyDollarIcon className="w-5 h-5 text-solar-amber" />
              <AnimatedCounter
                value={weeklySalaryUSD}
                prefix="$"
                suffix=" / week"
                decimals={0}
                className="text-lg md:text-xl text-solar-amber font-semibold"
              />
            </div>

            {/* Quick stats row */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-4 pt-4 border-t border-white/5">
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-gray-500">Team Volume</p>
                <p className="text-sm font-mono text-gray-200">{formatCompact(teamVolumeUSD)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-gray-500">Qualifying Vol.</p>
                <p className="text-sm font-mono text-gray-200">{formatCompact(adjustedVolumeUSD)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-gray-500">Direct Referrals</p>
                <p className="text-sm font-mono text-gray-200">{directCountNum}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-gray-500">Rank Earnings</p>
                <p className="text-sm font-mono text-matrix-green">
                  ${rankDividends.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        </GlassCard>
      </FadeIn>

      {/* ═══════════ SECTION 2: Rank Pyramid ═══════════ */}
      <FadeIn delay={0.1}>
        <GlassCard>
          <div className="flex items-center gap-2 mb-5">
            <ArrowTrendingUpIcon className="w-5 h-5 text-neon-purple" />
            <h2 className="text-lg font-semibold text-white">Rank Pyramid</h2>
          </div>
          <RankPyramid currentRankLevel={currentRankLevel} />
        </GlassCard>
      </FadeIn>

      {/* ═══════════ SECTION 3: Progress to Next Rank ═══════════ */}
      {nextRank && (
        <FadeIn delay={0.15}>
          <GlassCard>
            <div className="flex items-center gap-2 mb-5">
              <ArrowTrendingUpIcon className="w-5 h-5 text-neon-cyan" />
              <h2 className="text-lg font-semibold text-white">
                Next Rank: <span className="text-neon-purple font-orbitron">{nextRank.name}</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Team Volume Progress */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Team Volume (adjusted)</span>
                  <AnimatedCounter
                    value={adjustedVolumeUSD}
                    prefix="$"
                    decimals={0}
                    className="text-sm text-white font-semibold"
                  />
                </div>
                <ProgressBar value={volumeProgress} variant="cyan" size="md" glow showLabel />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">
                    Required: {formatCompact(nextRank.thresholdUSD)}
                  </span>
                  <span className="text-neon-coral font-mono">
                    Need {formatCompact(volumeNeeded)} more
                  </span>
                </div>
              </div>

              {/* Direct Referrals Progress */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Direct Referrals</span>
                  <span className="text-sm text-white font-semibold font-mono">{directCountNum}</span>
                </div>
                <ProgressBar value={directProgress} variant="cyan" size="md" glow showLabel />
                <p className="text-xs text-gray-500">
                  Volume is the primary rank qualifier. Build a balanced team for optimal rank progression.
                </p>
              </div>
            </div>
          </GlassCard>
        </FadeIn>
      )}

      {/* ═══════════ SECTION 4: 50% Leg Rule Visualization ═══════════ */}
      <FadeIn delay={0.2}>
        <GlassCard>
          <div className="flex items-center gap-2 mb-1">
            <ChartPieIcon className="w-5 h-5 text-solar-amber" />
            <h2 className="text-lg font-semibold text-white">Team Volume Distribution</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            No single leg may exceed 50% of qualifying volume
          </p>
          <LegDistributionChart
            legs={legs}
            qualifyingVolumeUSD={qualifyingVolumeUSD}
            legOverLimit={legOverLimit}
          />
        </GlassCard>
      </FadeIn>

      {/* ═══════════ SECTION 5: Qualifier Status ═══════════ */}
      <FadeIn delay={0.25}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Weekly Qualifier */}
          <GlassCard>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-neon-purple/10">
                <CalendarDaysIcon className="w-5 h-5 text-neon-purple" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Weekly Qualifier</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">3% Global Profits Pool</p>
              </div>
            </div>

            {/* Qualified badge */}
            <div className="mb-4">
              {currentRankLevel >= 0 ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-matrix-green/10 border border-matrix-green/30 text-xs font-semibold text-matrix-green">
                  <span className="w-1.5 h-1.5 rounded-full bg-matrix-green animate-glow-pulse" aria-hidden="true" />
                  Qualified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-600" aria-hidden="true" />
                  Not Qualified
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Your Earnings</span>
                <span className="text-white font-mono font-semibold">
                  ${qualifierWeekly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Next Distribution</span>
                <span className="text-neon-purple font-mono">
                  {daysToWeekly} day{daysToWeekly !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="pt-2 border-t border-white/5">
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  Maintain your rank and stay active to qualify for the weekly 3% global profit distribution.
                </p>
              </div>
            </div>
          </GlassCard>

          {/* Monthly Qualifier */}
          <GlassCard>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-neon-coral/10">
                <ClockIcon className="w-5 h-5 text-neon-coral" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Monthly Qualifier</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">2% Global Profits Pool</p>
              </div>
            </div>

            {/* Qualified badge */}
            <div className="mb-4">
              {currentRankLevel >= 0 ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-matrix-green/10 border border-matrix-green/30 text-xs font-semibold text-matrix-green">
                  <span className="w-1.5 h-1.5 rounded-full bg-matrix-green animate-glow-pulse" aria-hidden="true" />
                  Qualified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-600" aria-hidden="true" />
                  Not Qualified
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Your Earnings</span>
                <span className="text-white font-mono font-semibold">
                  ${qualifierMonthly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Next Distribution</span>
                <span className="text-neon-coral font-mono">
                  {daysToMonthly} day{daysToMonthly !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="pt-2 border-t border-white/5">
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  Maintain your rank and stay active to qualify for the monthly 2% global profit distribution.
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </FadeIn>

      {/* ═══════════ SECTION 6: Rank Salary History ═══════════ */}
      <FadeIn delay={0.3}>
        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <CurrencyDollarIcon className="w-5 h-5 text-matrix-green" />
            <h2 className="text-lg font-semibold text-white">Rank Salary History</h2>
          </div>

          {rankDividends > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="pb-2 text-xs text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="pb-2 text-xs text-gray-500 uppercase tracking-wider text-right">Amount</th>
                    <th className="pb-2 text-xs text-gray-500 uppercase tracking-wider text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-white/[0.03]">
                    <td className="py-3 text-sm text-gray-300">Accumulated Rank Dividends</td>
                    <td className="py-3 text-sm text-matrix-green font-mono text-right">
                      ${rankDividends.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 text-right">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-solar-amber/10 text-solar-amber border border-solar-amber/20">
                        Harvestable
                      </span>
                    </td>
                  </tr>
                  {qualifierWeekly > 0 && (
                    <tr className="border-b border-white/[0.03]">
                      <td className="py-3 text-sm text-gray-300">Weekly Qualifier Earnings</td>
                      <td className="py-3 text-sm text-neon-purple font-mono text-right">
                        ${qualifierWeekly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 text-right">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-solar-amber/10 text-solar-amber border border-solar-amber/20">
                          Harvestable
                        </span>
                      </td>
                    </tr>
                  )}
                  {qualifierMonthly > 0 && (
                    <tr className="border-b border-white/[0.03]">
                      <td className="py-3 text-sm text-gray-300">Monthly Qualifier Earnings</td>
                      <td className="py-3 text-sm text-neon-coral font-mono text-right">
                        ${qualifierMonthly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 text-right">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-solar-amber/10 text-solar-amber border border-solar-amber/20">
                          Harvestable
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-10">
              <CurrencyDollarIcon className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No rank salary history yet</p>
              <p className="text-xs text-gray-500 mt-1">
                Reach <span className="text-neon-cyan">Starlight</span> rank to start earning weekly salary
              </p>
            </div>
          )}
        </GlassCard>
      </FadeIn>
    </div>
  );
}
