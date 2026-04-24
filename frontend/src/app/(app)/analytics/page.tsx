'use client';

import { GlassCard, StatCard, ProgressBar } from '@/components/ui';
import { useGlobalStats } from '@/hooks/useGlobalStats';
import { useKairoPrice } from '@/hooks/useKairoPrice';
import { useCMS } from '@/hooks/useCMS';
import { USDT_DECIMALS, KAIRO_DECIMALS, CMS_MAX_SUBSCRIPTIONS } from '@/config/contracts';
import { formatUnits } from 'viem';
import { formatPrice, formatCompact } from '@/lib/utils';
import {
  FireIcon,
  BanknotesIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  CubeIcon,
  ArrowTrendingUpIcon,
  ArrowsRightLeftIcon,
  TicketIcon,
  CircleStackIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

export default function AnalyticsPage() {
  const { tvlFormatted, totalBurnedFormatted, totalSupplyFormatted, effectiveSupplyFormatted, socialLockFormatted, swapStats, globalCap, orderBookStats, p2pLiquidity, poolBalances } = useGlobalStats();
  const { price } = useKairoPrice();
  const { totalSubscriptions, remainingSubscriptions } = useCMS();
  const marketCap = price * Number(totalSupplyFormatted);

  // Parse swap stats
  const totalSwaps = swapStats ? Number(swapStats[0] || 0) : 0;
  const totalSwappedKairo = swapStats ? Number(formatUnits(BigInt(swapStats[1] || 0), KAIRO_DECIMALS)) : 0;
  const totalSwappedUsdt = swapStats ? Number(formatUnits(BigInt(swapStats[2] || 0), USDT_DECIMALS)) : 0;
  const totalFees = swapStats ? Number(formatUnits(BigInt(swapStats[3] || 0), USDT_DECIMALS)) : 0;

  // Parse global cap
  const globalTotalStaked = globalCap ? Number(formatUnits(BigInt(globalCap[0] || 0), USDT_DECIMALS)) : 0;
  const globalTotalPaid = globalCap ? Number(formatUnits(BigInt(globalCap[1] || 0), USDT_DECIMALS)) : 0;
  const globalCapLimit = globalCap ? Number(formatUnits(BigInt(globalCap[2] || 0), USDT_DECIMALS)) : 0;

  // Parse P2P order book stats [totalBuyOrders, totalSellOrders, filledTrades, totalVolume]
  const p2pTotalBuys = orderBookStats ? Number(orderBookStats[0] || 0) : 0;
  const p2pTotalSells = orderBookStats ? Number(orderBookStats[1] || 0) : 0;
  const p2pFilledTrades = orderBookStats ? Number(orderBookStats[2] || 0) : 0;
  const p2pTotalVolume = orderBookStats ? Number(formatUnits(BigInt(orderBookStats[3] || 0), USDT_DECIMALS)) : 0;
  const p2pLockedLiquidity = p2pLiquidity ? Number(formatUnits(BigInt(p2pLiquidity[0] || 0), USDT_DECIMALS)) + Number(formatUnits(BigInt(p2pLiquidity[1] || 0), KAIRO_DECIMALS)) * price : 0;

  // Pool balances
  const poolKairo = poolBalances ? Number(formatUnits(BigInt(poolBalances[0] || 0), KAIRO_DECIMALS)) : 0;
  const poolUsdt = poolBalances ? Number(formatUnits(BigInt(poolBalances[1] || 0), USDT_DECIMALS)) : 0;

  const totalBurnedNum = Number(totalBurnedFormatted);
  const totalSupplyNum = Number(totalSupplyFormatted);
  const effectiveSupplyNum = Number(effectiveSupplyFormatted);
  const socialLockNum = Number(socialLockFormatted);
  const burnPercent = totalSupplyNum > 0 ? (totalBurnedNum / (totalSupplyNum + totalBurnedNum)) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-orbitron font-bold gradient-text">Protocol Analytics</h1>
        <p className="text-base text-surface-500 mt-1">Real-time KAIRO ecosystem statistics</p>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="KAIRO Price"
          value={formatPrice(price)}
          prefix="$"
          icon={<CurrencyDollarIcon className="w-5 h-5" />}
          gradient="cyan"
        />
        <StatCard
          label="Market Cap"
          value={formatCompact(marketCap, 2)}
          prefix="$"
          icon={<ArrowTrendingUpIcon className="w-5 h-5" />}
          gradient="purple"
        />
        <StatCard
          label="Pool Liquidity (USDT)"
          value={formatCompact(Number(tvlFormatted), 2)}
          prefix="$"
          icon={<BanknotesIcon className="w-5 h-5" />}
          gradient="gold"
        />
        <StatCard
          label="Total Burned"
          value={formatCompact(totalBurnedNum, 2)}
          suffix=" KAIRO"
          icon={<FireIcon className="w-5 h-5" />}
          gradient="success"
        />
      </div>

      {/* Supply & Burn Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard variant="gradient">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-danger-400 to-danger-300 flex items-center justify-center shadow-md shadow-danger-300/30">
              <FireIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-surface-900">Token Supply</h3>
              <p className="text-xs text-surface-500">Deflationary mechanics via burn</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-white/70 to-primary-50/30 border border-primary-100/50">
                <p className="text-[10px] uppercase tracking-wider text-surface-400">Circulating</p>
                <p className="text-lg font-mono font-bold text-surface-900">{formatCompact(totalSupplyNum, 2)}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-danger-100/60 to-danger-50/40 border border-danger-200/50">
                <p className="text-[10px] uppercase tracking-wider text-danger-400">Burned</p>
                <p className="text-lg font-mono font-bold text-danger-600">{formatCompact(totalBurnedNum, 2)}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-secondary-100/60 to-secondary-50/40 border border-secondary-200/50">
                <p className="text-[10px] uppercase tracking-wider text-secondary-400">Effective Supply</p>
                <p className="text-lg font-mono font-bold text-secondary-600">{formatCompact(effectiveSupplyNum, 2)}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-accent-100/60 to-accent-50/40 border border-accent-200/50">
                <p className="text-[10px] uppercase tracking-wider text-accent-400">Social Lock</p>
                <p className="text-lg font-mono font-bold text-accent-600">{formatCompact(socialLockNum, 2)}</p>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-surface-500 mb-1">
                <span>Burn Rate</span>
                <span className="font-mono">{burnPercent.toFixed(2)}%</span>
              </div>
              <ProgressBar value={burnPercent} max={100} variant="gold" size="sm" />
            </div>
          </div>
        </GlassCard>

        {/* Staking Global Cap */}
        <GlassCard variant="gradient">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-300 flex items-center justify-center shadow-md shadow-primary-300/30">
              <CircleStackIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-surface-900">Global Staking</h3>
              <p className="text-xs text-surface-500">3X FIFO cap system</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-white/70 to-primary-50/30 border border-primary-100/50 text-center">
                <p className="text-[10px] uppercase tracking-wider text-surface-400">Staked</p>
                <p className="text-lg font-mono font-bold text-surface-900">${formatCompact(globalTotalStaked, 2)}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-success-100/60 to-success-50/40 border border-success-200/50 text-center">
                <p className="text-[10px] uppercase tracking-wider text-surface-400">Paid Out</p>
                <p className="text-lg font-mono font-bold text-success-600">${formatCompact(globalTotalPaid, 2)}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-accent-100/60 to-accent-50/40 border border-accent-200/50 text-center">
                <p className="text-[10px] uppercase tracking-wider text-surface-400">3X Cap</p>
                <p className="text-lg font-mono font-bold text-accent-600">${formatCompact(globalCapLimit, 2)}</p>
              </div>
            </div>
            {globalCapLimit > 0 && (
              <div>
                <div className="flex justify-between text-xs text-surface-500 mb-1">
                  <span>Global Cap Progress</span>
                  <span className="font-mono">{((globalTotalPaid / globalCapLimit) * 100).toFixed(2)}%</span>
                </div>
                <ProgressBar value={globalTotalPaid} max={globalCapLimit} variant="cyan" size="sm" />
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* DEX & CMS Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-secondary-400 to-secondary-300 flex items-center justify-center shadow-md shadow-secondary-300/30">
              <ArrowsRightLeftIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-surface-900">DEX Statistics</h3>
              <p className="text-xs text-surface-500">One-way swap (KAIRO → USDT)</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary-50/60 to-white border border-primary-100/50">
              <p className="text-[10px] uppercase tracking-wider text-surface-400">Total Swaps</p>
              <p className="text-lg font-mono font-bold text-primary-700">{formatCompact(totalSwaps, 2)}</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-secondary-50/60 to-white border border-secondary-100/50">
              <p className="text-[10px] uppercase tracking-wider text-surface-400">KAIRO Swapped</p>
              <p className="text-lg font-mono font-bold text-secondary-700">{formatCompact(totalSwappedKairo, 2)}</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-success-50/60 to-white border border-success-100/50">
              <p className="text-[10px] uppercase tracking-wider text-surface-400">USDT Volume</p>
              <p className="text-lg font-mono font-bold text-success-700">${formatCompact(totalSwappedUsdt, 2)}</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-accent-100/60 to-accent-50/40 border border-accent-200/50">
              <p className="text-[10px] uppercase tracking-wider text-surface-400">Fees Earned</p>
              <p className="text-lg font-mono font-bold text-accent-600">${formatCompact(totalFees, 2)}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-400 to-accent-300 flex items-center justify-center shadow-md shadow-accent-300/30">
              <TicketIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-surface-900">CMS Membership</h3>
              <p className="text-xs text-surface-500">Limited to {CMS_MAX_SUBSCRIPTIONS.toLocaleString()} total</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-accent-50/60 to-white border border-accent-100/50">
                <p className="text-[10px] uppercase tracking-wider text-surface-400">Total Sold</p>
                <p className="text-lg font-mono font-bold text-surface-900">{totalSubscriptions.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary-100/60 to-primary-50/40 border border-primary-200/50">
                <p className="text-[10px] uppercase tracking-wider text-surface-400">Remaining</p>
                <p className="text-lg font-mono font-bold text-primary-600">{remainingSubscriptions.toLocaleString()}</p>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-surface-500 mb-1">
                <span>Subscription Progress</span>
                <span className="font-mono">{CMS_MAX_SUBSCRIPTIONS > 0 ? ((totalSubscriptions / CMS_MAX_SUBSCRIPTIONS) * 100).toFixed(2) : 0}%</span>
              </div>
              <ProgressBar value={totalSubscriptions} max={CMS_MAX_SUBSCRIPTIONS} variant="purple" size="sm" />
            </div>
          </div>
        </GlassCard>
      </div>

      {/* P2P Exchange & Pool Balances */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center shadow-md shadow-primary-300/30">
              <ArrowsRightLeftIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-surface-900">P2P Exchange</h3>
              <p className="text-xs text-surface-500">Atomic peer-to-peer trading</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-success-50/60 to-white border border-success-100/50">
              <p className="text-[10px] uppercase tracking-wider text-surface-400">Buy Orders</p>
              <p className="text-lg font-mono font-bold text-success-700">{p2pTotalBuys}</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-danger-50/60 to-white border border-danger-100/50">
              <p className="text-[10px] uppercase tracking-wider text-surface-400">Sell Orders</p>
              <p className="text-lg font-mono font-bold text-danger-700">{p2pTotalSells}</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary-50/60 to-white border border-primary-100/50">
              <p className="text-[10px] uppercase tracking-wider text-surface-400">Filled Trades</p>
              <p className="text-lg font-mono font-bold text-primary-700">{p2pFilledTrades}</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-accent-100/60 to-accent-50/40 border border-accent-200/50">
              <p className="text-[10px] uppercase tracking-wider text-surface-400">P2P Volume</p>
              <p className="text-lg font-mono font-bold text-accent-600">${formatCompact(p2pTotalVolume, 2)}</p>
            </div>
          </div>
          {p2pLockedLiquidity > 0 && (
            <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-primary-100/50 to-secondary-100/50 border border-primary-200/50 text-center">
              <p className="text-[10px] uppercase tracking-wider text-surface-400">Locked Liquidity (P2P)</p>
              <p className="text-lg font-mono font-bold text-primary-700">${formatCompact(p2pLockedLiquidity, 2)}</p>
            </div>
          )}
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-success-400 to-success-300 flex items-center justify-center shadow-md shadow-success-300/30">
              <CubeIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-surface-900">Liquidity Pool</h3>
              <p className="text-xs text-surface-500">DEX pool composition</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary-50/60 to-white border border-primary-100/50 text-center">
              <p className="text-[10px] uppercase tracking-wider text-surface-400">KAIRO in Pool</p>
              <p className="text-lg font-mono font-bold text-primary-700">{formatCompact(poolKairo, 2)}</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-success-50/60 to-white border border-success-100/50 text-center">
              <p className="text-[10px] uppercase tracking-wider text-surface-400">USDT in Pool</p>
              <p className="text-lg font-mono font-bold text-success-700">${formatCompact(poolUsdt, 2)}</p>
            </div>
          </div>
          {totalSupplyNum > 0 && (
            <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-surface-50 to-primary-50/30 border border-surface-200 text-center">
              <p className="text-[10px] uppercase tracking-wider text-surface-400">Price (USDT / Total Supply)</p>
              <p className="text-lg font-mono font-bold text-surface-900">${(poolUsdt / totalSupplyNum).toFixed(6)}</p>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
