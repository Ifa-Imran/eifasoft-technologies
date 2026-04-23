import { Address } from 'viem';

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 204);

export const contracts = {
  kairoToken: (process.env.NEXT_PUBLIC_KAIRO_TOKEN || '0x') as Address,
  liquidityPool: (process.env.NEXT_PUBLIC_LIQUIDITY_POOL || '0x') as Address,
  stakingManager: (process.env.NEXT_PUBLIC_STAKING_MANAGER || '0x') as Address,
  affiliateDistributor: (process.env.NEXT_PUBLIC_AFFILIATE_DISTRIBUTOR || '0x') as Address,
  cms: (process.env.NEXT_PUBLIC_CMS || '0x') as Address,
  atomicP2p: (process.env.NEXT_PUBLIC_ATOMIC_P2P || '0x') as Address,
  usdt: (process.env.NEXT_PUBLIC_USDT || '0x') as Address,
} as const;

export const EXPLORER_URL = 'https://opbnbscan.com';

export function getExplorerTxUrl(hash: string) {
  return `${EXPLORER_URL}/tx/${hash}`;
}

export function getExplorerAddressUrl(address: string) {
  return `${EXPLORER_URL}/address/${address}`;
}

// Constants from contracts
export const STAKING_TIERS = [
  { name: 'Bronze', minAmount: 10, maxAmount: 499, compoundInterval: 8 * 60 * 60, color: '#CD7F32' },
  { name: 'Silver', minAmount: 500, maxAmount: 1999, compoundInterval: 6 * 60 * 60, color: '#C0C0C0' },
  { name: 'Gold', minAmount: 2000, maxAmount: Infinity, compoundInterval: 4 * 60 * 60, color: '#FFD700' },
] as const;

export const RANK_NAMES = [
  'None', 'Associate', 'Executive', 'Director', 'Vice President',
  'Senior VP', 'Managing Director', 'Partner', 'Senior Partner',
  'Global Leader', 'Chairman',
] as const;

// Rank thresholds in USD (team volume required)
export const RANK_THRESHOLDS = [
  10_000, 30_000, 100_000, 300_000, 1_000_000,
  3_000_000, 10_000_000, 30_000_000, 100_000_000, 250_000_000,
] as const;

// Rank salary per period in USD
export const RANK_SALARIES_USD = [
  10, 30, 70, 200, 600, 1_200, 4_000, 12_000, 40_000, 100_000,
] as const;

export const USDT_DECIMALS = 18;
export const KAIRO_DECIMALS = 18;
export const BASIS_POINTS = 10000;
export const SWAP_FEE_BPS = 1000; // 10%
export const P2P_FEE_BPS = 500; // 5%
export const CMS_PRICE_USDT = 10; // 10 USDT per subscription
export const CMS_MAX_SUBSCRIPTIONS = 10000;
export const KAIRO_PER_CMS = 5; // 5 KAIRO loyalty reward per subscription

// System wallet used as referrer for the first-ever (genesis) registration
export const SYSTEM_WALLET = (process.env.NEXT_PUBLIC_SYSTEM_WALLET || '0x') as Address;
