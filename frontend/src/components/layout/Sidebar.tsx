'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  HomeIcon,
  BanknotesIcon,
  ArrowsRightLeftIcon,
  TrophyIcon,
  UserGroupIcon,
  TicketIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';

const sidebarLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: HomeIcon },
  { href: '/stake', label: 'Stake', icon: BanknotesIcon },
  { href: '/exchange', label: 'Exchange', icon: ArrowsRightLeftIcon },
  { href: '/rank', label: 'Rank', icon: TrophyIcon },
  { href: '/dashboard/referrals', label: 'Referrals', icon: UserGroupIcon },
  { href: '/dashboard/cms', label: 'CMS', icon: TicketIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setIsDesktop(w >= 1440);
      setIsTablet(w >= 768 && w < 1440);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Auto-collapse on tablet
  useEffect(() => {
    if (isTablet) setExpanded(false);
    if (isDesktop) setExpanded(true);
  }, [isTablet, isDesktop]);

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href)) ||
    (href === '/dashboard' && pathname === '/dashboard');

  // Hidden on mobile
  if (!isDesktop && !isTablet) return null;

  const sidebarWidth = expanded ? 240 : 64;

  return (
    <RadixTooltip.Provider delayDuration={200}>
      <motion.aside
        initial={false}
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="fixed left-0 top-16 bottom-0 z-40 hidden md:flex flex-col bg-glass backdrop-blur-[20px] border-r border-glass-border"
      >
        {/* Navigation items */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto overflow-x-hidden">
          {sidebarLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);

            const linkContent = (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative',
                  active
                    ? 'text-neon-cyan bg-neon-cyan/10'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5',
                )}
              >
                {/* Active left border */}
                {active && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-neon-cyan rounded-full shadow-[0_0_8px_rgba(0,240,255,0.6)]"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <Icon className={cn('w-5 h-5 shrink-0', active && 'drop-shadow-[0_0_4px_rgba(0,240,255,0.5)]')} />
                <AnimatePresence>
                  {expanded && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.15 }}
                      className="whitespace-nowrap overflow-hidden font-space-grotesk"
                    >
                      {link.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );

            // Tooltip when collapsed
            if (!expanded) {
              return (
                <RadixTooltip.Root key={link.href}>
                  <RadixTooltip.Trigger asChild>
                    {linkContent}
                  </RadixTooltip.Trigger>
                  <RadixTooltip.Portal>
                    <RadixTooltip.Content
                      side="right"
                      sideOffset={8}
                      className="px-3 py-1.5 rounded-lg bg-cosmic border border-glass-border text-sm text-gray-200 font-medium shadow-lg z-[100]"
                    >
                      {link.label}
                      <RadixTooltip.Arrow className="fill-cosmic" />
                    </RadixTooltip.Content>
                  </RadixTooltip.Portal>
                </RadixTooltip.Root>
              );
            }

            return <div key={link.href}>{linkContent}</div>;
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="p-2 border-t border-glass-border">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors focus-visible:ring-2 focus-visible:ring-neon-cyan/50 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
            aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {expanded ? (
              <>
                <ChevronLeftIcon className="w-4 h-4" />
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs font-medium"
                >
                  Collapse
                </motion.span>
              </>
            ) : (
              <ChevronRightIcon className="w-4 h-4" />
            )}
          </button>
        </div>
      </motion.aside>
    </RadixTooltip.Provider>
  );
}
