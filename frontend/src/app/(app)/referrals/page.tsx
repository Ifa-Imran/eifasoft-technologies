'use client';

import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { GlassCard, Button, Badge, ProgressBar } from '@/components/ui';
import { useAffiliate } from '@/hooks/useAffiliate';
import { RANK_NAMES, USDT_DECIMALS } from '@/config/contracts';
import { formatUnits } from 'viem';
import { shortenAddress } from '@/lib/utils';
import {
  TrophyIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  StarIcon,
} from '@heroicons/react/24/outline';

export default function ReferralsPage() {
  const { isConnected, address } = useAccount();
  const { allIncome, rankInfo, directReferrals, freshBusiness, claimRankSalary, harvestIncome, isLoading, isPending } = useAffiliate();

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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-orbitron font-bold gradient-text">Referrals & Rank</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rank Card */}
        <GlassCard variant="gradient" className="text-center">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary-400/30">
            <TrophyIcon className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-sm text-surface-500 mb-2">Current Rank</h3>
          <div className="text-3xl font-orbitron font-bold gradient-text mb-2">{rankName}</div>
          <Badge tier="purple" size="md">Level {currentRank} / 10</Badge>

          <div className="mt-6">
            <ProgressBar
              value={currentRank}
              max={10}
              label="Rank Progress"
              variant="purple"
            />
          </div>

          <Button onClick={claimRankSalary} loading={isPending} className="w-full mt-4">
            Claim Rank Salary
          </Button>
        </GlassCard>

        {/* Team Stats */}
        <GlassCard>
          <div className="flex items-center gap-2 mb-5">
            <UserGroupIcon className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-surface-900">Team Stats</h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 rounded-xl bg-gradient-to-r from-primary-100 to-primary-50 border-2 border-primary-200/50">
              <span className="text-sm text-surface-600">Direct Referrals</span>
              <span className="font-mono font-bold text-primary-700 text-lg">{referralsList.length}</span>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-surface-500">Weekly Fresh Business</span>
                <span className="font-mono font-semibold text-primary-600">
                  ${weeklyBiz.toFixed(2)}
                </span>
              </div>
              <ProgressBar value={weeklyBiz} max={50000} variant="cyan" size="sm" showValue={false} />
              <p className="text-xs text-surface-400 mt-1">$50,000 threshold for weekly qualifier</p>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-surface-500">Monthly Fresh Business</span>
                <span className="font-mono font-semibold text-secondary-600">
                  ${monthlyBiz.toFixed(2)}
                </span>
              </div>
              <ProgressBar value={monthlyBiz} max={500000} variant="purple" size="sm" showValue={false} />
              <p className="text-xs text-surface-400 mt-1">$500,000 threshold for monthly qualifier</p>
            </div>
          </div>
        </GlassCard>

        {/* Income Harvest */}
        <GlassCard>
          <div className="flex items-center gap-2 mb-5">
            <CurrencyDollarIcon className="w-5 h-5 text-accent-600" />
            <h3 className="text-lg font-semibold text-surface-900">Claim Income</h3>
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
                    Claim
                  </Button>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>

      {/* Referral List */}
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
