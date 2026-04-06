import { cn } from '@/lib/utils';

type BadgeTier = 'bronze' | 'silver' | 'gold' | 'default' | 'cyan' | 'purple';

interface BadgeProps {
  children: React.ReactNode;
  tier?: BadgeTier;
  className?: string;
  size?: 'sm' | 'md';
}

const tierStyles: Record<BadgeTier, string> = {
  bronze: 'bg-gradient-to-r from-amber-200 to-orange-200 text-amber-900 border-amber-300 shadow-sm shadow-amber-200/40',
  silver: 'bg-gradient-to-r from-surface-200 to-surface-300 text-surface-800 border-surface-400 shadow-sm',
  gold: 'bg-gradient-to-r from-yellow-200 to-amber-200 text-yellow-900 border-yellow-400 shadow-sm shadow-yellow-300/40',
  default: 'bg-primary-100 text-primary-800 border-primary-300',
  cyan: 'bg-gradient-to-r from-primary-100 to-primary-200 text-primary-800 border-primary-300',
  purple: 'bg-gradient-to-r from-secondary-100 to-secondary-200 text-secondary-800 border-secondary-300',
};

const sizeStyles = {
  sm: 'px-2.5 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
};

export function Badge({ children, tier = 'default', className, size = 'sm' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded-full border',
        tierStyles[tier],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
}
