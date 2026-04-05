'use client';

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { CONTRACTS, LiquidityPoolABI } from '@/lib/contracts';
import { GlassCard } from '@/components/ui/GlassCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';

type Timeframe = '1H' | '4H' | '1D' | '1W';

const TIMEFRAME_CONFIG: Record<Timeframe, { label: string; hours: number; snapshots: number }> = {
  '1H': { label: '1H', hours: 1, snapshots: 12 },
  '4H': { label: '4H', hours: 4, snapshots: 24 },
  '1D': { label: '1D', hours: 24, snapshots: 48 },
  '1W': { label: '1W', hours: 168, snapshots: 100 },
};

interface PriceSnapshot {
  price: bigint;
  timestamp: bigint;
  usdtBalance: bigint;
  kairoSupply: bigint;
}

interface ChartDataPoint {
  time: number;
  value: number;
}

interface VolumeDataPoint {
  time: number;
  value: number;
  color: string;
}

export function TradingViewChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof import('lightweight-charts').createChart> | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [isChartReady, setIsChartReady] = useState(false);

  const config = TIMEFRAME_CONFIG[timeframe];

  const { data: snapshots, isLoading } = useReadContract({
    address: CONTRACTS.LIQUIDITY_POOL,
    abi: LiquidityPoolABI,
    functionName: 'getLatestSnapshots',
    args: [BigInt(config.snapshots)],
    query: {
      enabled: !!CONTRACTS.LIQUIDITY_POOL,
      refetchInterval: 30_000,
    },
  });

  const { priceData, volumeData } = useMemo(() => {
    if (!snapshots || !(snapshots as PriceSnapshot[]).length) {
      return { priceData: [] as ChartDataPoint[], volumeData: [] as VolumeDataPoint[] };
    }

    const raw = [...(snapshots as PriceSnapshot[])].reverse();
    const nowSec = Math.floor(Date.now() / 1000);
    const cutoff = nowSec - config.hours * 3600;

    const filtered = raw.filter((s) => Number(s.timestamp) >= cutoff);
    const source = filtered.length > 0 ? filtered : raw;

    const prices: ChartDataPoint[] = [];
    const volumes: VolumeDataPoint[] = [];

    for (let i = 0; i < source.length; i++) {
      const s = source[i];
      const time = Number(s.timestamp) as number;
      const price = Number(formatUnits(s.price, 18));
      prices.push({ time, value: price });

      if (i > 0) {
        const prevUsdt = Number(formatUnits(source[i - 1].usdtBalance, 18));
        const currUsdt = Number(formatUnits(s.usdtBalance, 18));
        const vol = Math.abs(currUsdt - prevUsdt);
        const isUp = price >= Number(formatUnits(source[i - 1].price, 18));
        volumes.push({
          time,
          value: vol,
          color: isUp ? 'rgba(0, 240, 255, 0.3)' : 'rgba(255, 46, 99, 0.3)',
        });
      }
    }

    return { priceData: prices, volumeData: volumes };
  }, [snapshots, config.hours]);

  // Create chart
  useEffect(() => {
    if (typeof window === 'undefined' || !chartContainerRef.current) return;

    let disposed = false;

    const initChart = async () => {
      const { createChart, ColorType, LineSeries, HistogramSeries } = await import('lightweight-charts');

      if (disposed || !chartContainerRef.current) return;

      // Clean up old chart
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

      const container = chartContainerRef.current;

      const chart = createChart(container, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: 'rgba(255, 255, 255, 0.5)',
          fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
          horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
        },
        crosshair: {
          vertLine: { color: '#00F0FF', width: 1, style: 2, labelBackgroundColor: '#0a0e1a' },
          horzLine: { color: '#00F0FF', width: 1, style: 2, labelBackgroundColor: '#0a0e1a' },
        },
        rightPriceScale: {
          borderColor: 'rgba(255, 255, 255, 0.06)',
          scaleMargins: { top: 0.1, bottom: 0.25 },
        },
        timeScale: {
          borderColor: 'rgba(255, 255, 255, 0.06)',
          timeVisible: true,
          secondsVisible: false,
        },
        width: container.clientWidth,
        height: container.clientHeight,
      });

      chartRef.current = chart;

      // Area/Line series for price
      const lineSeries = chart.addSeries(LineSeries, {
        color: '#00F0FF',
        lineWidth: 2,
        priceLineVisible: true,
        priceLineColor: '#00F0FF',
        priceLineWidth: 1,
        priceLineStyle: 2,
        lastValueVisible: true,
      });

      // Volume series
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });

      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });

      if (priceData.length > 0) {
        lineSeries.setData(priceData as any);
      }
      if (volumeData.length > 0) {
        volumeSeries.setData(volumeData as any);
      }

      chart.timeScale().fitContent();
      setIsChartReady(true);

      // ResizeObserver
      const resizeObserver = new ResizeObserver((entries) => {
        if (disposed) return;
        const { width, height } = entries[0].contentRect;
        chart.applyOptions({ width, height });
      });
      resizeObserver.observe(container);

      // Store cleanup info
      (chart as any).__resizeObserver = resizeObserver;
      (chart as any).__lineSeries = lineSeries;
      (chart as any).__volumeSeries = volumeSeries;
    };

    initChart();

    return () => {
      disposed = true;
      if (chartRef.current) {
        const chart = chartRef.current as any;
        chart.__resizeObserver?.disconnect();
        chartRef.current.remove();
        chartRef.current = null;
      }
      setIsChartReady(false);
    };
  }, []); // Only create chart once

  // Update data when timeframe/data changes
  useEffect(() => {
    if (!chartRef.current || !isChartReady) return;
    const chart = chartRef.current as any;
    const lineSeries = chart.__lineSeries;
    const volumeSeries = chart.__volumeSeries;
    if (!lineSeries || !volumeSeries) return;

    if (priceData.length > 0) {
      lineSeries.setData(priceData as any);
    }
    if (volumeData.length > 0) {
      volumeSeries.setData(volumeData as any);
    }

    chartRef.current.timeScale().fitContent();
  }, [priceData, volumeData, isChartReady]);

  return (
    <GlassCard className="h-full flex flex-col" padding="sm">
      {/* Timeframe buttons */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs text-gray-500 font-mono">Price Chart</span>
        <div className="flex gap-1">
          {(Object.keys(TIMEFRAME_CONFIG) as Timeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                'px-2.5 py-1 text-xs font-mono rounded-md transition-all duration-200',
                timeframe === tf
                  ? 'bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/30'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5',
              )}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart container */}
      <div className="flex-1 min-h-0 relative">
        {isLoading && !isChartReady && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center">
              <Skeleton variant="rect" width="100%" height="100%" className="absolute inset-0" />
              <span className="relative text-xs text-gray-500">Loading chart data...</span>
            </div>
          </div>
        )}
        <div
          ref={chartContainerRef}
          className="w-full h-full"
          style={{ minHeight: '300px' }}
        />
      </div>
    </GlassCard>
  );
}
