'use client';

import { useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits } from 'viem';
import {
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowRightIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  TrophyIcon,
  CalendarDaysIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { CONTRACTS, AffiliateDistributorABI } from '@/lib/contracts';
import { useReferral } from '@/hooks/useReferral';
import { useKairoPrice } from '@/hooks/useKairoPrice';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/providers/ToastProvider';
import { formatAddress } from '@/lib/utils';

const MIN_HARVEST = 10;

const INCOME_TYPES = [
  { key: 'direct', label: 'Direct Dividends', pct: '5%', icon: CurrencyDollarIcon, incomeType: 0, color: 'text-neon-cyan' },
  { key: 'team', label: 'Team Dividends', pct: '', icon: UserGroupIcon, incomeType: 1, color: 'text-neon-purple' },
  { key: 'rank', label: 'Rank Salary', pct: '', icon: TrophyIcon, incomeType: 2, color: 'text-solar-amber' },
  { key: 'qWeekly', label: 'Qualifier Weekly', pct: '3%', icon: CalendarDaysIcon, incomeType: 3, color: 'text-matrix-green' },
  { key: 'qMonthly', label: 'Qualifier Monthly', pct: '2%', icon: ClockIcon, incomeType: 4, color: 'text-neon-coral' },
] as const;

export function AffiliateNetwork() {
  const { address } = useAccount();
  const { referralLink } = useReferral();
  const { price } = useKairoPrice();
  const { addToast } = useToast();
  const [copied, setCopied] = useState(false);

  // Contract reads
  const { data: allIncome, isLoading: incomeLoading } = useReadContract({
    address: CONTRACTS.AFFILIATE_DISTRIBUTOR,
    abi: AffiliateDistributorABI,
    functionName: 'getAllIncome',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!CONTRACTS.AFFILIATE_DISTRIBUTOR, refetchInterval: 30_000 },
  });

  const { data: directCountData } = useReadContract({
    address: CONTRACTS.AFFILIATE_DISTRIBUTOR,
    abi: AffiliateDistributorABI,
    functionName: 'directCount',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!CONTRACTS.AFFILIATE_DISTRIBUTOR, refetchInterval: 30_000 },
  });

  const { data: teamVolumeData } = useReadContract({
    address: CONTRACTS.AFFILIATE_DISTRIBUTOR,
    abi: AffiliateDistributorABI,
    functionName: 'getTeamVolume',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!CONTRACTS.AFFILIATE_DISTRIBUTOR, refetchInterval: 30_000 },
  });

  const { data: directReferralsData } = useReadContract({
    address: CONTRACTS.AFFILIATE_DISTRIBUTOR,
    abi: AffiliateDistributorABI,
    functionName: 'getDirectReferrals',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!CONTRACTS.AFFILIATE_DISTRIBUTOR, refetchInterval: 60_000 },
  });

  // Harvest write
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });
  const [harvestingType, setHarvestingType] = useState<number | null>(null);
  const isHarvesting = isPending || isConfirming;

  const income = useMemo(() => {
    if (!allIncome) return { direct: 0, team: 0, rank: 0, qWeekly: 0, qMonthly: 0 };
    const [d, t, r, w, m] = allIncome as unknown as bigint[];
    return {
      direct: Number(formatUnits(d, 18)),
      team: Number(formatUnits(t, 18)),
      rank: Number(formatUnits(r, 18)),
      qWeekly: Number(formatUnits(w, 18)),
      qMonthly: Number(formatUnits(m, 18)),
    };
  }, [allIncome]);

  const directCount = directCountData ? Number(directCountData as bigint) : 0;
  const teamVolume = teamVolumeData ? Number(formatUnits(teamVolumeData as bigint, 18)) : 0;
  const directReferrals = (directReferralsData as `0x${string}`[] | undefined) ?? [];

  const handleCopy = useCallback(() => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      addToast('success', 'Copied!', 'Referral link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  }, [referralLink, addToast]);

  const handleHarvest = (incomeType: number) => {
    setHarvestingType(incomeType);
    writeContract({
      address: CONTRACTS.AFFILIATE_DISTRIBUTOR,
      abi: AffiliateDistributorABI,
      functionName: 'harvest',
      args: [incomeType],
    });
  };

  const values: Record<string, number> = income;

  return (
    <GlassCard padding="lg" className="mb-6">
      <h2 className="text-lg md:text-xl font-orbitron font-bold text-white tracking-wide mb-6">
        Affiliate Network
      </h2>

      {/* Referral Link Pill */}
      <div className="glass-card rounded-full p-1.5 pl-4 flex items-center gap-2 mb-6">
        <span className="text-xs text-gray-500 shrink-0 hidden sm:inline">Your Link:</span>
        <span className="flex-1 text-xs font-mono text-gray-300 truncate">
          {referralLink || 'Connect wallet to generate'}
        </span>
        <button
          onClick={handleCopy}
          disabled={!referralLink}
          className="shrink-0 px-4 py-2 rounded-full bg-neon-cyan/10 hover:bg-neon-cyan/20 text-neon-cyan text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {copied ? (
            <><CheckIcon className="w-3.5 h-3.5" /> Copied!</>
          ) : (
            <><ClipboardDocumentIcon className="w-3.5 h-3.5" /> Copy</>
          )}
        </button>
      </div>

      {/* Income Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {incomeLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="card" height={100} />
          ))
        ) : (
          INCOME_TYPES.map((t) => {
            const val = values[t.key] ?? 0;
            const Icon = t.icon;
            const canHarvest = val >= MIN_HARVEST;
            const kairoEquiv = price > 0 ? val / price : 0;
            return (
              <div key={t.key} className="glass-card rounded-xl p-4 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${t.color}`} />
                  <span className="text-[10px] text-gray-500 uppercase tracking-wide">{t.label}</span>
                  {t.pct && (
                    <span className={`text-[9px] font-bold ${t.color} ml-auto`}>{t.pct}</span>
                  )}
                </div>
                <p className="text-lg font-mono font-bold text-white mb-0.5">
                  ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-gray-500 mb-3">
                  &asymp; {kairoEquiv.toLocaleString('en-US', { maximumFractionDigits: 2 })} KAIRO
                </p>
                <div className="mt-auto">
                  <Tooltip content={canHarvest ? 'Harvest this income type' : 'Minimum $10 required to harvest'}>
                    <span>
                      <Button
                        size="sm"
                        variant={canHarvest ? 'primary' : 'ghost'}
                        disabled={!canHarvest || isHarvesting}
                        loading={isHarvesting && harvestingType === t.incomeType}
                        onClick={() => handleHarvest(t.incomeType)}
                        className="w-full"
                      >
                        Harvest
                      </Button>
                    </span>
                  </Tooltip>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Referral Summary */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <UserGroupIcon className="w-5 h-5 text-neon-purple" />
            <span className="text-sm font-semibold text-white">Your Network</span>
          </div>
          <Link
            href="/dashboard/referrals"
            className="text-xs text-neon-cyan hover:text-neon-cyan/80 flex items-center gap-1 transition-colors"
          >
            View Full Network <ArrowRightIcon className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-[10px] text-gray-500 uppercase">Direct Referrals</p>
            <p className="text-xl font-mono font-bold text-white">{directCount}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase">Team Volume</p>
            <p className="text-xl font-mono font-bold text-white">
              ${teamVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
        {directReferrals.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-gray-500 uppercase mb-2">Recent Direct Referrals</p>
            {directReferrals.slice(0, 5).map((addr) => (
              <div key={addr} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.02]">
                <div className="w-5 h-5 rounded-full bg-neon-purple/10 flex items-center justify-center">
                  <UserGroupIcon className="w-3 h-3 text-neon-purple" />
                </div>
                <span className="text-xs font-mono text-gray-400">{formatAddress(addr)}</span>
              </div>
            ))}
            {directReferrals.length > 5 && (
              <p className="text-[10px] text-gray-500 text-center pt-1">
                +{directReferrals.length - 5} more
              </p>
            )}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
