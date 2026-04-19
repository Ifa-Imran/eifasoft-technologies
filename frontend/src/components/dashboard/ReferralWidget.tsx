'use client';

import { GlassCard, Button } from '@/components/ui';
import { useAccount } from 'wagmi';
import { useAffiliate } from '@/hooks/useAffiliate';
import { RANK_NAMES, USDT_DECIMALS } from '@/config/contracts';
import { useState } from 'react';
import { ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline';
import { formatUnits } from 'viem';
import { formatCompact } from '@/lib/utils';

export function ReferralWidget() {
  const { address } = useAccount();
  const { rankInfo, directReferrals, teamVolume, teamAnalytics, teamLevelLoading } = useAffiliate();
  const [copied, setCopied] = useState(false);

  const referralLink = address
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/register?ref=${address}`
    : '';

  const currentRank = rankInfo ? Number(rankInfo[0] || 0) : 0;
  const rankName = RANK_NAMES[currentRank] || 'None';
  const referralCount = ((directReferrals as any[]) || []).length;
  const totalTeamBiz = teamVolume ? Number(formatUnits(teamVolume as bigint, USDT_DECIMALS)) : 0;

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

      {/* Rank & quick stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-4 rounded-xl bg-gradient-to-br from-secondary-200 to-secondary-100 border-2 border-secondary-300/50 text-center shadow-sm shadow-secondary-200/30">
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Rank</p>
          <p className="text-base font-bold text-secondary-700">{rankName}</p>
        </div>
        <div className="p-4 rounded-xl bg-gradient-to-br from-primary-200 to-primary-100 border-2 border-primary-300/50 text-center shadow-sm shadow-primary-200/30">
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Direct Referrals</p>
          <p className="text-xl font-mono font-bold text-primary-700">
            {referralCount}
            {teamAnalytics && (
              <span className="text-xs font-normal text-success-600 ml-1">({teamAnalytics.directActive} active)</span>
            )}
          </p>
        </div>
      </div>

      {/* Team Analytics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        <div className="p-3 rounded-lg bg-surface-50 border border-surface-200 text-center">
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-0.5">Total Team</p>
          <p className="text-lg font-mono font-bold text-surface-800">
            {teamLevelLoading ? <span className="animate-pulse text-surface-300">...</span> : (teamAnalytics?.totalTeamSize || 0)}
          </p>
          <p className="text-[10px] text-surface-400">registrations</p>
        </div>
        <div className="p-3 rounded-lg bg-surface-50 border border-surface-200 text-center">
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-0.5">Active Stakes</p>
          <p className="text-lg font-mono font-bold text-success-600">
            {teamLevelLoading ? <span className="animate-pulse text-surface-300">...</span> : (teamAnalytics?.activeTeamStakes || 0)}
          </p>
          <p className="text-[10px] text-surface-400">in team</p>
        </div>
        <div className="p-3 rounded-lg bg-surface-50 border border-surface-200 text-center">
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-0.5">Direct Business</p>
          <p className="text-lg font-mono font-bold text-primary-700">
            {teamLevelLoading ? <span className="animate-pulse text-surface-300">...</span> : (teamAnalytics?.directBusinessFormatted || '$0')}
          </p>
          <p className="text-[10px] text-surface-400">referral volume</p>
        </div>
        <div className="p-3 rounded-lg bg-surface-50 border border-surface-200 text-center">
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-0.5">Team Business</p>
          <p className="text-lg font-mono font-bold text-accent-700">
            ${formatCompact(totalTeamBiz, 0)}
          </p>
          <p className="text-[10px] text-surface-400">total volume</p>
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
