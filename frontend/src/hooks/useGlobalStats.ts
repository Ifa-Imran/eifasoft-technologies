'use client';

import { useReadContract } from 'wagmi';
import { contracts, KAIRO_DECIMALS, USDT_DECIMALS } from '@/config/contracts';
import { KAIROTokenABI } from '@/config/abis/KAIROToken';
import { LiquidityPoolABI } from '@/config/abis/LiquidityPool';
import { StakingManagerABI } from '@/config/abis/StakingManager';
import { AtomicP2pABI } from '@/config/abis/AtomicP2p';
import { erc20Abi } from 'viem';
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

  const { data: effectiveSupply } = useReadContract({
    address: contracts.kairoToken,
    abi: KAIROTokenABI,
    functionName: 'getEffectiveSupply',
    query: {
      enabled: contracts.kairoToken !== '0x',
      refetchInterval: 30000,
    },
  });

  const { data: socialLockAmount } = useReadContract({
    address: contracts.kairoToken,
    abi: KAIROTokenABI,
    functionName: 'getSocialLockAmount',
    query: {
      enabled: contracts.kairoToken !== '0x',
    },
  });

  // TVL = USDT balance in liquidity pool only
  const { data: tvl } = useReadContract({
    address: contracts.usdt,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [contracts.liquidityPool],
    query: {
      enabled: contracts.usdt !== '0x' && contracts.liquidityPool !== '0x',
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

  // P2P Order Book Stats
  const { data: orderBookStats } = useReadContract({
    address: contracts.atomicP2p,
    abi: AtomicP2pABI,
    functionName: 'getOrderBookStats',
    query: {
      enabled: contracts.atomicP2p !== '0x',
      refetchInterval: 30000,
    },
  });

  // P2P Total Liquidity locked
  const { data: p2pLiquidity } = useReadContract({
    address: contracts.atomicP2p,
    abi: AtomicP2pABI,
    functionName: 'getTotalLiquidity',
    query: {
      enabled: contracts.atomicP2p !== '0x',
      refetchInterval: 30000,
    },
  });

  // Pool balances (USDT + KAIRO in LP)
  const { data: poolBalances } = useReadContract({
    address: contracts.liquidityPool,
    abi: LiquidityPoolABI,
    functionName: 'getBalances',
    query: {
      enabled: contracts.liquidityPool !== '0x',
      refetchInterval: 15000,
    },
  });

  return {
    totalBurned: totalBurned as bigint | undefined,
    totalBurnedFormatted: totalBurned ? formatUnits(totalBurned as bigint, KAIRO_DECIMALS) : '0',
    totalSupply: totalSupply as bigint | undefined,
    totalSupplyFormatted: totalSupply ? formatUnits(totalSupply as bigint, KAIRO_DECIMALS) : '0',
    effectiveSupply: effectiveSupply as bigint | undefined,
    effectiveSupplyFormatted: effectiveSupply ? formatUnits(effectiveSupply as bigint, KAIRO_DECIMALS) : '0',
    socialLockAmount: socialLockAmount as bigint | undefined,
    socialLockFormatted: socialLockAmount ? formatUnits(socialLockAmount as bigint, KAIRO_DECIMALS) : '0',
    tvl: tvl as bigint | undefined,
    tvlFormatted: tvl ? formatUnits(tvl as bigint, USDT_DECIMALS) : '0',
    swapStats: swapStats as any,
    globalCap: globalCap as any,
    orderBookStats: orderBookStats as any,
    p2pLiquidity: p2pLiquidity as any,
    poolBalances: poolBalances as any,
  };
}
