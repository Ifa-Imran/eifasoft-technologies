'use client';

import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useAccount, usePublicClient } from 'wagmi';
import { contracts, USDT_DECIMALS } from '@/config/contracts';
import { AffiliateDistributorABI } from '@/config/abis/AffiliateDistributor';
import { StakingManagerABI } from '@/config/abis/StakingManager';
import { useToast } from '@/components/ui/Toast';
import { useEffect, useMemo, useState } from 'react';
import { formatUnits, parseAbiItem } from 'viem';

export interface SalaryClaimEvent {
  txHash: string;
  blockNumber: bigint;
  timestamp: number;
  rankLevel: number;
  salary: bigint;
  salaryFormatted: string;
}

export interface SalaryHarvestEvent {
  txHash: string;
  blockNumber: bigint;
  timestamp: number;
  amount: bigint;
  amountFormatted: string;
  kairoAmount: bigint;
}

export interface TeamLevelStats {
  level: number;
  members: number;
  totalBusiness: bigint;
  totalBusinessFormatted: string;
  totalEarned: bigint;
  totalEarnedFormatted: string;
  txCount: number;
}

export interface TeamAnalytics {
  directTotal: number;
  directActive: number;
  totalTeamSize: number;
  activeTeamStakes: number;
  directBusiness: bigint;
  directBusinessFormatted: string;
}

export interface LifetimeHarvested {
  staking: bigint;
  direct: bigint;
  team: bigint;
  rank: bigint;
  total: bigint;
  totalFormatted: string;
}

export function useAffiliate() {
  const { address } = useAccount();
  const { toast } = useToast();
  const publicClient = usePublicClient();
  const [salaryHistory, setSalaryHistory] = useState<SalaryClaimEvent[]>([]);
  const [harvestHistory, setHarvestHistory] = useState<SalaryHarvestEvent[]>([]);
  const [teamLevelStats, setTeamLevelStats] = useState<TeamLevelStats[]>([]);
  const [teamAnalytics, setTeamAnalytics] = useState<TeamAnalytics | null>(null);
  const [lifetimeHarvested, setLifetimeHarvested] = useState<LifetimeHarvested | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [teamLevelLoading, setTeamLevelLoading] = useState(false);

  // Fetch salary claim & harvest history + lifetime harvested totals from on-chain events
  useEffect(() => {
    if (!publicClient || !address || contracts.affiliateDistributor === '0x') return;
    let cancelled = false;
    (async () => {
      setHistoryLoading(true);
      try {
        // Use a safe fromBlock range (some RPCs reject fromBlock:0n)
        let safeFrom = 0n;
        try {
          const latestBlock = await publicClient.getBlockNumber();
          safeFrom = latestBlock > 500_000n ? latestBlock - 500_000n : 0n;
        } catch {}

        // Fetch events - each wrapped individually so one failure doesn't block others
        let claimLogs: any[] = [];
        let allHarvestLogs: any[] = [];
        let stakingHarvestLogs: any[] = [];

        try {
          claimLogs = await publicClient.getLogs({
            address: contracts.affiliateDistributor,
            event: parseAbiItem('event RankSalaryClaimed(address indexed user, uint256 rankLevel, uint256 salary)'),
            args: { user: address },
            fromBlock: safeFrom,
            toBlock: 'latest',
          });
        } catch (e) { console.warn('Failed to fetch RankSalaryClaimed logs:', e); }

        try {
          allHarvestLogs = await publicClient.getLogs({
            address: contracts.affiliateDistributor,
            event: parseAbiItem('event Harvested(address indexed user, uint8 incomeType, uint256 usdAmount, uint256 kairoAmount)'),
            args: { user: address },
            fromBlock: safeFrom,
            toBlock: 'latest',
          });
        } catch (e) { console.warn('Failed to fetch Harvested logs:', e); }

        try {
          if (contracts.stakingManager !== '0x') {
            stakingHarvestLogs = await publicClient.getLogs({
              address: contracts.stakingManager,
              event: parseAbiItem('event Harvested(address indexed user, uint256 stakeId, uint256 amount)'),
              args: { user: address },
              fromBlock: safeFrom,
              toBlock: 'latest',
            });
          }
        } catch (e) { console.warn('Failed to fetch staking Harvested logs:', e); }

        if (cancelled) return;

        // Get block timestamps for claim/harvest history display
        const blockNumbers = [...new Set([...claimLogs, ...allHarvestLogs].map(l => l.blockNumber))];
        const blockMap = new Map<bigint, number>();
        await Promise.all(blockNumbers.map(async (bn) => {
          try {
            const block = await publicClient.getBlock({ blockNumber: bn });
            blockMap.set(bn, Number(block.timestamp));
          } catch { blockMap.set(bn, 0); }
        }));

        if (cancelled) return;

        const claims: SalaryClaimEvent[] = claimLogs.map(log => ({
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          timestamp: blockMap.get(log.blockNumber) || 0,
          rankLevel: Number((log.args as any).rankLevel || 0),
          salary: BigInt((log.args as any).salary || 0),
          salaryFormatted: formatUnits(BigInt((log.args as any).salary || 0), USDT_DECIMALS),
        })).sort((a, b) => b.timestamp - a.timestamp);

        // Filter rank harvest events for salary history display
        const harvests: SalaryHarvestEvent[] = allHarvestLogs
          .filter(log => Number((log.args as any).incomeType) === 2)
          .map(log => ({
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            timestamp: blockMap.get(log.blockNumber) || 0,
            amount: BigInt((log.args as any).usdAmount || 0),
            amountFormatted: formatUnits(BigInt((log.args as any).usdAmount || 0), USDT_DECIMALS),
            kairoAmount: BigInt((log.args as any).kairoAmount || 0),
          })).sort((a, b) => b.timestamp - a.timestamp);

        // Compute lifetime harvested per income type from affiliate events
        let directHarvested = 0n, teamHarvested = 0n, rankHarvested = 0n;
        for (const log of allHarvestLogs) {
          const args = log.args as any;
          const incomeType = Number(args.incomeType);
          const amt = BigInt(args.usdAmount || 0);
          switch (incomeType) {
            case 0: directHarvested += amt; break;
            case 1: teamHarvested += amt; break;
            case 2: rankHarvested += amt; break;
          }
        }

        // Compute staking harvested total
        let stakingHarvested = 0n;
        for (const log of stakingHarvestLogs) {
          stakingHarvested += BigInt((log.args as any).amount || 0);
        }

        const totalHarvested = stakingHarvested + directHarvested + teamHarvested + rankHarvested;

        setSalaryHistory(claims);
        setHarvestHistory(harvests);
        setLifetimeHarvested({
          staking: stakingHarvested,
          direct: directHarvested,
          team: teamHarvested,
          rank: rankHarvested,
          total: totalHarvested,
          totalFormatted: `$${Number(formatUnits(totalHarvested, USDT_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        });
      } catch (err) {
        console.error('Failed to fetch salary history:', err);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [publicClient, address]);

  // Fetch team level data: per-level member count, business, and earnings from TeamEarned events
  useEffect(() => {
    if (!publicClient || !address) return;
    let cancelled = false;
    (async () => {
      setTeamLevelLoading(true);
      try {
        const contractAddr = contracts.affiliateDistributor;
        if (!contractAddr || contractAddr === '0x') {
          console.warn('[BFS] affiliateDistributor address not set');
          return;
        }

        console.log('[BFS] Starting BFS for', address);

        // BFS to get per-level members and their teamVolume
        const levelMembers: Map<number, Set<string>> = new Map();
        const levelBusiness: Map<number, bigint> = new Map();
        for (let i = 1; i <= 15; i++) {
          levelMembers.set(i, new Set());
          levelBusiness.set(i, 0n);
        }

        // BFS: start from user's direct referrals (level 1), then their referrals (level 2), etc.
        // Traverse ALL levels (not just 15) to get full team size. Dividend stats limited to 15.
        let currentLevel: string[] = [];
        const deepMembers: string[] = []; // members beyond level 15
        try {
          const directs = await publicClient.readContract({
            address: contractAddr,
            abi: AffiliateDistributorABI,
            functionName: 'getDirectReferrals',
            args: [address],
          }) as string[];
          currentLevel = directs || [];
          console.log('[BFS] Direct referrals:', currentLevel.length);
        } catch (e) { console.error('[BFS] getDirectReferrals failed:', e); currentLevel = []; }

        for (let lvl = 1; currentLevel.length > 0; lvl++) {
          if (lvl <= 15) {
            const membersSet = levelMembers.get(lvl)!;
            for (const addr of currentLevel) membersSet.add(addr.toLowerCase());

            // Batch read getTotalActiveStakeValue for each member at this level (personal stake = their business)
            const stakingAddr = contracts.stakingManager;
            if (stakingAddr && stakingAddr !== '0x') {
              const volCalls = currentLevel.map(addr => ({
                address: stakingAddr,
                abi: StakingManagerABI,
                functionName: 'getTotalActiveStakeValue' as const,
                args: [addr as `0x${string}`],
              }));
              try {
                const results = await publicClient.multicall({ contracts: volCalls });
                let totalVol = 0n;
                for (const r of results) {
                  if (r.status === 'success' && r.result) totalVol += BigInt(r.result as any);
                }
                levelBusiness.set(lvl, totalVol);
              } catch {}
            }
          } else {
            // Beyond level 15: just count members
            for (const addr of currentLevel) deepMembers.push(addr.toLowerCase());
          }

          // Fetch next level referrals (continue BFS for full tree)
          const CHUNK_REF = 200;
          const nextLevel: string[] = [];
          for (let c = 0; c < currentLevel.length; c += CHUNK_REF) {
            const chunk = currentLevel.slice(c, c + CHUNK_REF);
            const refCalls = chunk.map(addr => ({
              address: contractAddr,
              abi: AffiliateDistributorABI,
              functionName: 'getDirectReferrals' as const,
              args: [addr as `0x${string}`],
            }));
            try {
              const results = await publicClient.multicall({ contracts: refCalls });
              for (const r of results) {
                if (r.status === 'success' && Array.isArray(r.result)) {
                  nextLevel.push(...(r.result as string[]));
                }
              }
            } catch {}
          }
          currentLevel = nextLevel;
          if (cancelled) { console.warn('[BFS] Cancelled at level', lvl); return; }
        }

        console.log('[BFS] BFS complete. Level 1 members:', levelMembers.get(1)?.size);
        // Fetch TeamEarned events for this user (indexed as upline)
        // Wrapped in try/catch: some RPCs reject fromBlock:0n log queries
        const levelEarned: Map<number, bigint> = new Map();
        const levelTxCount: Map<number, number> = new Map();
        for (let i = 1; i <= 15; i++) {
          levelEarned.set(i, 0n);
          levelTxCount.set(i, 0);
        }
        try {
          const latestBlock = await publicClient.getBlockNumber();
          const safeFrom = latestBlock > 500_000n ? latestBlock - 500_000n : 0n;
          const teamEarnedLogs = await publicClient.getLogs({
            address: contractAddr,
            event: parseAbiItem('event TeamEarned(address indexed upline, address indexed staker, uint256 level, uint256 amount)'),
            args: { upline: address },
            fromBlock: safeFrom,
            toBlock: 'latest',
          });
          for (const log of teamEarnedLogs) {
            const args = log.args as any;
            const lvl = Number(args.level);
            const amt = BigInt(args.amount || 0);
            if (lvl >= 1 && lvl <= 15) {
              levelEarned.set(lvl, (levelEarned.get(lvl) || 0n) + amt);
              levelTxCount.set(lvl, (levelTxCount.get(lvl) || 0) + 1);
            }
          }
        } catch (logErr) {
          console.warn('Failed to fetch TeamEarned logs (non-fatal):', logErr);
        }

        if (cancelled) { console.warn('[BFS] Cancelled before analytics'); return; }

        const stats: TeamLevelStats[] = [];
        for (let i = 1; i <= 15; i++) {
          const biz = levelBusiness.get(i) || 0n;
          const earned = levelEarned.get(i) || 0n;
          stats.push({
            level: i,
            members: levelMembers.get(i)?.size || 0,
            totalBusiness: biz,
            totalBusinessFormatted: `$${Number(formatUnits(biz, USDT_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
            totalEarned: earned,
            totalEarnedFormatted: `$${Number(formatUnits(earned, USDT_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
            txCount: levelTxCount.get(i) || 0,
          });
        }
        setTeamLevelStats(stats);

        // ── Team Analytics: active directs, direct business, team size, active team stakes ──
        const directAddrs = levelMembers.get(1) ? [...levelMembers.get(1)!] : [];
        console.log('[BFS] Analytics - directAddrs:', directAddrs.length, 'addresses');
        const allTeamAddrs: string[] = [];
        for (let i = 1; i <= 15; i++) {
          const s = levelMembers.get(i);
          if (s) allTeamAddrs.push(...s);
        }
        // Include members beyond level 15 in total count
        allTeamAddrs.push(...deepMembers);
        const totalTeamSize = allTeamAddrs.length;

        // Batch check getTotalActiveStakeValue for direct referrals
        const stakingAddrForAnalytics = contracts.stakingManager;
        let directActive = 0;
        let directBusiness = 0n;
        if (directAddrs.length > 0 && stakingAddrForAnalytics && stakingAddrForAnalytics !== '0x') {
          const stakeCalls = directAddrs.map(addr => ({
            address: stakingAddrForAnalytics,
            abi: StakingManagerABI,
            functionName: 'getTotalActiveStakeValue' as const,
            args: [addr as `0x${string}`],
          }));
          try {
            const results = await publicClient.multicall({ contracts: stakeCalls });
            for (const r of results) {
              if (r.status === 'success') {
                const val = BigInt(r.result as any);
                if (val > 0n) { directActive++; directBusiness += val; }
              }
            }
          } catch (mcErr) { console.error('[BFS] Direct stake multicall FAILED:', mcErr); }
        }

        // Batch check getTotalActiveStakeValue for ALL team members (chunked)
        let activeTeamStakes = 0;
        if (allTeamAddrs.length > 0 && stakingAddrForAnalytics && stakingAddrForAnalytics !== '0x') {
          const CHUNK = 200;
          for (let c = 0; c < allTeamAddrs.length; c += CHUNK) {
            const chunk = allTeamAddrs.slice(c, c + CHUNK);
            const calls = chunk.map(addr => ({
              address: stakingAddrForAnalytics,
              abi: StakingManagerABI,
              functionName: 'getTotalActiveStakeValue' as const,
              args: [addr as `0x${string}`],
            }));
            try {
              const results = await publicClient.multicall({ contracts: calls });
              for (const r of results) {
                if (r.status === 'success' && BigInt(r.result as any) > 0n) activeTeamStakes++;
              }
            } catch (mcErr) { console.error('[BFS] Team stake multicall FAILED:', mcErr); }
          }
        }

        if (cancelled) { console.warn('[BFS] Cancelled before setTeamAnalytics'); return; }

        console.log('[BFS] FINAL:', { directActive, directBusiness: directBusiness.toString(), activeTeamStakes, totalTeamSize });
        setTeamAnalytics({
          directTotal: directAddrs.length,
          directActive,
          totalTeamSize,
          activeTeamStakes,
          directBusiness,
          directBusinessFormatted: `$${Number(formatUnits(directBusiness, USDT_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        });
      } catch (err) {
        console.error('Failed to fetch team level data:', err);
      } finally {
        if (!cancelled) setTeamLevelLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [publicClient, address]);

  const { data: allIncome, isLoading: incomeLoading } = useReadContract({
    address: contracts.affiliateDistributor,
    abi: AffiliateDistributorABI,
    functionName: 'getAllIncome',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contracts.affiliateDistributor !== '0x',
      refetchInterval: 15000,
    },
  });

  const { data: rankInfo, isLoading: rankLoading } = useReadContract({
    address: contracts.affiliateDistributor,
    abi: AffiliateDistributorABI,
    functionName: 'getUserRankInfo',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contracts.affiliateDistributor !== '0x',
      refetchInterval: 30000,
    },
  });

  const { data: directReferrals } = useReadContract({
    address: contracts.affiliateDistributor,
    abi: AffiliateDistributorABI,
    functionName: 'getDirectReferrals',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contracts.affiliateDistributor !== '0x',
    },
  });

  const { data: upline } = useReadContract({
    address: contracts.affiliateDistributor,
    abi: AffiliateDistributorABI,
    functionName: 'getUpline',
    args: address ? [address, BigInt(5)] : undefined,
    query: {
      enabled: !!address && contracts.affiliateDistributor !== '0x',
    },
  });

  const { data: teamVolume } = useReadContract({
    address: contracts.affiliateDistributor,
    abi: AffiliateDistributorABI,
    functionName: 'getTeamVolume',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contracts.affiliateDistributor !== '0x',
      refetchInterval: 30000,
    },
  });

  const { data: unlockedLevels } = useReadContract({
    address: contracts.affiliateDistributor,
    abi: AffiliateDistributorABI,
    functionName: 'getUnlockedLevels',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contracts.affiliateDistributor !== '0x',
      refetchInterval: 30000,
    },
  });

  const { data: totalHarvestable } = useReadContract({
    address: contracts.affiliateDistributor,
    abi: AffiliateDistributorABI,
    functionName: 'getTotalHarvestable',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contracts.affiliateDistributor !== '0x',
      refetchInterval: 15000,
    },
  });

  // Write operations
  const { writeContract: writeHarvest, isPending: harvestPending, data: harvestHash } = useWriteContract();
  const { writeContract: writeCheckRank, isPending: checkRankPending, data: checkRankHash } = useWriteContract();

  const { isSuccess: harvestSuccess, isError: harvestError } = useWaitForTransactionReceipt({ hash: harvestHash });
  const { isSuccess: checkRankSuccess, isError: checkRankError } = useWaitForTransactionReceipt({ hash: checkRankHash });

  useEffect(() => { if (harvestSuccess) toast({ type: 'success', title: 'Income harvested!' }); }, [harvestSuccess]);
  useEffect(() => { if (harvestError) toast({ type: 'error', title: 'Harvest failed' }); }, [harvestError]);
  useEffect(() => { if (checkRankSuccess) toast({ type: 'success', title: 'Rank updated!' }); }, [checkRankSuccess]);
  useEffect(() => { if (checkRankError) toast({ type: 'error', title: 'Rank check failed' }); }, [checkRankError]);

  const harvestIncome = (incomeType: number) => {
    writeHarvest({
      address: contracts.affiliateDistributor,
      abi: AffiliateDistributorABI,
      functionName: 'harvest',
      args: [incomeType],
    });
    toast({ type: 'pending', title: 'Harvesting income...' });
  };

  const checkRankChange = () => {
    if (!address) return;
    writeCheckRank({
      address: contracts.affiliateDistributor,
      abi: AffiliateDistributorABI,
      functionName: 'checkRankChange',
      args: [address],
    });
    toast({ type: 'pending', title: 'Checking rank...' });
  };

  // Fetch per-referral team volumes for leg breakdown & 50% rule
  const referralsList = (directReferrals as `0x${string}`[]) || [];
  const legVolumeContracts = useMemo(() =>
    referralsList.map((ref) => ({
      address: contracts.affiliateDistributor as `0x${string}`,
      abi: AffiliateDistributorABI,
      functionName: 'teamVolume' as const,
      args: [ref] as const,
    })),
    [referralsList.length]
  );

  // Fetch all stakes for each direct referral (to extract principal/originalAmount)
  const legStakeContracts = useMemo(() =>
    referralsList.map((ref) => ({
      address: contracts.stakingManager as `0x${string}`,
      abi: StakingManagerABI,
      functionName: 'getUserStakes' as const,
      args: [ref] as const,
    })),
    [referralsList.length]
  );

  const { data: legVolumesRaw } = useReadContracts({
    contracts: legVolumeContracts,
    query: {
      enabled: referralsList.length > 0 && contracts.affiliateDistributor !== '0x',
      refetchInterval: 30000,
    },
  });

  const { data: legStakesRaw } = useReadContracts({
    contracts: legStakeContracts,
    query: {
      enabled: referralsList.length > 0 && contracts.stakingManager !== '0x',
      refetchInterval: 30000,
    },
  });

  const legVolumes = useMemo(() => {
    if (!legVolumesRaw || !referralsList.length) return [];
    return referralsList.map((ref, i) => {
      const raw = legVolumesRaw[i];
      const vol = raw?.status === 'success' ? BigInt(raw.result as any) : 0n;
      const stakeRaw = legStakesRaw?.[i];
      // Sum originalAmount of active stakes to get principal (excludes compound growth)
      let principalVal = 0n;
      if (stakeRaw?.status === 'success' && Array.isArray(stakeRaw.result)) {
        for (const s of stakeRaw.result as any[]) {
          if (s.active) principalVal += BigInt(s.originalAmount);
        }
      }
      return {
        address: ref,
        volume: vol,
        volumeUsd: Number(formatUnits(vol, USDT_DECIMALS)),
        ownStake: principalVal,
        ownStakeUsd: Number(formatUnits(principalVal, USDT_DECIMALS)),
      };
    });
  }, [legVolumesRaw, legStakesRaw, referralsList.length]);

  const largestLegVolume = useMemo(() => {
    if (!legVolumes.length) return 0n;
    return legVolumes.reduce((max, l) => l.volume > max ? l.volume : max, 0n);
  }, [legVolumes]);

  return {
    allIncome: allIncome as any,
    rankInfo: rankInfo as any,
    // Parsed rank info fields (getUserRankInfo returns: storedRank, liveRank, salary, lastClaimed, nextClaimTime, pendingSalary, totalRankHarvestable)
    storedRank: rankInfo ? Number((rankInfo as any)[0] || 0) : 0,
    liveRank: rankInfo ? Number((rankInfo as any)[1] || 0) : 0,
    rankSalary: rankInfo ? BigInt((rankInfo as any)[2] || 0) : 0n,
    lastRankClaim: rankInfo ? Number((rankInfo as any)[3] || 0) : 0,
    nextRankClaim: rankInfo ? Number((rankInfo as any)[4] || 0) : 0,
    pendingRankSalary: rankInfo ? BigInt((rankInfo as any)[5] || 0) : 0n,
    totalRankHarvestable: rankInfo ? BigInt((rankInfo as any)[6] || 0) : 0n,
    isRankChangePending: rankInfo ? Number((rankInfo as any)[0] || 0) !== Number((rankInfo as any)[1] || 0) : false,
    directReferrals: directReferrals as any,
    upline: upline as string | undefined,
    teamVolume: teamVolume as bigint | undefined,
    unlockedLevels: unlockedLevels != null ? Number(unlockedLevels) : 0,
    legVolumes,
    largestLegVolume,
    claimRankSalary: () => {}, // deprecated: rank salary now auto-accrues
    harvestIncome,
    checkRankChange,
    salaryHistory,
    harvestHistory,
    historyLoading,
    teamLevelStats,
    teamLevelLoading,
    teamAnalytics,
    lifetimeHarvested,
    totalHarvestable: totalHarvestable as bigint | undefined,
    activeDirects: teamAnalytics?.directActive || 0,
    totalHarvestedSalary: harvestHistory.reduce((sum, h) => sum + h.amount, 0n),
    isLoading: incomeLoading || rankLoading,
    isPending: harvestPending || checkRankPending,
  };
}
