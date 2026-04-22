'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { GlassCard, Button, Input, ProgressBar } from '@/components/ui';
import { useCMS } from '@/hooks/useCMS';
import { useApproval } from '@/hooks/useApproval';
import { useTokenBalances } from '@/hooks/useTokenBalances';
import { useRegistration } from '@/hooks/useRegistration';
import { useUserStakes } from '@/hooks/useUserStakes';
import { contracts, CMS_PRICE_USDT, CMS_MAX_SUBSCRIPTIONS, USDT_DECIMALS } from '@/config/contracts';
import { parseUnits, zeroAddress, isAddress, formatUnits } from 'viem';
import {
  TicketIcon,
  GiftIcon,
  SparklesIcon,
  FireIcon,
  ShieldCheckIcon,
  LockClosedIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

export default function CMSPage() {
  const { isConnected } = useAccount();
  const [amount, setAmount] = useState('1');
  const { totalSubscriptions, userSubscriptionCount, remainingSubscriptions, subscribeDeadline, isSubscriptionEnded, availableFormatted, loyaltyFormatted, leadershipFormatted, maxClaimableFormatted, claimableFormatted, maxClaimable, claimDeadline, isClaimDeadlinePassed, excessToBeDeletedFormatted, cmsDirectCount, hasAlreadyClaimed, levelDetails, subscribe, claimRewards, isPending } = useCMS();
  const { usdtFormatted } = useTokenBalances();
  const { storedReferrer, hasOnChainReferrer } = useRegistration();
  const { totalStaked } = useUserStakes();
  const totalCost = Number(amount) * CMS_PRICE_USDT;
  const costBigInt = parseUnits(totalCost.toString(), USDT_DECIMALS);
  const approval = useApproval(contracts.usdt, contracts.cms);

  // Countdown timer
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);
  const timeLeft = subscribeDeadline > 0 ? Math.max(0, subscribeDeadline - now) : 0;
  const days = Math.floor(timeLeft / 86400);
  const hours = Math.floor((timeLeft % 86400) / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  const soldPercent = CMS_MAX_SUBSCRIPTIONS > 0 ? (totalSubscriptions / CMS_MAX_SUBSCRIPTIONS) * 100 : 0;
  const isAlmostSoldOut = remainingSubscriptions < 1000;

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center mb-2 shadow-xl shadow-primary-300/30">
          <TicketIcon className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-orbitron font-bold text-surface-900">Connect Wallet</h2>
        <p className="text-surface-500 text-sm">Join the Core Membership Subscription</p>
        <ConnectButton />
      </div>
    );
  }

  const pendingSubscribeRef = useRef(false);

  // Auto-subscribe after approval succeeds
  useEffect(() => {
    if (pendingSubscribeRef.current && approval.hasAllowance(costBigInt) && !isPending) {
      pendingSubscribeRef.current = false;
      // Always pass the actual referrer so CMS can set its internal referrerOf mapping
      const ref = storedReferrer && isAddress(storedReferrer) ? storedReferrer : zeroAddress;
      subscribe(BigInt(Number(amount)), ref);
    }
  }, [approval.allowance]);

  const handleSubscribe = () => {
    if (!approval.hasAllowance(costBigInt)) {
      pendingSubscribeRef.current = true;
      approval.approve(costBigInt);
      return;
    }
    // Always pass the actual referrer so CMS can set its internal referrerOf mapping
    const ref = storedReferrer && isAddress(storedReferrer) ? storedReferrer : zeroAddress;
    subscribe(BigInt(Number(amount)), ref);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-orbitron font-bold gradient-text">Core Membership</h1>
        <p className="text-base text-surface-500 mt-1">Limited to {CMS_MAX_SUBSCRIPTIONS.toLocaleString()} memberships worldwide</p>
      </div>

      {/* Subscription Countdown Timer */}
      <GlassCard variant="gradient" padding="p-0">
        <div className="relative overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-500/5 via-secondary-500/5 to-accent-500/5" />
          <div className="relative p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-500 to-primary-500 flex items-center justify-center shadow-lg shadow-accent-400/30">
                  <ClockIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-surface-900">Subscription Phase</h3>
                  <p className="text-sm text-surface-500">
                    {isSubscriptionEnded ? 'Subscription phase has ended' : timeLeft > 0 ? 'Time remaining to subscribe' : 'Loading...'}
                  </p>
                </div>
              </div>
              {!isSubscriptionEnded && timeLeft > 0 && (
                <div className="flex items-center justify-center gap-1.5">
                  {days > 0 && (
                    <div className="text-center px-3 py-2 rounded-xl bg-white/70 border border-accent-200">
                      <p className="text-2xl font-mono font-bold text-accent-700">{days}</p>
                      <p className="text-[9px] uppercase tracking-wider text-surface-400">DAYS</p>
                    </div>
                  )}
                  <div className="text-center px-3 py-2 rounded-xl bg-white/70 border border-accent-200">
                    <p className="text-2xl font-mono font-bold text-accent-700">{String(hours).padStart(2, '0')}</p>
                    <p className="text-[9px] uppercase tracking-wider text-surface-400">HRS</p>
                  </div>
                  <span className="text-accent-400 font-bold text-xl">:</span>
                  <div className="text-center px-3 py-2 rounded-xl bg-white/70 border border-accent-200">
                    <p className="text-2xl font-mono font-bold text-accent-700">{String(minutes).padStart(2, '0')}</p>
                    <p className="text-[9px] uppercase tracking-wider text-surface-400">MIN</p>
                  </div>
                  <span className="text-accent-400 font-bold text-xl">:</span>
                  <div className="text-center px-3 py-2 rounded-xl bg-white/70 border border-accent-200">
                    <p className="text-2xl font-mono font-bold text-accent-700">{String(seconds).padStart(2, '0')}</p>
                    <p className="text-[9px] uppercase tracking-wider text-surface-400">SEC</p>
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="text-center p-3 rounded-xl bg-gradient-to-br from-primary-50/60 to-white/60 border border-primary-100/50">
                <p className="text-lg font-mono font-bold text-surface-900">{userSubscriptionCount}</p>
                <p className="text-[10px] uppercase tracking-wider text-surface-400">Your Subscriptions</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-gradient-to-br from-accent-100/60 to-accent-50/40 border border-accent-200/50">
                <p className="text-lg font-mono font-bold text-accent-600">${CMS_PRICE_USDT}</p>
                <p className="text-[10px] uppercase tracking-wider text-surface-400">Price</p>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Purchase Form */}
        <GlassCard>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-300 flex items-center justify-center shadow-md shadow-primary-300/30">
              <ShieldCheckIcon className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-surface-900">Purchase Subscriptions</h3>
          </div>

          <div className="space-y-4">
            <Input
              label="Number of Subscriptions"
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              helperText={`Balance: ${Number(usdtFormatted).toFixed(2)} USDT`}
            />

            <div className="p-4 rounded-xl bg-gradient-to-r from-surface-50 to-primary-50/30 border border-primary-100/30 space-y-2 text-xs">
              <div className="flex justify-between text-surface-500">
                <span>Price per Subscription</span>
                <span className="font-mono text-surface-700">${CMS_PRICE_USDT} USDT</span>
              </div>
              <div className="flex justify-between text-surface-500">
                <span>Quantity</span>
                <span className="font-mono text-surface-700">{Number(amount) || 0}x</span>
              </div>
              <div className="border-t border-surface-200 pt-2 flex justify-between font-semibold text-surface-900">
                <span>Total Cost</span>
                <span className="font-mono">${totalCost} USDT</span>
              </div>
            </div>

            {/* Rewards Preview */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-accent-100 to-accent-50 border-2 border-accent-200/50">
              <div className="flex items-center gap-2 mb-2">
                <GiftIcon className="w-4 h-4 text-accent-600" />
                <span className="text-xs font-semibold text-accent-700">Rewards Preview</span>
              </div>
              <div className="space-y-1 text-xs text-surface-600">
                <div className="flex justify-between">
                  <span>Loyalty Reward</span>
                  <span className="font-mono font-semibold text-accent-700">{(Number(amount) || 0) * 5} KAIRO</span>
                </div>
                <div className="flex justify-between">
                  <span>Leadership Rewards</span>
                  <span className="text-surface-400">Based on referral activity</span>
                </div>
              </div>
            </div>

            <Button
              onClick={handleSubscribe}
              loading={isPending || approval.isPending}
              disabled={Number(amount) < 1}
              className="w-full"
            >
              {!approval.hasAllowance(costBigInt) ? `Approve & Subscribe (${amount}x for $${totalCost})` : `Subscribe (${amount}x for $${totalCost})`}
            </Button>
          </div>
        </GlassCard>

        {/* Rewards Panel */}
        <GlassCard>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-secondary-400 to-secondary-300 flex items-center justify-center shadow-md shadow-secondary-300/30">
              <SparklesIcon className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-surface-900">Your Rewards</h3>
          </div>

          <div className="space-y-4">
            {/* Available Rewards - total from subscriptions */}
            <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-primary-100/60 via-white to-secondary-100/60 border-2 border-primary-200/50">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-primary-400/30">
                <GiftIcon className="w-7 h-7 text-white" />
              </div>
              <p className="text-sm text-surface-500 mb-2">Available Rewards</p>
              <p className="text-4xl font-mono font-bold gradient-text">{Number(availableFormatted).toFixed(2)}</p>
              <p className="text-sm text-surface-400 mt-1">KAIRO tokens from subscriptions</p>
            </div>

            {/* Breakdown: Loyalty vs Leadership */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-accent-50 to-accent-100/60 border border-accent-200/50 text-center">
                <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Loyalty</p>
                <p className="text-lg font-mono font-bold text-accent-700">{Number(loyaltyFormatted).toFixed(2)}</p>
                <p className="text-[10px] text-surface-400">KAIRO</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-secondary-50 to-secondary-100/60 border border-secondary-200/50 text-center">
                <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Leadership</p>
                <p className="text-lg font-mono font-bold text-secondary-700">{Number(leadershipFormatted).toFixed(2)}</p>
                <p className="text-[10px] text-surface-400">KAIRO</p>
              </div>
            </div>

            {/* CMS Direct Count & Subscriptions Owned */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100/60 border border-primary-200/50 text-center">
                <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Your Subscriptions</p>
                <p className="text-lg font-mono font-bold text-primary-700">{userSubscriptionCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-success-50 to-success-100/60 border border-success-200/50 text-center">
                <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">CMS Referrals</p>
                <p className="text-lg font-mono font-bold text-success-700">{cmsDirectCount}</p>
              </div>
            </div>

            {/* Excess to Be Deleted Warning */}
            {Number(excessToBeDeletedFormatted) > 0 && (
              <div className="p-3 rounded-xl bg-gradient-to-r from-warn-50 to-warn-100 border border-warn-300 flex items-center gap-2">
                <FireIcon className="w-5 h-5 text-warn-600 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-warn-700">Excess Rewards Warning</p>
                  <p className="text-[10px] text-warn-600">
                    {Number(excessToBeDeletedFormatted).toFixed(2)} KAIRO will be deleted on claim (exceeds your stake cap)
                  </p>
                </div>
              </div>
            )}

            {/* Claim Deadline Info */}
            {claimDeadline > 0 && (
              <div className={`p-3 rounded-xl border text-xs ${isClaimDeadlinePassed ? 'bg-danger-50 border-danger-200 text-danger-600' : 'bg-surface-50 border-surface-200 text-surface-500'}`}>
                <span className="font-semibold">Claim Deadline:</span>{' '}
                {new Date(claimDeadline * 1000).toLocaleDateString()} {new Date(claimDeadline * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {isClaimDeadlinePassed && <span className="ml-2 font-bold text-danger-700">(Expired)</span>}
              </div>
            )}

            {/* Already Claimed Badge */}
            {hasAlreadyClaimed && (
              <div className="p-3 rounded-xl bg-success-50 border border-success-200 flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-success-600" />
                <span className="text-sm font-semibold text-success-700">CMS Rewards Already Claimed</span>
              </div>
            )}

            {/* Claimable Status - stake-gated */}
            <div className={`p-4 rounded-xl border-2 ${
              totalStaked > 0n
                ? 'bg-gradient-to-r from-success-50 to-success-100/60 border-success-300/50'
                : 'bg-gradient-to-r from-surface-50 to-warn-50/30 border-warn-200/50'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {totalStaked > 0n ? (
                  <CheckCircleIcon className="w-5 h-5 text-success-600" />
                ) : (
                  <LockClosedIcon className="w-5 h-5 text-warn-600" />
                )}
                <span className={`text-sm font-semibold ${
                  totalStaked > 0n ? 'text-success-700' : 'text-warn-700'
                }`}>
                  {totalStaked > 0n ? 'Claimable Amount' : 'Staking Required to Unlock'}
                </span>
              </div>
              {totalStaked > 0n ? (
                <div>
                  <p className="text-2xl font-mono font-bold text-success-700">
                    {Number(maxClaimableFormatted) >= Number(availableFormatted)
                      ? Number(availableFormatted).toFixed(2)
                      : Number(maxClaimableFormatted).toFixed(2)} KAIRO
                  </p>
                  <p className="text-xs text-surface-500 mt-1">
                    Claimable amount = min(available rewards, stake-equivalent KAIRO)
                  </p>
                  <p className="text-xs text-surface-400 mt-0.5">
                    Your stake supports up to {Number(maxClaimableFormatted).toFixed(2)} KAIRO
                  </p>
                </div>
              ) : (
                <p className="text-xs text-surface-500">
                  Your available rewards of <span className="font-semibold text-surface-700">{Number(availableFormatted).toFixed(2)} KAIRO</span> will become claimable once you create an active stake. The claimable amount is capped by your active stake value.
                </p>
              )}
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-r from-primary-100/50 to-secondary-100/50 border-2 border-primary-200/40 space-y-2 text-xs text-surface-600">
              <div className="flex items-start gap-2">
                <span className="text-primary-500 mt-0.5">&#8226;</span>
                <span>Claimable amount capped by your active stake value</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary-500 mt-0.5">&#8226;</span>
                <span>Requires active stake to claim rewards</span>
              </div>
            </div>

            <Button
              onClick={claimRewards}
              loading={isPending}
              variant="secondary"
              className="w-full"
              disabled={Number(availableFormatted) <= 0 || totalStaked <= 0n || hasAlreadyClaimed}
            >
              {hasAlreadyClaimed ? 'Already Claimed' : totalStaked <= 0n ? 'Requires Active Stake to Claim' : 'Claim CMS Rewards'}
            </Button>
          </div>
        </GlassCard>
      </div>

      {/* CMS Reward Structure - Level Breakdown */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-400 to-accent-300 flex items-center justify-center shadow-md shadow-accent-300/30">
            <SparklesIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-surface-900">Leadership Reward Structure</h3>
            <p className="text-xs text-surface-500">Earn KAIRO for every subscription in your 5-level network</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-surface-200">
                <th className="text-left py-2.5 px-3 text-xs uppercase tracking-wider text-surface-400 font-semibold">Level</th>
                <th className="text-center py-2.5 px-3 text-xs uppercase tracking-wider text-surface-400 font-semibold">Rate / Sub</th>
                <th className="text-center py-2.5 px-3 text-xs uppercase tracking-wider text-surface-400 font-semibold">Req. Directs</th>
                <th className="text-center py-2.5 px-3 text-xs uppercase tracking-wider text-surface-400 font-semibold">Activations</th>
                <th className="text-center py-2.5 px-3 text-xs uppercase tracking-wider text-surface-400 font-semibold">Earned</th>
                <th className="text-center py-2.5 px-3 text-xs uppercase tracking-wider text-surface-400 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                { level: 1, reward: 1, directs: 0 },
                { level: 2, reward: 0.5, directs: 2 },
                { level: 3, reward: 0.5, directs: 3 },
                { level: 4, reward: 0.25, directs: 4 },
                { level: 5, reward: 0.25, directs: 5 },
              ].map((row, i) => {
                const unlocked = cmsDirectCount >= row.directs;
                const levelSubs = levelDetails ? Number(levelDetails[0][i] || 0) : 0;
                const levelEarned = levelDetails ? Number(formatUnits(BigInt(levelDetails[1][i] || 0), 18)) : 0;
                return (
                  <tr key={row.level} className={`border-b border-surface-100 ${unlocked ? '' : 'opacity-50'}`}>
                    <td className="py-3 px-3 font-medium text-surface-700">Level {row.level}</td>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-accent-700">{row.reward} KAIRO</td>
                    <td className="py-3 px-3 text-center font-mono text-surface-600">{row.directs}</td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-mono font-bold text-primary-700 text-base">{levelSubs}</span>
                      <span className="text-[10px] text-surface-400 ml-1">subs</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-mono font-bold text-secondary-700">{levelEarned.toFixed(2)}</span>
                      <span className="text-[10px] text-surface-400 ml-1">KAIRO</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {unlocked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success-50 border border-success-200 text-success-700 text-xs font-semibold">
                          <CheckCircleIcon className="w-3 h-3" /> Unlocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-100 border border-surface-200 text-surface-500 text-xs font-semibold">
                          <LockClosedIcon className="w-3 h-3" /> Need {row.directs - cmsDirectCount} more
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr className="border-t-2 border-surface-300 bg-surface-50/50">
                <td className="py-3 px-3 font-bold text-surface-800" colSpan={3}>Total</td>
                <td className="py-3 px-3 text-center">
                  <span className="font-mono font-bold text-primary-800 text-base">
                    {levelDetails ? Array.from({ length: 5 }, (_, i) => Number(levelDetails[0][i] || 0)).reduce((a, b) => a + b, 0) : 0}
                  </span>
                  <span className="text-[10px] text-surface-400 ml-1">subs</span>
                </td>
                <td className="py-3 px-3 text-center">
                  <span className="font-mono font-bold text-secondary-800">{Number(leadershipFormatted).toFixed(2)}</span>
                  <span className="text-[10px] text-surface-400 ml-1">KAIRO</span>
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100/60 border border-primary-200/50 text-center">
            <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Your CMS Subs</p>
            <p className="text-xl font-mono font-bold text-primary-700">{userSubscriptionCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-gradient-to-br from-success-50 to-success-100/60 border border-success-200/50 text-center">
            <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">CMS Referrals</p>
            <p className="text-xl font-mono font-bold text-success-700">{cmsDirectCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-gradient-to-br from-secondary-50 to-secondary-100/60 border border-secondary-200/50 text-center">
            <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Total Leadership</p>
            <p className="text-xl font-mono font-bold text-secondary-700">{Number(leadershipFormatted).toFixed(2)}</p>
            <p className="text-[10px] text-surface-400">KAIRO</p>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-surface-50 to-accent-50/30 border border-surface-200 text-xs text-surface-600">
          <p className="font-semibold text-surface-700 mb-1">How it works:</p>
          <p>When someone in your network buys CMS subscriptions, you earn KAIRO based on their level relative to you. Activations show how many subs were purchased at each level. Earned shows the KAIRO credited (only if that level is unlocked).</p>
        </div>
      </GlassCard>
    </div>
  );
}
