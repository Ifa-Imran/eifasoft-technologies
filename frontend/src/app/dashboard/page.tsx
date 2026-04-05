'use client';

import { useMemo, useEffect, useCallback, useState } from 'react';
import Link from 'next/link';
import { useAccount, useReadContract } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { motion } from 'framer-motion';
import {
  CurrencyDollarIcon,
  BoltIcon,
  BeakerIcon,
  ArrowRightIcon,
  ArrowsRightLeftIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline';
import { useStaking } from '@/hooks/useStaking';
import { useKairoPrice } from '@/hooks/useKairoPrice';
import { CONTRACTS, AffiliateDistributorABI, USDTABI } from '@/lib/contracts';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatCard } from '@/components/ui/StatCard';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { TokenMetrics } from '@/components/dashboard/TokenMetrics';
import { StakingControlCenter } from '@/components/dashboard/StakingControlCenter';
import { AffiliateNetwork } from '@/components/dashboard/AffiliateNetwork';
import { CMSStatusWidget } from '@/components/dashboard/CMSStatusWidget';
import { useWS } from '@/providers/WebSocketProvider';
import { useToast } from '@/providers/ToastProvider';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};

const COMPOUND_SECS = [8 * 3600, 6 * 3600, 4 * 3600];

// ---- SVG Circular Progress ----
function CircularProgress({ percent, color }: { percent: number; color: string }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;
  const strokeColor =
    color === 'danger'
      ? '#FF4C6E'
      : color === 'warning'
        ? '#FFB800'
        : '#00E5A0';
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" className="shrink-0" role="img" aria-label={`3X Cap Progress: ${percent.toFixed(0)}%`}>
      <circle
        cx="48" cy="48" r={radius}
        fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6"
      />
      <circle
        cx="48" cy="48" r={radius}
        fill="none" stroke={strokeColor} strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 48 48)"
        className="transition-all duration-700 ease-out"
        style={{ filter: `drop-shadow(0 0 6px ${strokeColor}40)` }}
      />
      <text
        x="48" y="44" textAnchor="middle" dominantBaseline="central"
        className="fill-white font-mono text-lg font-bold"
      >
        {percent.toFixed(0)}%
      </text>
      <text
        x="48" y="60" textAnchor="middle" dominantBaseline="central"
        className="fill-gray-500 text-[8px] font-medium uppercase"
        aria-label="Triple your stake limit"
      >
        3X Cap
      </text>
    </svg>
  );
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const { stakes, totalStakeValue, isLoadingStakes, refetchStakes } = useStaking();
  const { price } = useKairoPrice();
  const { subscribe } = useWS();
  const { addToast } = useToast();

  // ---- Testnet Faucet ----
  const { data: usdtBalance, refetch: refetchUsdtBalance } = useReadContract({
    address: CONTRACTS.USDT,
    abi: USDTABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!CONTRACTS.USDT, refetchInterval: 15_000 },
  });
  const { writeContract: writeMint, data: mintTxHash, isPending: isMintPending, reset: resetMint } = useWriteContract();
  const { isLoading: isMintConfirming, isSuccess: isMintSuccess } = useWaitForTransactionReceipt({ hash: mintTxHash });
  const isMinting = isMintPending || isMintConfirming;

  const handleMint = useCallback(() => {
    if (!address) return;
    writeMint({
      address: CONTRACTS.USDT,
      abi: USDTABI,
      functionName: 'mint',
      args: [address, parseUnits('100000', 18)],
    });
  }, [address, writeMint]);

  useEffect(() => {
    if (isMintSuccess) {
      addToast('success', 'Faucet', 'Successfully minted 100,000 Test USDT!');
      refetchUsdtBalance();
      resetMint();
    }
  }, [isMintSuccess, addToast, refetchUsdtBalance, resetMint]);

  const formattedUsdtBalance = usdtBalance
    ? Number(formatUnits(usdtBalance as bigint, 18)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';

  // ---- Claimable Rewards from AffiliateDistributor ----
  const { data: totalHarvestable } = useReadContract({
    address: CONTRACTS.AFFILIATE_DISTRIBUTOR,
    abi: AffiliateDistributorABI,
    functionName: 'getTotalHarvestable',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!CONTRACTS.AFFILIATE_DISTRIBUTOR, refetchInterval: 30_000 },
  });
  const { data: allIncome } = useReadContract({
    address: CONTRACTS.AFFILIATE_DISTRIBUTOR,
    abi: AffiliateDistributorABI,
    functionName: 'getAllIncome',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!CONTRACTS.AFFILIATE_DISTRIBUTOR, refetchInterval: 30_000 },
  });

  // ---- Computed values ----
  const activeStakes = useMemo(() => stakes.filter((s) => s.active), [stakes]);
  const totalStakedUSD = totalStakeValue ? Number(formatUnits(totalStakeValue as bigint, 18)) : 0;
  const harvestableUSD = totalHarvestable ? Number(formatUnits(totalHarvestable as bigint, 18)) : 0;
  const kairoEquiv = price > 0 ? totalStakedUSD / price : 0;

  const { totalEarned, totalCap, capPercent } = useMemo(() => {
    let earned = 0, cap = 0;
    for (const s of activeStakes) {
      earned += Number(formatUnits(s.totalEarned, 18));
      cap += Number(formatUnits(s.originalAmount, 18)) * 3;
    }
    return { totalEarned: earned, totalCap: cap, capPercent: cap > 0 ? (earned / cap) * 100 : 0 };
  }, [activeStakes]);

  const capColor = capPercent >= 80 ? 'danger' : capPercent >= 50 ? 'warning' : 'success';

  // Nearest compound countdown
  const nearestCompound = useMemo(() => {
    if (activeStakes.length === 0) return null;
    const now = Math.floor(Date.now() / 1000);
    let nearest = Infinity;
    for (const s of activeStakes) {
      const next = Number(s.lastCompoundTime) + COMPOUND_SECS[s.tier];
      const remaining = next - now;
      if (remaining < nearest) nearest = remaining;
    }
    if (nearest <= 0) return 'Ready!';
    const h = Math.floor(nearest / 3600);
    const m = Math.floor((nearest % 3600) / 60);
    const sec = nearest % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }, [activeStakes]);

  const incomeBreakdown = useMemo(() => {
    if (!allIncome) return null;
    const [d, t, r, w, m] = allIncome as unknown as bigint[];
    return {
      direct: Number(formatUnits(d, 18)),
      team: Number(formatUnits(t, 18)),
      rank: Number(formatUnits(r, 18)),
      qWeekly: Number(formatUnits(w, 18)),
      qMonthly: Number(formatUnits(m, 18)),
    };
  }, [allIncome]);

  // ---- WebSocket ----
  useEffect(() => {
    if (!address) return;
    const unsub = subscribe((msg) => {
      if (msg.type === 'compound_event' && msg.data.user.toLowerCase() === address.toLowerCase()) {
        addToast('success', 'Stake Compounded', `Stake #${msg.data.stakeId} earned +$${msg.data.profit}`);
        refetchStakes();
      }
      if (msg.type === 'stake_created' && msg.data.user.toLowerCase() === address.toLowerCase()) {
        addToast('info', 'New Stake Created', `$${msg.data.amount} staked in Tier ${msg.data.tier + 1}`);
        refetchStakes();
      }
    });
    return unsub;
  }, [address, subscribe, addToast, refetchStakes]);

  // ---- Not connected ----
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="p-4 rounded-2xl bg-glass mb-4">
          <CurrencyDollarIcon className="w-12 h-12 text-gray-600" />
        </div>
        <h2 className="text-xl font-orbitron font-bold text-white mb-2">Connect Your Wallet</h2>
        <p className="text-sm text-gray-500 max-w-sm">Connect your wallet to view your dashboard, staking positions, and affiliate rewards</p>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-orbitron font-bold text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Monitor your staking, rewards, and team performance</p>
      </div>

      {/* Token Metrics Bar */}
      <TokenMetrics />

      {/* Header Stats — 4 Column Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {/* 1. Portfolio Value */}
        <motion.div {...fadeUp}>
          <GlassCard hover>
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">
                  Portfolio Value
                </p>
                {isLoadingStakes ? (
                  <Skeleton variant="text" width="70%" height={32} />
                ) : (
                  <div className="text-2xl lg:text-3xl font-semibold font-mono text-neon-cyan">
                    <AnimatedCounter value={totalStakedUSD} prefix="$" decimals={2} />
                  </div>
                )}
                <p className="text-[10px] text-gray-500 mt-1">
                  &asymp; {kairoEquiv.toLocaleString('en-US', { maximumFractionDigits: 2 })} KAIRO
                </p>
              </div>
              <div className="shrink-0 p-2.5 rounded-xl bg-neon-cyan/10 text-neon-cyan">
                <CurrencyDollarIcon className="w-5 h-5" />
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* 2. Active Stakes */}
        <motion.div {...fadeUp} transition={{ delay: 0.08 }}>
          <GlassCard hover>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">
                  Active Stakes
                </p>
                <p className="text-2xl lg:text-3xl font-semibold font-mono text-white">
                  {activeStakes.length}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">
                  {nearestCompound
                    ? nearestCompound === 'Ready!'
                      ? <span className="text-matrix-green font-bold">Compound Ready!</span>
                      : <>Next compound in <span className="font-mono text-gray-400">{nearestCompound}</span></>
                    : 'No active stakes'}
                </p>
              </div>
              <div className="shrink-0 p-2.5 rounded-xl bg-neon-purple/10 text-neon-purple">
                <BoltIcon className="w-5 h-5" />
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* 3. 3X Cap Progress */}
        <motion.div {...fadeUp} transition={{ delay: 0.16 }}>
          <GlassCard hover>
            {activeStakes.length > 0 ? (
              <div className="flex items-center gap-4">
                <CircularProgress percent={capPercent} color={capColor} />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1" aria-label="Triple stake limit progress">
                    3X Cap Progress
                  </p>
                  <p className="text-xs text-gray-400 font-mono">
                    ${totalEarned.toFixed(2)} / ${totalCap.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {capPercent < 100
                      ? `${(100 - capPercent).toFixed(1)}% remaining`
                      : 'Cap reached!'}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">
                  3X Cap Progress
                </p>
                <p className="text-sm text-gray-500">No Active Stakes</p>
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* 4. Claimable Rewards */}
        <motion.div {...fadeUp} transition={{ delay: 0.24 }}>
          <GlassCard hover>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">
                  Claimable Rewards
                </p>
                <div className="text-2xl lg:text-3xl font-semibold font-mono text-matrix-green">
                  <AnimatedCounter value={harvestableUSD} prefix="$" decimals={2} />
                </div>
              </div>
              <div className="shrink-0 p-2.5 rounded-xl bg-matrix-green/10 text-matrix-green">
                <CurrencyDollarIcon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[10px] text-gray-500">Direct + Team + Rank + Qualifier</p>
            {harvestableUSD >= 10 && (
              <Link href="/dashboard/staking" className="block mt-2">
                <Button size="sm" variant="primary" className="w-full">
                  Harvest All
                </Button>
              </Link>
            )}
          </GlassCard>
        </motion.div>
      </div>

      {/* Section A: Staking Control Center */}
      <motion.div {...fadeUp} transition={{ delay: 0.3 }}>
        <StakingControlCenter />
      </motion.div>

      {/* Section B: Affiliate Network */}
      <motion.div {...fadeUp} transition={{ delay: 0.35 }}>
        <AffiliateNetwork />
      </motion.div>

      {/* Section C: CMS Status Widget */}
      <motion.div {...fadeUp} transition={{ delay: 0.4 }}>
        <CMSStatusWidget />
      </motion.div>

      {/* Quick Actions */}
      <motion.div {...fadeUp} transition={{ delay: 0.45 }}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Link href="/dashboard/staking">
            <GlassCard hover className="group h-full">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-neon-cyan/10 text-neon-cyan group-hover:bg-neon-cyan/20 transition-colors">
                  <BoltIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Stake USDT</p>
                  <p className="text-xs text-gray-500">Earn 0.1% per compound</p>
                </div>
              </div>
            </GlassCard>
          </Link>
          <Link href="/dashboard/cms">
            <GlassCard hover className="group h-full">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-neon-purple/10 text-neon-purple group-hover:bg-neon-purple/20 transition-colors">
                  <CreditCardIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Subscribe CMS</p>
                  <p className="text-xs text-gray-500">Earn KAIRO loyalty rewards</p>
                </div>
              </div>
            </GlassCard>
          </Link>
          <Link href="/dashboard/trading">
            <GlassCard hover className="group h-full">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-solar-amber/10 text-solar-amber group-hover:bg-solar-amber/20 transition-colors">
                  <ArrowsRightLeftIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Trade P2P</p>
                  <p className="text-xs text-gray-500">Buy & sell KAIRO</p>
                </div>
              </div>
            </GlassCard>
          </Link>
        </div>
      </motion.div>

      {/* Testnet Faucet */}
      <motion.div {...fadeUp} transition={{ delay: 0.5 }}>
        <GlassCard className="border border-neon-cyan/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-neon-cyan/10 text-neon-cyan">
              <BeakerIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Testnet Faucet</h2>
              <p className="text-xs text-gray-500">Mint test USDT for development on opBNB testnet</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-[10px] text-gray-500 uppercase mb-1">Your USDT Balance</p>
              <p className="text-2xl font-semibold text-white font-mono">${formattedUsdtBalance}</p>
            </div>
            <Button
              variant="primary"
              size="lg"
              loading={isMinting}
              disabled={isMinting || !isConnected}
              onClick={handleMint}
            >
              Mint 100,000 Test USDT
            </Button>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
