'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { cn } from '@/lib/utils';
import { formatAddress } from '@/lib/utils';
import type { LegVolume } from '@/hooks/useRankData';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface LegDistributionChartProps {
  legs: LegVolume[];
  qualifyingVolumeUSD: number;
  legOverLimit: boolean;
  className?: string;
}

const COLORS = [
  '#00F0FF', // neon-cyan
  '#7000FF', // neon-purple
  '#00FFA3', // matrix-green
  '#FFB800', // solar-amber
  '#FF2E63', // neon-coral
  '#22d3ee', // primary-400
  '#60a5fa', // accent-400
  '#a78bfa', // violet
];

function CustomTooltipContent({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { fill: string } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="glass-card rounded-lg px-3 py-2 text-xs shadow-xl border border-white/10">
      <p className="text-gray-200 font-mono">{d.name}</p>
      <p className="text-white font-semibold mt-0.5">
        ${d.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
      </p>
    </div>
  );
}

export function LegDistributionChart({
  legs,
  qualifyingVolumeUSD,
  legOverLimit,
  className,
}: LegDistributionChartProps) {
  const chartData = useMemo(() => {
    if (legs.length === 0) return [];

    const top5 = legs.slice(0, 5);
    const rest = legs.slice(5);
    const restVolume = rest.reduce((sum, l) => sum + l.volumeUSD, 0);

    const data = top5.map((l) => ({
      name: formatAddress(l.address),
      value: l.volumeUSD,
      fullAddress: l.address,
    }));

    if (restVolume > 0) {
      data.push({ name: 'Others', value: restVolume, fullAddress: '' });
    }

    return data;
  }, [legs]);

  const totalVolume = legs.reduce((s, l) => s + l.volumeUSD, 0);

  if (legs.length === 0) {
    return (
      <div className={cn('text-center py-12', className)}>
        <p className="text-gray-500">No team legs to display</p>
        <p className="text-xs text-gray-600 mt-1">Refer users to see volume distribution</p>
      </div>
    );
  }

  return (
    <div className={cn('', className)}>
      {/* Warning banner */}
      {legOverLimit && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-neon-coral/5 border border-neon-coral/20 mb-4">
          <ExclamationTriangleIcon className="w-5 h-5 text-neon-coral shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-neon-coral font-medium">Leg Imbalance Detected</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Your largest leg exceeds 50% of total volume. Diversify your network for better rank qualification.
            </p>
          </div>
        </div>
      )}

      {/* Chart + center label */}
      <div className="relative w-full h-64 md:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {chartData.map((_, i) => {
                const isLargest = i === 0;
                const color = isLargest && legOverLimit ? '#FF2E63' : COLORS[i % COLORS.length];
                return <Cell key={i} fill={color} />;
              })}
            </Pie>
            <RechartsTooltip content={<CustomTooltipContent />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] uppercase tracking-wider text-gray-500">Qualifying</span>
          <span className="text-lg md:text-xl font-bold font-mono text-white">
            ${qualifyingVolumeUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      {/* Leg list */}
      <div className="mt-4 space-y-2">
        {legs.slice(0, 8).map((leg, i) => {
          const pct = totalVolume > 0 ? (leg.volumeUSD / totalVolume) * 100 : 0;
          const isOver = i === 0 && legOverLimit;
          return (
            <div key={leg.address} className="flex items-center gap-3">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: isOver ? '#FF2E63' : COLORS[i % COLORS.length] }}
              />
              <span className="text-xs font-mono text-gray-400 w-24 truncate">
                {formatAddress(leg.address)}
              </span>
              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(pct, 100)}%`,
                    backgroundColor: isOver ? '#FF2E63' : COLORS[i % COLORS.length],
                  }}
                />
              </div>
              <span className={cn('text-xs font-mono w-16 text-right', isOver ? 'text-neon-coral' : 'text-gray-400')}>
                {pct.toFixed(1)}%
              </span>
              <span className="text-xs font-mono text-gray-300 w-20 text-right hidden sm:block">
                ${leg.volumeUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
