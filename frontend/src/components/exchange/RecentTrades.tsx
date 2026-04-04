'use client';

import { useState, useEffect, useMemo } from 'react';

interface Trade {
  time: string;
  price: number;
  amount: number;
  type: 'buy' | 'sell';
}

// Mock recent trades for display (will connect to backend later)
function generateMockTrades(): Trade[] {
  const trades: Trade[] = [];
  const now = Date.now();
  for (let i = 0; i < 15; i++) {
    trades.push({
      time: new Date(now - i * 120000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      price: 1.0 + (Math.random() - 0.5) * 0.1,
      amount: Math.random() * 500 + 10,
      type: Math.random() > 0.5 ? 'buy' : 'sell',
    });
  }
  return trades;
}

export function RecentTrades() {
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    setTrades(generateMockTrades());
    const interval = setInterval(() => {
      setTrades((prev) => {
        const newTrade: Trade = {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          price: 1.0 + (Math.random() - 0.5) * 0.1,
          amount: Math.random() * 500 + 10,
          type: Math.random() > 0.5 ? 'buy' : 'sell',
        };
        return [newTrade, ...prev.slice(0, 14)];
      });
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="grid grid-cols-3 text-xs text-dark-500 mb-2 px-1">
        <span>Time</span>
        <span className="text-right">Price</span>
        <span className="text-right">Amount</span>
      </div>

      {/* Trades */}
      <div className="flex-1 space-y-px overflow-y-auto">
        {trades.length === 0 ? (
          <p className="text-xs text-dark-500 text-center py-6">No recent trades</p>
        ) : (
          trades.map((trade, i) => (
            <div key={`trade-${i}`} className="grid grid-cols-3 text-xs py-1 px-1 hover:bg-dark-700/30 transition-colors">
              <span className="text-dark-400 font-mono">{trade.time}</span>
              <span className={`text-right font-mono ${trade.type === 'buy' ? 'text-primary-400' : 'text-red-400'}`}>
                {trade.price.toFixed(4)}
              </span>
              <span className="text-right text-dark-300 font-mono">{trade.amount.toFixed(2)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
