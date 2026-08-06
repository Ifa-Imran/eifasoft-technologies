'use client';

import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui';
import { useTranslations } from 'next-intl';
import {
  CurrencyDollarIcon,
  ArrowsRightLeftIcon,
  UserGroupIcon,
  TrophyIcon,
  FireIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

const features = [
  {
    titleKey: 'staking',
    descKey: 'gridStakingDesc',
    icon: CurrencyDollarIcon,
    iconBg: 'from-primary-500 to-primary-300',
    iconColor: 'text-white',
    cardVariant: 'cyan' as const,
  },
  {
    titleKey: 'p2p',
    descKey: 'gridP2PDesc',
    icon: ArrowsRightLeftIcon,
    iconBg: 'from-secondary-500 to-secondary-300',
    iconColor: 'text-white',
    cardVariant: 'purple' as const,
  },
  {
    titleKey: 'referral',
    descKey: 'gridReferralDesc',
    icon: UserGroupIcon,
    iconBg: 'from-success-500 to-success-300',
    iconColor: 'text-white',
    cardVariant: 'cyan' as const,
  },
  {
    titleKey: 'ranks',
    descKey: 'gridRanksDesc',
    icon: TrophyIcon,
    iconBg: 'from-accent-500 to-accent-300',
    iconColor: 'text-white',
    cardVariant: 'gold' as const,
  },
  {
    titleKey: 'burn',
    descKey: 'burnDesc',
    icon: FireIcon,
    iconBg: 'from-danger-500 to-danger-300',
    iconColor: 'text-white',
    cardVariant: 'purple' as const,
  },
  {
    titleKey: 'swap',
    descKey: 'swapDesc',
    icon: ArrowPathIcon,
    iconBg: 'from-primary-500 to-secondary-400',
    iconColor: 'text-white',
    cardVariant: 'gold' as const,
  },
] as const;

export function FeatureGrid() {
  const t = useTranslations('features');
  return (
    <section className="py-16">
      <div className="max-w-6xl mx-auto px-4">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-orbitron font-bold text-center text-surface-900 mb-4"
        >
          {t('poweredBy')}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center text-surface-500 max-w-xl mx-auto mb-12"
        >
          {t('poweredByDesc')}
        </motion.p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.titleKey}
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
                  {t(feature.titleKey)}
                </h3>
                <p className="text-surface-500 text-base leading-relaxed">{t(feature.descKey)}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
