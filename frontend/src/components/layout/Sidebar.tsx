'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HomeIcon,
  CurrencyDollarIcon,
  ArrowsRightLeftIcon,
  UserGroupIcon,
  CreditCardIcon,
  ArrowPathIcon,
  ChartBarIcon,
  ChevronLeftIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: HomeIcon },
  { href: '/stake', label: 'Stake', icon: CurrencyDollarIcon },
  { href: '/exchange', label: 'Atomic P2P', icon: ArrowsRightLeftIcon },
  { href: '/referrals', label: 'Rank Dividend', icon: UserGroupIcon },
  { href: '/team-dividend', label: 'Team Dividend', icon: UsersIcon },
  { href: '/cms', label: 'CMS', icon: CreditCardIcon },
  { href: '/swap', label: 'Swap', icon: ArrowPathIcon },
  { href: '/analytics', label: 'Analytics', icon: ChartBarIcon },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo area */}
      <div className="flex items-center justify-between px-4 py-5">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm">K</span>
            </div>
            <span className="font-orbitron text-lg font-bold gradient-text">KAIRO DAO</span>
          </Link>
        )}
        <button
          onClick={onToggle}
          className="hidden lg:flex text-surface-400 hover:text-surface-700 p-1.5 rounded-lg hover:bg-surface-100 transition-colors"
        >
          <ChevronLeftIcon
            className={cn('w-4 h-4 transition-transform duration-300', collapsed && 'rotate-180')}
          />
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-gradient-to-r from-primary-100 to-secondary-100 text-primary-700 border-2 border-primary-300/60 shadow-md shadow-primary-200/30'
                  : 'text-surface-500 hover:text-primary-700 hover:bg-primary-50/50',
                collapsed && 'justify-center'
              )}
            >
              <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-primary-600')} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      {!collapsed && (
        <div className="p-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary-100 to-secondary-100 border-2 border-primary-200/60">
            <p className="text-xs text-surface-600 font-medium">opBNB Network</p>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
              <span className="text-xs text-success-600 font-medium">Connected</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col bg-gradient-to-b from-white/90 via-primary-50/20 to-secondary-50/20 backdrop-blur-xl border-r border-primary-200/50 transition-all duration-300',
          collapsed ? 'w-[72px]' : 'w-[240px]'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25 }}
              className="fixed left-0 top-0 bottom-0 w-[240px] bg-gradient-to-b from-white/95 via-primary-50/30 to-secondary-50/30 backdrop-blur-xl border-r border-primary-200/50 z-50 lg:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
