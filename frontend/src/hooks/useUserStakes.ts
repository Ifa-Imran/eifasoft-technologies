'use client';

import { useReadContract, useAccount } from 'wagmi';
import { contracts, STAKING_TIERS, USDT_DECIMALS } from '@/config/contracts';
import { StakingManagerABI } from '@/config/abis/StakingManager';
import { formatUnits } from 'viem';

export interface StakeInfo {
  index: number;
  amount: bigint;
  earned: bigint;
  harvested: bigint;
  startTime: number;
  lastCompoundTime: number;
  active: boolean;
  tier: number;
  tierName: string;
  tierColor: string;
  compoundInterval: number;
  nextCompoundTime: number;
  canCompound: boolean;
  hardCap: bigint;
  progress: number; // 0-100 progress to 3X
  amountFormatted: string;
  earnedFormatted: string;
  harvestedFormatted: string;
  harvestable: bigint;
  harvestableFormatted: string;
}

export function useUserStakes() {
  const { address } = useAccount();

  const { data: stakeCount, isLoading: countLoading } = useReadContract({
    address: contracts.stakingManager,
    abi: StakingManagerABI,
    functionName: 'getUserStakeCount',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contracts.stakingManager !== '0x',
      refetchInterval: 15000,
    },
  });

  const { data: rawStakes, isLoading: stakesLoading } = useReadContract({
    address: contracts.stakingManager,
    abi: StakingManagerABI,
    functionName: 'getUserStakes',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contracts.stakingManager !== '0x' && Number(stakeCount || 0) > 0,
      refetchInterval: 15000,
    },
  });

  const stakes: StakeInfo[] = rawStakes
    ? (rawStakes as any[]).map((s: any, i: number) => {
        const tierIdx = Number(s.tier || 0);
        const tier = STAKING_TIERS[tierIdx] || STAKING_TIERS[0];
        const amount = BigInt(s.amount || 0);
        const earned = BigInt(s.earned || 0);
        const harvested = BigInt(s.harvested || 0);
        const hardCap = amount * 3n;
        const harvestable = earned > harvested ? earned - harvested : 0n;
        const progress = hardCap > 0n ? Number((earned * 100n) / hardCap) : 0;
        const lastCompound = Number(s.lastCompoundTime || 0);
        const now = Math.floor(Date.now() / 1000);

        return {
          index: i,
          amount,
          earned,
          harvested,
          startTime: Number(s.startTime || 0),
          lastCompoundTime: lastCompound,
          active: s.active || false,
          tier: tierIdx,
          tierName: tier.name,
          tierColor: tier.color,
          compoundInterval: tier.compoundInterval,
          nextCompoundTime: lastCompound + tier.compoundInterval,
          canCompound: now >= lastCompound + tier.compoundInterval,
          hardCap,
          progress: Math.min(progress, 100),
          amountFormatted: formatUnits(amount, USDT_DECIMALS),
          earnedFormatted: formatUnits(earned, USDT_DECIMALS),
          harvestedFormatted: formatUnits(harvested, USDT_DECIMALS),
          harvestable,
          harvestableFormatted: formatUnits(harvestable, USDT_DECIMALS),
        };
      })
    : [];

  const activeStakes = stakes.filter((s) => s.active);
  const totalStaked = activeStakes.reduce((sum, s) => sum + s.amount, 0n);
  const totalHarvestable = activeStakes.reduce((sum, s) => sum + s.harvestable, 0n);

  return {
    stakes,
    activeStakes,
    totalStaked,
    totalHarvestable,
    stakeCount: Number(stakeCount || 0),
    isLoading: countLoading || stakesLoading,
  };
}
