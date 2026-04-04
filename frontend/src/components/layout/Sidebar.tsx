'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  HomeIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  CreditCardIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';

const sidebarLinks = [
  { href: '/dashboard', label: 'Overview', icon: HomeIcon },
  { href: '/dashboard/staking', label: 'Staking', icon: CurrencyDollarIcon },
  { href: '/dashboard/referrals', label: 'Referrals', icon: UserGroupIcon },
  { href: '/dashboard/cms', label: 'CMS', icon: CreditCardIcon },
  { href: '/dashboard/trading', label: 'Trading', icon: ArrowsRightLeftIcon },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 hidden lg:block">
      <div className="sticky top-20 glass rounded-xl p-3 space-y-1">
        {sidebarLinks.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'text-primary-400 bg-primary-500/10'
                  : 'text-dark-400 hover:text-dark-100 hover:bg-dark-800',
              )}
            >
              <Icon className="w-5 h-5" />
              {link.label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
