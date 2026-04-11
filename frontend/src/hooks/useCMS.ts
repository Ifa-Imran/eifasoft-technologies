'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { contracts, KAIRO_DECIMALS } from '@/config/contracts';
import { CoreMembershipSubscriptionABI } from '@/config/abis/CoreMembershipSubscription';
import { useToast } from '@/components/ui/Toast';
import { formatUnits } from 'viem';
import { useEffect } from 'react';

export function useCMS() {
  const { address } = useAccount();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Global total subscriptions sold
  const { data: totalSubs, isLoading: countLoading, queryKey: totalSubsKey } = useReadContract({
    address: contracts.cms,
    abi: CoreMembershipSubscriptionABI,
    functionName: 'totalSubscriptions',
    query: {
      enabled: contracts.cms !== '0x',
      refetchInterval: 15000,
    },
  });

  // Per-user subscription count
  const { data: userSubCount, queryKey: userSubCountKey } = useReadContract({
    address: contracts.cms,
    abi: CoreMembershipSubscriptionABI,
    functionName: 'getSubscriptionCount',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contracts.cms !== '0x',
      refetchInterval: 15000,
    },
  });

  const { data: claimable, queryKey: claimableKey } = useReadContract({
    address: contracts.cms,
    abi: CoreMembershipSubscriptionABI,
    functionName: 'getClaimableRewards',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contracts.cms !== '0x',
      refetchInterval: 15000,
    },
  });

  const { data: maxClaimable } = useReadContract({
    address: contracts.cms,
    abi: CoreMembershipSubscriptionABI,
    functionName: 'getMaxClaimable',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contracts.cms !== '0x',
      refetchInterval: 15000,
    },
  });

  const { data: remaining, queryKey: remainingKey } = useReadContract({
    address: contracts.cms,
    abi: CoreMembershipSubscriptionABI,
    functionName: 'getRemainingSubscriptions',
    query: {
      enabled: contracts.cms !== '0x',
      refetchInterval: 15000,
    },
  });

  // True when subscription period has ended (deadline passed OR 10k cap reached)
  const { data: subscriptionEnded } = useReadContract({
    address: contracts.cms,
    abi: CoreMembershipSubscriptionABI,
    functionName: 'isSubscriptionEnded',
    query: {
      enabled: contracts.cms !== '0x',
      refetchInterval: 15000,
    },
  });

  // Subscribe deadline timestamp (unix seconds)
  const { data: subscribeDeadline } = useReadContract({
    address: contracts.cms,
    abi: CoreMembershipSubscriptionABI,
    functionName: 'SUBSCRIBE_DEADLINE',
    query: {
      enabled: contracts.cms !== '0x',
    },
  });

  const { writeContract: writeSubscribe, isPending: subscribePending, data: subscribeHash } = useWriteContract();
  const { writeContract: writeClaim, isPending: claimPending, data: claimHash } = useWriteContract();

  const { isSuccess: subscribeSuccess, isError: subscribeError } = useWaitForTransactionReceipt({ hash: subscribeHash });
  const { isSuccess: claimSuccess, isError: claimError } = useWaitForTransactionReceipt({ hash: claimHash });

  // Refetch all data after successful subscribe
  useEffect(() => {
    if (subscribeSuccess) {
      toast({ type: 'success', title: 'Subscribed successfully!' });
      queryClient.invalidateQueries({ queryKey: totalSubsKey });
      queryClient.invalidateQueries({ queryKey: userSubCountKey });
      queryClient.invalidateQueries({ queryKey: remainingKey });
      queryClient.invalidateQueries({ queryKey: claimableKey });
    }
  }, [subscribeSuccess]);
  useEffect(() => { if (subscribeError) toast({ type: 'error', title: 'Subscription failed' }); }, [subscribeError]);

  // Refetch after successful claim
  useEffect(() => {
    if (claimSuccess) {
      toast({ type: 'success', title: 'CMS rewards claimed!' });
      queryClient.invalidateQueries({ queryKey: claimableKey });
    }
  }, [claimSuccess]);
  useEffect(() => { if (claimError) toast({ type: 'error', title: 'Claim failed' }); }, [claimError]);

  const subscribe = (amount: bigint, referrer: string) => {
    writeSubscribe({
      address: contracts.cms,
      abi: CoreMembershipSubscriptionABI,
      functionName: 'subscribe',
      args: [amount, referrer as `0x${string}`],
    });
    toast({ type: 'pending', title: 'Subscribing to CMS...' });
  };

  const claimRewards = () => {
    writeClaim({
      address: contracts.cms,
      abi: CoreMembershipSubscriptionABI,
      functionName: 'claimCMSRewards',
    });
    toast({ type: 'pending', title: 'Claiming CMS rewards...' });
  };

  return {
    totalSubscriptions: Number(totalSubs || 0),
    userSubscriptionCount: Number(userSubCount || 0),
    remainingSubscriptions: Number(remaining || 0),
    isSubscriptionEnded: subscriptionEnded === true,
    subscribeDeadline: subscribeDeadline ? Number(subscribeDeadline) : 0,
    claimableRewards: claimable as any,
    maxClaimable: maxClaimable as bigint | undefined,
    // Total available rewards from subscriptions (loyalty + leadership)
    availableFormatted: claimable ? formatUnits((claimable as readonly bigint[])[2] ?? BigInt(0), KAIRO_DECIMALS) : '0',
    loyaltyFormatted: claimable ? formatUnits((claimable as readonly bigint[])[0] ?? BigInt(0), KAIRO_DECIMALS) : '0',
    leadershipFormatted: claimable ? formatUnits((claimable as readonly bigint[])[1] ?? BigInt(0), KAIRO_DECIMALS) : '0',
    // Max claimable KAIRO capped by active stake value
    maxClaimableFormatted: maxClaimable ? formatUnits(maxClaimable as bigint, KAIRO_DECIMALS) : '0',
    // Legacy alias
    claimableFormatted: claimable ? formatUnits((claimable as readonly bigint[])[2] ?? BigInt(0), KAIRO_DECIMALS) : '0',
    subscribe,
    claimRewards,
    isLoading: countLoading,
    isPending: subscribePending || claimPending,
  };
}
