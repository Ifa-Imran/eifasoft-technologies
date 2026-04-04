'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useAccount } from 'wagmi';
import { CONTRACTS, StakingManagerABI } from '@/lib/contracts';

export interface Stake {
  amount: bigint;
  originalAmount: bigint;
  startTime: bigint;
  lastCompoundTime: bigint;
  harvestedRewards: bigint;
  totalEarned: bigint;
  active: boolean;
  tier: number;
}

export function useStaking() {
  const { address } = useAccount();
  const { writeContract, data: txHash, isPending: isWritePending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });

  // Read user stakes
  const {
    data: stakes,
    isLoading: isLoadingStakes,
    refetch: refetchStakes,
  } = useReadContract({
    address: CONTRACTS.STAKING_MANAGER,
    abi: StakingManagerABI,
    functionName: 'getUserStakes',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!CONTRACTS.STAKING_MANAGER,
      refetchInterval: 30_000,
    },
  });

  // Read total active stake value
  const { data: totalStakeValue } = useReadContract({
    address: CONTRACTS.STAKING_MANAGER,
    abi: StakingManagerABI,
    functionName: 'getTotalActiveStakeValue',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!CONTRACTS.STAKING_MANAGER,
      refetchInterval: 30_000,
    },
  });

  // Write operations
  const stake = (usdtAmount: bigint, referrer: `0x${string}`) => {
    writeContract({
      address: CONTRACTS.STAKING_MANAGER,
      abi: StakingManagerABI,
      functionName: 'stake',
      args: [usdtAmount, referrer],
    });
  };

  const compound = (stakeId: bigint) => {
    writeContract({
      address: CONTRACTS.STAKING_MANAGER,
      abi: StakingManagerABI,
      functionName: 'compound',
      args: [stakeId],
    });
  };

  const unstake = (stakeId: bigint) => {
    writeContract({
      address: CONTRACTS.STAKING_MANAGER,
      abi: StakingManagerABI,
      functionName: 'unstake',
      args: [stakeId],
    });
  };

  const harvest = (stakeId: bigint, amount: bigint) => {
    writeContract({
      address: CONTRACTS.STAKING_MANAGER,
      abi: StakingManagerABI,
      functionName: 'harvest',
      args: [stakeId, amount],
    });
  };

  return {
    stakes: (stakes as Stake[] | undefined) ?? [],
    totalStakeValue,
    isLoadingStakes,
    refetchStakes,
    stake,
    compound,
    unstake,
    harvest,
    isWritePending,
    isConfirming,
    txHash,
  };
}
