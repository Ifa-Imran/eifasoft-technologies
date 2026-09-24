'use client';

import { GlassCard, Badge } from '@/components/ui';
import { useP2POrderHistory, P2POrderStatus } from '@/hooks/useP2POrderHistory';
import { USDT_DECIMALS, KAIRO_DECIMALS } from '@/config/contracts';
import { formatUnits } from 'viem';
import { shortenAddress } from '@/lib/utils';
import {
  ArrowsRightLeftIcon,
  ShoppingCartIcon,
  TagIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

function StatusBadge({ status }: { status: P2POrderStatus }) {
  const t = useTranslations('p2pHistory');
  const config = {
    Placed: { color: 'text-primary-600 bg-primary-50 border-primary-200', icon: ClockIcon },
    Executed: { color: 'text-success-600 bg-success-50 border-success-200', icon: CheckCircleIcon },
    Canceled: { color: 'text-surface-500 bg-surface-100 border-surface-200', icon: XCircleIcon },
  };
  const { color, icon: Icon } = config[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${color}`}>
      <Icon className="w-3 h-3" />
      {t(status.toLowerCase())}
    </span>
  );
}

export function P2POrderHistory({ address }: { address?: `0x${string}` }) {
  const { history, loading, stats } = useP2POrderHistory(address);
  const t = useTranslations('p2pHistory');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'Placed' | 'Executed' | 'Canceled'>('all');

  const filtered = filter === 'all' ? history : history.filter(h => h.status === filter);

  return (
    <GlassCard>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center shadow-sm shadow-primary-300/30">
            <ArrowsRightLeftIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-surface-900">{t('title')}</h3>
            <p className="text-xs text-surface-400">{t('subtitle')}</p>
          </div>
        </div>
        <Badge tier="cyan">{t('totalOrders', { count: stats.total })}</Badge>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { label: t('placed'), value: stats.placed, color: 'text-primary-600' },
          { label: t('executed'), value: stats.executed, color: 'text-success-600' },
          { label: t('canceled'), value: stats.canceled, color: 'text-surface-500' },
          { label: t('totalTrades'), value: stats.totalTrades, color: 'text-secondary-600' },
        ].map((s, i) => (
          <div key={i} className="p-2 rounded-lg bg-surface-50 border border-surface-100 text-center">
            <p className={`text-lg font-mono font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-surface-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {(['all', 'Placed', 'Executed', 'Canceled'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              filter === f
                ? 'bg-primary-500 text-white shadow-sm'
                : 'bg-surface-100 text-surface-500 hover:bg-surface-200'
            }`}
          >
            {f === 'all' ? t('filterAll') : t(f.toLowerCase())}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-2 text-surface-400 text-sm py-6 justify-center">
          <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          {t('loading')}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-8">
          <ArrowsRightLeftIcon className="w-10 h-10 text-surface-300 mx-auto mb-2" />
          <p className="text-surface-500 text-sm">{t('noOrders')}</p>
          <p className="text-surface-400 text-xs mt-1">{t('noOrdersDesc')}</p>
        </div>
      )}

      {/* Order list */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filtered.map((order) => {
            const isExpanded = expandedOrder === order.id;
            const date = order.createdAt > 0 ? new Date(order.createdAt * 1000) : null;
            return (
              <div
                key={order.id}
                className={`rounded-xl border transition-all ${
                  order.type === 'buy'
                    ? 'bg-success-50/30 border-success-100'
                    : 'bg-danger-50/30 border-danger-100'
                }`}
              >
                {/* Order summary row */}
                <button
                  onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                  className="w-full flex items-center justify-between p-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      order.type === 'buy'
                        ? 'bg-success-100 text-success-600'
                        : 'bg-danger-100 text-danger-600'
                    }`}>
                      {order.type === 'buy'
                        ? <ShoppingCartIcon className="w-4 h-4" />
                        : <TagIcon className="w-4 h-4" />
                      }
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-surface-500 uppercase">
                          {order.type}
                        </span>
                        <span className="text-sm font-mono font-bold text-surface-900">
                          {order.type === 'buy' ? `$${order.originalAmount}` : `${order.originalAmount} KAIRO`}
                        </span>
                      </div>
                      <p className="text-[10px] text-surface-400">
                        #{order.id} &middot; {date ? date.toLocaleDateString() + ' ' + date.toLocaleTimeString() : '--'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={order.status} />
                    {order.trades.length > 0 && (
                      <span className="text-[10px] text-surface-400 font-mono">
                        {order.trades.length} {t('trade', { count: order.trades.length })}
                      </span>
                    )}
                    {isExpanded
                      ? <ChevronUpIcon className="w-4 h-4 text-surface-400" />
                      : <ChevronDownIcon className="w-4 h-4 text-surface-400" />
                    }
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-3 border-t border-surface-100 pt-3">
                    {/* Order details */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-white/60 border border-surface-100 text-center">
                        <p className="text-surface-400 text-[10px]">{t('originalAmount')}</p>
                        <p className="font-mono font-semibold text-surface-900">
                          {order.type === 'buy' ? `$${order.originalAmount}` : `${order.originalAmount} KAIRO`}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-white/60 border border-surface-100 text-center">
                        <p className="text-surface-400 text-[10px]">{t('filledAmount')}</p>
                        <p className="font-mono font-semibold text-success-600">
                          {order.type === 'buy' ? `$${order.filledAmount}` : `${order.filledAmount} KAIRO`}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-white/60 border border-surface-100 text-center">
                        <p className="text-surface-400 text-[10px]">{t('remainingAmount')}</p>
                        <p className="font-mono font-semibold text-surface-700">
                          {order.type === 'buy' ? `$${order.remainingAmount}` : `${order.remainingAmount} KAIRO`}
                        </p>
                      </div>
                    </div>

                    {/* Fill progress bar */}
                    {Number(order.originalAmount) > 0 && (
                      <div>
                        <div className="flex justify-between text-[10px] text-surface-400 mb-1">
                          <span>{t('fillProgress')}</span>
                          <span>
                            {((Number(order.filledAmount) / Number(order.originalAmount)) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              order.status === 'Canceled' ? 'bg-surface-400' : 'bg-success-500'
                            }`}
                            style={{ width: `${Math.min((Number(order.filledAmount) / Number(order.originalAmount)) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Trade execution history */}
                    {order.trades.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-surface-600 mb-2">{t('executionHistory')}</p>
                        <div className="space-y-1.5">
                          {order.trades.map((trade, ti) => {
                            const tradeDate = trade.executedAt > 0 ? new Date(trade.executedAt * 1000) : null;
                            const kairoAmt = Number(formatUnits(trade.kairoAmount, KAIRO_DECIMALS));
                            const usdtAmt = Number(formatUnits(trade.usdtAmount, USDT_DECIMALS));
                            const priceVal = Number(formatUnits(trade.price, USDT_DECIMALS));
                            return (
                              <div
                                key={ti}
                                className="flex items-center justify-between p-2 rounded-lg bg-white/60 border border-surface-100 text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${
                                    trade.role === 'buyer' ? 'bg-success-500' : 'bg-danger-500'
                                  }`}>
                                    {trade.role === 'buyer' ? 'B' : 'S'}
                                  </div>
                                  <div>
                                    <p className="font-mono font-semibold text-surface-900">
                                      {kairoAmt.toFixed(2)} KAIRO &harr; ${usdtAmt.toFixed(2)}
                                    </p>
                                    <p className="text-[10px] text-surface-400">
                                      {tradeDate ? tradeDate.toLocaleString() : '--'} &middot; {t('asRole', { role: t(trade.role === 'buyer' ? 'roleBuyer' : 'roleSeller') })} &middot; {t('price')}: ${priceVal.toFixed(2)}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[10px] text-surface-400 font-mono">
                                  {shortenAddress(trade.counterparty)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {order.trades.length === 0 && order.status === 'Placed' && (
                      <p className="text-xs text-surface-400 text-center py-2">{t('noTradesYet')}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
