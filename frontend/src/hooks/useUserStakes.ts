'use client';

import { useReadContract, useAccount } from 'wagmi';
import { contracts, STAKING_TIERS, USDT_DECIMALS } from '@/config/contracts';
import { StakingManagerABI } from '@/config/abis/StakingManager';
import { formatUnits } from 'viem';

// ─── Individual stake (raw on-chain data + derived) ──────────────────────────
export interface StakeInfo {
  index: number;
  amount: bigint;
  originalAmount: bigint;
  compoundEarned: bigint;
  harvestedRewards: bigint;
  totalEarned: bigint;        // FIFO cap tracker (ALL income types)
  startTime: number;
  lastCompoundTime: number;
  active: boolean;
  tier: number;
  tierName: string;
  compoundInterval: number;
  canCompound: boolean;
  hardCap: bigint;
  harvestable: bigint;
}

// ─── Tier-grouped view (what the UI renders) ─────────────────────────────────
export interface TierGroup {
  tier: number;
  tierName: string;
  tierColor: string;
  compoundInterval: number;
  // Aggregated on-chain
  totalOriginalAmount: bigint;
  totalCompoundEarned: bigint;
  totalHarvestedRewards: bigint;
  totalCapEarned: bigint;     // sum of FIFO totalEarned
  totalHardCap: bigint;       // sum of 3X caps
  capProgress: number;        // 0-100
  // Virtual pending compound (calculated client-side)
  pendingProfit: bigint;
  // Derived display values
  displayHarvestable: bigint; // on-chain harvestable + pending profit
  displayTotalEarned: bigint; // displayHarvestable + totalHarvestedRewards
  harvestable: bigint;        // on-chain confirmed only
  // Formatted strings
  originalAmountFormatted: string;
  totalEarnedFormatted: string;
  harvestableFormatted: string;
  displayHarvestableFormatted: string;
  totalHarvestedFormatted: string;
  pendingProfitFormatted: string;
  // Underlying stakes for tx operations
  stakes: StakeInfo[];
  stakeCount: number;
}

// ─── Calculate pending compound profit for a single stake ────────────────────
function calcPendingProfit(
  amount: bigint,
  lastCompoundTime: number,
  compoundInterval: number,
  now: number,
): bigint {
  const elapsed = now - lastCompoundTime;
  const intervals = Math.floor(elapsed / compoundInterval);
  if (intervals <= 0) return 0n;

  let currentAmount = amount;
  let totalProfit = 0n;
  for (let i = 0; i < intervals; i++) {
    const profit = currentAmount / 1000n; // 0.1% per interval
    currentAmount += profit;
    totalProfit += profit;
  }
  return totalProfit;
}

export function useUserStakes() {
  const { address } = useAccount();

  const { data: stakeCount, isLoading: countLoading } = useReadContract({
    address: contracts.stakingManager,
    abi: StakingManagerABI,
    functionName: 'getUserStakeCount',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contracts.stakingManager !== '0x',
      refetchInterval: 15000,
    },
  });

  const { data: rawStakes, isLoading: stakesLoading } = useReadContract({
    address: contracts.stakingManager,
    abi: StakingManagerABI,
    functionName: 'getUserStakes',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contracts.stakingManager !== '0x' && Number(stakeCount || 0) > 0,
      refetchInterval: 15000,
    },
  });

  const now = Math.floor(Date.now() / 1000);

  // ── Parse individual stakes ────────────────────────────────────────────────
  const stakes: StakeInfo[] = rawStakes
    ? (rawStakes as any[]).map((s: any, i: number) => {
        const tierIdx = Number(s.tier || 0);
        const tier = STAKING_TIERS[tierIdx] || STAKING_TIERS[0];
        const amount = BigInt(s.amount || 0);
        const originalAmount = BigInt(s.originalAmount || 0);
        const compoundEarned = BigInt(s.compoundEarned || 0);
        const harvestedRewards = BigInt(s.harvestedRewards || 0);
        const totalEarned = BigInt(s.totalEarned || 0);
        const hardCap = originalAmount * 3n;
        const harvestable = compoundEarned > harvestedRewards ? compoundEarned - harvestedRewards : 0n;
        const lastCompound = Number(s.lastCompoundTime || 0);

        return {
          index: i,
          amount,
          originalAmount,
          compoundEarned,
          harvestedRewards,
          totalEarned,
          startTime: Number(s.startTime || 0),
          lastCompoundTime: lastCompound,
          active: s.active || false,
          tier: tierIdx,
          tierName: tier.name,
          compoundInterval: tier.compoundInterval,
          canCompound: now >= lastCompound + tier.compoundInterval,
          hardCap,
          harvestable,
        };
      })
    : [];

  const activeStakes = stakes.filter((s) => s.active);

  // ── Group active stakes by tier ────────────────────────────────────────────
  const tierGroupMap = new Map<number, StakeInfo[]>();
  for (const s of activeStakes) {
    const arr = tierGroupMap.get(s.tier) || [];
    arr.push(s);
    tierGroupMap.set(s.tier, arr);
  }

  const tierGroups: TierGroup[] = Array.from(tierGroupMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([tierIdx, tierStakes]) => {
      const tier = STAKING_TIERS[tierIdx] || STAKING_TIERS[0];

      let totalOriginalAmount = 0n;
      let totalCompoundEarned = 0n;
      let totalHarvestedRewards = 0n;
      let totalCapEarned = 0n;
      let totalHardCap = 0n;
      let pendingProfit = 0n;
      let harvestable = 0n;

      for (const s of tierStakes) {
        totalOriginalAmount += s.originalAmount;
        totalCompoundEarned += s.compoundEarned;
        totalHarvestedRewards += s.harvestedRewards;
        totalCapEarned += s.totalEarned;
        totalHardCap += s.hardCap;
        harvestable += s.harvestable;
        // Virtual pending compound profit
        pendingProfit += calcPendingProfit(s.amount, s.lastCompoundTime, s.compoundInterval, now);
      }

      const displayHarvestable = harvestable + pendingProfit;
      const displayTotalEarned = displayHarvestable + totalHarvestedRewards;
      const capProgress = totalHardCap > 0n ? Number((totalCapEarned * 100n) / totalHardCap) : 0;

      return {
        tier: tierIdx,
        tierName: tier.name,
        tierColor: tier.color,
        compoundInterval: tier.compoundInterval,
        totalOriginalAmount,
        totalCompoundEarned,
        totalHarvestedRewards,
        totalCapEarned,
        totalHardCap,
        capProgress: Math.min(capProgress, 100),
        pendingProfit,
        displayHarvestable,
        displayTotalEarned,
        harvestable,
        originalAmountFormatted: formatUnits(totalOriginalAmount, USDT_DECIMALS),
        totalEarnedFormatted: formatUnits(displayTotalEarned, USDT_DECIMALS),
        harvestableFormatted: formatUnits(harvestable, USDT_DECIMALS),
        displayHarvestableFormatted: formatUnits(displayHarvestable, USDT_DECIMALS),
        totalHarvestedFormatted: formatUnits(totalHarvestedRewards, USDT_DECIMALS),
        pendingProfitFormatted: formatUnits(pendingProfit, USDT_DECIMALS),
        stakes: tierStakes,
        stakeCount: tierStakes.length,
      };
    });

  const totalStaked = activeStakes.reduce((sum, s) => sum + s.originalAmount, 0n);
  const totalHarvestable = activeStakes.reduce((sum, s) => sum + s.harvestable, 0n);
  // Sum harvestedRewards across ALL stakes (active + inactive) for lifetime tracking
  const totalHarvestedRewards = stakes.reduce((sum, s) => sum + s.harvestedRewards, 0n);

  return {
    stakes,
    activeStakes,
    tierGroups,
    totalStaked,
    totalHarvestable,
    totalHarvestedRewards,
    stakeCount: Number(stakeCount || 0),
    isLoading: countLoading || stakesLoading,
  };
}
