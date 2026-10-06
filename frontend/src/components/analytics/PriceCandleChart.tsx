'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createChart, CandlestickSeries, ColorType, CrosshairMode, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import { ChartBarIcon } from '@heroicons/react/24/outline';
import { GlassCard } from '@/components/ui';
import { usePriceHistory, type PricePoint } from '@/hooks/usePriceHistory';
import { useTranslations } from 'next-intl';

interface Candle {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Interval {
  label: string;
  /** Candle width in seconds */
  sec: number;
  /** How far back (in seconds) to render candles for this interval */
  windowSec: number;
}

// Time-based candle presets. windowSec keeps the bucket count sane for
// sparse histories (the pool only snapshots on swaps/fee events).
// Range views (1M/3M/6M/1Y) widen the candle interval so each range fits
// a readable number of candles; they fill in progressively as on-chain
// snapshot history accumulates.
const INTERVALS: Interval[] = [
  { label: '15m', sec: 15 * 60, windowSec: 3 * 24 * 3600 },
  { label: '1H', sec: 60 * 60, windowSec: 14 * 24 * 3600 },
  { label: '4H', sec: 4 * 60 * 60, windowSec: 60 * 24 * 3600 },
  { label: '1D', sec: 24 * 60 * 60, windowSec: 365 * 24 * 3600 },
  { label: '1M', sec: 6 * 60 * 60, windowSec: 30 * 24 * 3600 },
  { label: '3M', sec: 12 * 60 * 60, windowSec: 90 * 24 * 3600 },
  { label: '6M', sec: 24 * 60 * 60, windowSec: 180 * 24 * 3600 },
  { label: '1Y', sec: 3 * 24 * 3600, windowSec: 365 * 24 * 3600 },
];

const UP_COLOR = '#10b981';
const DOWN_COLOR = '#f43f5e';

/**
 * Bucket raw price points into OHLC candles for the given interval.
 * Buckets without ticks are forward-filled (the price genuinely does not
 * change between on-chain snapshots), so the chart stays continuous.
 */
function buildCandles(points: PricePoint[], interval: Interval, nowSec: number): Candle[] {
  if (points.length === 0) return [];

  const lastBucket = Math.floor(nowSec / interval.sec) * interval.sec;
  const firstPointBucket = Math.floor(points[0].time / interval.sec) * interval.sec;
  const firstBucket = Math.max(firstPointBucket, lastBucket - interval.windowSec);

  const byBucket = new Map<number, number[]>();
  for (const p of points) {
    const b = Math.floor(p.time / interval.sec) * interval.sec;
    if (b < firstBucket) continue;
    const arr = byBucket.get(b);
    if (arr) arr.push(p.price);
    else byBucket.set(b, [p.price]);
  }

  // Seed prevClose with the last price before the window so the first
  // rendered candle connects to history instead of floating.
  let prevClose = points[0].price;
  for (const p of points) {
    if (Math.floor(p.time / interval.sec) * interval.sec < firstBucket) prevClose = p.price;
    else break;
  }

  const candles: Candle[] = [];
  for (let b = firstBucket; b <= lastBucket; b += interval.sec) {
    const ticks = byBucket.get(b);
    if (ticks && ticks.length > 0) {
      const open = ticks[0];
      const close = ticks[ticks.length - 1];
      candles.push({
        time: b as UTCTimestamp,
        open,
        high: Math.max(open, close, ...ticks),
        low: Math.min(open, close, ...ticks),
        close,
      });
      prevClose = close;
    } else {
      candles.push({ time: b as UTCTimestamp, open: prevClose, high: prevClose, low: prevClose, close: prevClose });
    }
  }
  return candles;
}

interface PriceCandleChartProps {
  /** Live price (from useKairoPrice) merged into the forming candle */
  livePrice?: number;
}

export function PriceCandleChart({ livePrice }: PriceCandleChartProps) {
  const t = useTranslations('analytics');
  const { points, isLoading } = usePriceHistory();
  const [intervalIdx, setIntervalIdx] = useState(1); // default 1H
  const interval = INTERVALS[intervalIdx];

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  // Merge the live price as the newest tick so the forming candle tracks
  // the 5s-refreshing on-chain price between snapshot refetches.
  const mergedPoints = useMemo<PricePoint[]>(() => {
    if (!livePrice || livePrice <= 0) return points;
    const now = Math.floor(Date.now() / 1000);
    const last = points[points.length - 1];
    if (last && now - last.time < 5) {
      // Avoid a duplicate tick right on top of the latest snapshot
      return [...points.slice(0, -1), { time: now, price: livePrice }];
    }
    return [...points, { time: now, price: livePrice }];
  }, [points, livePrice]);

  const candles = useMemo(
    () => buildCandles(mergedPoints, interval, Date.now() / 1000),
    // Re-bucket when points/interval/livePrice change (Date.now is intentional
    // live-tick noise, not a dependency).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mergedPoints, interval, livePrice]
  );

  // Create the chart once on mount.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.08)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.08)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(148, 163, 184, 0.4)', labelBackgroundColor: '#0ea5e9' },
        horzLine: { color: 'rgba(148, 163, 184, 0.4)', labelBackgroundColor: '#0ea5e9' },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
        barSpacing: 8,
      },
      autoSize: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      borderUpColor: UP_COLOR,
      borderDownColor: DOWN_COLOR,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
      priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
    });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Feed candles into the series whenever they change.
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || candles.length === 0) return;
    series.setData(candles);
    // Keep the newest ~140 candles in view when the dataset grows beyond it.
    const visibleFrom = Math.max(0, candles.length - 140);
    chart?.timeScale().setVisibleLogicalRange({
      from: visibleFrom,
      to: candles.length - 1 + 4,
    });
  }, [candles]);

  const showSkeleton = isLoading && points.length === 0;
  const showEmpty = !isLoading && points.length === 0;

  return (
    <GlassCard>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-300 flex items-center justify-center shadow-md shadow-primary-300/30">
            <ChartBarIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-surface-900">{t('priceChart')}</h3>
            <p className="text-xs text-surface-500">{t('priceChartSubtitle')}</p>
          </div>
        </div>

        {/* Timeframe selector */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-100/80 border border-surface-200 self-start sm:self-auto max-w-full overflow-x-auto">
          {INTERVALS.map((iv, idx) => (
            <button
              key={iv.label}
              onClick={() => setIntervalIdx(idx)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                idx === intervalIdx
                  ? 'bg-white text-primary-600 shadow-sm border border-primary-100'
                  : 'text-surface-500 hover:text-surface-700'
              }`}
            >
              {iv.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative h-[340px] sm:h-[400px]">
        <div ref={containerRef} className="absolute inset-0" />
        {showSkeleton && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/40 rounded-xl">
            <div className="flex items-center gap-2 text-sm text-surface-500">
              <span className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
              {t('chartLoading')}
            </div>
          </div>
        )}
        {showEmpty && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/40 rounded-xl">
            <p className="text-sm text-surface-500">{t('chartNoData')}</p>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
