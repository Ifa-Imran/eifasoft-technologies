'use client';

import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useAccount, usePublicClient } from 'wagmi';
import { contracts, USDT_DECIMALS } from '@/config/contracts';
import { AffiliateDistributorABI } from '@/config/abis/AffiliateDistributor';
import { StakingManagerABI } from '@/config/abis/StakingManager';
import { useToast } from '@/components/ui/Toast';
import { useEffect, useMemo, useState } from 'react';
import { formatUnits, parseAbiItem } from 'viem';
import { usePostAction } from '@/hooks/usePostAction';

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
  const { runPostActionTasks } = usePostAction();

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

  // Fetch team level data with COMPRESSION: skip inactive users when counting levels.
  // Each member's compressed level = parent's compressed level + (1 if active, 0 if inactive).
  // Matches the contract's distributeTeamDividend() compression logic.
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
        const stakingAddr = contracts.stakingManager;

        console.log('[BFS] Starting compressed BFS for', address);

        // Compressed level buckets
        const levelMembers: Map<number, Set<string>> = new Map();
        const levelBusiness: Map<number, bigint> = new Map();
        for (let i = 1; i <= 15; i++) {
          levelMembers.set(i, new Set());
          levelBusiness.set(i, 0n);
        }

        // BFS entry: address + parentCompressedLevel
        interface BFSEntry { addr: string; parentCL: number; }
        const MAX_BFS_DEPTH = 50; // match contract MAX_TREE_DEPTH
        const CHUNK = 200;

        // All team addresses (for analytics)
        const allTeamAddrs: string[] = [];
        const deepMembers: string[] = [];
        // Map address -> compressed level (for parent lookups)
        const memberCL = new Map<string, number>();

        // Direct referrals
        let currentBatch: BFSEntry[] = [];
        let directAddrs: string[] = [];
        try {
          const directs = await publicClient.readContract({
            address: contractAddr,
            abi: AffiliateDistributorABI,
            functionName: 'getDirectReferrals',
            args: [address],
          }) as string[];
          directAddrs = directs || [];
          currentBatch = directAddrs.map(a => ({ addr: a, parentCL: 0 }));
          console.log('[BFS] Direct referrals:', directAddrs.length);
        } catch (e) { console.error('[BFS] getDirectReferrals failed:', e); }

        let directActive = 0;
        let directBusiness = 0n;
        let activeTeamStakes = 0;

        for (let bfsDepth = 1; bfsDepth <= MAX_BFS_DEPTH && currentBatch.length > 0; bfsDepth++) {
          const addrs = currentBatch.map(e => e.addr);
          allTeamAddrs.push(...addrs.map(a => a.toLowerCase()));

          // Batch fetch all stakes for each member to get principal (originalAmount)
          let memberStakes: { isActive: boolean; principalVal: bigint }[] = [];
          if (stakingAddr && stakingAddr !== '0x') {
            const stakeCalls = addrs.map(addr => ({
              address: stakingAddr,
              abi: StakingManagerABI,
              functionName: 'getUserStakes' as const,
              args: [addr as `0x${string}`],
            }));
            try {
              const results = await publicClient.multicall({ contracts: stakeCalls });
              memberStakes = results.map(r => {
                if (r.status !== 'success' || !Array.isArray(r.result)) return { isActive: false, principalVal: 0n };
                let principal = 0n;
                let hasActive = false;
                for (const s of r.result as any[]) {
                  if (s.active) {
                    hasActive = true;
                    principal += BigInt(s.originalAmount);
                  }
                }
                return { isActive: hasActive, principalVal: principal };
              });
            } catch { memberStakes = addrs.map(() => ({ isActive: false, principalVal: 0n })); }
          } else {
            memberStakes = addrs.map(() => ({ isActive: false, principalVal: 0n }));
          }

          // Assign compressed levels and bucket members
          for (let j = 0; j < currentBatch.length; j++) {
            const { addr, parentCL } = currentBatch[j];
            const { isActive, principalVal } = memberStakes[j];
            const myCL = isActive ? parentCL + 1 : parentCL;
            memberCL.set(addr.toLowerCase(), myCL);

            if (isActive) activeTeamStakes++;

            // Track direct referral analytics (BFS depth 1) — use principal only
            if (bfsDepth === 1 && isActive) {
              directActive++;
              directBusiness += principalVal;
            }

            // Place into compressed level bucket — business = principal only
            if (myCL >= 1 && myCL <= 15) {
              levelMembers.get(myCL)!.add(addr.toLowerCase());
              if (isActive) {
                levelBusiness.set(myCL, (levelBusiness.get(myCL) || 0n) + principalVal);
              }
            } else if (myCL > 15) {
              deepMembers.push(addr.toLowerCase());
            }
            // myCL === 0: inactive member with no active ancestor between them and user
          }

          // Fetch next BFS level referrals
          const nextBatch: BFSEntry[] = [];
          for (let c = 0; c < addrs.length; c += CHUNK) {
            const chunk = currentBatch.slice(c, c + CHUNK);
            const refCalls = chunk.map(e => ({
              address: contractAddr,
              abi: AffiliateDistributorABI,
              functionName: 'getDirectReferrals' as const,
              args: [e.addr as `0x${string}`],
            }));
            try {
              const results = await publicClient.multicall({ contracts: refCalls });
              for (let k = 0; k < chunk.length; k++) {
                const parentAddr = chunk[k].addr;
                const pCL = memberCL.get(parentAddr.toLowerCase()) || 0;
                const r = results[k];
                if (r?.status === 'success' && Array.isArray(r.result)) {
                  for (const ref of r.result as string[]) {
                    nextBatch.push({ addr: ref, parentCL: pCL });
                  }
                }
              }
            } catch {}
          }
          currentBatch = nextBatch;
          if (cancelled) { console.warn('[BFS] Cancelled at depth', bfsDepth); return; }
        }

        allTeamAddrs.push(...deepMembers);
        const totalTeamSize = allTeamAddrs.length;

        console.log('[BFS] Compressed BFS complete. Total team:', totalTeamSize, 'Active stakes:', activeTeamStakes);

        // Fetch TeamEarned events (contract already emits compressed level numbers)
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

  useEffect(() => { if (harvestSuccess) { toast({ type: 'success', title: 'Income harvested!' }); runPostActionTasks(); } }, [harvestSuccess]);
  useEffect(() => { if (harvestError) toast({ type: 'error', title: 'Harvest failed' }); }, [harvestError]);
  useEffect(() => { if (checkRankSuccess) { toast({ type: 'success', title: 'Rank updated!' }); runPostActionTasks(); } }, [checkRankSuccess]);
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

  // Fetch per-referral team volumes for leg breakdown & 50%-of-rank-target rule
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

  // Fetch personalVolume for each direct referral (own stake volume)
  const legPersonalVolumeContracts = useMemo(() =>
    referralsList.map((ref) => ({
      address: contracts.affiliateDistributor as `0x${string}`,
      abi: AffiliateDistributorABI,
      functionName: 'personalVolume' as const,
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

  const { data: legPersonalVolumesRaw } = useReadContracts({
    contracts: legPersonalVolumeContracts,
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
      const teamVol = raw?.status === 'success' ? BigInt(raw.result as any) : 0n;
      const personalRaw = legPersonalVolumesRaw?.[i];
      const personalVol = personalRaw?.status === 'success' ? BigInt(personalRaw.result as any) : 0n;
      // Total leg volume = referral's own stake + their downline volume
      const vol = personalVol + teamVol;
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
  }, [legVolumesRaw, legPersonalVolumesRaw, legStakesRaw, referralsList.length]);

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
