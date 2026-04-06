'use client';

import { useReadContract } from 'wagmi';
import { contracts, KAIRO_DECIMALS, USDT_DECIMALS } from '@/config/contracts';
import { KAIROTokenABI } from '@/config/abis/KAIROToken';
import { LiquidityPoolABI } from '@/config/abis/LiquidityPool';
import { StakingManagerABI } from '@/config/abis/StakingManager';
import { formatUnits } from 'viem';

export function useGlobalStats() {
  const { data: totalBurned } = useReadContract({
    address: contracts.kairoToken,
    abi: KAIROTokenABI,
    functionName: 'getTotalBurned',
    query: {
      enabled: contracts.kairoToken !== '0x',
      refetchInterval: 30000,
    },
  });

  const { data: totalSupply } = useReadContract({
    address: contracts.kairoToken,
    abi: KAIROTokenABI,
    functionName: 'totalSupply',
    query: {
      enabled: contracts.kairoToken !== '0x',
      refetchInterval: 30000,
    },
  });

  const { data: tvl } = useReadContract({
    address: contracts.liquidityPool,
    abi: LiquidityPoolABI,
    functionName: 'getTotalValueLocked',
    query: {
      enabled: contracts.liquidityPool !== '0x',
      refetchInterval: 15000,
    },
  });

  const { data: swapStats } = useReadContract({
    address: contracts.liquidityPool,
    abi: LiquidityPoolABI,
    functionName: 'getSwapStatistics',
    query: {
      enabled: contracts.liquidityPool !== '0x',
      refetchInterval: 30000,
    },
  });

  const { data: globalCap } = useReadContract({
    address: contracts.stakingManager,
    abi: StakingManagerABI,
    functionName: 'getGlobalCapProgress',
    query: {
      enabled: contracts.stakingManager !== '0x',
      refetchInterval: 30000,
    },
  });

  return {
    totalBurned: totalBurned as bigint | undefined,
    totalBurnedFormatted: totalBurned ? formatUnits(totalBurned as bigint, KAIRO_DECIMALS) : '0',
    totalSupply: totalSupply as bigint | undefined,
    totalSupplyFormatted: totalSupply ? formatUnits(totalSupply as bigint, KAIRO_DECIMALS) : '0',
    tvl: tvl as bigint | undefined,
    tvlFormatted: tvl ? formatUnits(tvl as bigint, USDT_DECIMALS) : '0',
    swapStats: swapStats as any,
    globalCap: globalCap as any,
  };
}
