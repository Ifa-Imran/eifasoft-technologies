'use client';

import { useCallback } from 'react';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { contracts } from '@/config/contracts';
import { StakingManagerABI } from '@/config/abis/StakingManager';
import { AffiliateDistributorABI } from '@/config/abis/AffiliateDistributor';
import { useToast } from '@/components/ui/Toast';

/**
 * Hook that provides post-action tasks: auto-compound eligible stakes + sync rank.
 * Called after successful user actions (stake, unstake, harvest, register, claim).
 * All transactions are signed by the user's wallet — no backend signer needed.
 */
export function usePostAction() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { toast } = useToast();

  /**
   * Compound all eligible stakes for the current user.
   * Silently skips stakes that aren't ready for compound.
   */
  const compoundAllEligible = useCallback(async () => {
    if (!address || !publicClient) return;

    try {
      // Read user's stakes from the contract
      const stakes = await publicClient.readContract({
        address: contracts.stakingManager,
        abi: StakingManagerABI,
        functionName: 'getUserStakes',
        args: [address],
      }) as any[];

      if (!stakes || stakes.length === 0) return;

      const now = Math.floor(Date.now() / 1000);
      // TESTING intervals: Tier0=900s, Tier1=600s, Tier2=300s
      const intervals = [900, 600, 300];

      let compounded = 0;
      for (let i = 0; i < stakes.length; i++) {
        const s = stakes[i];
        if (!s.active) continue;

        const tier = Number(s.tier || 0);
        const lastCompound = Number(s.lastCompoundTime || 0);
        const interval = intervals[tier] || 900;

        if (now < lastCompound + interval) continue;

        try {
          const hash = await writeContractAsync({
            address: contracts.stakingManager,
            abi: StakingManagerABI,
            functionName: 'compound',
            args: [BigInt(i)],
          });
          await publicClient.waitForTransactionReceipt({ hash });
          compounded++;
        } catch {
          // Silently skip — stake may not be ready or already compounded
        }
      }

      if (compounded > 0) {
        console.log(`[PostAction] Compounded ${compounded} stake(s)`);
      }
    } catch (err) {
      console.warn('[PostAction] Auto-compound failed (non-critical):', err);
    }
  }, [address, publicClient, writeContractAsync]);

  /**
   * Trigger on-chain rank recalculation for the current user.
   * This calls checkRankChange() on AffiliateDistributor (permissionless).
   */
  const syncRank = useCallback(async () => {
    if (!address || !publicClient) return;

    try {
      const hash = await writeContractAsync({
        address: contracts.affiliateDistributor,
        abi: AffiliateDistributorABI,
        functionName: 'checkRankChange',
        args: [address],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log('[PostAction] Rank synced');
    } catch {
      // Silently skip — rank check may revert if no change needed
    }
  }, [address, publicClient, writeContractAsync]);

  /**
   * Run all post-action tasks: compound eligible stakes + sync rank.
   * Called after successful user actions. Shows a toast while running.
   * All failures are silently handled — these are best-effort operations.
   */
  const runPostActionTasks = useCallback(async () => {
    if (!address) return;

    try {
      toast({ type: 'pending', title: 'Syncing rewards...', description: 'Compounding & updating rank' });
      await compoundAllEligible();
      await syncRank();
    } catch {
      // Non-critical — silently skip
    }
  }, [address, compoundAllEligible, syncRank, toast]);

  return {
    compoundAllEligible,
    syncRank,
    runPostActionTasks,
  };
}
