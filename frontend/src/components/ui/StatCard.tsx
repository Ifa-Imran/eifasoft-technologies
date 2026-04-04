import { cn } from '@/lib/utils';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline';

interface StatCardProps {
  label: string;
  value: string;
  trend?: { value: number; label?: string };
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ label, value, trend, icon, className }: StatCardProps) {
  const isPositive = trend && trend.value >= 0;

  return (
    <div className={cn('glass rounded-xl p-5', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-dark-400 mb-1">{label}</p>
          <p className="text-2xl font-semibold text-dark-50 font-mono">{value}</p>
        </div>
        {icon && (
          <div className="p-2 rounded-lg bg-primary-500/10 text-primary-400">
            {icon}
          </div>
        )}
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-3">
          {isPositive ? (
            <ArrowTrendingUpIcon className="w-4 h-4 text-primary-400" />
          ) : (
            <ArrowTrendingDownIcon className="w-4 h-4 text-red-400" />
          )}
          <span className={cn('text-sm font-medium', isPositive ? 'text-primary-400' : 'text-red-400')}>
            {isPositive ? '+' : ''}{trend.value}%
          </span>
          {trend.label && <span className="text-xs text-dark-500 ml-1">{trend.label}</span>}
        </div>
      )}
    </div>
  );
}
