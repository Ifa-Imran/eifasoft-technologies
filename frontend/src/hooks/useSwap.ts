'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount, usePublicClient } from 'wagmi';
import { contracts } from '@/config/contracts';
import { LiquidityPoolABI } from '@/config/abis/LiquidityPool';
import { useToast } from '@/components/ui/Toast';
import { formatUnits, BaseError, ContractFunctionRevertedError } from 'viem';
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

  // Extract a human-readable revert reason from a viem error.
  //
  // Priority order:
  //  1. Custom Solidity error -> ErrorName(args)  (via ContractFunctionRevertedError.data)
  //  2. Plain string revert    -> the require/revert reason
  //  3. viem shortMessage      -> e.g. "User rejected the request"
  //  4. Generic fallback
  const cleanReason = (s: string): string =>
    s
      .replace(/^Execution reverted(?: with reason(?: string)?:)?\s*/i, '')
      .replace(/^reverted with reason string\s*['"]?/i, '')
      .replace(/^The contract function .*? reverted(?: with the following reason:)?\s*/i, '')
      .replace(/^['"]/, '')
      .replace(/['"]\s*$/, '')
      .trim();

  const extractRevertReason = (err: unknown): string => {
    // Always log the raw error for debugging in DevTools.
    // eslint-disable-next-line no-console
    console.error('[swap] revert error:', err);

    if (err instanceof BaseError) {
      const revertError = err.walk(e => e instanceof ContractFunctionRevertedError);
      if (revertError instanceof ContractFunctionRevertedError) {
        // Custom error (e.g. ERC20InsufficientAllowance(...))
        const errorName = revertError.data?.errorName;
        const args = revertError.data?.args;
        if (errorName) {
          if (args && (args as readonly unknown[]).length > 0) {
            return `${errorName}(${(args as readonly unknown[]).map(String).join(', ')})`;
          }
          return errorName;
        }
        // Plain string revert (LiquidityPool: ...)
        if (revertError.reason) return cleanReason(revertError.reason);
        if (revertError.shortMessage) return cleanReason(revertError.shortMessage);
      }
      if (err.shortMessage) return cleanReason(err.shortMessage);
      if (err.message) return cleanReason(err.message);
    }

    // Non-BaseError fallback (e.g. plain RPC error)
    const anyErr = err as any;
    const candidates = [
      anyErr?.cause?.cause?.reason,
      anyErr?.cause?.reason,
      anyErr?.shortMessage,
      anyErr?.cause?.shortMessage,
      anyErr?.details,
      anyErr?.message,
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim().length > 0) {
        return cleanReason(c);
      }
    }
    return 'Transaction would revert';
  };

  const swap = async (kairoAmount: bigint, minUsdtOut: bigint) => {
    if (!publicClient || !address) {
      toast({ type: 'error', title: 'Wallet not ready' });
      return;
    }
    // Pre-simulate to surface the actual revert reason (e.g. deployer block,
    // insufficient USDT liquidity, slippage, internal compoundAllFor revert)
    // instead of the generic "execution reverted" wagmi error.
    try {
      await publicClient.simulateContract({
        address: contracts.liquidityPool,
        abi: LiquidityPoolABI,
        functionName: 'swapKAIROForUSDT',
        args: [kairoAmount, minUsdtOut, address],
        account: address,
      });
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Swap blocked',
        description: extractRevertReason(err),
      });
      return;
    }
    writeSwap({
      address: contracts.liquidityPool,
      abi: LiquidityPoolABI,
      functionName: 'swapKAIROForUSDT',
      args: [kairoAmount, minUsdtOut, address],
    });
    toast({ type: 'pending', title: 'Swapping KAIRO for USDT...', description: 'Confirming transaction' });
  };

  /** Swap USDT for KAIRO (reverse direction). */
  const swapUSDTForKAIRO = async (usdtAmount: bigint, minKairoOut: bigint) => {
    if (!publicClient || !address) {
      toast({ type: 'error', title: 'Wallet not ready' });
      return;
    }
    try {
      await publicClient.simulateContract({
        address: contracts.liquidityPool,
        abi: LiquidityPoolABI,
        functionName: 'swapUSDTForKAIRO',
        args: [usdtAmount, minKairoOut, address],
        account: address,
      });
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Swap blocked',
        description: extractRevertReason(err),
      });
      return;
    }
    writeSwapUSDT({
      address: contracts.liquidityPool,
      abi: LiquidityPoolABI,
      functionName: 'swapUSDTForKAIRO',
      args: [usdtAmount, minKairoOut, address],
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
