'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { contracts } from '@/config/contracts';
import { AffiliateDistributorABI } from '@/config/abis/AffiliateDistributor';
import { useToast } from '@/components/ui/Toast';
import { useEffect } from 'react';

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

  // Write operations
  const { writeContract: writeClaimRank, isPending: claimRankPending, data: claimRankHash } = useWriteContract();
  const { writeContract: writeClaimWeekly, isPending: claimWeeklyPending, data: claimWeeklyHash } = useWriteContract();
  const { writeContract: writeClaimMonthly, isPending: claimMonthlyPending, data: claimMonthlyHash } = useWriteContract();
  const { writeContract: writeHarvest, isPending: harvestPending, data: harvestHash } = useWriteContract();

  const { isSuccess: rankSuccess, isError: rankError } = useWaitForTransactionReceipt({ hash: claimRankHash });
  const { isSuccess: weeklySuccess, isError: weeklyError } = useWaitForTransactionReceipt({ hash: claimWeeklyHash });
  const { isSuccess: monthlySuccess, isError: monthlyError } = useWaitForTransactionReceipt({ hash: claimMonthlyHash });
  const { isSuccess: harvestSuccess, isError: harvestError } = useWaitForTransactionReceipt({ hash: harvestHash });

  useEffect(() => { if (rankSuccess) toast({ type: 'success', title: 'Rank salary claimed!' }); }, [rankSuccess]);
  useEffect(() => { if (rankError) toast({ type: 'error', title: 'Rank salary claim failed' }); }, [rankError]);
  useEffect(() => { if (weeklySuccess) toast({ type: 'success', title: 'Weekly qualifier claimed!' }); }, [weeklySuccess]);
  useEffect(() => { if (weeklyError) toast({ type: 'error', title: 'Weekly qualifier claim failed' }); }, [weeklyError]);
  useEffect(() => { if (monthlySuccess) toast({ type: 'success', title: 'Monthly qualifier claimed!' }); }, [monthlySuccess]);
  useEffect(() => { if (monthlyError) toast({ type: 'error', title: 'Monthly qualifier claim failed' }); }, [monthlyError]);
  useEffect(() => { if (harvestSuccess) toast({ type: 'success', title: 'Income harvested!' }); }, [harvestSuccess]);
  useEffect(() => { if (harvestError) toast({ type: 'error', title: 'Harvest failed' }); }, [harvestError]);

  const claimRankSalary = () => {
    writeClaimRank({
      address: contracts.affiliateDistributor,
      abi: AffiliateDistributorABI,
      functionName: 'claimRankSalary',
    });
    toast({ type: 'pending', title: 'Claiming rank salary...' });
  };

  const claimWeeklyQualifier = () => {
    writeClaimWeekly({
      address: contracts.affiliateDistributor,
      abi: AffiliateDistributorABI,
      functionName: 'claimWeeklyQualifier',
    });
    toast({ type: 'pending', title: 'Claiming weekly qualifier...' });
  };

  const claimMonthlyQualifier = () => {
    writeClaimMonthly({
      address: contracts.affiliateDistributor,
      abi: AffiliateDistributorABI,
      functionName: 'claimMonthlyQualifier',
    });
    toast({ type: 'pending', title: 'Claiming monthly qualifier...' });
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

  return {
    allIncome: allIncome as any,
    rankInfo: rankInfo as any,
    directReferrals: directReferrals as any,
    freshBusiness: freshBusiness as any,
    upline: upline as string | undefined,
    claimRankSalary,
    claimWeeklyQualifier,
    claimMonthlyQualifier,
    harvestIncome,
    isLoading: incomeLoading || rankLoading,
    isPending: claimRankPending || claimWeeklyPending || claimMonthlyPending || harvestPending,
  };
}
