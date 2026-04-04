import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function formatKAIRO(value: bigint | number, decimals = 18): string {
  const num = typeof value === 'bigint' ? Number(value) / 10 ** decimals : value;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(num);
}
