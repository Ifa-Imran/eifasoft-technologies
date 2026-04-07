'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { zeroAddress } from 'viem';
import { contracts, SYSTEM_WALLET } from '@/config/contracts';
import { AffiliateDistributorABI } from '@/config/abis/AffiliateDistributor';
import { useEffect } from 'react';
import { useToast } from '@/components/ui/Toast';

export function useRegistration() {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check if user has a referrer set on-chain (source of truth)
  const { data: onChainReferrer, isLoading: referrerLoading, queryKey: referrerQueryKey } = useReadContract({
    address: contracts.affiliateDistributor,
    abi: AffiliateDistributorABI,
    functionName: 'referrerOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contracts.affiliateDistributor !== '0x',
      refetchInterval: 10000,
    },
  });

  // Genesis mode detection: check if genesis account is set
  const { data: genesisAccount } = useReadContract({
    address: contracts.affiliateDistributor,
    abi: AffiliateDistributorABI,
    functionName: 'genesisAccount',
    query: {
      enabled: contracts.affiliateDistributor !== '0x',
      refetchInterval: 30000,
    },
  });

  const hasOnChainReferrer = onChainReferrer !== undefined && onChainReferrer !== zeroAddress;
  const isRegistered = hasOnChainReferrer;
  const isGenesisMode = genesisAccount !== undefined && (genesisAccount as string) === zeroAddress;
  const isLoading = referrerLoading || (isConnected && !address);

  // On-chain register transaction
  const { writeContract, isPending: registerPending, data: registerHash } = useWriteContract();
  const { isSuccess: registerSuccess, isError: registerError } = useWaitForTransactionReceipt({ hash: registerHash });

  // Handle registration success
  useEffect(() => {
    if (registerSuccess) {
      toast({ type: 'success', title: 'Registration successful!' });
      queryClient.invalidateQueries({ queryKey: referrerQueryKey });
    }
  }, [registerSuccess]);

  // Handle registration error
  useEffect(() => {
    if (registerError) {
      toast({ type: 'error', title: 'Registration failed. Please try again.' });
    }
  }, [registerError]);

  // Register on-chain by calling AffiliateDistributor.register(_referrer)
  const register = (referrer: string) => {
    if (!address) return;
    writeContract({
      address: contracts.affiliateDistributor,
      abi: AffiliateDistributorABI,
      functionName: 'register',
      args: [referrer as `0x${string}`],
    });
    toast({ type: 'pending', title: 'Registering on blockchain...' });
  };

  // Stored referrer from on-chain data (for CMS/staking referrer param)
  const storedReferrer = hasOnChainReferrer ? (onChainReferrer as string) : '';

  return {
    isRegistered,
    isLoading,
    isConnected,
    isGenesisMode,
    hasOnChainReferrer,
    storedReferrer,
    register,
    isPending: registerPending,
    isSuccess: registerSuccess,
  };
}
