'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '@/components/ui/Button';

interface TradeFormProps {
  currentPrice: number;
  onCreateBuyOrder: (usdtAmount: bigint) => void;
  onCreateSellOrder: (kairoAmount: bigint) => void;
  isWritePending: boolean;
  isConfirming: boolean;
}

export function TradeForm({ currentPrice, onCreateBuyOrder, onCreateSellOrder, isWritePending, isConfirming }: TradeFormProps) {
  const { isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');

  const effectivePrice = price ? Number(price) : currentPrice;
  const estimatedReceive =
    activeTab === 'buy'
      ? effectivePrice > 0
        ? Number(amount || 0) / effectivePrice
        : 0
      : Number(amount || 0) * effectivePrice;

  const handleSubmit = () => {
    if (!amount || Number(amount) <= 0) return;
    if (activeTab === 'buy') {
      onCreateBuyOrder(parseUnits(amount, 18));
    } else {
      onCreateSellOrder(parseUnits(amount, 18));
    }
    setAmount('');
  };

  const loading = isWritePending || isConfirming;

  return (
    <div className="glass rounded-xl p-4">
      <h2 className="text-sm font-semibold text-dark-200 mb-3">Place Order</h2>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-lg bg-dark-900/50 mb-4">
        <button
          onClick={() => setActiveTab('buy')}
          className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
            activeTab === 'buy'
              ? 'bg-primary-500/15 text-primary-400'
              : 'text-dark-500 hover:text-dark-300'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setActiveTab('sell')}
          className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
            activeTab === 'sell'
              ? 'bg-red-500/15 text-red-400'
              : 'text-dark-500 hover:text-dark-300'
          }`}
        >
          Sell
        </button>
      </div>

      {!isConnected ? (
        <div className="text-center py-6">
          <p className="text-dark-400 text-sm mb-4">Connect your wallet to trade</p>
          <ConnectButton />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Price input */}
          <div>
            <label className="flex items-center justify-between text-xs text-dark-500 mb-1">
              <span>Price per KAIRO</span>
              <button
                onClick={() => setPrice('')}
                className="text-primary-400 hover:text-primary-300 transition-colors"
              >
                Market
              </button>
            </label>
            <div className="relative">
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={currentPrice.toFixed(4)}
                className="w-full px-3 py-2.5 rounded-lg bg-dark-900 border border-dark-700 text-dark-100 text-sm font-mono focus:outline-none focus:border-primary-500 transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dark-500">USDT</span>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-xs text-dark-500 mb-1">
              Amount ({activeTab === 'buy' ? 'USDT' : 'KAIRO'})
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2.5 rounded-lg bg-dark-900 border border-dark-700 text-dark-100 text-sm font-mono focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>

          {/* Estimated receive */}
          <div className="px-3 py-2.5 rounded-lg bg-dark-900/50 border border-dark-700/50">
            <div className="flex justify-between text-xs">
              <span className="text-dark-500">
                Est. {activeTab === 'buy' ? 'KAIRO' : 'USDT'} to receive
              </span>
              <span className="text-dark-200 font-mono">
                {estimatedReceive.toFixed(4)} {activeTab === 'buy' ? 'KAIRO' : 'USDT'}
              </span>
            </div>
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            loading={loading}
            disabled={!amount || Number(amount) <= 0}
            variant={activeTab === 'buy' ? 'primary' : 'danger'}
            size="lg"
            className="w-full"
          >
            {loading
              ? 'Processing...'
              : activeTab === 'buy'
                ? 'Create Buy Order'
                : 'Create Sell Order'}
          </Button>
        </div>
      )}
    </div>
  );
}
