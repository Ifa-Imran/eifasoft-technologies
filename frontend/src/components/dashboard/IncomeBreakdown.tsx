'use client';

import {
  CurrencyDollarIcon,
  UserGroupIcon,
  TrophyIcon,
  CalendarDaysIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface IncomeBreakdownProps {
  direct: number;
  team: number;
  rank: number;
  qWeekly: number;
  qMonthly: number;
  className?: string;
}

const incomeTypes = [
  { key: 'direct', label: 'Direct Referral', icon: CurrencyDollarIcon, color: 'text-primary-400' },
  { key: 'team', label: 'Team Dividends', icon: UserGroupIcon, color: 'text-accent-400' },
  { key: 'rank', label: 'Rank Salary', icon: TrophyIcon, color: 'text-yellow-400' },
  { key: 'qWeekly', label: 'Weekly Qualifier', icon: CalendarDaysIcon, color: 'text-purple-400' },
  { key: 'qMonthly', label: 'Monthly Qualifier', icon: ClockIcon, color: 'text-pink-400' },
] as const;

export function IncomeBreakdown({ direct, team, rank, qWeekly, qMonthly, className = '' }: IncomeBreakdownProps) {
  const values: Record<string, number> = { direct, team, rank, qWeekly, qMonthly };
  const total = direct + team + rank + qWeekly + qMonthly;

  return (
    <div className={className}>
      <div className="space-y-3">
        {incomeTypes.map((t) => {
          const val = values[t.key];
          const Icon = t.icon;
          const pct = total > 0 ? (val / total) * 100 : 0;
          return (
            <div key={t.key} className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg bg-dark-900/60 ${t.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-dark-400">{t.label}</span>
                  <span className="text-sm font-mono text-dark-100">
                    ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="w-full h-1 bg-dark-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${t.color.replace('text-', 'bg-')}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 pt-3 border-t border-dark-700/50 flex items-center justify-between">
        <span className="text-sm font-medium text-dark-300">Total Harvestable</span>
        <span className="text-lg font-bold font-mono text-primary-400">
          ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}
