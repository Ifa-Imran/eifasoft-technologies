'use client';

import { useState } from 'react';
import { formatUnits } from 'viem';
import { useKairoPrice } from '@/hooks/useKairoPrice';
import { useP2P } from '@/hooks/useP2P';
import { OrderBook } from '@/components/exchange/OrderBook';
import { PriceChart } from '@/components/exchange/PriceChart';
import { TradeForm } from '@/components/exchange/TradeForm';
import { RecentTrades } from '@/components/exchange/RecentTrades';
import { MyOrders } from '@/components/exchange/MyOrders';

export default function ExchangePage() {
  const { price } = useKairoPrice();
  const {
    activeBuyOrders,
    activeSellOrders,
    orderBookStats,
    createBuyOrder,
    createSellOrder,
    cancelBuyOrder,
    cancelSellOrder,
    isWritePending,
    isConfirming,
  } = useP2P();

  const [rightTab, setRightTab] = useState<'trades' | 'orders'>('trades');

  // Parse stats
  const stats = orderBookStats as
    | { totalBuyOrders: bigint; totalSellOrders: bigint; totalTrades: bigint; activeBuyOrders: bigint; activeSellOrders: bigint }
    | undefined;

  return (
    <div className="max-w-[1400px] mx-auto px-3 sm:px-4 lg:px-6 py-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-dark-50">
            KAIRO <span className="text-dark-500">/</span> USDT
          </h1>
          <span className="text-2xl font-bold font-mono text-primary-400">${price.toFixed(4)}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-dark-400">
          <div>
            <span className="text-dark-500 mr-1">Buy Orders:</span>
            <span className="font-mono text-dark-200">{stats ? Number(stats.activeBuyOrders) : 0}</span>
          </div>
          <div>
            <span className="text-dark-500 mr-1">Sell Orders:</span>
            <span className="font-mono text-dark-200">{stats ? Number(stats.activeSellOrders) : 0}</span>
          </div>
          <div>
            <span className="text-dark-500 mr-1">Total Trades:</span>
            <span className="font-mono text-dark-200">{stats ? Number(stats.totalTrades) : 0}</span>
          </div>
        </div>
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left: Order Book */}
        <div className="lg:col-span-3 min-h-[500px]">
          <OrderBook
            buyOrders={activeBuyOrders as any}
            sellOrders={activeSellOrders as any}
            currentPrice={price}
          />
        </div>

        {/* Center: Chart + Trade Form */}
        <div className="lg:col-span-5 space-y-3">
          <PriceChart currentPrice={price} />
          <TradeForm
            currentPrice={price}
            onCreateBuyOrder={createBuyOrder}
            onCreateSellOrder={createSellOrder}
            isWritePending={isWritePending}
            isConfirming={isConfirming}
          />
        </div>

        {/* Right: Recent Trades / My Orders */}
        <div className="lg:col-span-4 glass rounded-xl p-4 min-h-[500px] flex flex-col">
          {/* Tab switcher */}
          <div className="flex gap-3 mb-3 border-b border-dark-700/50 pb-2">
            <button
              onClick={() => setRightTab('trades')}
              className={`text-xs font-semibold transition-colors pb-1 ${
                rightTab === 'trades'
                  ? 'text-primary-400 border-b border-primary-400'
                  : 'text-dark-500 hover:text-dark-300'
              }`}
            >
              Recent Trades
            </button>
            <button
              onClick={() => setRightTab('orders')}
              className={`text-xs font-semibold transition-colors pb-1 ${
                rightTab === 'orders'
                  ? 'text-primary-400 border-b border-primary-400'
                  : 'text-dark-500 hover:text-dark-300'
              }`}
            >
              My Orders
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0">
            {rightTab === 'trades' ? (
              <RecentTrades />
            ) : (
              <MyOrders
                buyOrders={activeBuyOrders as any}
                sellOrders={activeSellOrders as any}
                onCancelBuyOrder={cancelBuyOrder}
                onCancelSellOrder={cancelSellOrder}
                isWritePending={isWritePending}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
