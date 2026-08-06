'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { GlassCard, Button, Input, LanguageSwitcher } from '@/components/ui';
import { useRegistration } from '@/hooks/useRegistration';
import { useTranslations } from 'next-intl';
import { contracts, SYSTEM_WALLET } from '@/config/contracts';
import { isAddress, zeroAddress } from 'viem';
import { AffiliateDistributorABI } from '@/config/abis/AffiliateDistributor';
import { useReadContract } from 'wagmi';

function RegisterPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isConnected, address } = useAccount();
  const { isRegistered, isLoading: regLoading, isGenesisMode, isFirstUserMode, genesisAccount, register, isPending, isSuccess } = useRegistration();
  const t = useTranslations('register');

  // Either genesis or first-user can skip referrer
  const skipReferrer = isGenesisMode || isFirstUserMode;

  const refParam = searchParams.get('ref') || '';
  const [referrer, setReferrer] = useState(refParam);
  const [referrerError, setReferrerError] = useState('');
  const hasRefLink = !!refParam && isAddress(refParam);

  // Validate referrer is registered on-chain
  const referrerAddr = referrer && isAddress(referrer) ? (referrer as `0x${string}`) : undefined;
  const { data: referrerOfReferrer } = useReadContract({
    address: contracts.affiliateDistributor,
    abi: AffiliateDistributorABI,
    functionName: 'referrerOf',
    args: referrerAddr ? [referrerAddr] : undefined,
    query: { enabled: !!referrerAddr && contracts.affiliateDistributor !== '0x' },
  });

  // Redirect to dashboard if already registered (even if they opened a referral link)
  useEffect(() => {
    if (isRegistered && !regLoading) {
      router.replace('/dashboard');
    }
  }, [isRegistered, regLoading, router]);

  // Redirect after successful registration tx
  useEffect(() => {
    if (isSuccess && isRegistered) {
      router.replace('/dashboard');
    }
  }, [isSuccess, isRegistered, router]);

  // Validate referrer on change
  useEffect(() => {
    if (!referrer) {
      setReferrerError('');
      return;
    }
    if (!isAddress(referrer)) {
      setReferrerError('Invalid address format');
      return;
    }
    if (referrer.toLowerCase() === address?.toLowerCase()) {
      setReferrerError('Cannot refer yourself');
      return;
    }
    // Genesis mode: system wallet is always valid
    if (referrer.toLowerCase() === SYSTEM_WALLET.toLowerCase()) {
      setReferrerError('');
      return;
    }
    // Check referrer is registered on-chain
    if (referrerOfReferrer !== undefined) {
      if (referrerOfReferrer === zeroAddress) {
        setReferrerError('This address is not registered in the system');
      } else {
        setReferrerError('');
      }
    }
  }, [referrer, referrerOfReferrer, address]);

  // --- Not connected ---
  if (!isConnected) {
    return (
      <main className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="fixed top-4 right-4 z-50">
          <LanguageSwitcher />
        </div>
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-primary-200/30 to-primary-100/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-gradient-to-br from-secondary-200/30 to-secondary-100/20 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-accent-100/20 rounded-full blur-[100px]" />
        </div>
        <GlassCard className="relative z-10 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-orbitron font-bold text-white">K</span>
          </div>
          <h1 className="text-3xl font-orbitron font-bold gradient-text mb-3">{t('title')}</h1>
          <p className="text-surface-500 mb-8">{t('connectPrompt')}</p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </GlassCard>
      </main>
    );
  }

  // --- Loading ---
  if (regLoading) {
    return (
      <main className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="text-surface-500 text-center">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p>{t('checkingStatus')}</p>
        </div>
      </main>
    );
  }

  // --- Registration form ---
  // In first-user mode, use genesis account as referrer (it's the only registered address)
  // In genesis mode, use SYSTEM_WALLET (contract handles self-registration)
  const effectiveReferrer = skipReferrer && !referrer
    ? (isFirstUserMode && genesisAccount ? genesisAccount : SYSTEM_WALLET)
    : referrer;
  // For non-genesis/non-first-user: require on-chain proof that the referrer is registered
  const referrerVerifiedOnChain = referrerOfReferrer !== undefined && referrerOfReferrer !== zeroAddress;
  const canSubmit = !referrerError && (
    skipReferrer || (effectiveReferrer && isAddress(effectiveReferrer) && referrerVerifiedOnChain)
  );

  const handleRegister = () => {
    if (!canSubmit || isPending) return;
    const ref = effectiveReferrer && isAddress(effectiveReferrer) ? effectiveReferrer : SYSTEM_WALLET;
    register(ref);
  };

  return (
    <main className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher />
      </div>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-100/40 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-100/40 rounded-full blur-[120px]" />
      </div>

      <GlassCard className="relative z-10 max-w-lg w-full">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center mx-auto mb-3">
            <span className="text-xl font-orbitron font-bold text-white">K</span>
          </div>
          <h1 className="text-2xl font-orbitron font-bold gradient-text mb-2">{t('title')}</h1>
          <p className="text-surface-500 text-sm">
            {t('formPrompt')}
          </p>
        </div>

        {!skipReferrer && !hasRefLink && (
          <div className="mb-4 p-3 rounded-xl bg-primary-50 border border-primary-200 text-xs text-surface-600 text-center">
            {t('referrerHint')} <span className="text-primary-600 font-mono">domain.com/register?ref=0x...</span>
          </div>
        )}

        {isGenesisMode && (
          <div className="mb-4 p-3 rounded-xl bg-accent-50 border border-accent-200 text-xs text-accent-700 text-center">
            {t('genesisMode')}
          </div>
        )}

        {isFirstUserMode && (
          <div className="mb-4 p-3 rounded-xl bg-accent-50 border border-accent-200 text-xs text-accent-700 text-center">
            {t('firstUserMode')}
          </div>
        )}

        <div className="space-y-4">
          {!skipReferrer && (
            <div>
              <Input
                label={t('referrerLabel')}
                placeholder={t('referrerPlaceholder')}
                value={referrer}
                onChange={(e) => setReferrer(e.target.value)}
                error={referrerError}
                disabled={hasRefLink}
              />
              {hasRefLink && !referrerError && (
                <p className="text-xs text-accent-600 mt-1">{t('referrerVerified')}</p>
              )}
            </div>
          )}

          <div className="p-4 rounded-xl bg-gradient-to-r from-primary-50/50 to-secondary-50/50 border border-primary-100/50 space-y-3">
            <h4 className="text-sm font-semibold text-surface-900">{t('whatHappensNext')}</h4>
            <ul className="space-y-2 text-xs text-surface-500">
              <li className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">1</span>
                <span>{t('step1')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-secondary-100 text-secondary-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">2</span>
                <span>{t('step2')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-accent-100 text-accent-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">3</span>
                <span>{t('step3')}</span>
              </li>
            </ul>
          </div>

          <Button
            onClick={handleRegister}
            disabled={!canSubmit || isPending}
            loading={isPending}
            className="w-full"
          >
            {isPending ? t('registering') : t('registerButton')}
          </Button>
        </div>
      </GlassCard>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-surface-50 flex items-center justify-center">
          <div className="text-surface-500">Loading...</div>
        </main>
      }
    >
      <RegisterPageInner />
    </Suspense>
  );
}
