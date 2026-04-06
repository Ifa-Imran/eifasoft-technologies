'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { contracts, USDT_DECIMALS, KAIRO_DECIMALS } from '@/config/contracts';
import { CoreMembershipSubscriptionABI } from '@/config/abis/CoreMembershipSubscription';
import { useToast } from '@/components/ui/Toast';
import { formatUnits } from 'viem';
import { useEffect } from 'react';

export function useCMS() {
  const { address } = useAccount();
  const { toast } = useToast();

  const { data: subscriptionCount, isLoading: countLoading } = useReadContract({
    address: contracts.cms,
    abi: CoreMembershipSubscriptionABI,
    functionName: 'getSubscriptionCount',
    query: {
      enabled: contracts.cms !== '0x',
      refetchInterval: 30000,
    },
  });

  const { data: claimable } = useReadContract({
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

  const { data: remaining } = useReadContract({
    address: contracts.cms,
    abi: CoreMembershipSubscriptionABI,
    functionName: 'getRemainingSubscriptions',
    query: {
      enabled: contracts.cms !== '0x',
    },
  });

  const { writeContract: writeSubscribe, isPending: subscribePending, data: subscribeHash } = useWriteContract();
  const { writeContract: writeClaim, isPending: claimPending, data: claimHash } = useWriteContract();

  const { isSuccess: subscribeSuccess, isError: subscribeError } = useWaitForTransactionReceipt({ hash: subscribeHash });
  const { isSuccess: claimSuccess, isError: claimError } = useWaitForTransactionReceipt({ hash: claimHash });

  useEffect(() => { if (subscribeSuccess) toast({ type: 'success', title: 'Subscribed successfully!' }); }, [subscribeSuccess]);
  useEffect(() => { if (subscribeError) toast({ type: 'error', title: 'Subscription failed' }); }, [subscribeError]);
  useEffect(() => { if (claimSuccess) toast({ type: 'success', title: 'CMS rewards claimed!' }); }, [claimSuccess]);
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
    subscriptionCount: Number(subscriptionCount || 0),
    remainingSubscriptions: Number(remaining || 0),
    claimableRewards: claimable as any,
    maxClaimable: maxClaimable as bigint | undefined,
    claimableFormatted: claimable ? formatUnits((claimable as readonly bigint[])[2] ?? BigInt(0), KAIRO_DECIMALS) : '0',
    subscribe,
    claimRewards,
    isLoading: countLoading,
    isPending: subscribePending || claimPending,
  };
}
