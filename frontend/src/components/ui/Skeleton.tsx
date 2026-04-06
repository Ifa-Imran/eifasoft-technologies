import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className, variant = 'text', width, height }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-shimmer bg-gradient-to-r from-surface-200 via-surface-100 to-surface-200 bg-[length:200%_100%]',
        variant === 'text' && 'h-4 rounded-md',
        variant === 'circular' && 'rounded-full',
        variant === 'rectangular' && 'rounded-xl',
        className
      )}
      style={{ width, height }}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="card p-5 space-y-3">
      <Skeleton width="60%" className="h-3" />
      <Skeleton width="80%" className="h-7" />
    </div>
  );
}
