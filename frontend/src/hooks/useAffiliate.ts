'use client';

import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { contracts, USDT_DECIMALS } from '@/config/contracts';
import { AffiliateDistributorABI } from '@/config/abis/AffiliateDistributor';
import { useToast } from '@/components/ui/Toast';
import { useEffect, useMemo } from 'react';
import { formatUnits } from 'viem';

export function useAffiliate() {
  const { address } = useAccount();
  const { toast } = useToast();

  const { data: allIncome, isLoading: incomeLoading } = useReadContract({
    address: contracts.affiliateDistributor,
    abi: AffiliateDistributorABI,
    functionName: 'getAllIncome',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contracts.affiliateDistributor !== '0x',
      refetchInterval: 15000,
    },
  });

  const { data: rankInfo, isLoading: rankLoading } = useReadContract({
    address: contracts.affiliateDistributor,
    abi: AffiliateDistributorABI,
    functionName: 'getUserRankInfo',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contracts.affiliateDistributor !== '0x',
      refetchInterval: 30000,
    },
  });

  const { data: directReferrals } = useReadContract({
    address: contracts.affiliateDistributor,
    abi: AffiliateDistributorABI,
    functionName: 'getDirectReferrals',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contracts.affiliateDistributor !== '0x',
    },
  });

  const { data: freshBusiness } = useReadContract({
    address: contracts.affiliateDistributor,
    abi: AffiliateDistributorABI,
    functionName: 'getUserFreshBusiness',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contracts.affiliateDistributor !== '0x',
      refetchInterval: 30000,
    },
  });

  const { data: upline } = useReadContract({
    address: contracts.affiliateDistributor,
    abi: AffiliateDistributorABI,
    functionName: 'getUpline',
    args: address ? [address, BigInt(5)] : undefined,
    query: {
      enabled: !!address && contracts.affiliateDistributor !== '0x',
    },
  });

  const { data: teamVolume } = useReadContract({
    address: contracts.affiliateDistributor,
    abi: AffiliateDistributorABI,
    functionName: 'getTeamVolume',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contracts.affiliateDistributor !== '0x',
      refetchInterval: 30000,
    },
  });

  const { data: unlockedLevels } = useReadContract({
    address: contracts.affiliateDistributor,
    abi: AffiliateDistributorABI,
    functionName: 'getUnlockedLevels',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contracts.affiliateDistributor !== '0x',
      refetchInterval: 30000,
    },
  });

  // Write operations
  const { writeContract: writeClaimRank, isPending: claimRankPending, data: claimRankHash } = useWriteContract();
  const { writeContract: writeClaimWeekly, isPending: claimWeeklyPending, data: claimWeeklyHash } = useWriteContract();
  const { writeContract: writeClaimMonthly, isPending: claimMonthlyPending, data: claimMonthlyHash } = useWriteContract();
  const { writeContract: writeHarvest, isPending: harvestPending, data: harvestHash } = useWriteContract();
  const { writeContract: writeCheckRank, isPending: checkRankPending, data: checkRankHash } = useWriteContract();

  const { isSuccess: rankSuccess, isError: rankError } = useWaitForTransactionReceipt({ hash: claimRankHash });
  const { isSuccess: weeklySuccess, isError: weeklyError } = useWaitForTransactionReceipt({ hash: claimWeeklyHash });
  const { isSuccess: monthlySuccess, isError: monthlyError } = useWaitForTransactionReceipt({ hash: claimMonthlyHash });
  const { isSuccess: harvestSuccess, isError: harvestError } = useWaitForTransactionReceipt({ hash: harvestHash });
  const { isSuccess: checkRankSuccess, isError: checkRankError } = useWaitForTransactionReceipt({ hash: checkRankHash });

  useEffect(() => { if (rankSuccess) toast({ type: 'success', title: 'Rank salary harvested!' }); }, [rankSuccess]);
  useEffect(() => { if (rankError) toast({ type: 'error', title: 'Rank salary harvest failed' }); }, [rankError]);
  useEffect(() => { if (weeklySuccess) toast({ type: 'success', title: 'Weekly qualifier harvested!' }); }, [weeklySuccess]);
  useEffect(() => { if (weeklyError) toast({ type: 'error', title: 'Weekly qualifier harvest failed' }); }, [weeklyError]);
  useEffect(() => { if (monthlySuccess) toast({ type: 'success', title: 'Monthly qualifier harvested!' }); }, [monthlySuccess]);
  useEffect(() => { if (monthlyError) toast({ type: 'error', title: 'Monthly qualifier harvest failed' }); }, [monthlyError]);
  useEffect(() => { if (harvestSuccess) toast({ type: 'success', title: 'Income harvested!' }); }, [harvestSuccess]);
  useEffect(() => { if (harvestError) toast({ type: 'error', title: 'Harvest failed' }); }, [harvestError]);
  useEffect(() => { if (checkRankSuccess) toast({ type: 'success', title: 'Rank updated!' }); }, [checkRankSuccess]);
  useEffect(() => { if (checkRankError) toast({ type: 'error', title: 'Rank check failed' }); }, [checkRankError]);

  const claimRankSalary = () => {
    writeClaimRank({
      address: contracts.affiliateDistributor,
      abi: AffiliateDistributorABI,
      functionName: 'claimRankSalary',
    });
    toast({ type: 'pending', title: 'Harvesting rank salary...' });
  };

  const claimWeeklyQualifier = () => {
    writeClaimWeekly({
      address: contracts.affiliateDistributor,
      abi: AffiliateDistributorABI,
      functionName: 'claimWeeklyQualifier',
    });
    toast({ type: 'pending', title: 'Harvesting weekly qualifier...' });
  };

  const claimMonthlyQualifier = () => {
    writeClaimMonthly({
      address: contracts.affiliateDistributor,
      abi: AffiliateDistributorABI,
      functionName: 'claimMonthlyQualifier',
    });
    toast({ type: 'pending', title: 'Harvesting monthly qualifier...' });
  };

  const harvestIncome = (incomeType: number) => {
    writeHarvest({
      address: contracts.affiliateDistributor,
      abi: AffiliateDistributorABI,
      functionName: 'harvest',
      args: [incomeType],
    });
    toast({ type: 'pending', title: 'Harvesting income...' });
  };

  const checkRankChange = () => {
    if (!address) return;
    writeCheckRank({
      address: contracts.affiliateDistributor,
      abi: AffiliateDistributorABI,
      functionName: 'checkRankChange',
      args: [address],
    });
    toast({ type: 'pending', title: 'Checking rank...' });
  };

  // Fetch per-referral team volumes for leg breakdown & 50% rule
  const referralsList = (directReferrals as `0x${string}`[]) || [];
  const legVolumeContracts = useMemo(() =>
    referralsList.map((ref) => ({
      address: contracts.affiliateDistributor as `0x${string}`,
      abi: AffiliateDistributorABI,
      functionName: 'teamVolume' as const,
      args: [ref] as const,
    })),
    [referralsList.length]
  );

  const { data: legVolumesRaw } = useReadContracts({
    contracts: legVolumeContracts,
    query: {
      enabled: referralsList.length > 0 && contracts.affiliateDistributor !== '0x',
      refetchInterval: 30000,
    },
  });

  const legVolumes = useMemo(() => {
    if (!legVolumesRaw || !referralsList.length) return [];
    return referralsList.map((ref, i) => {
      const raw = legVolumesRaw[i];
      const vol = raw?.status === 'success' ? BigInt(raw.result as any) : 0n;
      return {
        address: ref,
        volume: vol,
        volumeUsd: Number(formatUnits(vol, USDT_DECIMALS)),
      };
    });
  }, [legVolumesRaw, referralsList.length]);

  const largestLegVolume = useMemo(() => {
    if (!legVolumes.length) return 0n;
    return legVolumes.reduce((max, l) => l.volume > max ? l.volume : max, 0n);
  }, [legVolumes]);

  return {
    allIncome: allIncome as any,
    rankInfo: rankInfo as any,
    // Parsed rank info fields (getUserRankInfo returns: storedRank, liveRank, salary, lastClaimed, nextClaimTime)
    storedRank: rankInfo ? Number((rankInfo as any)[0] || 0) : 0,
    liveRank: rankInfo ? Number((rankInfo as any)[1] || 0) : 0,
    rankSalary: rankInfo ? BigInt((rankInfo as any)[2] || 0) : 0n,
    lastRankClaim: rankInfo ? Number((rankInfo as any)[3] || 0) : 0,
    nextRankClaim: rankInfo ? Number((rankInfo as any)[4] || 0) : 0,
    isRankChangePending: rankInfo ? Number((rankInfo as any)[0] || 0) !== Number((rankInfo as any)[1] || 0) : false,
    directReferrals: directReferrals as any,
    freshBusiness: freshBusiness as any,
    upline: upline as string | undefined,
    teamVolume: teamVolume as bigint | undefined,
    unlockedLevels: unlockedLevels != null ? Number(unlockedLevels) : 0,
    legVolumes,
    largestLegVolume,
    claimRankSalary,
    claimWeeklyQualifier,
    claimMonthlyQualifier,
    harvestIncome,
    checkRankChange,
    isLoading: incomeLoading || rankLoading,
    isPending: claimRankPending || claimWeeklyPending || claimMonthlyPending || harvestPending || checkRankPending,
  };
}
