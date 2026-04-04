'use client';

import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { CONTRACTS, AuxFundABI } from '@/lib/contracts';

export function useKairoPrice() {
  const { data, isLoading, isError, refetch } = useReadContract({
    address: CONTRACTS.AUXFUND,
    abi: AuxFundABI,
    functionName: 'getLivePrice',
    query: {
      enabled: !!CONTRACTS.AUXFUND,
      refetchInterval: 15_000, // Refresh every 15 seconds
    },
  });

  const price = data ? Number(formatUnits(data, 18)) : 0;

  return {
    price,
    rawPrice: data,
    isLoading,
    isError,
    refetch,
  };
}
