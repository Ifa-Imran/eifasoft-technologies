import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatUnits, parseUnits } from 'viem';
import { KAIRO_DECIMALS, USDT_DECIMALS } from '@/config/contracts';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatKairo(value: bigint, decimals: number = 2): string {
  const formatted = formatUnits(value, KAIRO_DECIMALS);
  return Number(formatted).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatUsdt(value: bigint, decimals: number = 2): string {
  const formatted = formatUnits(value, USDT_DECIMALS);
  return Number(formatted).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function parseKairo(value: string): bigint {
  return parseUnits(value, KAIRO_DECIMALS);
}

export function parseUsdt(value: string): bigint {
  return parseUnits(value, USDT_DECIMALS);
}

export function shortenAddress(address: string, chars: number = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}
