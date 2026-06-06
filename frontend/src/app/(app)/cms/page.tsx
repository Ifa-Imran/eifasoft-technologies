'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { GlassCard, Button } from '@/components/ui';
import { useCMS } from '@/hooks/useCMS';
import { useApproval } from '@/hooks/useApproval';
import { useRegistration } from '@/hooks/useRegistration';
import { contracts, USDT_DECIMALS, KAIRO_DECIMALS } from '@/config/contracts';
import { parseUnits, formatUnits, zeroAddress } from 'viem';
import {
  TicketIcon,
  GiftIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  FireIcon,
  UserGroupIcon,
  TrophyIcon,
  InformationCircleIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

const CMS_PRICE_USDT = 10;
const REWARD_PER_SUB_KAIRO = 5;
const MAX_SUBSCRIPTIONS = 10000;
const REF_REWARDS = [1, 0.5, 0.5, 0.25, 0.25]; // KAIRO per level
const LEVEL_DIRECTS = [0, 2, 3, 4, 5]; // Required directs per level

export default function CMSPage() {
  const { address, isConnected } = useAccount();
  const { isRegistered } = useRegistration();
  const {
    subscribe,
    claimCMSRewards,
    subscriptionCount,
    loyaltyRewards,
    leadershipRewards,
    totalClaimable,
    totalClaimableFormatted,
    maxClaimable,
    maxClaimableFormatted,
    excessToBeDeleted,
    remainingSubscriptions,
    isSubscriptionEnded,
    isClaimDeadlinePassed,
    canClaim,
    canClaimReason,
    hasClaimed,
    levelSubscriptions,
    levelRewardsEarned,
    isPending,
    isDeployed,
  } = useCMS();

  const [subAmount, setSubAmount] = useState('1');
  const [referrer, setReferrer] = useState(zeroAddress);

  const { hasAllowance, approve, isPending: isApprovePending } = useApproval(
    contracts.usdt,
    contracts.cms
  );

  const requiredAmount = parseUnits(subAmount ? (Number(subAmount) * CMS_PRICE_USDT).toString() : '0', USDT_DECIMALS);
  const isApproved = hasAllowance(requiredAmount);

  const totalCost = Number(subAmount) * CMS_PRICE_USDT;
  const loyaltyReward = Number(subAmount) * REWARD_PER_SUB_KAIRO;

  const handleSubscribe = async () => {
    if (!address || !subAmount) return;
    const amount = parseUnits(subAmount, 0);
    await subscribe(amount, referrer);
  };

  const handleClaim = async () => {
    await claimCMSRewards();
  };

  const loyaltyFormatted = formatUnits(loyaltyRewards, KAIRO_DECIMALS);
  const leadershipFormatted = formatUnits(leadershipRewards, KAIRO_DECIMALS);
  const excessFormatted = formatUnits(excessToBeDeleted, KAIRO_DECIMALS);

  if (!isDeployed) {
    return (
      <div className="space-y-6">
        <GlassCard>
          <div className="text-center py-12">
            <TicketIcon className="w-16 h-16 mx-auto text-surface-300 mb-4" />
            <h2 className="text-2xl font-bold text-surface-700 mb-2">CMS Not Available</h2>
            <p className="text-surface-500">Core Membership Subscription contract is not deployed yet.</p>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Core Membership</h1>
          <p className="text-surface-500 mt-1">Purchase CMS subscriptions and earn KAIRO rewards</p>
        </div>
        {!isConnected && <ConnectButton />}
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
              <TicketIcon className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-surface-500">Your Subscriptions</p>
              <p className="text-2xl font-bold text-surface-900">{subscriptionCount}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary-100 to-secondary-200 flex items-center justify-center">
              <GiftIcon className="w-6 h-6 text-secondary-600" />
            </div>
            <div>
              <p className="text-sm text-surface-500">Remaining Slots</p>
              <p className="text-2xl font-bold text-surface-900">{remainingSubscriptions.toLocaleString()}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              isSubscriptionEnded ? 'bg-gradient-to-br from-red-100 to-red-200' : 'bg-gradient-to-br from-success-100 to-success-200'
            }`}>
              {isSubscriptionEnded ? (
                <XCircleIcon className="w-6 h-6 text-red-600" />
              ) : (
                <CheckCircleIcon className="w-6 h-6 text-success-600" />
              )}
            </div>
            <div>
              <p className="text-sm text-surface-500">Subscription Status</p>
              <p className={`text-lg font-bold ${isSubscriptionEnded ? 'text-red-600' : 'text-success-600'}`}>
                {isSubscriptionEnded ? 'Ended' : 'Active'}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subscribe Card */}
        <GlassCard>
          <h2 className="text-xl font-bold text-surface-900 mb-6 flex items-center gap-2">
            <TicketIcon className="w-6 h-6 text-primary-600" />
            Purchase Subscription
          </h2>

          {isSubscriptionEnded ? (
            <div className="text-center py-8">
              <ClockIcon className="w-12 h-12 mx-auto text-surface-300 mb-3" />
              <p className="text-surface-500">Subscription period has ended</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <label className="text-sm font-semibold text-surface-600 mb-2 block">
                  Number of Subscriptions
                </label>
                <input
                  type="number"
                  value={subAmount}
                  onChange={(e) => setSubAmount(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-surface-200 bg-white/70 font-mono text-lg text-surface-900 focus:border-primary-400 focus:outline-none transition-colors"
                  placeholder="Enter amount..."
                  min="1"
                  max={remainingSubscriptions}
                  disabled={!isConnected}
                />
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-primary-50 to-secondary-50 border border-primary-200/50">
                <h3 className="text-sm font-semibold text-surface-700 mb-3">Subscription Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-surface-600">Price per subscription:</span>
                    <span className="font-semibold text-surface-900">{CMS_PRICE_USDT} USDT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-600">Loyalty reward per sub:</span>
                    <span className="font-semibold text-primary-600">{REWARD_PER_SUB_KAIRO} KAIRO</span>
                  </div>
                  <div className="border-t border-primary-200 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-surface-700 font-medium">Total cost:</span>
                      <span className="font-bold text-surface-900">{totalCost} USDT</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-primary-700 font-medium">You'll earn:</span>
                      <span className="font-bold text-primary-600">{loyaltyReward} KAIRO</span>
                    </div>
                  </div>
                </div>
              </div>

              {!isConnected ? (
                <div className="text-center py-2">
                  <ConnectButton />
                </div>
              ) : !isRegistered ? (
                <div className="text-center py-2 text-surface-500 text-sm">
                  Please complete registration first
                </div>
              ) : !isApproved ? (
                <Button
                  onClick={() => approve(requiredAmount)}
                  variant="secondary"
                  className="w-full"
                  size="lg"
                  loading={isApprovePending}
                >
                  Approve USDT
                </Button>
              ) : (
                <Button
                  onClick={handleSubscribe}
                  variant="primary"
                  className="w-full"
                  size="lg"
                  loading={isPending}
                  disabled={!subAmount || Number(subAmount) <= 0 || Number(subAmount) > remainingSubscriptions}
                >
                  Subscribe ({totalCost} USDT)
                </Button>
              )}
            </div>
          )}
        </GlassCard>

        {/* Claim Rewards Card */}
        <GlassCard>
          <h2 className="text-xl font-bold text-surface-900 mb-6 flex items-center gap-2">
            <GiftIcon className="w-6 h-6 text-secondary-600" />
            Claim Rewards
          </h2>

          {hasClaimed ? (
            <div className="text-center py-8">
              <CheckCircleIcon className="w-12 h-12 mx-auto text-success-500 mb-3" />
              <p className="text-surface-700 font-semibold">You have already claimed your rewards</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100/50 border border-primary-200/50">
                  <p className="text-xs text-surface-600 mb-1">Loyalty Rewards</p>
                  <p className="text-xl font-bold text-primary-600">{Number(loyaltyFormatted).toFixed(2)}</p>
                  <p className="text-xs text-surface-500">KAIRO</p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-secondary-50 to-secondary-100/50 border border-secondary-200/50">
                  <p className="text-xs text-surface-600 mb-1">Leadership Rewards</p>
                  <p className="text-xl font-bold text-secondary-600">{Number(leadershipFormatted).toFixed(2)}</p>
                  <p className="text-xs text-surface-500">KAIRO</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-success-50 to-success-100/50 border border-success-200/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-surface-600 mb-1">Total Claimable</p>
                    <p className="text-2xl font-bold text-success-600">{Number(totalClaimableFormatted).toFixed(2)} KAIRO</p>
                  </div>
                  <GiftIcon className="w-10 h-10 text-success-500" />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface-50 border border-surface-200">
                <h3 className="text-sm font-semibold text-surface-700 mb-3">Claim Rules</h3>
                <div className="space-y-2 text-xs text-surface-600">
                  <div className="flex items-start gap-2">
                    <InformationCircleIcon className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" />
                    <span>One-time claim only (use it or lose it)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <InformationCircleIcon className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" />
                    <span>Requires active stake in StakingManager</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <InformationCircleIcon className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" />
                    <span>Capped by active stake value (excess is deleted)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <InformationCircleIcon className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" />
                    <span>90% minted to you, 10% deflationary (not minted)</span>
                  </div>
                </div>
              </div>

              {Number(excessFormatted) > 0 && (
                <div className="p-3 rounded-xl bg-gradient-to-br from-red-50 to-red-100/50 border border-red-200/50">
                  <div className="flex items-center gap-2">
                    <FireIcon className="w-5 h-5 text-red-600" />
                    <span className="text-sm text-red-700 font-medium">
                      Warning: {Number(excessFormatted).toFixed(2)} KAIRO will be permanently deleted (exceeds stake cap)
                    </span>
                  </div>
                </div>
              )}

              {!canClaim && (
                <div className="p-3 rounded-xl bg-yellow-50 border border-yellow-200">
                  <p className="text-sm text-yellow-700">{canClaimReason}</p>
                </div>
              )}

              <div className="p-4 rounded-xl bg-gradient-to-br from-surface-50 to-surface-100/50 border border-surface-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-surface-600">Max claimable (based on stake):</span>
                  <span className="font-bold text-surface-900">{Number(maxClaimableFormatted).toFixed(2)} KAIRO</span>
                </div>
                {Number(maxClaimableFormatted) > 0 && (
                  <div className="w-full bg-surface-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-primary-500 to-secondary-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min((Number(totalClaimableFormatted) / Number(maxClaimableFormatted)) * 100, 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>

              <Button
                onClick={handleClaim}
                variant="primary"
                className="w-full"
                size="lg"
                loading={isPending}
                disabled={!canClaim || hasClaimed}
              >
                Claim Rewards
              </Button>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Leadership Rewards Breakdown */}
      {address && levelSubscriptions.length > 0 && (
        <GlassCard>
          <h2 className="text-xl font-bold text-surface-900 mb-6 flex items-center gap-2">
            <UserGroupIcon className="w-6 h-6 text-primary-600" />
            Leadership Rewards (5 Levels)
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-surface-600">Level</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-surface-600">Required Directs</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-surface-600">Reward/Sub</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-surface-600">Subscriptions</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-surface-600">Earned (KAIRO)</th>
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2, 3, 4].map((level) => {
                  const subs = Number(levelSubscriptions[level] || 0);
                  const rewards = Number(formatUnits(levelRewardsEarned[level] || 0n, KAIRO_DECIMALS));
                  const requiredDirects = LEVEL_DIRECTS[level];
                  const rewardPerSub = REF_REWARDS[level];

                  return (
                    <tr key={level} className="border-b border-surface-100 hover:bg-surface-50/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <TrophyIcon className="w-4 h-4 text-primary-500" />
                          <span className="font-semibold text-surface-900">Level {level + 1}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center text-surface-700">{requiredDirects}</td>
                      <td className="py-3 px-4 text-center font-semibold text-primary-600">{rewardPerSub}</td>
                      <td className="py-3 px-4 text-center text-surface-700">{subs}</td>
                      <td className="py-3 px-4 text-center font-semibold text-secondary-600">{rewards.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Info Section */}
      <GlassCard>
        <h2 className="text-xl font-bold text-surface-900 mb-4">How CMS Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-surface-800 mb-2 flex items-center gap-2">
              <TicketIcon className="w-5 h-5 text-primary-600" />
              Subscription Benefits
            </h3>
            <ul className="space-y-2 text-sm text-surface-600">
              <li className="flex items-start gap-2">
                <CheckCircleIcon className="w-4 h-4 text-success-500 flex-shrink-0 mt-0.5" />
                <span>10 USDT per subscription (max 10,000 total)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircleIcon className="w-4 h-4 text-success-500 flex-shrink-0 mt-0.5" />
                <span>Earn 5 KAIRO loyalty reward per subscription</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircleIcon className="w-4 h-4 text-success-500 flex-shrink-0 mt-0.5" />
                <span>Earn leadership rewards from 5 referral levels</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircleIcon className="w-4 h-4 text-success-500 flex-shrink-0 mt-0.5" />
                <span>Claim once with active stake (use it or lose it)</span>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-surface-800 mb-2 flex items-center gap-2">
              <UserGroupIcon className="w-5 h-5 text-secondary-600" />
              Referral Rewards
            </h3>
            <ul className="space-y-2 text-sm text-surface-600">
              <li className="flex items-start gap-2">
                <span className="font-semibold text-primary-600 w-20">Level 1:</span>
                <span>1 KAIRO per sub (0 directs required)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-primary-600 w-20">Level 2:</span>
                <span>0.5 KAIRO per sub (2 directs required)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-primary-600 w-20">Level 3:</span>
                <span>0.5 KAIRO per sub (3 directs required)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-primary-600 w-20">Level 4:</span>
                <span>0.25 KAIRO per sub (4 directs required)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-primary-600 w-20">Level 5:</span>
                <span>0.25 KAIRO per sub (5 directs required)</span>
              </li>
            </ul>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
