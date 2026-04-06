'use client';

import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { contracts } from '@/config/contracts';
import { StakingManagerABI } from '@/config/abis/StakingManager';
import { useToast } from '@/components/ui/Toast';
import { Address } from 'viem';
import { useEffect } from 'react';

export function useStaking() {
  const { toast } = useToast();
  const { address } = useAccount();

  const { writeContract: writeStake, data: stakeHash, isPending: stakePending } = useWriteContract();
  const { writeContract: writeCompound, data: compoundHash, isPending: compoundPending } = useWriteContract();
  const { writeContract: writeHarvest, data: harvestHash, isPending: harvestPending } = useWriteContract();
  const { writeContract: writeUnstake, data: unstakeHash, isPending: unstakePending } = useWriteContract();

  const { isSuccess: stakeSuccess, isError: stakeError } = useWaitForTransactionReceipt({ hash: stakeHash });
  const { isSuccess: compoundSuccess, isError: compoundError } = useWaitForTransactionReceipt({ hash: compoundHash });
  const { isSuccess: harvestSuccess, isError: harvestError } = useWaitForTransactionReceipt({ hash: harvestHash });
  const { isSuccess: unstakeSuccess, isError: unstakeError } = useWaitForTransactionReceipt({ hash: unstakeHash });

  useEffect(() => { if (stakeSuccess) toast({ type: 'success', title: 'Staked successfully!' }); }, [stakeSuccess]);
  useEffect(() => { if (stakeError) toast({ type: 'error', title: 'Stake failed' }); }, [stakeError]);
  useEffect(() => { if (compoundSuccess) toast({ type: 'success', title: 'Compounded successfully!' }); }, [compoundSuccess]);
  useEffect(() => { if (compoundError) toast({ type: 'error', title: 'Compound failed' }); }, [compoundError]);
  useEffect(() => { if (harvestSuccess) toast({ type: 'success', title: 'Harvested successfully!' }); }, [harvestSuccess]);
  useEffect(() => { if (harvestError) toast({ type: 'error', title: 'Harvest failed' }); }, [harvestError]);
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

  const compound = async (stakeIndex: bigint) => {
    try {
      writeCompound({
        address: contracts.stakingManager,
        abi: StakingManagerABI,
        functionName: 'compound',
        args: [stakeIndex],
      });
      toast({ type: 'pending', title: 'Compounding...', description: 'Confirming transaction' });
    } catch (err: any) {
      toast({ type: 'error', title: 'Compound Failed', description: err?.message?.slice(0, 100) });
    }
  };

  const harvest = async (stakeIndex: bigint, amount: bigint) => {
    try {
      writeHarvest({
        address: contracts.stakingManager,
        abi: StakingManagerABI,
        functionName: 'harvest',
        args: [stakeIndex, amount],
      });
      toast({ type: 'pending', title: 'Harvesting...', description: 'Confirming transaction' });
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
    unstake,
    isPending: stakePending || compoundPending || harvestPending || unstakePending,
    stakeHash,
    compoundHash,
    harvestHash,
    unstakeHash,
  };
}
