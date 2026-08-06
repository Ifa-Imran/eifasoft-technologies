'use client';

import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useTranslations } from 'next-intl';
import { PortfolioOverview } from '@/components/dashboard/PortfolioOverview';
import { ActiveStakesTable } from '@/components/dashboard/ActiveStakesTable';
import { IncomeSummary } from '@/components/dashboard/IncomeSummary';
import { ReferralWidget } from '@/components/dashboard/ReferralWidget';
import { MockUsdtFaucet } from '@/components/dashboard/MockUsdtFaucet';

export default function DashboardPage() {
  const { isConnected } = useAccount();
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <h2 className="text-2xl font-orbitron font-bold text-surface-900">{tCommon('connectWalletTitle')}</h2>
        <p className="text-surface-500 text-center max-w-md">
          {tCommon('connectWalletDesc')}
        </p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-orbitron font-bold gradient-text">{t('title')}</h1>
      </div>

      <ReferralWidget />
      <MockUsdtFaucet />
      <PortfolioOverview />
      <ActiveStakesTable />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IncomeSummary />
      </div>
    </div>
  );
}
