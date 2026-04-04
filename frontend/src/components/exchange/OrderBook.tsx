'use client';

import { useMemo, useEffect, useState } from 'react';
import { formatUnits } from 'viem';
import { cn } from '@/lib/utils';
import { useWS } from '@/providers/WebSocketProvider';
import { useToast } from '@/providers/ToastProvider';

interface Order {
  creator: string;
  usdtAmount?: bigint;
  usdtRemaining?: bigint;
  kairoAmount?: bigint;
  kairoRemaining?: bigint;
  active: boolean;
  createdAt: bigint;
}

interface OrderBookProps {
  buyOrders: Order[] | undefined;
  sellOrders: Order[] | undefined;
  currentPrice: number;
}

function formatVal(val: bigint | undefined, decimals = 18): string {
  if (!val) return '0.00';
  return Number(formatUnits(val, decimals)).toFixed(2);
}

export function OrderBook({ buyOrders, sellOrders, currentPrice }: OrderBookProps) {
  const { subscribe } = useWS();
  const { addToast } = useToast();
  const [flashSide, setFlashSide] = useState<'buy' | 'sell' | null>(null);

  // Listen for real-time orderbook updates and trades
  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type === 'orderbook_update') {
        setFlashSide(msg.data.side);
        setTimeout(() => setFlashSide(null), 600);
      }
      if (msg.type === 'trade_executed') {
        addToast('info', 'Trade Executed', `${msg.data.amount} KAIRO @ $${msg.data.price}`);
        setFlashSide('buy');
        setTimeout(() => setFlashSide(null), 600);
      }
    });
    return unsub;
  }, [subscribe, addToast]);
  const processedBuys = useMemo(() => {
    if (!buyOrders) return [];
    return buyOrders
      .filter((o) => o.active)
      .map((o) => {
        const usdtRem = Number(formatUnits(o.usdtRemaining || BigInt(0), 18));
        const kairoEst = currentPrice > 0 ? usdtRem / currentPrice : 0;
        return { price: currentPrice, amount: kairoEst, total: usdtRem, creator: o.creator };
      })
      .sort((a, b) => b.price - a.price)
      .slice(0, 10);
  }, [buyOrders, currentPrice]);

  const processedSells = useMemo(() => {
    if (!sellOrders) return [];
    return sellOrders
      .filter((o) => o.active)
      .map((o) => {
        const kairoRem = Number(formatUnits(o.kairoRemaining || BigInt(0), 18));
        const usdtEst = kairoRem * currentPrice;
        return { price: currentPrice, amount: kairoRem, total: usdtEst, creator: o.creator };
      })
      .sort((a, b) => a.price - b.price)
      .slice(0, 10);
  }, [sellOrders, currentPrice]);

  const maxBuyTotal = Math.max(...processedBuys.map((o) => o.total), 1);
  const maxSellTotal = Math.max(...processedSells.map((o) => o.total), 1);

  const spread = currentPrice > 0 ? '~0.00%' : '—';

  return (
    <div className="glass rounded-xl p-4 h-full flex flex-col">
      <h2 className="text-sm font-semibold text-dark-200 mb-3">Order Book</h2>

      {/* Header */}
      <div className="grid grid-cols-3 text-xs text-dark-500 mb-2 px-1">
        <span>Price (USDT)</span>
        <span className="text-right">Amount (KAIRO)</span>
        <span className="text-right">Total (USDT)</span>
      </div>

      {/* Sell orders (asks) - show reversed so best ask is at bottom */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className={cn('flex-1 flex flex-col justify-end space-y-px overflow-hidden transition-colors duration-300', flashSide === 'sell' && 'bg-red-500/5 rounded')}>
          {processedSells.length === 0 ? (
            <p className="text-xs text-dark-500 text-center py-4">No sell orders</p>
          ) : (
            [...processedSells].reverse().map((order, i) => (
              <div key={`sell-${i}`} className="relative grid grid-cols-3 text-xs py-1 px-1 hover:bg-dark-700/30 transition-colors">
                <div
                  className="absolute inset-y-0 right-0 bg-red-500/8"
                  style={{ width: `${(order.total / maxSellTotal) * 100}%` }}
                />
                <span className="relative text-red-400 font-mono">{order.price.toFixed(4)}</span>
                <span className="relative text-dark-300 font-mono text-right">{order.amount.toFixed(2)}</span>
                <span className="relative text-dark-300 font-mono text-right">{order.total.toFixed(2)}</span>
              </div>
            ))
          )}
        </div>

        {/* Spread */}
        <div className="flex items-center justify-center gap-2 py-2 border-y border-dark-700/50 my-1">
          <span className="text-lg font-bold font-mono text-dark-50">
            ${currentPrice.toFixed(4)}
          </span>
          <span className="text-xs text-dark-500">Spread: {spread}</span>
        </div>

        {/* Buy orders (bids) */}
        <div className={cn('flex-1 space-y-px overflow-hidden transition-colors duration-300', flashSide === 'buy' && 'bg-primary-500/5 rounded')}>
          {processedBuys.length === 0 ? (
            <p className="text-xs text-dark-500 text-center py-4">No buy orders</p>
          ) : (
            processedBuys.map((order, i) => (
              <div key={`buy-${i}`} className="relative grid grid-cols-3 text-xs py-1 px-1 hover:bg-dark-700/30 transition-colors">
                <div
                  className="absolute inset-y-0 right-0 bg-primary-500/8"
                  style={{ width: `${(order.total / maxBuyTotal) * 100}%` }}
                />
                <span className="relative text-primary-400 font-mono">{order.price.toFixed(4)}</span>
                <span className="relative text-dark-300 font-mono text-right">{order.amount.toFixed(2)}</span>
                <span className="relative text-dark-300 font-mono text-right">{order.total.toFixed(2)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
