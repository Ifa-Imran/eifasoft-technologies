'use client';

import { useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { contracts, USDT_DECIMALS } from '@/config/contracts';
import { LiquidityPoolABI } from '@/config/abis/LiquidityPool';

export interface PricePoint {
  /** Unix timestamp in seconds */
  time: number;
  /** KAIRO price in USDT */
  price: number;
}

// Cap on how many of the latest on-chain snapshots we pull in a single
// getLatestSnapshots() call. The view loops over storage slots, so this is a
// pure eth_call read (not on-chain gas). 1000 comfortably covers the full
// history to date (~772 snapshots spanning 2026-05-21 -> now) so the 3M/6M/
// 1Y range views can render their full window; the contract clamps the count
// itself when fewer snapshots exist.
const SNAPSHOT_CAP = 1000n;

/**
 * Historical KAIRO price points from the LiquidityPool's on-chain price
 * snapshots (recorded on every swap/fee event via _updatePriceSnapshot).
 * Returns ascending { time, price } points — raw material for candle building.
 */
export function usePriceHistory() {
  const { data: snapshots, isLoading, refetch } = useReadContract({
    address: contracts.liquidityPool,
    abi: LiquidityPoolABI,
    functionName: 'getLatestSnapshots',
    args: [SNAPSHOT_CAP],
    query: {
      enabled: contracts.liquidityPool !== '0x',
      refetchInterval: 60_000,
    },
  });

  // getLatestSnapshots returns newest-first; normalize to ascending points.
  const points = useMemo<PricePoint[]>(() => {
    if (!snapshots) return [];
    return (snapshots as readonly { price: bigint; timestamp: bigint }[])
      .map((s) => ({
        time: Number(s.timestamp),
        price: Number(formatUnits(s.price, USDT_DECIMALS)),
      }))
      .filter((p) => p.time > 0 && p.price > 0)
      .sort((a, b) => a.time - b.time);
  }, [snapshots]);

  return { points, isLoading, refetch };
}
