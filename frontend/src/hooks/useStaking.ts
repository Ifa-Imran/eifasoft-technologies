'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount, usePublicClient } from 'wagmi';
import { contracts } from '@/config/contracts';
import { StakingManagerABI } from '@/config/abis/StakingManager';
import { useToast } from '@/components/ui/Toast';
import { Address } from 'viem';
import { useEffect, useRef, useCallback, useState } from 'react';
import type { StakeInfo } from '@/hooks/useUserStakes';
// Compounding is MANUAL — the user must explicitly click "Compound" per tier.
// The contract no longer auto-compounds on stake/unstake/harvest.

export function useStaking() {
  const { toast } = useToast();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [harvesting, setHarvesting] = useState(false);
  const [compounding, setCompounding] = useState(false);


  const { writeContractAsync } = useWriteContract();

  const { writeContract: writeStake, data: stakeHash, isPending: stakePending } = useWriteContract();
  const { writeContract: writeUnstake, data: unstakeHash, isPending: unstakePending } = useWriteContract();
  const { writeContract: writeSetAutoCompound, data: setAutoCompoundHash, isPending: setAutoCompoundPending } = useWriteContract();

  // Read current auto-compound preference
  const { data: autoCompoundEnabled } = useReadContract({
    address: contracts.stakingManager,
    abi: StakingManagerABI,
    functionName: 'autoCompoundEnabled',
    args: address ? [address] : undefined,
    query: { enabled: !!address && contracts.stakingManager !== '0x', refetchInterval: 30000 },
  });

  const { isSuccess: stakeSuccess, isError: stakeError } = useWaitForTransactionReceipt({ hash: stakeHash });
  const { isSuccess: unstakeSuccess, isError: unstakeError } = useWaitForTransactionReceipt({ hash: unstakeHash });
  const { isSuccess: setAutoCompoundSuccess, isError: setAutoCompoundError } = useWaitForTransactionReceipt({ hash: setAutoCompoundHash });

  // Compounding is manual — user clicks "Compound" button per tier card.
  useEffect(() => { if (stakeSuccess) toast({ type: 'success', title: 'Staked successfully!' }); }, [stakeSuccess]);
  useEffect(() => { if (stakeError) toast({ type: 'error', title: 'Stake failed' }); }, [stakeError]);
  useEffect(() => { if (unstakeSuccess) toast({ type: 'success', title: 'Unstaked successfully!' }); }, [unstakeSuccess]);
  useEffect(() => { if (unstakeError) toast({ type: 'error', title: 'Unstake failed' }); }, [unstakeError]);
  useEffect(() => { if (setAutoCompoundSuccess) toast({ type: 'success', title: 'Auto-compound updated!' }); }, [setAutoCompoundSuccess]);
  useEffect(() => { if (setAutoCompoundError) toast({ type: 'error', title: 'Auto-compound toggle failed' }); }, [setAutoCompoundError]);

  const stake = async (amount: bigint, referrer: Address) => {
    try {
      writeStake({
        address: contracts.stakingManager,
        abi: StakingManagerABI,
        functionName: 'stake',
        args: [amount, referrer],
      });
      toast({ type: 'pending', title: 'Staking...', description: 'Confirming transaction' });
    } catch (err: any) {
      toast({ type: 'error', title: 'Stake Failed', description: err?.message?.slice(0, 100) });
    }
  };

  /**
   * Harvest flow:
   * Compounding is now manual — harvest() pulls accrued (already-compounded)
   * profit only. Use compoundTier() first if there is unclaimed pending profit.
   */
  const harvestTier = useCallback(async (tierStakes: StakeInfo[]) => {
    if (!publicClient || !address) return;
    setHarvesting(true);
    try {
      const MIN = BigInt(10) * BigInt(10 ** 18);
      // Only harvest stakes with crystallized on-chain harvestable AND meeting $10 minimum per stake.
      const harvestable = tierStakes.filter((s) => s.harvestable >= MIN);
      if (harvestable.length === 0) {
        // Check if there is harvestable below minimum
        const belowMin = tierStakes.filter((s) => s.harvestable > 0n && s.harvestable < MIN);
        if (belowMin.length > 0) {
          toast({ type: 'error', title: 'Below per-stake minimum', description: 'Each stake needs at least $10 harvestable individually. Keep compounding to accumulate more.' });
        } else {
          toast({ type: 'error', title: 'Nothing to harvest', description: 'Click Compound first to crystallize pending profit.' });
        }
        return;
      }
      toast({ type: 'pending', title: 'Harvesting...', description: `Harvesting ${harvestable.length} stake(s)` });
      let success = 0;
      for (const s of harvestable) {
        try {
          const hash = await writeContractAsync({
            address: contracts.stakingManager,
            abi: StakingManagerABI,
            functionName: 'harvest',
            args: [BigInt(s.index), s.harvestable],
          });
          await publicClient.waitForTransactionReceipt({ hash });
          success++;
        } catch {
          // Skip stakes that fail individually (per-stake revert)
        }
      }
      if (success > 0) {
        toast({ type: 'success', title: 'Harvest complete!', description: `${success} stake(s) harvested` });
      } else {
        toast({ type: 'error', title: 'Harvest failed', description: 'Transaction reverted on-chain. Try compounding again first.' });
      }
    } catch (err: any) {
      toast({ type: 'error', title: 'Harvest Failed', description: err?.message?.slice(0, 100) });
    } finally {
      setHarvesting(false);
    }
  }, [publicClient, address, writeContractAsync, toast]);

  /** Compound a single stake (used internally / for background auto-compound) */
  const compound = useCallback(async (stakeIndex: bigint) => {
    if (!publicClient) return;
    try {
      const hash = await writeContractAsync({
        address: contracts.stakingManager,
        abi: StakingManagerABI,
        functionName: 'compound',
        args: [stakeIndex],
      });
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (err: any) {
      // Silently fail for background compounds
    }
  }, [publicClient, writeContractAsync]);

  /** Compound a stake on behalf of another user (requires operator/dao role) */
  const compoundFor = useCallback(async (user: Address, stakeIndex: bigint) => {
    if (!publicClient) return;
    try {
      const hash = await writeContractAsync({
        address: contracts.stakingManager,
        abi: StakingManagerABI,
        functionName: 'compoundFor',
        args: [user, stakeIndex],
      });
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (err: any) {
      // CompoundFor may fail if caller lacks role
    }
  }, [publicClient, writeContractAsync]);

  /**
   * Manually compound every eligible stake in a tier.
   * One signature per stake (the contract has no batch compound for arbitrary
   * users). Stakes whose interval has not yet elapsed are skipped silently.
   */
  const compoundTier = useCallback(async (tierStakes: StakeInfo[]) => {
    if (!publicClient || !address) return;
    setCompounding(true);
    try {
      const eligible = tierStakes.filter((s) => s.active && s.canCompound);
      if (eligible.length === 0) {
        toast({ type: 'error', title: 'Nothing to compound yet', description: 'Wait for the next interval to elapse.' });
        return;
      }
      toast({ type: 'pending', title: 'Compounding...', description: `Compounding ${eligible.length} stake(s)` });
      let success = 0;
      let userRejected = false;
      for (const s of eligible) {
        try {
          const hash = await writeContractAsync({
            address: contracts.stakingManager,
            abi: StakingManagerABI,
            functionName: 'compound',
            args: [BigInt(s.index)],
          });
          await publicClient.waitForTransactionReceipt({ hash });
          success++;
        } catch (err: any) {
          // If user rejected the wallet prompt, stop asking for more approvals
          const msg = (err?.message || err?.shortMessage || '').toLowerCase();
          if (msg.includes('user rejected') || msg.includes('user denied') || msg.includes('rejected') || err?.name === 'UserRejectedRequestError') {
            userRejected = true;
            break;
          }
          // Otherwise skip — stake may have just been compounded or not yet eligible
        }
      }
      if (success > 0 && userRejected) {
        toast({ type: 'success', title: 'Compound partial', description: `${success} stake(s) compounded. Click again for the rest.` });
      } else if (success > 0) {
        toast({ type: 'success', title: 'Compound complete!', description: `${success} stake(s) compounded` });
      } else if (userRejected) {
        toast({ type: 'error', title: 'Compound cancelled', description: 'Transaction rejected. Click Compound again when ready.' });
      } else {
        toast({ type: 'error', title: 'Compound failed', description: 'No stakes were compounded.' });
      }
    } catch (err: any) {
      toast({ type: 'error', title: 'Compound Failed', description: err?.message?.slice(0, 100) });
    } finally {
      setCompounding(false);
    }
  }, [publicClient, address, writeContractAsync, toast]);

  const harvest = async (stakeIndex: bigint, amount: bigint) => {
    try {
      const hash = await writeContractAsync({
        address: contracts.stakingManager,
        abi: StakingManagerABI,
        functionName: 'harvest',
        args: [stakeIndex, amount],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      toast({ type: 'success', title: 'Harvested successfully!' });
    } catch (err: any) {
      toast({ type: 'error', title: 'Harvest Failed', description: err?.message?.slice(0, 100) });
    }
  };

  const unstake = async (stakeIndex: bigint) => {
    try {
      writeUnstake({
        address: contracts.stakingManager,
        abi: StakingManagerABI,
        functionName: 'unstake',
        args: [stakeIndex],
      });
      toast({ type: 'pending', title: 'Unstaking...', description: 'Confirming transaction' });
    } catch (err: any) {
      toast({ type: 'error', title: 'Unstake Failed', description: err?.message?.slice(0, 100) });
    }
  };

  /** Toggle auto-compound on/off for the connected user. */
  const setAutoCompound = (enabled: boolean) => {
    try {
      writeSetAutoCompound({
        address: contracts.stakingManager,
        abi: StakingManagerABI,
        functionName: 'setAutoCompound',
        args: [enabled],
      });
      toast({ type: 'pending', title: enabled ? 'Enabling auto-compound...' : 'Disabling auto-compound...' });
    } catch (err: any) {
      toast({ type: 'error', title: 'Auto-compound toggle failed', description: err?.message?.slice(0, 100) });
    }
  };

  return {
    stake,
    compound,
    compoundFor,
    compoundTier,
    harvest,
    harvestTier,
    unstake,
    setAutoCompound,
    autoCompoundEnabled: autoCompoundEnabled === true,
    isPending: stakePending || unstakePending || setAutoCompoundPending || harvesting || compounding,
    isCompounding: compounding,
    stakeHash,
    unstakeHash,
  };
}
