'use client';

import { useMemo } from 'react';
import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { CONTRACTS, AffiliateDistributorABI } from '@/lib/contracts';

// ── Rank definitions (from AffiliateDistributor.sol) ──
export interface RankInfo {
  level: number;
  name: string;
  threshold: bigint;     // team volume in USD 18-dec
  salary: bigint;        // weekly salary in USD 18-dec
  thresholdUSD: number;
  salaryUSD: number;
}

export const RANK_NAMES = [
  'Starlight', 'Spark', 'Blaze', 'Flare', 'Radiant',
  'Luminary', 'Nova', 'Supernova', 'Galaxy', 'Universe',
] as const;

// Helper to create 18-decimal bigint from a USD integer
const e18 = (usd: number): bigint => BigInt(usd) * BigInt('1000000000000000000');

// Exact values from contract RANK_THRESHOLDS
const RANK_THRESHOLDS: bigint[] = [
  e18(10_000),
  e18(30_000),
  e18(100_000),
  e18(300_000),
  e18(1_000_000),
  e18(3_000_000),
  e18(10_000_000),
  e18(30_000_000),
  e18(100_000_000),
  e18(250_000_000),
];

// Exact values from contract RANK_SALARIES
const RANK_SALARIES: bigint[] = [
  e18(10),
  e18(30),
  e18(70),
  e18(200),
  e18(600),
  e18(1_200),
  e18(4_000),
  e18(12_000),
  e18(40_000),
  e18(100_000),
];

export const RANKS: RankInfo[] = RANK_NAMES.map((name, i) => ({
  level: i,
  name,
  threshold: RANK_THRESHOLDS[i],
  salary: RANK_SALARIES[i],
  thresholdUSD: Number(formatUnits(RANK_THRESHOLDS[i], 18)),
  salaryUSD: Number(formatUnits(RANK_SALARIES[i], 18)),
}));

export interface LegVolume {
  address: string;
  volume: bigint;
  volumeUSD: number;
}

// ── Hook ──
export function useRankData() {
  const { address } = useAccount();
  const enabled = !!address && !!CONTRACTS.AFFILIATE_DISTRIBUTOR;

  // Batch core reads
  const { data: coreData, isLoading: isLoadingCore } = useReadContracts({
    contracts: [
      {
        address: CONTRACTS.AFFILIATE_DISTRIBUTOR,
        abi: AffiliateDistributorABI,
        functionName: 'getTeamVolume',
        args: address ? [address] : undefined,
      },
      {
        address: CONTRACTS.AFFILIATE_DISTRIBUTOR,
        abi: AffiliateDistributorABI,
        functionName: 'directCount',
        args: address ? [address] : undefined,
      },
      {
        address: CONTRACTS.AFFILIATE_DISTRIBUTOR,
        abi: AffiliateDistributorABI,
        functionName: 'getAllIncome',
        args: address ? [address] : undefined,
      },
      {
        address: CONTRACTS.AFFILIATE_DISTRIBUTOR,
        abi: AffiliateDistributorABI,
        functionName: 'calculateRankSalary',
        args: address ? [address] : undefined,
      },
    ],
    query: { enabled, refetchInterval: 30_000 },
  });

  // Direct referral list (for leg volumes)
  const { data: directReferrals, isLoading: isLoadingReferrals } = useReadContract({
    address: CONTRACTS.AFFILIATE_DISTRIBUTOR,
    abi: AffiliateDistributorABI,
    functionName: 'getDirectReferrals',
    args: address ? [address] : undefined,
    query: { enabled, refetchInterval: 30_000 },
  });

  const referralAddresses = (directReferrals as `0x${string}`[] | undefined) ?? [];

  // Batch leg volume reads (top 20 max for gas)
  const legContracts = useMemo(
    () =>
      referralAddresses.slice(0, 20).map((addr) => ({
        address: CONTRACTS.AFFILIATE_DISTRIBUTOR as `0x${string}`,
        abi: AffiliateDistributorABI,
        functionName: 'getTeamVolume' as const,
        args: [addr] as const,
      })),
    [referralAddresses],
  );

  const { data: legVolumeData, isLoading: isLoadingLegs } = useReadContracts({
    contracts: legContracts,
    query: { enabled: enabled && referralAddresses.length > 0, refetchInterval: 30_000 },
  });

  // ── Derived values ──
  const teamVolume = coreData?.[0]?.result as bigint | undefined;
  const directCount = coreData?.[1]?.result as bigint | undefined;
  const allIncome = coreData?.[2]?.result as [bigint, bigint, bigint, bigint, bigint] | undefined;
  const calculatedSalary = coreData?.[3]?.result as bigint | undefined;

  const teamVolumeUSD = teamVolume ? Number(formatUnits(teamVolume, 18)) : 0;
  const directCountNum = directCount ? Number(directCount) : 0;

  // Calculate current rank from adjusted volume (replicating 50% leg rule)
  const legs: LegVolume[] = useMemo(() => {
    if (!legVolumeData || referralAddresses.length === 0) return [];
    return referralAddresses.slice(0, 20).map((addr, i) => {
      const vol = legVolumeData[i]?.result as bigint | undefined;
      return {
        address: addr,
        volume: vol ?? BigInt(0),
        volumeUSD: vol ? Number(formatUnits(vol, 18)) : 0,
      };
    }).sort((a, b) => (b.volumeUSD - a.volumeUSD));
  }, [legVolumeData, referralAddresses]);

  const largestLeg = legs.length > 0 ? legs[0].volume : BigInt(0);
  const totalVolumeBigint = teamVolume ?? BigInt(0);

  const adjustedVolume = useMemo(() => {
    if (totalVolumeBigint === BigInt(0)) return BigInt(0);
    const maxLeg = totalVolumeBigint / BigInt(2);
    if (largestLeg > maxLeg) {
      return totalVolumeBigint - largestLeg + maxLeg;
    }
    return totalVolumeBigint;
  }, [totalVolumeBigint, largestLeg]);

  const adjustedVolumeUSD = Number(formatUnits(adjustedVolume, 18));

  // Current rank level (from adjusted volume)
  const currentRankLevel = useMemo(() => {
    for (let i = RANK_THRESHOLDS.length - 1; i >= 0; i--) {
      if (adjustedVolume >= RANK_THRESHOLDS[i]) return i;
    }
    return -1; // Below first rank
  }, [adjustedVolume]);

  const currentRank = currentRankLevel >= 0 ? RANKS[currentRankLevel] : null;
  const nextRank = currentRankLevel < 9 ? RANKS[currentRankLevel + 1] : null;

  // Progress to next rank
  const volumeProgress = nextRank
    ? Math.min(100, (adjustedVolumeUSD / nextRank.thresholdUSD) * 100)
    : 100;
  const volumeNeeded = nextRank
    ? Math.max(0, nextRank.thresholdUSD - adjustedVolumeUSD)
    : 0;

  // qualifier income
  const qualifierWeekly = allIncome ? Number(formatUnits(allIncome[3], 18)) : 0;
  const qualifierMonthly = allIncome ? Number(formatUnits(allIncome[4], 18)) : 0;
  const rankDividends = allIncome ? Number(formatUnits(allIncome[2], 18)) : 0;

  // 50% leg status
  const legOverLimit = totalVolumeBigint > BigInt(0) && largestLeg > totalVolumeBigint / BigInt(2);
  const qualifyingVolumeUSD = adjustedVolumeUSD;

  return {
    // Loading
    isLoading: isLoadingCore || isLoadingReferrals || isLoadingLegs,
    // Rank data
    currentRankLevel,
    currentRank,
    nextRank,
    teamVolumeUSD,
    adjustedVolumeUSD,
    directCountNum,
    weeklySalaryUSD: calculatedSalary ? Number(formatUnits(calculatedSalary, 18)) : (currentRank?.salaryUSD ?? 0),
    // Progress
    volumeProgress,
    volumeNeeded,
    // Legs
    legs,
    legOverLimit,
    qualifyingVolumeUSD,
    largestLegUSD: legs.length > 0 ? legs[0].volumeUSD : 0,
    // Qualifiers
    qualifierWeekly,
    qualifierMonthly,
    rankDividends,
    // Raw
    allIncome,
  };
}
