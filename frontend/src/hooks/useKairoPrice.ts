'use client';

import { useReadContract } from 'wagmi';
import { contracts } from '@/config/contracts';
import { LiquidityPoolABI } from '@/config/abis/LiquidityPool';

export function useKairoPrice() {
  const { data: priceData, isLoading, refetch } = useReadContract({
    address: contracts.liquidityPool,
    abi: LiquidityPoolABI,
    functionName: 'getLivePrice',
    query: {
      refetchInterval: 5000,
      enabled: contracts.liquidityPool !== '0x',
    },
  });

  const price = priceData ? Number(priceData) / 1e6 : 0;

  return { price, isLoading, refetch };
}
