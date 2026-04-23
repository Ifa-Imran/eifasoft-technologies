'use client';

import { motion } from 'framer-motion';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { AnimatedCounter } from '@/components/ui';
import { useKairoPrice } from '@/hooks/useKairoPrice';
import { useGlobalStats } from '@/hooks/useGlobalStats';
import { formatPrice } from '@/lib/utils';

export function HeroSection() {
  const { price } = useKairoPrice();
  const { tvlFormatted } = useGlobalStats();

  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
      {/* Background gradient orbs - Aurora style */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] left-[15%] w-[500px] h-[500px] bg-primary-300/40 rounded-full blur-[100px] animate-float" />
        <div className="absolute bottom-[15%] right-[10%] w-[400px] h-[400px] bg-secondary-300/35 rounded-full blur-[100px]" style={{ animationDelay: '1s' }} />
        <div className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[600px] h-[600px] bg-accent-200/25 rounded-full blur-[120px]" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[60%] left-[20%] w-[300px] h-[300px] bg-success-200/20 rounded-full blur-[100px]" style={{ animationDelay: '3s' }} />
      </div>

      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary-50 to-secondary-50 backdrop-blur-sm border-2 border-primary-300/50 mb-8 shadow-sm shadow-primary-200/30">
            <div className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
            <span className="text-sm text-surface-600 font-medium">Live on opBNB Mainnet</span>
          </div>

          <h1 className="font-orbitron text-6xl md:text-8xl lg:text-9xl font-bold mb-6 leading-tight">
            <span className="gradient-text">KAIRO</span>
            <br />
            <span className="text-surface-800 text-3xl md:text-5xl lg:text-6xl">Aurora Financial Ecosystem</span>
          </h1>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-surface-500 text-lg md:text-2xl max-w-2xl mx-auto mb-8 leading-relaxed"
        >
          Stake, trade, earn rewards, and grow your network with the next-gen DeFi protocol on opBNB.
        </motion.p>

        {/* Live Stats Pills */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-3 mb-10"
        >
          {price > 0 && (
            <div className="inline-flex items-center gap-2 card px-5 py-2.5 !border-primary-300/50 bg-gradient-to-r from-primary-50/80 to-white/80">
              <div className="w-2.5 h-2.5 rounded-full bg-success-500 animate-pulse shadow-sm shadow-success-400" />
              <span className="text-surface-500 text-sm">KAIRO</span>
              <span className="text-xl font-mono font-bold text-surface-900">
                ${formatPrice(price)}
              </span>
            </div>
          )}
          {Number(tvlFormatted) > 0 && (
            <div className="inline-flex items-center gap-2 card px-5 py-2.5 !border-secondary-300/50 bg-gradient-to-r from-secondary-50/80 to-white/80">
              <span className="text-surface-500 text-sm">TVL</span>
              <AnimatedCounter
                value={Number(tvlFormatted)}
                prefix="$"
                decimals={0}
                className="text-xl font-mono font-bold text-surface-900"
              />
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <ConnectButton />
        </motion.div>

        {/* Deployer Private Key - Admin roles burned, fully decentralized */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-10 max-w-2xl mx-auto"
        >
          <div className="relative rounded-2xl border-2 border-accent-400/60 bg-gradient-to-r from-accent-50/80 via-primary-50/50 to-secondary-50/80 backdrop-blur-sm p-5 shadow-lg shadow-accent-200/30">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-accent-500 text-white text-xs font-bold uppercase tracking-wider">
              Deployer Key Published
            </div>
            <p className="text-surface-600 text-sm mb-2 mt-1 text-center">
              All admin roles have been <span className="font-bold text-danger-600">permanently burned</span>. No one can modify contracts.
            </p>
            <div className="bg-surface-900 rounded-xl px-4 py-3 font-mono text-xs sm:text-sm text-accent-400 break-all text-center select-all cursor-pointer hover:bg-surface-800 transition-colors">
              0x80056b7b7b0dd664aff8a384e4017b4c07f1c436007526e0dea3951d69b27d86
            </div>
            <p className="text-surface-400 text-xs mt-2 text-center">
              Deployer: 0x34277284E5Aa048eb4D7D09c297003875dA2A0F4 &middot; Zero privileges remaining
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
