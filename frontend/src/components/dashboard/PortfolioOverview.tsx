'use client';

import { StatCard } from '@/components/ui';
import { useTokenBalances } from '@/hooks/useTokenBalances';
import { useUserStakes } from '@/hooks/useUserStakes';
import { useKairoPrice } from '@/hooks/useKairoPrice';
import { useGlobalStats } from '@/hooks/useGlobalStats';
import { USDT_DECIMALS } from '@/config/contracts';
import { formatUnits } from 'viem';
import { formatPrice, formatCompact } from '@/lib/utils';
import {
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  GiftIcon,
  CircleStackIcon,
  BeakerIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

export function PortfolioOverview() {
  const { kairoFormatted } = useTokenBalances();
  const { totalStaked, totalHarvestable, activeStakes } = useUserStakes();
  const { price } = useKairoPrice();
  const { tvlFormatted, totalSupplyFormatted } = useGlobalStats();

  const kairoUsd = Number(kairoFormatted) * price;
  const stakedUsd = totalStaked ? Number(formatUnits(totalStaked, USDT_DECIMALS)) : 0;
  const harvestableUsd = totalHarvestable ? Number(formatUnits(totalHarvestable, USDT_DECIMALS)) : 0;
  const totalPortfolioUsd = kairoUsd + stakedUsd;

  // Pool liquidity = actual USDT balance in pool (from useGlobalStats)
  const poolUsdt = Number(tvlFormatted);

  // Total circulation
  const totalCirculation = Number(totalSupplyFormatted);

  return (
    <div className="space-y-4">
      {/* Total portfolio value */}
      <div className="card p-8 bg-gradient-to-r from-primary-100/80 via-secondary-50/60 to-accent-50/40 !border-2 !border-primary-300/60 shadow-[0_12px_40px_-8px_rgba(6,182,212,0.2)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-primary-600 mb-2 uppercase tracking-wider font-semibold">Total Portfolio Value</p>
            <p className="text-4xl lg:text-5xl font-mono font-bold gradient-text">
              ${formatCompact(totalPortfolioUsd, 2)}
            </p>
          </div>
          <div className="text-right">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center shadow-xl shadow-primary-400/30 mb-2">
              <span className="text-2xl font-orbitron font-bold text-white">{activeStakes.length}</span>
            </div>
            <p className="text-xs text-surface-400">Active Stakes</p>
          </div>
        </div>
      </div>

      {/* Stat cards - personal */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="KAIRO Balance"
          value={Number(kairoFormatted).toLocaleString('en-US', { maximumFractionDigits: 2 })}
          suffix=" KAIRO"
          icon={<CurrencyDollarIcon className="w-5 h-5" />}
          gradient="cyan"
        />
        <StatCard
          label="Total Staked"
          value={stakedUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          prefix="$"
          icon={<ArrowTrendingUpIcon className="w-5 h-5" />}
          gradient="purple"
        />
        <StatCard
          label="Harvestable"
          value={harvestableUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          prefix="$"
          icon={<GiftIcon className="w-5 h-5" />}
          gradient="gold"
        />
      </div>

      {/* Protocol stats - Token Price, Liquidity, Total Circulation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="KAIRO Price"
          value={formatPrice(price)}
          prefix="$"
          icon={<ChartBarIcon className="w-5 h-5" />}
          gradient="cyan"
        />
        <StatCard
          label="Pool Liquidity"
          value={formatCompact(poolUsdt, 2)}
          prefix="$"
          icon={<BeakerIcon className="w-5 h-5" />}
          gradient="purple"
        />
        <StatCard
          label="Total Circulation"
          value={formatCompact(totalCirculation, 0)}
          suffix=" KAIRO"
          icon={<CircleStackIcon className="w-5 h-5" />}
          gradient="gold"
        />
      </div>
    </div>
  );
}
