'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount, usePublicClient } from 'wagmi';
import { contracts, KAIRO_DECIMALS } from '@/config/contracts';
import { CoreMembershipSubscriptionABI } from '@/config/abis/CoreMembershipSubscription';
import { useToast } from '@/components/ui/Toast';
import { Address, formatUnits } from 'viem';
import { useEffect, useCallback } from 'react';

export function useCMS() {
  const { toast } = useToast();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { writeContract: writeSubscribe, data: subscribeHash, isPending: subscribePending } = useWriteContract();
  const { writeContract: writeClaim, data: claimHash, isPending: claimPending } = useWriteContract();

  const { isSuccess: subscribeSuccess, isError: subscribeError } = useWaitForTransactionReceipt({ hash: subscribeHash });
  const { isSuccess: claimSuccess, isError: claimError } = useWaitForTransactionReceipt({ hash: claimHash });

  const enabled = !!address && contracts.cms !== '0x';

  // ── Read subscription count ──
  const { data: subscriptionCount, refetch: refetchSubCount } = useReadContract({
    address: contracts.cms,
    abi: CoreMembershipSubscriptionABI,
    functionName: 'getSubscriptionCount',
    args: address ? [address] : undefined,
    query: { enabled, refetchInterval: 15000 },
  });

  // ── Read claimable rewards ──
  const { data: claimableRewards, refetch: refetchClaimable } = useReadContract({
    address: contracts.cms,
    abi: CoreMembershipSubscriptionABI,
    functionName: 'getClaimableRewards',
    args: address ? [address] : undefined,
    query: { enabled, refetchInterval: 15000 },
  });

  // ── Read max claimable ──
  const { data: maxClaimable } = useReadContract({
    address: contracts.cms,
    abi: CoreMembershipSubscriptionABI,
    functionName: 'getMaxClaimable',
    args: address ? [address] : undefined,
    query: { enabled, refetchInterval: 15000 },
  });

  // ── Read excess to be deleted ──
  const { data: excessToBeDeleted } = useReadContract({
    address: contracts.cms,
    abi: CoreMembershipSubscriptionABI,
    functionName: 'getExcessToBeDeleted',
    args: address ? [address] : undefined,
    query: { enabled, refetchInterval: 15000 },
  });

  // ── Read remaining subscriptions ──
  const { data: remainingSubscriptions } = useReadContract({
    address: contracts.cms,
    abi: CoreMembershipSubscriptionABI,
    functionName: 'getRemainingSubscriptions',
    query: { enabled: contracts.cms !== '0x', refetchInterval: 30000 },
  });

  // ── Read if subscription period ended ──
  const { data: isSubscriptionEnded } = useReadContract({
    address: contracts.cms,
    abi: CoreMembershipSubscriptionABI,
    functionName: 'isSubscriptionEnded',
    query: { enabled: contracts.cms !== '0x', refetchInterval: 30000 },
  });

  // ── Read if claim deadline passed ──
  const { data: isClaimDeadlinePassed } = useReadContract({
    address: contracts.cms,
    abi: CoreMembershipSubscriptionABI,
    functionName: 'isClaimDeadlinePassed',
    query: { enabled: contracts.cms !== '0x', refetchInterval: 30000 },
  });

  // ── Read canClaim status ──
  const { data: canClaimData } = useReadContract({
    address: contracts.cms,
    abi: CoreMembershipSubscriptionABI,
    functionName: 'canClaim',
    args: address ? [address] : undefined,
    query: { enabled, refetchInterval: 15000 },
  });

  // ── Read hasClaimed ──
  const { data: hasClaimed } = useReadContract({
    address: contracts.cms,
    abi: CoreMembershipSubscriptionABI,
    functionName: 'hasClaimed',
    args: address ? [address] : undefined,
    query: { enabled, refetchInterval: 15000 },
  });

  // ── Read level details ──
  const { data: levelDetails } = useReadContract({
    address: contracts.cms,
    abi: CoreMembershipSubscriptionABI,
    functionName: 'getLevelDetails',
    args: address ? [address] : undefined,
    query: { enabled, refetchInterval: 30000 },
  });

  // ── Toast effects ──
  useEffect(() => { if (subscribeSuccess) toast({ type: 'success', title: 'Subscription purchased!' }); }, [subscribeSuccess]);
  useEffect(() => { if (subscribeError) toast({ type: 'error', title: 'Subscription failed' }); }, [subscribeError]);
  useEffect(() => { if (claimSuccess) toast({ type: 'success', title: 'CMS rewards claimed!' }); }, [claimSuccess]);
  useEffect(() => { if (claimError) toast({ type: 'error', title: 'Claim failed' }); }, [claimError]);

  // ── Subscribe ──
  const subscribe = (amount: bigint, referrer: Address) => {
    try {
      writeSubscribe({
        address: contracts.cms,
        abi: CoreMembershipSubscriptionABI,
        functionName: 'subscribe',
        args: [amount, referrer],
      });
      toast({ type: 'pending', title: 'Subscribing...', description: 'Confirming transaction' });
    } catch (err: any) {
      toast({ type: 'error', title: 'Subscribe Failed', description: err?.message?.slice(0, 100) });
    }
  };

  // ── Claim CMS Rewards ──
  const claimCMSRewards = useCallback(async () => {
    if (!publicClient) return;
    try {
      const hash = await writeContractAsync({
        address: contracts.cms,
        abi: CoreMembershipSubscriptionABI,
        functionName: 'claimCMSRewards',
      });
      await publicClient.waitForTransactionReceipt({ hash });
      toast({ type: 'success', title: 'CMS Rewards Claimed!' });
      refetchSubCount();
      refetchClaimable();
    } catch (err: any) {
      toast({ type: 'error', title: 'Claim Failed', description: err?.message?.slice(0, 100) });
    }
  }, [publicClient, writeContractAsync, toast, refetchSubCount, refetchClaimable]);

  // Parse claimable rewards tuple
  const rewards = claimableRewards as [bigint, bigint, bigint] | undefined;
  const loyaltyRewards = rewards?.[0] || 0n;
  const leadershipRewards = rewards?.[1] || 0n;
  const totalClaimable = rewards?.[2] || 0n;

  // Parse canClaim tuple
  const canClaimResult = canClaimData as [boolean, string] | undefined;
  const canClaim = canClaimResult?.[0] || false;
  const canClaimReason = canClaimResult?.[1] || '';

  // Parse level details tuple
  const levels = levelDetails as [bigint[], bigint[]] | undefined;
  const levelSubscriptions = levels?.[0] || [];
  const levelRewardsEarned = levels?.[1] || [];

  return {
    // Actions
    subscribe,
    claimCMSRewards,
    // State
    subscriptionCount: Number(subscriptionCount || 0),
    loyaltyRewards,
    leadershipRewards,
    totalClaimable,
    totalClaimableFormatted: formatUnits(totalClaimable, KAIRO_DECIMALS),
    maxClaimable: (maxClaimable as bigint) || 0n,
    maxClaimableFormatted: formatUnits((maxClaimable as bigint) || 0n, KAIRO_DECIMALS),
    excessToBeDeleted: (excessToBeDeleted as bigint) || 0n,
    remainingSubscriptions: Number(remainingSubscriptions || 0),
    isSubscriptionEnded: isSubscriptionEnded === true,
    isClaimDeadlinePassed: isClaimDeadlinePassed === true,
    canClaim,
    canClaimReason,
    hasClaimed: hasClaimed === true,
    levelSubscriptions,
    levelRewardsEarned,
    // Loading
    isPending: subscribePending || claimPending,
    isDeployed: contracts.cms !== '0x',
  };
}

