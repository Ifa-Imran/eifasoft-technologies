'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount, usePublicClient } from 'wagmi';
import { contracts } from '@/config/contracts';
import { LiquidityPoolABI } from '@/config/abis/LiquidityPool';
import { useToast } from '@/components/ui/Toast';
import { formatUnits } from 'viem';
import { useEffect } from 'react';

export function useSwap() {
  const { toast } = useToast();
  const { address } = useAccount();
  const publicClient = usePublicClient();

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

  const { data: totalValueLocked } = useReadContract({
    address: contracts.liquidityPool,
    abi: LiquidityPoolABI,
    functionName: 'getTotalValueLocked',
    query: { enabled: contracts.liquidityPool !== '0x', refetchInterval: 30000 },
  });

  const { data: livePrice } = useReadContract({
    address: contracts.liquidityPool,
    abi: LiquidityPoolABI,
    functionName: 'getLivePrice',
    query: { enabled: contracts.liquidityPool !== '0x', refetchInterval: 10000 },
  });

  const { writeContract: writeSwap, isPending, data: swapHash } = useWriteContract();
  const { writeContract: writeSwapUSDT, isPending: swapUSDTPending, data: swapUSDTHash } = useWriteContract();

  const { isSuccess: swapSuccess, isError: swapError } = useWaitForTransactionReceipt({ hash: swapHash });
  const { isSuccess: swapUSDTSuccess, isError: swapUSDTError } = useWaitForTransactionReceipt({ hash: swapUSDTHash });

  useEffect(() => { if (swapSuccess) toast({ type: 'success', title: 'Swap completed!' }); }, [swapSuccess]);
  useEffect(() => { if (swapError) toast({ type: 'error', title: 'Swap failed' }); }, [swapError]);
  useEffect(() => { if (swapUSDTSuccess) toast({ type: 'success', title: 'Swap completed!' }); }, [swapUSDTSuccess]);
  useEffect(() => { if (swapUSDTError) toast({ type: 'error', title: 'Swap failed' }); }, [swapUSDTError]);

  const swap = (kairoAmount: bigint, minUsdtOut: bigint) => {
    writeSwap({
      address: contracts.liquidityPool,
      abi: LiquidityPoolABI,
      functionName: 'swapKAIROForUSDT',
      args: [kairoAmount, minUsdtOut, address!],
    });
    toast({ type: 'pending', title: 'Swapping KAIRO for USDT...', description: 'Confirming transaction' });
  };

  /** Swap USDT for KAIRO (reverse direction). */
  const swapUSDTForKAIRO = (usdtAmount: bigint, minKairoOut: bigint) => {
    writeSwapUSDT({
      address: contracts.liquidityPool,
      abi: LiquidityPoolABI,
      functionName: 'swapUSDTForKAIRO',
      args: [usdtAmount, minKairoOut, address!],
    });
    toast({ type: 'pending', title: 'Swapping USDT for KAIRO...', description: 'Confirming transaction' });
  };

  /** On-chain: calculate minimum USDT output for a given KAIRO input (accounts for 10% fee+slippage). */
  const calculateMinOutput = async (kairoAmount: bigint, maxSlippagePercent: bigint = 100n): Promise<bigint> => {
    if (!publicClient) return 0n;
    try {
      const result = await publicClient.readContract({
        address: contracts.liquidityPool,
        abi: LiquidityPoolABI,
        functionName: 'calculateMinOutput',
        args: [kairoAmount, maxSlippagePercent, true],
      });
      return result as bigint;
    } catch { return 0n; }
  };

  /** On-chain: calculate price impact percentage for a given KAIRO amount. */
  const calculatePriceImpact = async (kairoAmount: bigint): Promise<bigint> => {
    if (!publicClient) return 0n;
    try {
      const result = await publicClient.readContract({
        address: contracts.liquidityPool,
        abi: LiquidityPoolABI,
        functionName: 'calculatePriceImpact',
        args: [kairoAmount, true],
      });
      return result as bigint;
    } catch { return 0n; }
  };

  return {
    poolBalances: balances as any,
    swapStats: swapStats as any,
    totalValueLocked: totalValueLocked as bigint | undefined,
    livePrice: livePrice as bigint | undefined,
    swap,
    swapUSDTForKAIRO,
    calculateMinOutput,
    calculatePriceImpact,
    isPending: isPending || swapUSDTPending,
    swapHash,
  };
}
