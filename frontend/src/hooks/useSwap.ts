'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { contracts } from '@/config/contracts';
import { LiquidityPoolABI } from '@/config/abis/LiquidityPool';
import { useToast } from '@/components/ui/Toast';
import { formatUnits } from 'viem';
import { useEffect } from 'react';

export function useSwap() {
  const { toast } = useToast();
  const { address } = useAccount();

  const { data: balances } = useReadContract({
    address: contracts.liquidityPool,
    abi: LiquidityPoolABI,
    functionName: 'getBalances',
    query: {
      enabled: contracts.liquidityPool !== '0x',
      refetchInterval: 10000,
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

  const { writeContract: writeSwap, isPending, data: swapHash } = useWriteContract();

  const { isSuccess: swapSuccess, isError: swapError } = useWaitForTransactionReceipt({ hash: swapHash });

  useEffect(() => { if (swapSuccess) toast({ type: 'success', title: 'Swap completed!' }); }, [swapSuccess]);
  useEffect(() => { if (swapError) toast({ type: 'error', title: 'Swap failed' }); }, [swapError]);

  const swap = (kairoAmount: bigint, minUsdtOut: bigint) => {
    writeSwap({
      address: contracts.liquidityPool,
      abi: LiquidityPoolABI,
      functionName: 'swapKAIROForUSDT',
      args: [kairoAmount, minUsdtOut, address!],
    });
    toast({ type: 'pending', title: 'Swapping KAIRO for USDT...', description: 'Confirming transaction' });
  };

  return {
    poolBalances: balances as any,
    swapStats: swapStats as any,
    swap,
    isPending,
    swapHash,
  };
}
