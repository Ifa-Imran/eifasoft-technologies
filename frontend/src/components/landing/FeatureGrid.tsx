'use client';

import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui';
import {
  CurrencyDollarIcon,
  ArrowsRightLeftIcon,
  UserGroupIcon,
  TrophyIcon,
  CreditCardIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

const features = [
  {
    title: '3-Tier Staking',
    description: 'Bronze, Silver, Gold tiers with auto-compounding and 3X FIFO hard cap returns.',
    icon: CurrencyDollarIcon,
    iconBg: 'from-primary-500 to-primary-300',
    iconColor: 'text-white',
    cardVariant: 'cyan' as const,
  },
  {
    title: 'Atomic P2P Exchange',
    description: 'Trustless KAIRO/USDT trading with escrow protection and instant settlement.',
    icon: ArrowsRightLeftIcon,
    iconBg: 'from-secondary-500 to-secondary-300',
    iconColor: 'text-white',
    cardVariant: 'purple' as const,
  },
  {
    title: '15-Level Referral System',
    description: 'Earn multi-level commissions with automated team dividend distribution.',
    icon: UserGroupIcon,
    iconBg: 'from-success-500 to-success-300',
    iconColor: 'text-white',
    cardVariant: 'cyan' as const,
  },
  {
    title: '10-Rank Progression',
    description: 'Climb from Star to Crown Diamond with increasing rank salary rewards.',
    icon: TrophyIcon,
    iconBg: 'from-accent-500 to-accent-300',
    iconColor: 'text-white',
    cardVariant: 'gold' as const,
  },
  {
    title: 'CMS Subscriptions',
    description: '10,000 limited membership slots with 5 KAIRO loyalty per subscription.',
    icon: CreditCardIcon,
    iconBg: 'from-danger-500 to-danger-300',
    iconColor: 'text-white',
    cardVariant: 'purple' as const,
  },
  {
    title: 'One-Way AMM Swap',
    description: 'Swap KAIRO for USDT with dynamic pricing and deflationary burn mechanics.',
    icon: ArrowPathIcon,
    iconBg: 'from-primary-500 to-secondary-400',
    iconColor: 'text-white',
    cardVariant: 'gold' as const,
  },
];

export function FeatureGrid() {
  return (
    <section className="py-16">
      <div className="max-w-6xl mx-auto px-4">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-orbitron font-bold text-center text-surface-900 mb-4"
        >
          Powered by <span className="gradient-text">Smart Contracts</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center text-surface-500 max-w-xl mx-auto mb-12"
        >
          A complete DeFi ecosystem built on opBNB with transparent, auditable smart contracts.
        </motion.p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <GlassCard hover="lift" className="h-full" variant={feature.cardVariant}>
                <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${feature.iconBg} mb-5 shadow-lg`}>
                  <feature.icon className={`w-7 h-7 ${feature.iconColor}`} />
                </div>
                <h3 className="text-xl font-bold text-surface-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-surface-500 text-base leading-relaxed">{feature.description}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
