'use client';

import { useReadContract, useAccount } from 'wagmi';
import { zeroAddress } from 'viem';
import { contracts, SYSTEM_WALLET } from '@/config/contracts';
import { AffiliateDistributorABI } from '@/config/abis/AffiliateDistributor';
import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'kairo_registration';

interface RegistrationData {
  address: string;
  referrer: string;
  timestamp: number;
}

/** Read saved registration from localStorage */
function getSavedRegistration(address: string | undefined): RegistrationData | null {
  if (!address || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data: RegistrationData = JSON.parse(raw);
    if (data.address?.toLowerCase() === address.toLowerCase()) return data;
    return null;
  } catch {
    return null;
  }
}

/** Save registration to localStorage */
function saveRegistration(address: string, referrer: string) {
  if (typeof window === 'undefined') return;
  const data: RegistrationData = { address: address.toLowerCase(), referrer, timestamp: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useRegistration() {
  const { address, isConnected } = useAccount();
  const [localRegistered, setLocalRegistered] = useState(false);
  const [storedReferrer, setStoredReferrer] = useState<string>('');

  // Check localStorage on mount and address change
  useEffect(() => {
    const saved = getSavedRegistration(address);
    if (saved) {
      setLocalRegistered(true);
      setStoredReferrer(saved.referrer);
    } else {
      setLocalRegistered(false);
      setStoredReferrer('');
    }
  }, [address]);

  // Check if user has a referrer set on-chain (meaning they already interacted)
  const { data: onChainReferrer, isLoading: referrerLoading } = useReadContract({
    address: contracts.affiliateDistributor,
    abi: AffiliateDistributorABI,
    functionName: 'referrerOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contracts.affiliateDistributor !== '0x',
      refetchInterval: 15000,
    },
  });

  // Genesis mode detection: check if system wallet has any direct referrals
  const { data: systemDirectCount } = useReadContract({
    address: contracts.affiliateDistributor,
    abi: AffiliateDistributorABI,
    functionName: 'directCount',
    args: SYSTEM_WALLET !== '0x' ? [SYSTEM_WALLET] : undefined,
    query: {
      enabled: SYSTEM_WALLET !== '0x' && contracts.affiliateDistributor !== '0x',
      refetchInterval: 30000,
    },
  });

  const hasOnChainReferrer = onChainReferrer !== undefined && onChainReferrer !== zeroAddress;
  const isRegistered = localRegistered || hasOnChainReferrer;
  const isGenesisMode = systemDirectCount !== undefined && (systemDirectCount as bigint) === 0n;
  const isLoading = referrerLoading;

  // Register: save referrer to localStorage
  const register = useCallback((referrer: string) => {
    if (!address) return;
    saveRegistration(address, referrer);
    setLocalRegistered(true);
    setStoredReferrer(referrer);
  }, [address]);

  // If on-chain referrer is set but no local data, sync it
  useEffect(() => {
    if (hasOnChainReferrer && !localRegistered && address && onChainReferrer) {
      saveRegistration(address, onChainReferrer as string);
      setLocalRegistered(true);
      setStoredReferrer(onChainReferrer as string);
    }
  }, [hasOnChainReferrer, localRegistered, address, onChainReferrer]);

  return {
    isRegistered,
    isLoading,
    isConnected,
    isGenesisMode,
    hasOnChainReferrer,
    storedReferrer,
    register,
  };
}
