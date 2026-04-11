'use client';

import { useWriteContract, useWaitForTransactionReceipt, useAccount, usePublicClient } from 'wagmi';
import { contracts } from '@/config/contracts';
import { StakingManagerABI } from '@/config/abis/StakingManager';
import { useToast } from '@/components/ui/Toast';
import { Address } from 'viem';
import { useEffect, useRef, useCallback, useState } from 'react';
import type { StakeInfo } from '@/hooks/useUserStakes';

export function useStaking() {
  const { toast } = useToast();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [harvesting, setHarvesting] = useState(false);

  const { writeContractAsync } = useWriteContract();

  const { writeContract: writeStake, data: stakeHash, isPending: stakePending } = useWriteContract();
  const { writeContract: writeUnstake, data: unstakeHash, isPending: unstakePending } = useWriteContract();

  const { isSuccess: stakeSuccess, isError: stakeError } = useWaitForTransactionReceipt({ hash: stakeHash });
  const { isSuccess: unstakeSuccess, isError: unstakeError } = useWaitForTransactionReceipt({ hash: unstakeHash });

  useEffect(() => { if (stakeSuccess) toast({ type: 'success', title: 'Staked successfully!' }); }, [stakeSuccess]);
  useEffect(() => { if (stakeError) toast({ type: 'error', title: 'Stake failed' }); }, [stakeError]);
  useEffect(() => { if (unstakeSuccess) toast({ type: 'success', title: 'Unstaked successfully!' }); }, [unstakeSuccess]);
  useEffect(() => { if (unstakeError) toast({ type: 'error', title: 'Unstake failed' }); }, [unstakeError]);

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
   * Auto-compound + harvest flow:
   * 1. Compound all eligible stakes in the tier (pending intervals > 0)
   * 2. Then harvest all harvestable amounts from each stake
   */
  const harvestTier = useCallback(async (tierStakes: StakeInfo[]) => {
    if (!publicClient || !address) return;
    setHarvesting(true);
    try {
      // Step 1: Compound all stakes that have pending intervals
      const compoundable = tierStakes.filter((s) => s.canCompound);
      if (compoundable.length > 0) {
        toast({ type: 'pending', title: 'Auto-compounding...', description: `Compounding ${compoundable.length} stake(s)` });
        for (const s of compoundable) {
          const hash = await writeContractAsync({
            address: contracts.stakingManager,
            abi: StakingManagerABI,
            functionName: 'compound',
            args: [BigInt(s.index)],
          });
          await publicClient.waitForTransactionReceipt({ hash });
        }
        toast({ type: 'success', title: 'Auto-compound complete' });
      }

      // Step 2: Harvest from each stake that has harvestable balance
      const harvestable = tierStakes.filter((s) => s.harvestable > 0n);
      if (harvestable.length > 0) {
        toast({ type: 'pending', title: 'Harvesting...', description: `Harvesting from ${harvestable.length} stake(s)` });
        for (const s of harvestable) {
          const hash = await writeContractAsync({
            address: contracts.stakingManager,
            abi: StakingManagerABI,
            functionName: 'harvest',
            args: [BigInt(s.index), s.harvestable],
          });
          await publicClient.waitForTransactionReceipt({ hash });
        }
        toast({ type: 'success', title: 'Harvest complete!' });
      } else if (compoundable.length === 0) {
        toast({ type: 'error', title: 'Nothing to harvest yet' });
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

  return {
    stake,
    compound,
    harvest,
    harvestTier,
    unstake,
    isPending: stakePending || unstakePending || harvesting,
    stakeHash,
    unstakeHash,
  };
}
