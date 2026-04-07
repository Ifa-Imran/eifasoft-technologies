'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  HomeIcon,
  CurrencyDollarIcon,
  ArrowsRightLeftIcon,
  UserGroupIcon,
  UsersIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

const items = [
  { href: '/dashboard', label: 'Home', icon: HomeIcon },
  { href: '/stake', label: 'Stake', icon: CurrencyDollarIcon },
  { href: '/exchange', label: 'P2P', icon: ArrowsRightLeftIcon },
  { href: '/referrals', label: 'Rank', icon: UserGroupIcon },
  { href: '/team-dividend', label: 'Team', icon: UsersIcon },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white/90 backdrop-blur-xl border-t border-surface-200">
      <div className="flex items-center justify-around h-16 px-2">
        {items.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all duration-200',
                isActive
                  ? 'text-primary-600 bg-primary-50'
                  : 'text-surface-400 hover:text-surface-600'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
