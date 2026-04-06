'use client';

import { useReadContract, useAccount } from 'wagmi';
import { contracts, KAIRO_DECIMALS, USDT_DECIMALS } from '@/config/contracts';
import { KAIROTokenABI } from '@/config/abis/KAIROToken';
import { MockUSDTABI } from '@/config/abis/MockUSDT';
import { formatUnits } from 'viem';

export function useTokenBalances() {
  const { address } = useAccount();

  const { data: kairoBalance, isLoading: kairoLoading } = useReadContract({
    address: contracts.kairoToken,
    abi: KAIROTokenABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contracts.kairoToken !== '0x',
      refetchInterval: 10000,
    },
  });

  const { data: usdtBalance, isLoading: usdtLoading } = useReadContract({
    address: contracts.usdt,
    abi: MockUSDTABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contracts.usdt !== '0x',
      refetchInterval: 10000,
    },
  });

  return {
    kairoBalance: kairoBalance as bigint | undefined,
    usdtBalance: usdtBalance as bigint | undefined,
    kairoFormatted: kairoBalance ? formatUnits(kairoBalance as bigint, KAIRO_DECIMALS) : '0',
    usdtFormatted: usdtBalance ? formatUnits(usdtBalance as bigint, USDT_DECIMALS) : '0',
    isLoading: kairoLoading || usdtLoading,
  };
}
