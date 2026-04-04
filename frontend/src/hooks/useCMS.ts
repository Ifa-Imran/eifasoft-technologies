'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useAccount } from 'wagmi';
import { CONTRACTS, CoreMembershipSubscriptionABI } from '@/lib/contracts';

export function useCMS() {
  const { address } = useAccount();
  const { writeContract, data: txHash, isPending: isWritePending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });

  // Read claimable rewards
  const { data: claimableRewards, refetch: refetchRewards } = useReadContract({
    address: CONTRACTS.CMS,
    abi: CoreMembershipSubscriptionABI,
    functionName: 'getClaimableRewards',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!CONTRACTS.CMS,
      refetchInterval: 30_000,
    },
  });

  // Read max claimable
  const { data: maxClaimable } = useReadContract({
    address: CONTRACTS.CMS,
    abi: CoreMembershipSubscriptionABI,
    functionName: 'getMaxClaimable',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!CONTRACTS.CMS },
  });

  // Read excess to be deleted
  const { data: excessToDelete } = useReadContract({
    address: CONTRACTS.CMS,
    abi: CoreMembershipSubscriptionABI,
    functionName: 'getExcessToBeDeleted',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!CONTRACTS.CMS },
  });

  // Read subscription count
  const { data: subscriptionCount } = useReadContract({
    address: CONTRACTS.CMS,
    abi: CoreMembershipSubscriptionABI,
    functionName: 'getSubscriptionCount',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!CONTRACTS.CMS },
  });

  // Read remaining subscriptions
  const { data: remainingSubscriptions } = useReadContract({
    address: CONTRACTS.CMS,
    abi: CoreMembershipSubscriptionABI,
    functionName: 'getRemainingSubscriptions',
    query: { enabled: !!CONTRACTS.CMS },
  });

  // Read deadline
  const { data: deadline } = useReadContract({
    address: CONTRACTS.CMS,
    abi: CoreMembershipSubscriptionABI,
    functionName: 'deadline',
    query: { enabled: !!CONTRACTS.CMS },
  });

  // Check if can claim
  const { data: canClaimResult } = useReadContract({
    address: CONTRACTS.CMS,
    abi: CoreMembershipSubscriptionABI,
    functionName: 'canClaim',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!CONTRACTS.CMS },
  });

  // Read has claimed
  const { data: hasClaimed } = useReadContract({
    address: CONTRACTS.CMS,
    abi: CoreMembershipSubscriptionABI,
    functionName: 'hasClaimed',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!CONTRACTS.CMS },
  });

  // Write operations
  const subscribe = (amount: bigint, referrer: `0x${string}`) => {
    writeContract({
      address: CONTRACTS.CMS,
      abi: CoreMembershipSubscriptionABI,
      functionName: 'subscribe',
      args: [amount, referrer],
    });
  };

  const claimRewards = () => {
    writeContract({
      address: CONTRACTS.CMS,
      abi: CoreMembershipSubscriptionABI,
      functionName: 'claimCMSRewards',
    });
  };

  return {
    claimableRewards,
    maxClaimable,
    excessToDelete,
    subscriptionCount,
    remainingSubscriptions,
    deadline,
    canClaimResult,
    hasClaimed,
    subscribe,
    claimRewards,
    refetchRewards,
    isWritePending,
    isConfirming,
    txHash,
  };
}
