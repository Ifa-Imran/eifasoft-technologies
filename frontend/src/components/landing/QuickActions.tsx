'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui';
import {
  CurrencyDollarIcon,
  ArrowsRightLeftIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

const actions = [
  {
    title: 'Stake Now',
    description: 'Earn up to 3X returns with our 3-tier staking system',
    href: '/stake',
    icon: CurrencyDollarIcon,
    iconBg: 'gradient-primary',
  },
  {
    title: 'Trade P2P',
    description: 'Buy and sell KAIRO with atomic escrow protection',
    href: '/exchange',
    icon: ArrowsRightLeftIcon,
    iconBg: 'gradient-gold',
  },
  {
    title: 'View Referrals',
    description: 'Track your team and earn multi-level commissions',
    href: '/referrals',
    icon: UserGroupIcon,
    iconBg: 'gradient-success',
  },
];

export function QuickActions() {
  return (
    <section className="py-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto px-4">
        {actions.map((action, i) => (
          <motion.div
            key={action.title}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
          >
            <Link href={action.href}>
              <GlassCard hover="lift" className="h-full cursor-pointer group">
                <div className={`inline-flex p-3 rounded-xl ${action.iconBg} mb-4`}>
                  <action.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-surface-900 mb-2 group-hover:text-primary-600 transition-colors">
                  {action.title}
                </h3>
                <p className="text-surface-500 text-sm">{action.description}</p>
              </GlassCard>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
