'use client';

import { useMemo, useState, useEffect } from 'react';
import { formatUnits } from 'viem';
import { GlassCard } from '@/components/ui/GlassCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import { useWS } from '@/providers/WebSocketProvider';

interface BuyOrder {
  creator: string;
  usdtAmount: bigint;
  usdtRemaining: bigint;
  active: boolean;
  createdAt: bigint;
}

interface SellOrder {
  creator: string;
  kairoAmount: bigint;
  kairoRemaining: bigint;
  active: boolean;
  createdAt: bigint;
}

interface OrderBookPanelProps {
  buyOrders: readonly BuyOrder[] | undefined;
  sellOrders: readonly SellOrder[] | undefined;
  buyOrderIds: readonly bigint[] | undefined;
  sellOrderIds: readonly bigint[] | undefined;
  currentPrice: number;
  isLoading?: boolean;
  onSelectOrder?: (side: 'buy' | 'sell', orderId: bigint, amount: number) => void;
}

interface ProcessedOrder {
  orderId: bigint;
  price: number;
  amount: number;
  total: number;
  creator: string;
}

export function OrderBookPanel({
  buyOrders,
  sellOrders,
  buyOrderIds,
  sellOrderIds,
  currentPrice,
  isLoading,
  onSelectOrder,
}: OrderBookPanelProps) {
  const { subscribe } = useWS();
  const [flashSide, setFlashSide] = useState<'buy' | 'sell' | null>(null);

  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type === 'orderbook_update') {
        setFlashSide(msg.data.side);
        setTimeout(() => setFlashSide(null), 600);
      }
    });
    return unsub;
  }, [subscribe]);

  const processedSells = useMemo<ProcessedOrder[]>(() => {
    if (!sellOrders || !sellOrderIds) return [];
    const ids = sellOrderIds as bigint[];
    return (sellOrders as SellOrder[])
      .map((o, i) => {
        if (!o.active || !ids[i]) return null;
        const kairoRem = Number(formatUnits(o.kairoRemaining ?? BigInt(0), 18));
        if (kairoRem <= 0) return null;
        const usdtEst = kairoRem * currentPrice;
        return { orderId: ids[i], price: currentPrice, amount: kairoRem, total: usdtEst, creator: o.creator };
      })
      .filter(Boolean) as ProcessedOrder[];
  }, [sellOrders, sellOrderIds, currentPrice]);

  const processedBuys = useMemo<ProcessedOrder[]>(() => {
    if (!buyOrders || !buyOrderIds) return [];
    const ids = buyOrderIds as bigint[];
    return (buyOrders as BuyOrder[])
      .map((o, i) => {
        if (!o.active || !ids[i]) return null;
        const usdtRem = Number(formatUnits(o.usdtRemaining ?? BigInt(0), 18));
        if (usdtRem <= 0) return null;
        const kairoEst = currentPrice > 0 ? usdtRem / currentPrice : 0;
        return { orderId: ids[i], price: currentPrice, amount: kairoEst, total: usdtRem, creator: o.creator };
      })
      .filter(Boolean) as ProcessedOrder[];
  }, [buyOrders, buyOrderIds, currentPrice]);

  const maxSellTotal = Math.max(...processedSells.map((o) => o.total), 1);
  const maxBuyTotal = Math.max(...processedBuys.map((o) => o.total), 1);

  const spread = processedSells.length > 0 && processedBuys.length > 0
    ? Math.abs(processedSells[0]?.price - processedBuys[0]?.price).toFixed(4)
    : '0.0000';

  if (isLoading) {
    return (
      <GlassCard className="h-full" padding="sm">
        <div className="space-y-2">
          <Skeleton variant="text" className="w-24 h-4 mb-3" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} variant="text" className="h-5" />
          ))}
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="h-full flex flex-col overflow-hidden" padding="sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider font-orbitron">
          Order Book
        </h3>
        <span className="text-[10px] text-gray-600 font-mono">KAIRO/USDT</span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-3 text-[10px] text-gray-600 mb-1 px-2 uppercase tracking-wider">
        <span>Price</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Total</span>
      </div>

      {/* Sell orders (asks) — reversed so best ask at bottom */}
      <div
        className={cn(
          'flex-1 flex flex-col justify-end space-y-px overflow-hidden min-h-0 transition-colors duration-300',
          flashSide === 'sell' && 'bg-neon-coral/5 rounded',
        )}
      >
        {processedSells.length === 0 ? (
          <p className="text-[10px] text-gray-600 text-center py-3">No sell orders</p>
        ) : (
          [...processedSells].slice(0, 8).reverse().map((order) => (
            <button
              key={`sell-${order.orderId.toString()}`}
              className="relative grid grid-cols-3 text-xs py-1 px-2 hover:bg-white/5 transition-colors text-left w-full"
              onClick={() => onSelectOrder?.('sell', order.orderId, order.amount)}
            >
              <div
                className="absolute inset-y-0 right-0 bg-neon-coral/8 pointer-events-none"
                style={{ width: `${(order.total / maxSellTotal) * 100}%` }}
              />
              <span className="relative text-neon-coral font-mono text-[11px]">
                {order.price.toFixed(4)}
              </span>
              <span className="relative text-gray-400 font-mono text-right text-[11px]">
                {order.amount.toFixed(2)}
              </span>
              <span className="relative text-gray-500 font-mono text-right text-[11px]">
                {order.total.toFixed(2)}
              </span>
            </button>
          ))
        )}
      </div>

      {/* Spread / Current Price divider */}
      <div className="flex items-center justify-center gap-3 py-2 my-1 border-y border-white/5">
        <span className="text-base font-bold font-mono text-white">
          ${currentPrice.toFixed(4)}
        </span>
        <span className="text-[10px] text-gray-600 font-mono">
          Spread: ${spread}
        </span>
      </div>

      {/* Buy orders (bids) */}
      <div
        className={cn(
          'flex-1 space-y-px overflow-hidden min-h-0 transition-colors duration-300',
          flashSide === 'buy' && 'bg-matrix-green/5 rounded',
        )}
      >
        {processedBuys.length === 0 ? (
          <p className="text-[10px] text-gray-600 text-center py-3">No buy orders</p>
        ) : (
          processedBuys.slice(0, 8).map((order) => (
            <button
              key={`buy-${order.orderId.toString()}`}
              className="relative grid grid-cols-3 text-xs py-1 px-2 hover:bg-white/5 transition-colors text-left w-full"
              onClick={() => onSelectOrder?.('buy', order.orderId, order.amount)}
            >
              <div
                className="absolute inset-y-0 right-0 bg-matrix-green/8 pointer-events-none"
                style={{ width: `${(order.total / maxBuyTotal) * 100}%` }}
              />
              <span className="relative text-matrix-green font-mono text-[11px]">
                {order.price.toFixed(4)}
              </span>
              <span className="relative text-gray-400 font-mono text-right text-[11px]">
                {order.amount.toFixed(2)}
              </span>
              <span className="relative text-gray-500 font-mono text-right text-[11px]">
                {order.total.toFixed(2)}
              </span>
            </button>
          ))
        )}
      </div>
    </GlassCard>
  );
}
