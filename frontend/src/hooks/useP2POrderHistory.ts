'use client';

import { useReadContract, useAccount, usePublicClient } from 'wagmi';
import { contracts, USDT_DECIMALS, KAIRO_DECIMALS } from '@/config/contracts';
import { AtomicP2pABI } from '@/config/abis/AtomicP2p';
import { useEffect, useState, useMemo } from 'react';
import { formatUnits, parseAbiItem } from 'viem';

export type P2POrderStatus = 'Placed' | 'Executed' | 'Canceled';

export interface P2POrderHistoryItem {
  id: string;
  type: 'buy' | 'sell';
  status: P2POrderStatus;
  originalAmount: string;
  filledAmount: string;
  remainingAmount: string;
  token: string; // 'USDT' for buy, 'KAIRO' for sell
  createdAt: number; // unix timestamp
  txHash?: string;
  trades: P2PTradeEntry[];
}

export interface P2PTradeEntry {
  tradeId: bigint;
  kairoAmount: bigint;
  usdtAmount: bigint;
  price: bigint;
  executedAt: number;
  role: 'buyer' | 'seller';
  counterparty: string;
  buyOrderId: bigint;
  sellOrderId: bigint;
}

export function useP2POrderHistory(overrideAddress?: `0x${string}`) {
  const { address: connectedAddress } = useAccount();
  const address = overrideAddress ?? connectedAddress;
  const publicClient = usePublicClient();
  const [history, setHistory] = useState<P2POrderHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch user's order IDs (buy + sell)
  const { data: userOrders } = useReadContract({
    address: contracts.atomicP2p,
    abi: AtomicP2pABI,
    functionName: 'getUserOrders',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contracts.atomicP2p !== '0x',
      refetchInterval: 15000,
    },
  });

  // Fetch user's trade IDs
  const { data: userTradeIds } = useReadContract({
    address: contracts.atomicP2p,
    abi: AtomicP2pABI,
    functionName: 'getUserTrades',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contracts.atomicP2p !== '0x',
      refetchInterval: 15000,
    },
  });

  useEffect(() => {
    if (!publicClient || !address || contracts.atomicP2p === '0x') return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const orders = userOrders as [bigint[], bigint[]] | undefined;
        const buyOrderIds = orders?.[0] || [];
        const sellOrderIds = orders?.[1] || [];
        const tradeIds = (userTradeIds as bigint[]) || [];

        // ── Fetch all buy & sell order details ──
        const buyOrderCalls = buyOrderIds.map((id) => ({
          address: contracts.atomicP2p as `0x${string}`,
          abi: AtomicP2pABI,
          functionName: 'getBuyOrder' as const,
          args: [id] as const,
        }));

        const sellOrderCalls = sellOrderIds.map((id) => ({
          address: contracts.atomicP2p as `0x${string}`,
          abi: AtomicP2pABI,
          functionName: 'getSellOrder' as const,
          args: [id] as const,
        }));

        const [buyResults, sellResults] = await Promise.all([
          buyOrderCalls.length > 0
            ? publicClient.multicall({ contracts: buyOrderCalls })
            : Promise.resolve([]),
          sellOrderCalls.length > 0
            ? publicClient.multicall({ contracts: sellOrderCalls })
            : Promise.resolve([]),
        ]);

        if (cancelled) return;

        // ── Fetch trade details ──
        const tradeCalls = tradeIds.map((id) => ({
          address: contracts.atomicP2p as `0x${string}`,
          abi: AtomicP2pABI,
          functionName: 'getTrade' as const,
          args: [id] as const,
        }));

        const tradeResults = tradeCalls.length > 0
          ? await publicClient.multicall({ contracts: tradeCalls })
          : [];

        if (cancelled) return;

        // Parse trades into a map for quick lookup
        const tradeEntries: P2PTradeEntry[] = [];
        const tradesByBuyOrder = new Map<string, P2PTradeEntry[]>();
        const tradesBySellOrder = new Map<string, P2PTradeEntry[]>();

        for (let i = 0; i < tradeResults.length; i++) {
          const r = tradeResults[i];
          if (r?.status !== 'success' || !r.result) continue;
          const t = r.result as any;
          const entry: P2PTradeEntry = {
            tradeId: tradeIds[i],
            kairoAmount: BigInt(t.kairoAmount || 0),
            usdtAmount: BigInt(t.usdtAmount || 0),
            price: BigInt(t.price || 0),
            executedAt: Number(t.executedAt || 0),
            role: t.buyer?.toLowerCase() === address.toLowerCase() ? 'buyer' : 'seller',
            counterparty: t.buyer?.toLowerCase() === address.toLowerCase() ? t.seller : t.buyer,
            buyOrderId: BigInt(t.buyOrderId || 0),
            sellOrderId: BigInt(t.sellOrderId || 0),
          };
          tradeEntries.push(entry);

          const buyKey = t.buyOrderId.toString();
          const sellKey = t.sellOrderId.toString();
          if (!tradesByBuyOrder.has(buyKey)) tradesByBuyOrder.set(buyKey, []);
          if (!tradesBySellOrder.has(sellKey)) tradesBySellOrder.set(sellKey, []);
          tradesByBuyOrder.get(buyKey)!.push(entry);
          tradesBySellOrder.get(sellKey)!.push(entry);
        }

        // ── Build order history items ──
        const items: P2POrderHistoryItem[] = [];

        // Buy orders
        for (let i = 0; i < buyOrderIds.length; i++) {
          const r = buyResults[i];
          if (r?.status !== 'success' || !r.result) continue;
          const o = r.result as any;
          const orderId = buyOrderIds[i];
          const usdtAmount = BigInt(o.usdtAmount || 0);
          const usdtRemaining = BigInt(o.usdtRemaining || 0);
          const active = o.active as boolean;
          const createdAt = Number(o.createdAt || 0);
          const filled = usdtAmount - usdtRemaining;

          // Determine status
          let status: P2POrderStatus;
          if (active && usdtRemaining > 0n) {
            status = 'Placed';
          } else if (!active && filled > 0n) {
            status = 'Executed';
          } else if (!active && filled === 0n) {
            status = 'Canceled';
          } else {
            status = 'Executed';
          }

          const orderIdStr = orderId.toString();
          const trades = tradesByBuyOrder.get(orderIdStr) || [];

          items.push({
            id: orderIdStr,
            type: 'buy',
            status,
            originalAmount: Number(formatUnits(usdtAmount, USDT_DECIMALS)).toFixed(2),
            filledAmount: Number(formatUnits(filled, USDT_DECIMALS)).toFixed(2),
            remainingAmount: Number(formatUnits(usdtRemaining, USDT_DECIMALS)).toFixed(2),
            token: 'USDT',
            createdAt,
            trades,
          });
        }

        // Sell orders
        for (let i = 0; i < sellOrderIds.length; i++) {
          const r = sellResults[i];
          if (r?.status !== 'success' || !r.result) continue;
          const o = r.result as any;
          const orderId = sellOrderIds[i];
          const kairoAmount = BigInt(o.kairoAmount || 0);
          const kairoRemaining = BigInt(o.kairoRemaining || 0);
          const active = o.active as boolean;
          const createdAt = Number(o.createdAt || 0);
          const filled = kairoAmount - kairoRemaining;

          let status: P2POrderStatus;
          if (active && kairoRemaining > 0n) {
            status = 'Placed';
          } else if (!active && filled > 0n) {
            status = 'Executed';
          } else if (!active && filled === 0n) {
            status = 'Canceled';
          } else {
            status = 'Executed';
          }

          const orderIdStr = orderId.toString();
          const trades = tradesBySellOrder.get(orderIdStr) || [];

          items.push({
            id: orderIdStr,
            type: 'sell',
            status,
            originalAmount: Number(formatUnits(kairoAmount, KAIRO_DECIMALS)).toFixed(2),
            filledAmount: Number(formatUnits(filled, KAIRO_DECIMALS)).toFixed(2),
            remainingAmount: Number(formatUnits(kairoRemaining, KAIRO_DECIMALS)).toFixed(2),
            token: 'KAIRO',
            createdAt,
            trades,
          });
        }

        // Sort by createdAt descending (newest first)
        items.sort((a, b) => b.createdAt - a.createdAt);

        if (!cancelled) setHistory(items);
      } catch (err) {
        console.error('Failed to fetch P2P order history:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [publicClient, address, userOrders, userTradeIds]);

  const stats = useMemo(() => {
    const total = history.length;
    const placed = history.filter(h => h.status === 'Placed').length;
    const executed = history.filter(h => h.status === 'Executed').length;
    const canceled = history.filter(h => h.status === 'Canceled').length;
    const totalTrades = history.reduce((sum, h) => sum + h.trades.length, 0);
    return { total, placed, executed, canceled, totalTrades };
  }, [history]);

  return {
    history,
    loading,
    stats,
  };
}
