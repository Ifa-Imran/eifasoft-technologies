'use client';

import { GlassCard, Button } from '@/components/ui';
import { useAffiliate } from '@/hooks/useAffiliate';
import { useUserStakes } from '@/hooks/useUserStakes';
import { formatUnits } from 'viem';
import { USDT_DECIMALS } from '@/config/contracts';

const incomeTypes = [
  { key: 'direct', label: 'Direct Commission', color: 'bg-primary-500', bgLight: 'bg-gradient-to-r from-primary-100 to-primary-50', textColor: 'text-primary-700', borderColor: 'border-primary-300/50' },
  { key: 'team', label: 'Team Dividends', color: 'bg-secondary-500', bgLight: 'bg-gradient-to-r from-secondary-100 to-secondary-50', textColor: 'text-secondary-700', borderColor: 'border-secondary-300/50' },
  { key: 'rank', label: 'Rank Salary', color: 'bg-accent-500', bgLight: 'bg-gradient-to-r from-accent-100 to-accent-50', textColor: 'text-accent-700', borderColor: 'border-accent-300/50' },
];

export function IncomeSummary() {
  const { allIncome, harvestIncome, lifetimeHarvested, isPending } = useAffiliate();
  const { totalHarvestedRewards, tierGroups } = useUserStakes();

  const incomes = allIncome
    ? [
        Number(formatUnits(BigInt(allIncome[0] || 0), USDT_DECIMALS)),
        Number(formatUnits(BigInt(allIncome[1] || 0), USDT_DECIMALS)),
        Number(formatUnits(BigInt(allIncome[2] || 0), USDT_DECIMALS)),
      ]
    : [0, 0, 0];

  const total = incomes.reduce((a, b) => a + b, 0);

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-surface-900">Income Summary</h3>
        <span className="text-xs text-surface-400 font-mono">{incomeTypes.length} types</span>
      </div>
      <div className="space-y-3">
        {incomeTypes.map((type, i) => (
          <div key={type.key} className={`flex items-center justify-between p-3 rounded-xl ${type.bgLight} border-2 ${type.borderColor}`}>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${type.color}`} />
              <span className="text-sm font-medium text-surface-700">{type.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`font-mono text-base font-bold ${type.textColor}`}>
                ${incomes[i].toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => harvestIncome(i)}
                disabled={incomes[i] <= 0 || isPending}
                className="text-xs"
              >
                Harvest
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 pt-5 border-t border-surface-200">
        <div className="flex justify-between items-center mb-3">
          <span className="text-base font-semibold text-surface-900">Pending Harvest</span>
          <span className="font-mono font-bold gradient-text text-2xl">
            ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
        {lifetimeHarvested && lifetimeHarvested.total > 0n && (
          <div className="p-3 rounded-xl bg-gradient-to-r from-success-50 to-accent-50 border border-success-200/60">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-surface-700">Affiliate Harvested</span>
              <span className="font-mono font-bold text-success-700 text-base">{lifetimeHarvested.totalFormatted}</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              {lifetimeHarvested.direct > 0n && (
                <div className="flex justify-between"><span className="text-surface-500">Direct</span><span className="font-mono text-surface-600">${Number(formatUnits(lifetimeHarvested.direct, USDT_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
              )}
              {lifetimeHarvested.team > 0n && (
                <div className="flex justify-between"><span className="text-surface-500">Team</span><span className="font-mono text-surface-600">${Number(formatUnits(lifetimeHarvested.team, USDT_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
              )}
              {lifetimeHarvested.rank > 0n && (
                <div className="flex justify-between"><span className="text-surface-500">Rank</span><span className="font-mono text-surface-600">${Number(formatUnits(lifetimeHarvested.rank, USDT_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
              )}
            </div>
          </div>
        )}
        {/* Staking Earned summary */}
        {(totalHarvestedRewards > 0n || tierGroups.some(tg => tg.displayHarvestable > 0n)) && (
          <div className="p-3 rounded-xl bg-gradient-to-r from-primary-50 to-secondary-50 border border-primary-200/60">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-surface-700">Staking Earnings</span>
              <span className="font-mono font-bold text-primary-700 text-base">
                ${Number(formatUnits(totalHarvestedRewards + tierGroups.reduce((s, tg) => s + tg.displayHarvestable, 0n), USDT_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <div className="flex justify-between"><span className="text-surface-500">Harvested</span><span className="font-mono text-surface-600">${Number(formatUnits(totalHarvestedRewards, USDT_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between"><span className="text-surface-500">Harvestable</span><span className="font-mono text-surface-600">${Number(formatUnits(tierGroups.reduce((s, tg) => s + tg.displayHarvestable, 0n), USDT_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
