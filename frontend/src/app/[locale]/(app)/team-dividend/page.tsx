'use client';

import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { GlassCard, Button, Badge, ProgressBar } from '@/components/ui';
import { useAffiliate } from '@/hooks/useAffiliate';
import { USDT_DECIMALS } from '@/config/contracts';
import { formatUnits } from 'viem';
import { shortenAddress, formatCompact } from '@/lib/utils';
import {
  UsersIcon,
  LockOpenIcon,
  LockClosedIcon,
  ArrowDownTrayIcon,
  ChartBarIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';

// Team dividend percentages from contract (basis points)
const TEAM_PERCENTAGES = [
  1000, 500, 500, 500, 500, 500, 500, 500, 500, 500,
  200, 200, 200, 200, 200,
];

// Map level to display percentage
function levelPercent(level: number): string {
  const bp = TEAM_PERCENTAGES[level] || 0;
  return `${(bp / 100).toFixed(2)}%`;
}

// Calculate how many directs needed for a given level (mirrors contract _getUnlockedLevels)
function directsNeededForLevel(level: number): number {
  if (level <= 5) return level;
  return 5 + Math.ceil((level - 5) / 2);
}

export default function TeamDividendPage() {
  const { isConnected } = useAccount();
  const t = useTranslations('teamDividend');
  const {
    allIncome,
    directReferrals,
    teamVolume,
    unlockedLevels,
    legVolumes,
    harvestIncome,
    teamLevelStats,
    teamLevelLoading,
    teamAnalytics,
    activeDirects,
    isLoading,
    isPending,
  } = useAffiliate();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-secondary-400 to-primary-400 flex items-center justify-center mb-2 shadow-xl shadow-secondary-300/30">
          <UsersIcon className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-orbitron font-bold text-surface-900">{t('connectWalletTitle')}</h2>
        <p className="text-surface-500 text-sm">{t('connectWalletDesc')}</p>
        <ConnectButton />
      </div>
    );
  }

  const referralsList = (directReferrals as any[]) || [];
  const teamVolumeUsd = teamVolume ? Number(formatUnits(teamVolume, USDT_DECIMALS)) : 0;
  const teamDividendBalance = allIncome ? Number(formatUnits(BigInt(allIncome[1] || 0), USDT_DECIMALS)) : 0;

  // Sort legs by volume descending
  const sortedLegs = [...legVolumes].sort((a, b) => (b.volumeUsd - a.volumeUsd));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-orbitron font-bold gradient-text">{t('title')}</h1>
        <p className="text-base text-surface-500 mt-1">
          {t('subtitle')}
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <GlassCard padding="p-4">
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">{t('unlockedLevels')}</p>
          <p className="text-xl sm:text-2xl font-mono font-bold text-primary-700">{unlockedLevels} <span className="text-sm text-surface-400">/ 15</span></p>
          <ProgressBar value={unlockedLevels} max={15} variant="cyan" size="sm" className="mt-2" />
        </GlassCard>
        <GlassCard padding="p-4">
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">{t('directReferrals')}</p>
          <p className="text-xl sm:text-2xl font-mono font-bold text-secondary-700">{referralsList.length}</p>
          <p className="text-xs text-surface-400 mt-1">
            {activeDirects} {t('activeLabel')} / {referralsList.length < 10 ? t('moreForNext', { count: directsNeededForLevel(unlockedLevels + 1) - referralsList.length }) : t('maxLevelsUnlocked')}
          </p>
        </GlassCard>
        <GlassCard padding="p-4">
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">{t('directBusiness')}</p>
          <p className="text-xl sm:text-2xl font-mono font-bold text-primary-700">
            {teamLevelLoading ? '...' : (teamAnalytics?.directBusinessFormatted || '$0')}
          </p>
          <p className="text-xs text-surface-400 mt-1">{t('referralStakes')}</p>
        </GlassCard>
        <GlassCard padding="p-4">
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">{t('teamVolume')}</p>
          <p className="text-xl sm:text-2xl font-mono font-bold text-surface-900">${formatCompact(teamVolumeUsd, 2)}</p>
          <p className="text-xs text-surface-400 mt-1">{t('totalDownlineVolume')}</p>
        </GlassCard>
        <GlassCard padding="p-4" className="col-span-2 sm:col-span-1">
          <div className="flex flex-col items-center text-center">
            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-surface-400 mb-1">{t('teamDividend')}</p>
            <p className="text-2xl sm:text-3xl font-mono font-bold text-accent-700">${teamDividendBalance.toFixed(2)}</p>
            <Button
              size="sm"
              onClick={() => harvestIncome(1)}
              disabled={teamDividendBalance <= 0 || isPending}
              className="w-full mt-3"
              icon={<ArrowDownTrayIcon className="w-3.5 h-3.5" />}
            >
              {t('harvest')}
            </Button>
          </div>
        </GlassCard>
      </div>

      {/* Detailed Level Breakdown Table */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <ChartBarIcon className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-surface-900">{t('levelBreakdownTitle')}</h3>
        </div>
        <p className="text-xs text-surface-500 mb-4">
          {t('levelBreakdownDesc')}
        </p>

        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-xs sm:text-sm min-w-[540px]">
            <thead>
              <tr className="border-b border-surface-200">
                <th className="text-left py-2 sm:py-3 px-2 text-surface-500 font-medium">{t('levelCol')}</th>
                <th className="text-center py-2 sm:py-3 px-2 text-surface-500 font-medium">{t('rateCol')}</th>
                <th className="text-center py-2 sm:py-3 px-2 text-surface-500 font-medium">{t('membersCol')}</th>
                <th className="text-right py-2 sm:py-3 px-2 text-surface-500 font-medium">{t('businessCol')}</th>
                <th className="text-right py-2 sm:py-3 px-2 text-surface-500 font-medium">{t('earnedCol')}</th>
                <th className="text-center py-2 sm:py-3 px-2 text-surface-500 font-medium">{t('statusCol')}</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 15 }, (_, i) => {
                const level = i + 1;
                const isActive = level <= unlockedLevels;
                const directsNeeded = directsNeededForLevel(level);
                const isNextUnlock = !isActive && level === unlockedLevels + 1;
                const stats = teamLevelStats.find(s => s.level === level);

                return (
                  <tr
                    key={i}
                    className={`border-b border-surface-100 transition-colors ${
                      isActive
                        ? 'bg-success-50/40'
                        : isNextUnlock
                          ? 'bg-primary-50/40'
                          : ''
                    }`}
                  >
                    <td className="py-2 sm:py-3 px-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          isActive
                            ? 'bg-success-500 text-white'
                            : isNextUnlock
                              ? 'bg-primary-500 text-white'
                              : 'bg-surface-200 text-surface-500'
                        }`}>
                          {level}
                        </span>
                        <div>
                          <span className={`font-medium text-xs ${isActive ? 'text-success-700' : isNextUnlock ? 'text-primary-700' : 'text-surface-500'}`}>
                            {t('levelLabel', { level })}
                          </span>
                          <p className="text-[10px] text-surface-400">{t('directsNeeded', { count: directsNeeded })}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 sm:py-3 px-2 text-center">
                      <span className="font-mono font-bold text-accent-600">{levelPercent(i)}</span>
                    </td>
                    <td className="py-2 sm:py-3 px-2 text-center">
                      {teamLevelLoading ? (
                        <span className="text-surface-300 animate-pulse">...</span>
                      ) : (
                        <span className="font-mono font-semibold text-surface-700">{stats?.members || 0}</span>
                      )}
                    </td>
                    <td className="py-2 sm:py-3 px-2 text-right">
                      {teamLevelLoading ? (
                        <span className="text-surface-300 animate-pulse">...</span>
                      ) : (
                        <span className="font-mono text-surface-700">{stats?.totalBusinessFormatted || '$0'}</span>
                      )}
                    </td>
                    <td className="py-2 sm:py-3 px-2 text-right">
                      {teamLevelLoading ? (
                        <span className="text-surface-300 animate-pulse">...</span>
                      ) : (
                        <span className={`font-mono font-semibold ${
                          (stats?.totalEarned || 0n) > 0n ? 'text-accent-600' : 'text-surface-400'
                        }`}>
                          {stats?.totalEarnedFormatted || '$0.00'}
                        </span>
                      )}
                    </td>
                    <td className="py-2 sm:py-3 px-2 text-center">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 text-success-600 text-xs font-semibold">
                          <LockOpenIcon className="w-3.5 h-3.5" /> {t('statusActive')}
                        </span>
                      ) : isNextUnlock ? (
                        <span className="inline-flex items-center gap-1 text-primary-600 text-xs font-semibold animate-pulse-soft">
                          <BoltIcon className="w-3.5 h-3.5" /> {t('statusNext')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-surface-400 text-xs">
                          <LockClosedIcon className="w-3.5 h-3.5" /> {t('statusLocked')}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Totals row */}
            <tfoot>
              <tr className="border-t-2 border-surface-300 bg-surface-50">
                <td className="py-2 sm:py-3 px-2 font-semibold text-surface-700" colSpan={2}>{t('total')}</td>
                <td className="py-2 sm:py-3 px-2 text-center font-mono font-bold text-surface-800">
                  {teamLevelLoading ? '...' : teamLevelStats.reduce((sum, s) => sum + s.members, 0)}
                </td>
                <td className="py-2 sm:py-3 px-2 text-right font-mono font-bold text-surface-800">
                  {teamLevelLoading ? '...' : `$${teamLevelStats.reduce((sum, s) => sum + Number(formatUnits(s.totalBusiness, USDT_DECIMALS)), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                </td>
                <td className="py-2 sm:py-3 px-2 text-right font-mono font-bold text-accent-700">
                  {teamLevelLoading ? '...' : `$${teamLevelStats.reduce((sum, s) => sum + Number(formatUnits(s.totalEarned, USDT_DECIMALS)), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </GlassCard>

      {/* Level Activation Tracker with member counts */}
      <GlassCard>
        <h3 className="text-lg font-semibold text-surface-900 mb-3">{t('levelActivationTracker')}</h3>
        <p className="text-xs text-surface-500 mb-4">
          {t('levelActivationDesc', { directs: referralsList.length, unlocked: unlockedLevels })}
        </p>
        <div className="grid grid-cols-5 sm:grid-cols-5 lg:grid-cols-15 gap-1.5 sm:gap-2">
          {Array.from({ length: 15 }, (_, i) => {
            const level = i + 1;
            const isActive = level <= unlockedLevels;
            const isNextUnlock = !isActive && level === unlockedLevels + 1;
            const stats = teamLevelStats.find(s => s.level === level);
            return (
              <div
                key={i}
                className={`p-2 rounded-xl text-center border-2 transition-all ${
                  isActive
                    ? 'bg-gradient-to-br from-success-50 to-success-100/60 border-success-300/60'
                    : isNextUnlock
                      ? 'bg-gradient-to-br from-primary-50 to-primary-100/60 border-primary-300/60 animate-pulse-soft'
                      : 'bg-surface-50 border-surface-200 opacity-50'
                }`}
              >
                <div className="flex justify-center mb-1">
                  {isActive ? (
                    <LockOpenIcon className="w-4 h-4 text-success-600" />
                  ) : isNextUnlock ? (
                    <BoltIcon className="w-4 h-4 text-primary-600" />
                  ) : (
                    <LockClosedIcon className="w-4 h-4 text-surface-400" />
                  )}
                </div>
                <p className={`text-sm font-bold ${isActive ? 'text-success-700' : isNextUnlock ? 'text-primary-700' : 'text-surface-400'}`}>
                  L{level}
                </p>
                <p className="text-[10px] text-surface-400">{levelPercent(i)}</p>
                <p className={`text-[10px] font-semibold mt-0.5 ${stats && stats.members > 0 ? 'text-primary-600' : 'text-surface-300'}`}>
                  {stats?.members || 0} <span className="text-surface-400">{t('ppl')}</span>
                </p>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Leg Volume Breakdown */}
      {sortedLegs.length > 0 && (
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-surface-900">{t('legVolumeBreakdown')}</h3>
            <Badge tier="cyan">{t('legs', { count: sortedLegs.length })}</Badge>
          </div>
          <p className="text-xs text-surface-500 mb-4">
            {t('legVolumeDesc')}
          </p>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-xs sm:text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-surface-200">
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-3 text-surface-500 font-medium">#</th>
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-3 text-surface-500 font-medium">{t('refCol')}</th>
                  <th className="text-right py-2 sm:py-3 px-2 sm:px-3 text-surface-500 font-medium">{t('selfStakeCol')}</th>
                  <th className="text-right py-2 sm:py-3 px-2 sm:px-3 text-surface-500 font-medium">{t('legVolumeCol')}</th>
                  <th className="py-2 sm:py-3 px-2 sm:px-3 text-surface-500 font-medium">{t('shareCol')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedLegs.map((leg, i) => {
                  const share = teamVolumeUsd > 0 ? (leg.volumeUsd / teamVolumeUsd) * 100 : 0;
                  return (
                    <tr key={i} className="border-b border-surface-100 hover:bg-primary-50/30 transition-colors">
                      <td className="py-2 sm:py-3 px-2 sm:px-3">
                        <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center text-[10px] sm:text-xs font-bold text-white">
                          {i + 1}
                        </span>
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-3 font-mono text-surface-600 text-[10px] sm:text-xs">
                        {shortenAddress(leg.address)}
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-3 text-right font-mono font-semibold text-primary-600">
                        ${formatCompact(leg.ownStakeUsd, 2)}
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-3 text-right font-mono font-semibold text-surface-700">
                        ${formatCompact(leg.volumeUsd, 2)}
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-full max-w-[80px] h-2 rounded-full bg-surface-100 overflow-hidden">
                            <div
                              className="h-full bg-primary-400 rounded-full transition-all"
                              style={{ width: `${Math.min(share, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-surface-500 w-12 text-right">{share.toFixed(2)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* How Team Dividends Work */}
      <GlassCard variant="gradient">
        <h3 className="text-sm font-semibold text-surface-900 mb-3">{t('howItWorks')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-surface-600">
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">1</span>
            <span>{t('how1')}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-secondary-100 text-secondary-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">2</span>
            <span>{t('how2')}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-accent-100 text-accent-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">3</span>
            <span>{t('how3')}</span>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
