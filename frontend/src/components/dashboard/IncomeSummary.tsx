'use client';

import { GlassCard, Button } from '@/components/ui';
import { useAffiliate } from '@/hooks/useAffiliate';
import { formatUnits } from 'viem';
import { USDT_DECIMALS } from '@/config/contracts';

const incomeTypes = [
  { key: 'direct', label: 'Direct Commission', color: 'bg-primary-500', bgLight: 'bg-gradient-to-r from-primary-100 to-primary-50', textColor: 'text-primary-700', borderColor: 'border-primary-300/50' },
  { key: 'team', label: 'Team Dividends', color: 'bg-secondary-500', bgLight: 'bg-gradient-to-r from-secondary-100 to-secondary-50', textColor: 'text-secondary-700', borderColor: 'border-secondary-300/50' },
  { key: 'rank', label: 'Rank Salary', color: 'bg-accent-500', bgLight: 'bg-gradient-to-r from-accent-100 to-accent-50', textColor: 'text-accent-700', borderColor: 'border-accent-300/50' },
  { key: 'weekly', label: 'Weekly Qualifier', color: 'bg-success-500', bgLight: 'bg-gradient-to-r from-success-100 to-success-50', textColor: 'text-success-700', borderColor: 'border-success-300/50' },
  { key: 'monthly', label: 'Monthly Qualifier', color: 'bg-warn-500', bgLight: 'bg-gradient-to-r from-warn-100 to-warn-50', textColor: 'text-warn-700', borderColor: 'border-warn-300/50' },
];

export function IncomeSummary() {
  const { allIncome, harvestIncome, isPending } = useAffiliate();

  const incomes = allIncome
    ? [
        Number(formatUnits(BigInt(allIncome[0] || 0), USDT_DECIMALS)),
        Number(formatUnits(BigInt(allIncome[1] || 0), USDT_DECIMALS)),
        Number(formatUnits(BigInt(allIncome[2] || 0), USDT_DECIMALS)),
        Number(formatUnits(BigInt(allIncome[3] || 0), USDT_DECIMALS)),
        Number(formatUnits(BigInt(allIncome[4] || 0), USDT_DECIMALS)),
      ]
    : [0, 0, 0, 0, 0];

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
                Claim
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 pt-5 border-t border-surface-200 flex justify-between items-center">
        <span className="text-base font-semibold text-surface-900">Total Earned</span>
        <span className="font-mono font-bold gradient-text text-2xl">
          ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      </div>
    </GlassCard>
  );
}
