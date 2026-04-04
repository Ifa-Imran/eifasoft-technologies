'use client';

import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface PriceChartProps {
  currentPrice: number;
}

// Generate mock price history data for now
function generateMockData(currentPrice: number) {
  const base = currentPrice || 1.0;
  const data = [];
  const now = Date.now();
  for (let i = 23; i >= 0; i--) {
    const variation = (Math.sin(i * 0.5) * 0.05 + (Math.random() - 0.5) * 0.03) * base;
    data.push({
      time: new Date(now - i * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      price: Math.max(base + variation, 0.01),
    });
  }
  return data;
}

export function PriceChart({ currentPrice }: PriceChartProps) {
  const data = useMemo(() => generateMockData(currentPrice), [currentPrice]);

  const priceChange = data.length >= 2 ? ((data[data.length - 1].price - data[0].price) / data[0].price) * 100 : 0;
  const isPositive = priceChange >= 0;

  return (
    <div className="glass rounded-xl p-4">
      {/* Price header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-dark-500">KAIRO / USDT</p>
          <p className="text-2xl font-bold font-mono text-dark-50">${currentPrice.toFixed(4)}</p>
        </div>
        <div className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-mono font-semibold ${isPositive ? 'bg-primary-500/10 text-primary-400' : 'bg-red-500/10 text-red-400'}`}>
          {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
          <span className="text-xs">24h</span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0.2} />
                <stop offset="100%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} domain={['dataMin', 'dataMax']} tickFormatter={(v) => `$${v.toFixed(2)}`} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem', fontSize: '12px', color: '#f8fafc' }}
              formatter={(value: number) => [`$${value.toFixed(4)}`, 'Price']}
            />
            <Area type="monotone" dataKey="price" stroke={isPositive ? '#22c55e' : '#ef4444'} fill="url(#priceGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
