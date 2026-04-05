'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { formatUnits, parseUnits, isAddress, zeroAddress } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  RocketLaunchIcon,
} from '@heroicons/react/24/outline';
import { useReferral } from '@/hooks/useReferral';
import {
  CONTRACTS,
  USDTABI,
  StakingManagerABI,
  AffiliateDistributorABI,
} from '@/lib/contracts';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { Tooltip } from '@/components/ui/Tooltip';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn, formatAddress } from '@/lib/utils';

// ─── Tier config ───
const TIERS = [
  { name: 'Tier 0', min: 10, max: 499, intervalHours: 8, closings: 3 },
  { name: 'Tier 1', min: 500, max: 1_999, intervalHours: 6, closings: 4 },
  { name: 'Tier 2', min: 2_000, max: Infinity, intervalHours: 4, closings: 6 },
];

const STEP_LABELS = ['Amount', 'Referrer', 'Confirm'];
const USDT_DECIMALS = 18;
const COMPOUNDS_TO_3X = 1099; // ln(3)/ln(1.001) ≈ 1099

function detectTier(amount: number) {
  if (amount >= 2_000) return 2;
  if (amount >= 500) return 1;
  if (amount >= 10) return 0;
  return -1;
}

function estimate3xDate(intervalHours: number): Date {
  const hoursNeeded = COMPOUNDS_TO_3X * intervalHours;
  return new Date(Date.now() + hoursNeeded * 3600 * 1000);
}

// ─── Step Indicator ───
function StepIndicator({ current, completed }: { current: number; completed: number[] }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEP_LABELS.map((label, i) => {
        const isCompleted = completed.includes(i);
        const isActive = i === current;
        const isUpcoming = !isCompleted && !isActive;

        return (
          <div key={label} className="flex items-center">
            {/* Circle */}
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                layout
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all duration-300',
                  isCompleted && 'bg-matrix-green/20 border-matrix-green text-matrix-green',
                  isActive && 'bg-neon-cyan/20 border-neon-cyan text-neon-cyan shadow-lg shadow-neon-cyan/30',
                  isUpcoming && 'bg-transparent border-white/20 text-white/40',
                )}
              >
                {isCompleted ? <CheckIcon className="w-5 h-5" /> : i + 1}
              </motion.div>
              <span
                className={cn(
                  'text-xs font-medium',
                  isCompleted && 'text-matrix-green',
                  isActive && 'text-neon-cyan',
                  isUpcoming && 'text-white/40',
                )}
              >
                {label}
              </span>
            </div>

            {/* Connector line */}
            {i < STEP_LABELS.length - 1 && (
              <div className="w-16 sm:w-24 h-0.5 mx-2 mb-5 relative overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-matrix-green to-neon-cyan"
                  initial={{ width: '0%' }}
                  animate={{ width: completed.includes(i) ? '100%' : '0%' }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ───
export default function StakePage() {
  const router = useRouter();
  const { address } = useAccount();
  const { referrer: storedReferrer } = useReferral();

  // Multi-step state
  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState('');
  const [sliderValue, setSliderValue] = useState(10);
  const [referrerInput, setReferrerInput] = useState('');
  const [referrerStatus, setReferrerStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid' | 'self'>('idle');
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [txPhase, setTxPhase] = useState<'idle' | 'approving' | 'waitApprove' | 'staking' | 'waitStake' | 'success'>('idle');

  // ─── Contract reads ───
  const { data: usdtBalanceRaw, isLoading: isBalanceLoading } = useReadContract({
    address: CONTRACTS.USDT,
    abi: USDTABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!CONTRACTS.USDT },
  });

  const { data: usdtAllowanceRaw, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.USDT,
    abi: USDTABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACTS.STAKING_MANAGER] : undefined,
    query: { enabled: !!address && !!CONTRACTS.USDT && !!CONTRACTS.STAKING_MANAGER },
  });

  // Referrer verification — check if the address has a referrer set (meaning they're registered)
  const { data: referrerOfData, refetch: checkReferrer } = useReadContract({
    address: CONTRACTS.AFFILIATE_DISTRIBUTOR,
    abi: AffiliateDistributorABI,
    functionName: 'referrerOf',
    args: referrerInput && isAddress(referrerInput) ? [referrerInput as `0x${string}`] : undefined,
    query: { enabled: false }, // manual trigger
  });

  // ─── Write contracts ───
  const {
    writeContract: writeApprove,
    data: approveTxHash,
    isPending: isApprovePending,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract();

  const {
    writeContract: writeStake,
    data: stakeTxHash,
    isPending: isStakePending,
    error: stakeError,
    reset: resetStake,
  } = useWriteContract();

  const { isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({
    hash: approveTxHash,
    query: { enabled: !!approveTxHash },
  });

  const { isSuccess: isStakeConfirmed } = useWaitForTransactionReceipt({
    hash: stakeTxHash,
    query: { enabled: !!stakeTxHash },
  });

  // ─── Derived values ───
  const parsedAmount = useMemo(() => {
    const n = parseFloat(amount);
    return isNaN(n) || n <= 0 ? 0 : n;
  }, [amount]);

  const usdtBalance = usdtBalanceRaw ? Number(formatUnits(usdtBalanceRaw as bigint, USDT_DECIMALS)) : 0;
  const usdtAllowance = usdtAllowanceRaw ? Number(formatUnits(usdtAllowanceRaw as bigint, USDT_DECIMALS)) : 0;
  const detectedTier = detectTier(parsedAmount);
  const needsApproval = parsedAmount > 0 && usdtAllowance < parsedAmount;
  const isInsufficientBalance = parsedAmount > usdtBalance && usdtBalance > 0;
  const isAmountValid = parsedAmount >= 10 && !isInsufficientBalance;
  const completedSteps = useMemo(() => {
    const c: number[] = [];
    if (step > 0) c.push(0);
    if (step > 1) c.push(1);
    return c;
  }, [step]);

  // ─── Auto-fill referrer from URL/localStorage ───
  useEffect(() => {
    if (storedReferrer && !referrerInput) {
      setReferrerInput(storedReferrer);
      // Auto-validate after a tick
      setTimeout(() => handleCheckReferrer(storedReferrer), 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedReferrer]);

  // ─── Sync slider ↔ input ───
  const handleAmountChange = (val: string) => {
    setAmount(val);
    const n = parseFloat(val);
    if (!isNaN(n) && n >= 10 && n <= 10000) {
      setSliderValue(n);
    }
  };

  const handleSliderChange = (val: number) => {
    setSliderValue(val);
    setAmount(val.toString());
  };

  // ─── Referrer check ───
  const handleCheckReferrer = useCallback(
    async (addressToCheck?: string) => {
      const addr = addressToCheck || referrerInput;
      if (!addr || !isAddress(addr)) {
        setReferrerStatus('invalid');
        return;
      }
      if (address && addr.toLowerCase() === address.toLowerCase()) {
        setReferrerStatus('self');
        return;
      }
      setReferrerStatus('checking');
      try {
        const result = await checkReferrer();
        const ref = result.data as `0x${string}` | undefined;
        if (ref && ref !== zeroAddress) {
          setReferrerStatus('valid');
        } else {
          setReferrerStatus('invalid');
        }
      } catch {
        setReferrerStatus('invalid');
      }
    },
    [referrerInput, address, checkReferrer],
  );

  // ─── Approve → Stake flow ───
  const handleStakeClick = useCallback(() => {
    if (!address) return;
    const amtBig = parseUnits(amount, USDT_DECIMALS);
    const ref = (referrerInput && isAddress(referrerInput) && referrerStatus === 'valid'
      ? referrerInput
      : zeroAddress) as `0x${string}`;

    if (needsApproval) {
      setTxPhase('approving');
      writeApprove({
        address: CONTRACTS.USDT,
        abi: USDTABI,
        functionName: 'approve',
        args: [CONTRACTS.STAKING_MANAGER, amtBig],
      });
    } else {
      setTxPhase('staking');
      writeStake({
        address: CONTRACTS.STAKING_MANAGER,
        abi: StakingManagerABI,
        functionName: 'stake',
        args: [amtBig, ref],
      });
    }
  }, [address, amount, referrerInput, referrerStatus, needsApproval, writeApprove, writeStake]);

  // Track approve tx → then stake
  useEffect(() => {
    if (approveTxHash && txPhase === 'approving') {
      setTxPhase('waitApprove');
    }
  }, [approveTxHash, txPhase]);

  useEffect(() => {
    if (isApproveConfirmed && txPhase === 'waitApprove') {
      // Refetch allowance then stake
      refetchAllowance().then(() => {
        const amtBig = parseUnits(amount, USDT_DECIMALS);
        const ref = (referrerInput && isAddress(referrerInput) && referrerStatus === 'valid'
          ? referrerInput
          : zeroAddress) as `0x${string}`;
        setTxPhase('staking');
        writeStake({
          address: CONTRACTS.STAKING_MANAGER,
          abi: StakingManagerABI,
          functionName: 'stake',
          args: [amtBig, ref],
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApproveConfirmed, txPhase]);

  // Track stake tx
  useEffect(() => {
    if (stakeTxHash && txPhase === 'staking') {
      setTxPhase('waitStake');
    }
  }, [stakeTxHash, txPhase]);

  useEffect(() => {
    if (isStakeConfirmed && txPhase === 'waitStake') {
      setTxPhase('success');
    }
  }, [isStakeConfirmed, txPhase]);

  // Error handling
  useEffect(() => {
    if (approveError) setTxPhase('idle');
  }, [approveError]);

  useEffect(() => {
    if (stakeError) setTxPhase('idle');
  }, [stakeError]);

  // Auto-redirect on success
  useEffect(() => {
    if (txPhase === 'success') {
      const timeout = setTimeout(() => router.push('/dashboard'), 3000);
      return () => clearTimeout(timeout);
    }
  }, [txPhase, router]);

  const buttonLabel = useMemo(() => {
    switch (txPhase) {
      case 'approving': return 'Approve USDT...';
      case 'waitApprove': return 'Confirming Approval...';
      case 'staking': return 'Confirm in Wallet...';
      case 'waitStake': return 'Staking...';
      case 'success': return 'Success!';
      default: return needsApproval ? 'Approve & Stake USDT' : 'Stake USDT';
    }
  }, [txPhase, needsApproval]);

  const isTxBusy = txPhase !== 'idle' && txPhase !== 'success';

  // ─── Slider fill percentage for custom styling ───
  const sliderPercent = ((sliderValue - 10) / (10000 - 10)) * 100;

  // ─── Success Screen ───
  if (txPhase === 'success') {
    const tier = TIERS[detectedTier >= 0 ? detectedTier : 0];
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          className="text-center max-w-md w-full"
        >
          {/* Glowing checkmark */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', damping: 15 }}
            className="w-24 h-24 mx-auto mb-6 rounded-full bg-neon-cyan/10 border-2 border-neon-cyan flex items-center justify-center shadow-[0_0_40px_rgba(0,255,255,0.3)]"
          >
            <CheckIcon className="w-12 h-12 text-neon-cyan" />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-2xl font-orbitron text-white mb-6"
          >
            Stake Activated
          </motion.h2>

          {/* Holographic badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <GlassCard className="border border-neon-cyan/30 bg-gradient-to-br from-neon-cyan/5 to-neon-purple/5 relative overflow-hidden">
              {/* Holographic shimmer */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_3s_ease-in-out_infinite]" />
              <div className="relative space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Amount Staked</span>
                  <span className="font-mono text-white text-lg">${parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Tier</span>
                  <span className="text-neon-cyan font-semibold">{tier.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">First Compound In</span>
                  <span className="font-mono text-white">{tier.intervalHours}h</span>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-sm text-gray-400 mt-4"
          >
            Your stake is now earning 0.1% every {tier.intervalHours} hours
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="mt-6"
          >
            <Button variant="secondary" size="lg" onClick={() => router.push('/dashboard')}>
              Go to Dashboard
            </Button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // ─── Main multi-step form ───
  return (
    <div className="px-4 py-6 sm:px-6 max-w-2xl mx-auto">
      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl sm:text-3xl font-orbitron text-white text-center mb-2"
      >
        Stake USDT
      </motion.h1>
      <p className="text-center text-gray-400 text-sm mb-8">Earn compound rewards with the 3X cap mechanism</p>

      <StepIndicator current={step} completed={completedSteps} />

      <AnimatePresence mode="wait">
        {/* ────── STEP 1: AMOUNT ────── */}
        {step === 0 && (
          <motion.div
            key="step-amount"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-lg sm:text-xl font-orbitron text-white mb-6">
              How much would you like to stake?
            </h2>

            {/* Amount input */}
            <div className="relative mb-4">
              <input
                type="number"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0"
                min={10}
                className={cn(
                  'w-full px-6 py-4 text-4xl font-mono text-white rounded-xl',
                  'bg-white/5 backdrop-blur-sm border-2 transition-all duration-300',
                  'placeholder:text-white/20 focus:outline-none pr-24',
                  parsedAmount > 0 && parsedAmount < 10
                    ? 'border-neon-coral/50 focus:border-neon-coral'
                    : 'border-white/10 focus:border-neon-cyan focus:shadow-[0_0_20px_rgba(0,255,255,0.15)]',
                )}
              />
              <span className="absolute right-6 top-1/2 -translate-y-1/2 text-lg font-semibold text-gray-400">
                USDT
              </span>
            </div>

            {/* Balance + MAX */}
            <div className="flex items-center justify-between mb-6 text-sm">
              <span className="text-gray-400">
                Balance:{' '}
                {isBalanceLoading ? (
                  <Skeleton variant="text" className="inline-block h-4 w-24 align-middle" />
                ) : (
                  <span className="font-mono text-gray-300">
                    {usdtBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT
                  </span>
                )}
              </span>
              <button
                onClick={() => handleAmountChange(Math.min(usdtBalance, 10000).toString())}
                className="px-3 py-1 text-xs font-medium text-neon-cyan bg-neon-cyan/10 rounded-lg hover:bg-neon-cyan/20 transition-colors"
              >
                MAX
              </button>
            </div>

            {isInsufficientBalance && (
              <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-neon-coral/10 border border-neon-coral/30">
                <ExclamationTriangleIcon className="w-5 h-5 text-neon-coral shrink-0" />
                <span className="text-sm text-neon-coral">Insufficient balance</span>
              </div>
            )}

            {parsedAmount > 0 && parsedAmount < 10 && (
              <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-solar-amber/10 border border-solar-amber/30">
                <ExclamationTriangleIcon className="w-5 h-5 text-solar-amber shrink-0" />
                <span className="text-sm text-solar-amber">Minimum stake is 10 USDT</span>
              </div>
            )}

            {/* Slider */}
            <div className="mb-8">
              <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span>$10</span>
                <span>$10,000</span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min={10}
                  max={10000}
                  step={10}
                  value={sliderValue}
                  onChange={(e) => handleSliderChange(Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer bg-white/10"
                  style={{
                    background: `linear-gradient(to right, #00FFFF ${sliderPercent}%, rgba(255,255,255,0.1) ${sliderPercent}%)`,
                  }}
                />
              </div>
            </div>

            {/* Tier cards */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-medium text-gray-300">Staking Tiers</span>
              <Tooltip content="Higher tiers compound faster, reaching the 3X cap sooner">
                <span>
                  <InformationCircleIcon className="w-4 h-4 text-gray-500 cursor-help" />
                </span>
              </Tooltip>
            </div>

            <div className="grid gap-3 mb-8">
              {TIERS.map((tier, i) => {
                const isMatch = detectedTier === i;
                return (
                  <GlassCard
                    key={tier.name}
                    className={cn(
                      'transition-all duration-300 border-2',
                      isMatch
                        ? 'border-neon-cyan/60 shadow-[0_0_15px_rgba(0,255,255,0.15)]'
                        : 'border-transparent opacity-50',
                    )}
                    padding="sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={cn('font-semibold text-sm', isMatch ? 'text-neon-cyan' : 'text-gray-400')}>
                          {tier.name}
                        </span>
                        <p className="text-xs text-gray-500 mt-0.5">
                          ${tier.min.toLocaleString()} - {tier.max === Infinity ? '∞' : `$${tier.max.toLocaleString()}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn('text-xs', isMatch ? 'text-gray-300' : 'text-gray-500')}>
                          Compounds every {tier.intervalHours}h
                        </p>
                        <p className={cn('text-xs', isMatch ? 'text-gray-400' : 'text-gray-600')}>
                          {tier.closings} daily closings
                        </p>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>

            <Button
              size="lg"
              variant="primary"
              className="w-full"
              disabled={!isAmountValid}
              onClick={() => setStep(1)}
            >
              <span>Next</span>
              <ArrowRightIcon className="w-4 h-4" />
            </Button>
          </motion.div>
        )}

        {/* ────── STEP 2: REFERRER ────── */}
        {step === 1 && (
          <motion.div
            key="step-referrer"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-lg sm:text-xl font-orbitron text-white mb-2">Who referred you?</h2>
            <p className="text-sm text-gray-400 mb-6">Optional — Enter your referrer&apos;s wallet address</p>

            {/* Address input */}
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={referrerInput}
                  onChange={(e) => {
                    setReferrerInput(e.target.value);
                    setReferrerStatus('idle');
                  }}
                  placeholder="0x..."
                  className={cn(
                    'w-full px-4 py-3 text-sm font-mono text-white rounded-xl',
                    'bg-white/5 backdrop-blur-sm border-2 transition-all duration-300',
                    'placeholder:text-white/20 focus:outline-none',
                    referrerStatus === 'valid' ? 'border-matrix-green/50' :
                    referrerStatus === 'invalid' || referrerStatus === 'self' ? 'border-neon-coral/50' :
                    'border-white/10 focus:border-neon-cyan',
                  )}
                />
              </div>
              <Button
                variant="secondary"
                size="md"
                disabled={!referrerInput || referrerStatus === 'checking'}
                loading={referrerStatus === 'checking'}
                onClick={() => handleCheckReferrer()}
              >
                Check
              </Button>
            </div>

            {/* Validation messages */}
            <AnimatePresence>
              {referrerStatus === 'valid' && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 mb-4 text-sm text-matrix-green"
                >
                  <CheckCircleIcon className="w-5 h-5" />
                  <span>Valid referrer</span>
                </motion.div>
              )}
              {referrerStatus === 'invalid' && referrerInput && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 mb-4 text-sm text-neon-coral"
                >
                  <XCircleIcon className="w-5 h-5" />
                  <span>Not found</span>
                </motion.div>
              )}
              {referrerStatus === 'self' && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 mb-4 text-sm text-neon-coral"
                >
                  <XCircleIcon className="w-5 h-5" />
                  <span>No self-referral allowed</span>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="text-xs text-gray-500 mb-8">This field is optional — you can proceed without a referrer.</p>

            <div className="flex gap-3">
              <Button variant="secondary" size="lg" className="flex-1" onClick={() => setStep(0)}>
                <ArrowLeftIcon className="w-4 h-4" />
                <span>Back</span>
              </Button>
              <Button variant="primary" size="lg" className="flex-1" onClick={() => setStep(2)}>
                <span>Next</span>
                <ArrowRightIcon className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* ────── STEP 3: CONFIRM ────── */}
        {step === 2 && (
          <motion.div
            key="step-confirm"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-lg sm:text-xl font-orbitron text-white mb-6">Confirm Your Stake</h2>

            {/* Summary card */}
            <GlassCard className="border border-white/10 mb-6">
              <div className="space-y-4">
                {/* Amount */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Amount</span>
                  <span className="text-2xl font-mono text-white">
                    {parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT
                  </span>
                </div>

                <div className="h-px bg-white/10" />

                {/* Tier */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Tier</span>
                  <span className="inline-flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30">
                      {detectedTier >= 0 ? TIERS[detectedTier].name : '—'}
                    </span>
                  </span>
                </div>

                {/* Compound Interval */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Compound Interval</span>
                  <span className="text-sm font-mono text-white">
                    Every {detectedTier >= 0 ? TIERS[detectedTier].intervalHours : '—'}h
                  </span>
                </div>

                {/* Estimated 3X date */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Estimated 3X Date</span>
                  <span className="text-sm font-mono text-white">
                    {detectedTier >= 0
                      ? estimate3xDate(TIERS[detectedTier].intervalHours).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : '—'}
                  </span>
                </div>

                {/* Referrer */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Referrer</span>
                  <span className="text-sm font-mono text-white">
                    {referrerInput && referrerStatus === 'valid' ? formatAddress(referrerInput) : 'None'}
                  </span>
                </div>

                {/* Gas */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Gas Estimate</span>
                  <span className="text-sm text-gray-300">~$0.01 on opBNB</span>
                </div>
              </div>
            </GlassCard>

            {/* Fee info */}
            <div className="flex items-start gap-2 mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
              <InformationCircleIcon className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
              <span className="text-xs text-gray-400">
                5% affiliate dividend will be distributed to your referrer&apos;s network
              </span>
            </div>

            {/* Risk checkbox */}
            <label className="flex items-start gap-3 mb-6 cursor-pointer group">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={riskAccepted}
                  onChange={(e) => setRiskAccepted(e.target.checked)}
                  className="sr-only peer"
                />
                <div className={cn(
                  'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                  riskAccepted
                    ? 'bg-neon-cyan/20 border-neon-cyan'
                    : 'border-white/30 group-hover:border-white/50',
                )}>
                  {riskAccepted && <CheckIcon className="w-3.5 h-3.5 text-neon-cyan" />}
                </div>
              </div>
              <span className="text-sm text-gray-300 leading-snug">
                I understand that unstaking before reaching the 3X cap returns only 80% of my staked value
              </span>
            </label>

            {/* Error messages */}
            {(approveError || stakeError) && (
              <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-neon-coral/10 border border-neon-coral/30">
                <ExclamationTriangleIcon className="w-5 h-5 text-neon-coral shrink-0" />
                <span className="text-sm text-neon-coral">
                  {approveError
                    ? 'Approval failed — transaction was rejected or gas insufficient'
                    : 'Stake failed — transaction was rejected or gas insufficient'}
                </span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="lg"
                className="flex-1"
                disabled={isTxBusy}
                onClick={() => {
                  resetApprove();
                  resetStake();
                  setStep(1);
                }}
              >
                <ArrowLeftIcon className="w-4 h-4" />
                <span>Back</span>
              </Button>
              <Button
                variant="primary"
                size="lg"
                className="flex-1"
                disabled={!riskAccepted || isTxBusy}
                loading={isTxBusy}
                onClick={handleStakeClick}
              >
                <RocketLaunchIcon className="w-5 h-5" />
                <span>{buttonLabel}</span>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
