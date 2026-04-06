'use client';

import { motion } from 'framer-motion';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { AnimatedCounter } from '@/components/ui';
import { useKairoPrice } from '@/hooks/useKairoPrice';
import { useGlobalStats } from '@/hooks/useGlobalStats';

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
            <span className="text-sm text-surface-600 font-medium">Live on opBNB Testnet</span>
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
              <AnimatedCounter
                value={price}
                prefix="$"
                decimals={4}
                className="text-xl font-mono font-bold text-surface-900"
              />
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
      </div>
    </section>
  );
}
