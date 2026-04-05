'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  HomeIcon,
  BanknotesIcon,
  ArrowsRightLeftIcon,
  TrophyIcon,
  EllipsisHorizontalIcon,
  UserGroupIcon,
  TicketIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const mainTabs = [
  { href: '/dashboard', label: 'Dashboard', icon: HomeIcon },
  { href: '/stake', label: 'Stake', icon: BanknotesIcon },
  { href: '/exchange', label: 'Exchange', icon: ArrowsRightLeftIcon },
  { href: '/rank', label: 'Rank', icon: TrophyIcon },
];

const moreLinks = [
  { href: '/dashboard/referrals', label: 'Referrals', icon: UserGroupIcon },
  { href: '/dashboard/cms', label: 'CMS', icon: TicketIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href));

  return (
    <>
      {/* More menu overlay */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-[72px] left-0 right-0 z-50 px-4 pb-2 md:hidden"
          >
            <div className="glass-card p-3 space-y-1">
              <div className="flex items-center justify-between px-2 pb-2 border-b border-glass-border">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">More</span>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/5"
                  aria-label="Close menu"
                >
                  <XMarkIcon className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              {moreLinks.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                      active
                        ? 'text-neon-cyan bg-neon-cyan/10'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-white/5',
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom navigation bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-glass backdrop-blur-[20px] border-t border-glass-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around h-[72px]">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[48px] rounded-xl transition-colors',
                  active ? 'text-neon-cyan' : 'text-gray-500',
                )}
              >
                <Icon className="w-6 h-6" />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[48px] rounded-xl transition-colors',
              moreOpen ? 'text-neon-cyan' : 'text-gray-500',
            )}
          >
            <EllipsisHorizontalIcon className="w-6 h-6" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
