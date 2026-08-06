'use client';

import { GlassCard, StatCard, ProgressBar } from '@/components/ui';
import { useGlobalStats } from '@/hooks/useGlobalStats';
import { useKairoPrice } from '@/hooks/useKairoPrice';
import { USDT_DECIMALS, KAIRO_DECIMALS } from '@/config/contracts';
import { formatUnits } from 'viem';
import { formatPrice, formatCompact } from '@/lib/utils';
import {
  FireIcon,
  BanknotesIcon,
  CurrencyDollarIcon,
  CubeIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';

export default function AnalyticsPage() {
  const t = useTranslations('analytics');
  const { tvlFormatted, totalBurnedFormatted, totalSupplyFormatted, effectiveSupplyFormatted, socialLockFormatted, poolBalances } = useGlobalStats();
  const { price } = useKairoPrice();
  const marketCap = price * Number(totalSupplyFormatted);

  // Pool balances — getBalances() returns (usdtBalance, kairoBalance)
  const poolUsdt = poolBalances ? Number(formatUnits(BigInt(poolBalances[0] || 0), USDT_DECIMALS)) : 0;
  const poolKairo = poolBalances ? Number(formatUnits(BigInt(poolBalances[1] || 0), KAIRO_DECIMALS)) : 0;

  const totalBurnedNum = Number(totalBurnedFormatted);
  const totalSupplyNum = Number(totalSupplyFormatted);
  const effectiveSupplyNum = Number(effectiveSupplyFormatted);
  const socialLockNum = Number(socialLockFormatted);
  const burnPercent = totalSupplyNum > 0 ? (totalBurnedNum / (totalSupplyNum + totalBurnedNum)) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-orbitron font-bold gradient-text">{t('title')}</h1>
        <p className="text-base text-surface-500 mt-1">{t('subtitle')}</p>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('kairoPrice')}
          value={formatPrice(price)}
          prefix="$"
          icon={<CurrencyDollarIcon className="w-5 h-5" />}
          gradient="cyan"
        />
        <StatCard
          label={t('marketCap')}
          value={formatCompact(marketCap, 2)}
          prefix="$"
          icon={<ArrowTrendingUpIcon className="w-5 h-5" />}
          gradient="purple"
        />
        <StatCard
          label={t('poolLiquidityUsdt')}
          value={formatCompact(Number(tvlFormatted), 2)}
          prefix="$"
          icon={<BanknotesIcon className="w-5 h-5" />}
          gradient="gold"
        />
        <StatCard
          label={t('totalBurned')}
          value={formatCompact(totalBurnedNum, 2)}
          suffix=" KAIRO"
          icon={<FireIcon className="w-5 h-5" />}
          gradient="success"
        />
      </div>

      {/* Supply & Liquidity Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard variant="gradient">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-danger-400 to-danger-300 flex items-center justify-center shadow-md shadow-danger-300/30">
              <FireIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-surface-900">{t('tokenSupply')}</h3>
              <p className="text-xs text-surface-500">{t('deflationaryNote')}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-white/70 to-primary-50/30 border border-primary-100/50">
                <p className="text-[10px] uppercase tracking-wider text-surface-400">{t('circulating')}</p>
                <p className="text-lg font-mono font-bold text-surface-900">{formatCompact(totalSupplyNum - socialLockNum, 2)}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-danger-100/60 to-danger-50/40 border border-danger-200/50">
                <p className="text-[10px] uppercase tracking-wider text-danger-400">{t('burned')}</p>
                <p className="text-lg font-mono font-bold text-danger-600">{formatCompact(totalBurnedNum, 2)}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-secondary-100/60 to-secondary-50/40 border border-secondary-200/50">
                <p className="text-[10px] uppercase tracking-wider text-secondary-400">{t('effectiveSupply')}</p>
                <p className="text-lg font-mono font-bold text-secondary-600">{formatCompact(effectiveSupplyNum, 2)}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-accent-100/60 to-accent-50/40 border border-accent-200/50">
                <p className="text-[10px] uppercase tracking-wider text-accent-400">{t('socialLock')}</p>
                <p className="text-lg font-mono font-bold text-accent-600">{formatCompact(socialLockNum, 2)}</p>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-surface-500 mb-1">
                <span>{t('burnRate')}</span>
                <span className="font-mono">{burnPercent.toFixed(2)}%</span>
              </div>
              <ProgressBar value={burnPercent} max={100} variant="gold" size="sm" />
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-success-400 to-success-300 flex items-center justify-center shadow-md shadow-success-300/30">
              <CubeIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-surface-900">{t('liquidityPool')}</h3>
              <p className="text-xs text-surface-500">{t('dexPoolComposition')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary-50/60 to-white border border-primary-100/50 text-center">
              <p className="text-[10px] uppercase tracking-wider text-surface-400">{t('kairoInPool')}</p>
              <p className="text-lg font-mono font-bold text-primary-700">{formatCompact(poolKairo, 2)}</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-success-50/60 to-white border border-success-100/50 text-center">
              <p className="text-[10px] uppercase tracking-wider text-surface-400">{t('usdtInPool')}</p>
              <p className="text-lg font-mono font-bold text-success-700">${formatCompact(poolUsdt, 2)}</p>
            </div>
          </div>
          {totalSupplyNum > 0 && (
            <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-surface-50 to-primary-50/30 border border-surface-200 text-center">
              <p className="text-[10px] uppercase tracking-wider text-surface-400">{t('pricePerSupply')}</p>
              <p className="text-lg font-mono font-bold text-surface-900">${(poolUsdt / totalSupplyNum).toFixed(6)}</p>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
