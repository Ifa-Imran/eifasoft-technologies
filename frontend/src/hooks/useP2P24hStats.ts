import { useState, useEffect } from 'react';
import { usePublicClient } from 'wagmi';
import { parseAbiItem, formatUnits } from 'viem';
import { contracts, USDT_DECIMALS } from '@/config/contracts';

export interface P2P24hStats {
  trades24h: number;
  volume24h: number;
  loading: boolean;
}

/**
 * Fetches P2P TradeExecuted events from the last 24 hours.
 * Returns the count of trades completed and total USDT volume traded
 * during that same 24-hour period.
 */
export function useP2P24hStats(): P2P24hStats {
  const publicClient = usePublicClient();
  const [stats, setStats] = useState<P2P24hStats>({ trades24h: 0, volume24h: 0, loading: true });

  useEffect(() => {
    if (!publicClient || contracts.atomicP2p === '0x') {
      setStats({ trades24h: 0, volume24h: 0, loading: false });
      return;
    }

    let cancelled = false;

    const fetch24hStats = async () => {
      try {
        // opBNB block time ≈ 0.5s → 24h ≈ 172,800 blocks.
        // Chunk in 45k blocks to stay within RPC getLogs limits.
        const CHUNK = 45_000n;
        const BLOCKS_PER_DAY = 172_800n;

        let latestBlock = 0n;
        try { latestBlock = await publicClient.getBlockNumber(); } catch {}
        const safeFrom = latestBlock > BLOCKS_PER_DAY ? latestBlock - BLOCKS_PER_DAY : 0n;

        const event = parseAbiItem(
          'event TradeExecuted(uint256 indexed tradeId, uint256 indexed buyOrderId, uint256 indexed sellOrderId, address buyer, address seller, uint256 kairoAmount, uint256 usdtAmount, uint256 price, uint256 kairoFee, uint256 usdtFee)'
        );

        let tradeCount = 0;
        let totalVolume = 0n;

        let from = safeFrom;
        while (from <= latestBlock) {
          if (cancelled) return;
          const to = from + CHUNK - 1n > latestBlock ? latestBlock : from + CHUNK - 1n;
          try {
            const logs = await publicClient.getLogs({
              address: contracts.atomicP2p,
              event,
              fromBlock: from,
              toBlock: to,
            });
            for (const log of logs) {
              tradeCount++;
              const args = log.args as any;
              if (args?.usdtAmount) {
                totalVolume += BigInt(args.usdtAmount);
              }
            }
          } catch (e) {
            console.warn(`P2P 24h stats chunk ${from}-${to} failed:`, e);
          }
          from = to + 1n;
        }

        if (cancelled) return;
        setStats({
          trades24h: tradeCount,
          volume24h: Number(formatUnits(totalVolume, USDT_DECIMALS)),
          loading: false,
        });
      } catch (e) {
        console.error('Failed to fetch P2P 24h stats:', e);
        if (!cancelled) setStats(s => ({ ...s, loading: false }));
      }
    };

    fetch24hStats();
    const interval = setInterval(fetch24hStats, 30_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [publicClient]);

  return stats;
}
