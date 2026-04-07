'use client';

import { GlassCard, Button } from '@/components/ui';
import { useAccount } from 'wagmi';
import { useAffiliate } from '@/hooks/useAffiliate';
import { RANK_NAMES, USDT_DECIMALS } from '@/config/contracts';
import { useState } from 'react';
import { ClipboardDocumentIcon, CheckIcon, ShareIcon } from '@heroicons/react/24/outline';
import { formatUnits } from 'viem';

export function ReferralWidget() {
  const { address } = useAccount();
  const { rankInfo, directReferrals, freshBusiness } = useAffiliate();
  const [copied, setCopied] = useState(false);

  const referralLink = address
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/register?ref=${address}`
    : '';

  const currentRank = rankInfo ? Number(rankInfo[0] || 0) : 0;
  const rankName = RANK_NAMES[currentRank] || 'None';
  const referralCount = ((directReferrals as any[]) || []).length;
  const weeklyBiz = freshBusiness ? Number(formatUnits(BigInt(freshBusiness[0] || 0), USDT_DECIMALS)) : 0;

  const copyLink = async () => {
    try {
      // Try modern Clipboard API first
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(referralLink);
      } else {
        // Fallback for dApp browsers (MetaMask, Trust Wallet, etc.)
        const textarea = document.createElement('textarea');
        textarea.value = referralLink;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Last resort fallback
      const textarea = document.createElement('textarea');
      textarea.value = referralLink;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <GlassCard>
      <h3 className="text-xl font-semibold text-surface-900 mb-5">Referral Network</h3>

      {/* Quick rank & stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="p-4 rounded-xl bg-gradient-to-br from-secondary-200 to-secondary-100 border-2 border-secondary-300/50 text-center shadow-sm shadow-secondary-200/30">
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Rank</p>
          <p className="text-base font-bold text-secondary-700">{rankName}</p>
        </div>
        <div className="p-4 rounded-xl bg-gradient-to-br from-primary-200 to-primary-100 border-2 border-primary-300/50 text-center shadow-sm shadow-primary-200/30">
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Referrals</p>
          <p className="text-xl font-mono font-bold text-primary-700">{referralCount}</p>
        </div>
        <div className="p-4 rounded-xl bg-gradient-to-br from-accent-200 to-accent-100 border-2 border-accent-300/50 text-center shadow-sm shadow-accent-200/30">
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Weekly Biz</p>
          <p className="text-xl font-mono font-bold text-accent-700">${weeklyBiz.toFixed(0)}</p>
        </div>
      </div>

      {/* Referral link */}
      <p className="text-surface-500 text-xs mb-3">
        Share your link to invite new members and earn multi-level commissions.
      </p>

      <div className="flex gap-2">
        <input
          readOnly
          value={referralLink}
          className="input-field flex-1 text-xs truncate"
        />
        <Button onClick={copyLink} variant="secondary" size="md">
          {copied ? (
            <CheckIcon className="w-4 h-4 text-success-500" />
          ) : (
            <ClipboardDocumentIcon className="w-4 h-4" />
          )}
        </Button>
      </div>

      <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-primary-100 to-secondary-100 border-2 border-primary-200/60">
        <p className="text-xs text-surface-600">
          Earn <span className="text-primary-600 font-semibold">5%</span> direct commission +{' '}
          <span className="text-secondary-600 font-semibold">15-level</span> team dividends on each referral stake.
        </p>
      </div>
    </GlassCard>
  );
}
