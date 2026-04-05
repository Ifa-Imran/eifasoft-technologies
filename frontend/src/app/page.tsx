'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { useAccount } from 'wagmi';
import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useKairoPrice } from '@/hooks/useKairoPrice';
import { useReferral } from '@/hooks/useReferral';
import { useCMS } from '@/hooks/useCMS';
import { useGlobalStore } from '@/stores/useGlobalStore';
import { CONTRACTS, KAIROTokenABI, LiquidityPoolABI, StakingManagerABI } from '@/lib/contracts';
import { ParticleBackground } from '@/components/layout/ParticleBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tooltip } from '@/components/ui/Tooltip';

/* ═══════════════ Helpers ═══════════════ */

const MAX_SUBS = 10_000;

const CONTRACT_LIST: { name: string; key: keyof typeof CONTRACTS }[] = [
  { name: 'KAIRO Token', key: 'KAIRO_TOKEN' },
  { name: 'Liquidity Pool', key: 'LIQUIDITY_POOL' },
  { name: 'Staking Manager', key: 'STAKING_MANAGER' },
  { name: 'Affiliate', key: 'AFFILIATE_DISTRIBUTOR' },
  { name: 'CMS', key: 'CMS' },
  { name: 'Atomic P2P', key: 'ATOMIC_P2P' },
];

function truncateAddr(addr: string) {
  if (!addr || addr.length < 10) return addr || '—';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/* ═══════════════ Countdown Hook ═══════════════ */

function useCountdown(target: number) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(target - now, 0);
  return {
    days: Math.floor(diff / 86400),
    hours: Math.floor((diff % 86400) / 3600),
    minutes: Math.floor((diff % 3600) / 60),
    seconds: diff % 60,
    isExpired: diff <= 0,
    isClosingSoon: diff > 0 && diff < 7 * 86400,
  };
}

/* ═══════════════ Staggered Word Reveal ═══════════════ */

function KineticHeadline({ text, className }: { text: string; className?: string }) {
  const words = text.split(' ');
  return (
    <span className={className}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="inline-block mr-[0.3em]"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 + i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}

/* ═══════════════ Copy Button ═══════════════ */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <Tooltip content={copied ? 'Copied!' : 'Copy address'}>
      <button
        onClick={handleCopy}
        className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-gray-500 hover:text-neon-cyan focus-visible:ring-2 focus-visible:ring-neon-cyan/50 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
        aria-label="Copy address"
      >
        {copied ? (
          <svg className="w-4 h-4 text-matrix-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
          </svg>
        )}
      </button>
    </Tooltip>
  );
}

/* ═══════════════ Feature Card Data ═══════════════ */

const features = [
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: 'Hard Cap Guarantee',
    subtitle: 'The 3X Protocol',
    description: 'Every stake is capped at exactly 3X your principal. No more, no less. Transparent, on-chain, unstoppable.',
    color: 'neon-cyan',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
    title: '5-Level Deep Rewards',
    subtitle: 'Neural Referral Networks',
    description: 'Build your network and earn from 15 levels of team activity. Direct dividends, team bonuses, rank salaries, and qualifier pools.',
    color: 'neon-purple',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
    title: 'Zero-Slippage Trading',
    subtitle: 'Atomic P2P Exchange',
    description: 'Buy and sell KAIRO peer-to-peer at oracle prices. Atomic settlement means no disputes, no waiting. 2% fee burns KAIRO forever.',
    color: 'neon-coral',
  },
];

/* ═══════════════════════════════════════════════════════ */
/*                      MAIN PAGE                         */
/* ═══════════════════════════════════════════════════════ */

export default function HomePage() {
  const { isConnected } = useAccount();
  const { price, isLoading: priceLoading } = useKairoPrice();
  const { deadline: contractDeadline, remainingSubscriptions } = useCMS();
  const { totalTVL, totalBurned } = useGlobalStore();

  // Referral capture
  useReferral();

  // On-chain reads
  const { data: totalBurnedRaw, isLoading: burnLoading } = useReadContract({
    address: CONTRACTS.KAIRO_TOKEN, abi: KAIROTokenABI, functionName: 'getTotalBurned',
    query: { enabled: !!CONTRACTS.KAIRO_TOKEN, refetchInterval: 60_000 },
  });
  const { data: tvlRaw, isLoading: tvlLoading } = useReadContract({
    address: CONTRACTS.LIQUIDITY_POOL, abi: LiquidityPoolABI, functionName: 'getTotalValueLocked',
    query: { enabled: !!CONTRACTS.LIQUIDITY_POOL, refetchInterval: 60_000 },
  });

  const burnedValue = totalBurned > 0 ? totalBurned : (totalBurnedRaw ? Number(formatUnits(totalBurnedRaw as bigint, 18)) : 0);
  const tvlValue = totalTVL > 0 ? totalTVL : (tvlRaw ? Number(formatUnits(tvlRaw as bigint, 18)) : 0);

  // CMS data
  const cmsDeadline = contractDeadline ? Number(contractDeadline as bigint) : 0;
  const countdown = useCountdown(cmsDeadline);
  const remaining = remainingSubscriptions ? Number(remainingSubscriptions as bigint) : 0;
  const filled = MAX_SUBS - remaining;
  const fillPercent = MAX_SUBS > 0 ? (filled / MAX_SUBS) * 100 : 0;

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* ═══════ SECTION 1: HERO ═══════ */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <ParticleBackground />

        {/* Ambient glow orbs */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-neon-cyan/5 blur-[160px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-neon-purple/5 blur-[120px]" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center z-10">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mb-10"
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card text-neon-cyan text-sm font-space-grotesk">
              <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse shadow-[0_0_6px_#00F0FF]" aria-hidden="true" />
              Live on opBNB
            </span>
          </motion.div>

          {/* Kinetic headline */}
          <h1 className="font-orbitron text-3xl sm:text-5xl md:text-7xl font-bold text-white leading-tight">
            <KineticHeadline text="The Future of Deflationary Wealth" />
          </h1>

          {/* Sub-headline */}
          <motion.p
            className="mt-6 text-base sm:text-xl text-gray-300 font-space-grotesk max-w-3xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.6 }}
          >
            3X Capped Staking &bull; Neural Referral Networks &bull; Atomic P2P Exchange
          </motion.p>

          {/* CTA */}
          <motion.div
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4, duration: 0.6 }}
          >
            {isConnected ? (
              <Link href="/dashboard">
                <Button variant="primary" size="lg">Enter The DAO</Button>
              </Link>
            ) : (
              <ConnectButton.Custom>
                {({ openConnectModal, mounted }) => (
                  <div {...(!mounted && { 'aria-hidden': true, style: { opacity: 0, pointerEvents: 'none' } })}>
                    <Button variant="primary" size="lg" onClick={openConnectModal}>
                      Enter The DAO
                    </Button>
                  </div>
                )}
              </ConnectButton.Custom>
            )}
          </motion.div>

          {/* Powered by */}
          <motion.p
            className="mt-4 text-xs text-gray-500 font-space-grotesk"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.7, duration: 0.5 }}
          >
            Powered by opBNB &bull; Gas fees &lt; $0.01
          </motion.p>
        </div>
      </section>

      {/* ═══════ SECTION 2: CMS COUNTDOWN ═══════ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
        >
          <GlassCard padding="lg" className="text-center relative overflow-hidden">
            {/* Decorative gradient accent */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent" />

            <h2 className="font-orbitron text-2xl md:text-3xl font-bold text-white mb-2">
              Core Membership Subscription
            </h2>
            <p className="text-gray-400 text-sm mb-8 font-space-grotesk">Limited to 10,000 slots — claim yours before time runs out</p>

            {/* Countdown timer */}
            {cmsDeadline > 0 ? (
              <div className="flex items-center justify-center gap-3 sm:gap-4 mb-8">
                {[
                  { label: 'DAYS', value: countdown.days },
                  { label: 'HOURS', value: countdown.hours },
                  { label: 'MINS', value: countdown.minutes },
                  { label: 'SECS', value: countdown.seconds },
                ].map((unit, i) => (
                  <div key={unit.label} className="flex flex-col items-center">
                    <div className="w-[68px] sm:w-[88px] h-[72px] sm:h-[92px] rounded-xl glass-card flex items-center justify-center border border-neon-cyan/10">
                      <span className="font-mono text-4xl md:text-6xl font-bold text-neon-cyan drop-shadow-[0_0_12px_rgba(0,240,255,0.4)]">
                        {String(unit.value).padStart(2, '0')}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500 mt-2 uppercase tracking-[0.2em] font-space-grotesk">
                      {unit.label}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex justify-center gap-3 mb-8">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} variant="rect" width={88} height={92} />
                ))}
              </div>
            )}

            {/* Closing soon badge */}
            {countdown.isClosingSoon && (
              <motion.div
                className="mb-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-neon-coral/10 border border-neon-coral/30"
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <span className="w-2 h-2 rounded-full bg-neon-coral animate-pulse" aria-hidden="true" />
                <span className="text-neon-coral text-sm font-semibold font-space-grotesk">CLOSING SOON</span>
              </motion.div>
            )}

            {/* Progress bar */}
            <div className="mb-4">
              <ProgressBar value={fillPercent} variant="cyan" size="md" glow />
            </div>
            <p className="text-gray-400 text-sm mb-8 font-space-grotesk">
              <AnimatedCounter value={remaining} decimals={0} className="text-white font-semibold" />
              {' '}Subscriptions Remaining
            </p>

            {/* CTA */}
            <Link href="/dashboard/cms">
              <Button variant="primary" size="lg">Subscribe Now</Button>
            </Link>
          </GlassCard>
        </motion.div>
      </section>

      {/* ═══════ SECTION 3: LIVE METRICS TICKER ═══════ */}
      <section className="py-10 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6 }}
        >
          <GlassCard padding="md" className="max-w-5xl mx-auto">
            <div className="flex items-center gap-6 overflow-x-auto scrollbar-hide">
              {/* LIVE indicator */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-cyan opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-neon-cyan shadow-[0_0_6px_#00F0FF]" />
                </span>
                <span className="text-neon-cyan text-xs font-bold tracking-wider font-space-grotesk">LIVE</span>
              </div>

              {/* Divider */}
              <div className="w-px h-10 bg-white/10 shrink-0" />

              {/* KAIRO Price */}
              <div className="flex flex-col shrink-0 min-w-[120px]">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-space-grotesk">KAIRO Price</span>
                {priceLoading ? (
                  <Skeleton variant="text" className="w-20 h-6 mt-1" />
                ) : (
                  <AnimatedCounter value={price} prefix="$" decimals={4} className="text-white text-lg font-bold" />
                )}
              </div>

              <div className="w-px h-10 bg-white/10 shrink-0" />

              {/* TVL */}
              <div className="flex flex-col shrink-0 min-w-[120px]">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-space-grotesk">Total Value Locked</span>
                {tvlLoading && tvlValue === 0 ? (
                  <Skeleton variant="text" className="w-20 h-6 mt-1" />
                ) : (
                  <AnimatedCounter value={tvlValue} prefix="$" decimals={2} className="text-white text-lg font-bold" />
                )}
              </div>

              <div className="w-px h-10 bg-white/10 shrink-0" />

              {/* Burned */}
              <div className="flex flex-col shrink-0 min-w-[140px]">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-space-grotesk">Total Burned 🔥</span>
                {burnLoading && burnedValue === 0 ? (
                  <Skeleton variant="text" className="w-24 h-6 mt-1" />
                ) : (
                  <AnimatedCounter value={burnedValue} suffix=" KAIRO" decimals={0} className="text-white text-lg font-bold" />
                )}
              </div>

              <div className="w-px h-10 bg-white/10 shrink-0" />

              {/* Active Stakes */}
              <div className="flex flex-col shrink-0 min-w-[100px]">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-space-grotesk">CMS Filled</span>
                <AnimatedCounter value={filled} decimals={0} className="text-white text-lg font-bold" />
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </section>

      {/* ═══════ SECTION 4: FEATURE GRID ═══════ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-orbitron text-3xl md:text-4xl font-bold text-white">The Protocol</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
              >
                <GlassCard hover padding="lg" className="h-full group">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 bg-${feat.color}/10 text-${feat.color} border border-${feat.color}/20`}
                    style={{
                      backgroundColor: feat.color === 'neon-cyan' ? 'rgba(0,240,255,0.1)' : feat.color === 'neon-purple' ? 'rgba(112,0,255,0.1)' : 'rgba(255,46,99,0.1)',
                      color: feat.color === 'neon-cyan' ? '#00F0FF' : feat.color === 'neon-purple' ? '#7000FF' : '#FF2E63',
                      borderColor: feat.color === 'neon-cyan' ? 'rgba(0,240,255,0.2)' : feat.color === 'neon-purple' ? 'rgba(112,0,255,0.2)' : 'rgba(255,46,99,0.2)',
                    }}
                  >
                    {feat.icon}
                  </div>

                  {/* Subtitle label */}
                  <p className="text-xs uppercase tracking-[0.15em] font-space-grotesk mb-2"
                    style={{ color: feat.color === 'neon-cyan' ? '#00F0FF' : feat.color === 'neon-purple' ? '#7000FF' : '#FF2E63' }}
                  >
                    {feat.subtitle}
                  </p>

                  <h3 className="font-orbitron text-xl font-bold text-white mb-3">{feat.title}</h3>
                  <p className="text-gray-300 text-sm leading-relaxed">{feat.description}</p>

                  {/* Visual accent per card */}
                  {feat.subtitle === 'The 3X Protocol' && (
                    <div className="mt-5 flex items-center gap-1">
                      {['1X', '2X', '3X'].map((label, j) => (
                        <div key={label} className="flex-1">
                          <motion.div
                            className="h-1.5 rounded-full bg-gradient-to-r from-neon-cyan to-[#0080FF]"
                            initial={{ width: 0 }}
                            whileInView={{ width: '100%' }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.3 + j * 0.3, duration: 0.6 }}
                          />
                          <span className="text-[10px] text-gray-500 mt-1 block text-center font-mono">{label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {feat.subtitle === 'Neural Referral Networks' && (
                    <div className="mt-5 flex items-center justify-between px-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <div key={n} className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-neon-purple/40 border border-neon-purple/60" />
                          {n < 5 && <div className="w-6 sm:w-8 h-px bg-neon-purple/30" />}
                        </div>
                      ))}
                    </div>
                  )}
                  {feat.subtitle === 'Atomic P2P Exchange' && (
                    <div className="mt-5 flex items-center justify-center gap-4">
                      <span className="px-3 py-1 rounded-lg bg-matrix-green/10 text-matrix-green text-xs font-bold border border-matrix-green/20">BUY</span>
                      <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                      </svg>
                      <span className="px-3 py-1 rounded-lg bg-neon-coral/10 text-neon-coral text-xs font-bold border border-neon-coral/20">SELL</span>
                    </div>
                  )}
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ SECTION 5: CTA + CONTRACTS ═══════ */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neon-cyan/[0.02] to-transparent pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-orbitron text-3xl md:text-5xl font-bold text-white mb-6">
              Ready to Enter The DAO?
            </h2>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              {isConnected ? (
                <Link href="/dashboard">
                  <Button variant="primary" size="lg">Go to Dashboard</Button>
                </Link>
              ) : (
                <ConnectButton.Custom>
                  {({ openConnectModal, mounted }) => (
                    <div {...(!mounted && { 'aria-hidden': true, style: { opacity: 0, pointerEvents: 'none' } })}>
                      <Button variant="primary" size="lg" onClick={openConnectModal}>
                        Connect Wallet
                      </Button>
                    </div>
                  )}
                </ConnectButton.Custom>
              )}
              <a href="#" target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" size="lg">Read Docs</Button>
              </a>
            </div>

            {/* Smart Contracts */}
            <div className="text-left">
              <h3 className="font-orbitron text-lg font-semibold text-white mb-4 text-center">
                Verified Smart Contracts
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {CONTRACT_LIST.map((c) => {
                  const addr = CONTRACTS[c.key] || '';
                  return (
                    <div key={c.key} className="glass-card rounded-xl px-4 py-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 font-space-grotesk">{c.name}</p>
                        <p className="text-sm text-gray-300 font-mono truncate">{truncateAddr(addr)}</p>
                      </div>
                      {addr && <CopyButton text={addr} />}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════ SECTION 6: FOOTER ═══════ */}
      <footer className="border-t border-white/5 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <div className="flex flex-wrap items-center justify-center gap-6 mb-6">
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-300 transition-colors font-space-grotesk">
              Dashboard
            </Link>
            <Link href="/exchange" className="text-sm text-gray-500 hover:text-gray-300 transition-colors font-space-grotesk">
              Exchange
            </Link>
            <a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors font-space-grotesk">
              Docs
            </a>
          </div>

          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="px-3 py-1 rounded-md glass-card text-xs text-gray-400 font-space-grotesk">
              Built on opBNB
            </span>
          </div>

          <p className="text-gray-600 text-sm font-space-grotesk">
            KAIRO DAO &copy; 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
