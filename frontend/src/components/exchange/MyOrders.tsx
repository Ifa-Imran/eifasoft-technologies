'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { Button } from '@/components/ui/Button';
import { formatAddress } from '@/lib/utils';

interface MyOrdersProps {
  buyOrders: readonly {
    creator: string;
    usdtAmount: bigint;
    usdtRemaining: bigint;
    active: boolean;
    createdAt: bigint;
  }[] | undefined;
  sellOrders: readonly {
    creator: string;
    kairoAmount: bigint;
    kairoRemaining: bigint;
    active: boolean;
    createdAt: bigint;
  }[] | undefined;
  onCancelBuyOrder: (orderId: bigint) => void;
  onCancelSellOrder: (orderId: bigint) => void;
  isWritePending: boolean;
}

export function MyOrders({ buyOrders, sellOrders, onCancelBuyOrder, onCancelSellOrder, isWritePending }: MyOrdersProps) {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<'active' | 'history'>('active');

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-xs text-dark-500">Connect wallet to view orders</p>
      </div>
    );
  }

  const myBuys = buyOrders?.filter(
    (o) => o.creator.toLowerCase() === address?.toLowerCase() && o.active
  ) || [];

  const mySells = sellOrders?.filter(
    (o) => o.creator.toLowerCase() === address?.toLowerCase() && o.active
  ) || [];

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex gap-3 mb-3 border-b border-dark-700/50 pb-2">
        <button
          onClick={() => setTab('active')}
          className={`text-xs font-medium transition-colors pb-1 ${
            tab === 'active' ? 'text-primary-400 border-b border-primary-400' : 'text-dark-500 hover:text-dark-300'
          }`}
        >
          Active ({myBuys.length + mySells.length})
        </button>
        <button
          onClick={() => setTab('history')}
          className={`text-xs font-medium transition-colors pb-1 ${
            tab === 'history' ? 'text-primary-400 border-b border-primary-400' : 'text-dark-500 hover:text-dark-300'
          }`}
        >
          History
        </button>
      </div>

      {tab === 'active' ? (
        <div className="flex-1 space-y-2 overflow-y-auto">
          {myBuys.length === 0 && mySells.length === 0 ? (
            <p className="text-xs text-dark-500 text-center py-6">No active orders</p>
          ) : (
            <>
              {myBuys.map((order, i) => (
                <div key={`my-buy-${i}`} className="flex items-center justify-between p-2 rounded-lg bg-dark-900/50 border border-dark-700/30">
                  <div>
                    <span className="text-xs font-semibold text-primary-400">BUY</span>
                    <p className="text-xs text-dark-300 font-mono mt-0.5">
                      {Number(formatUnits(order.usdtRemaining, 18)).toFixed(2)} USDT
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => onCancelBuyOrder(BigInt(i))}
                    loading={isWritePending}
                  >
                    Cancel
                  </Button>
                </div>
              ))}
              {mySells.map((order, i) => (
                <div key={`my-sell-${i}`} className="flex items-center justify-between p-2 rounded-lg bg-dark-900/50 border border-dark-700/30">
                  <div>
                    <span className="text-xs font-semibold text-red-400">SELL</span>
                    <p className="text-xs text-dark-300 font-mono mt-0.5">
                      {Number(formatUnits(order.kairoRemaining, 18)).toFixed(2)} KAIRO
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => onCancelSellOrder(BigInt(i))}
                    loading={isWritePending}
                  >
                    Cancel
                  </Button>
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-dark-500">Order history coming soon</p>
        </div>
      )}
    </div>
  );
}
