'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useRegistration } from '@/hooks/useRegistration';
import { HeroSection } from '@/components/landing/HeroSection';

import { FeatureGrid } from '@/components/landing/FeatureGrid';
import { AnnouncementPopup } from '@/components/landing/AnnouncementPopup';
import { GlassCard } from '@/components/ui';
import { CHAIN_ID, IS_TESTNET, contracts, getExplorerAddressUrl } from '@/config/contracts';

export default function Home() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { isRegistered, isLoading } = useRegistration();

  useEffect(() => {
    if (!isConnected || isLoading) return;
    if (isRegistered) {
      router.replace('/dashboard');
    } else {
      router.replace('/register');
    }
  }, [isConnected, isRegistered, isLoading, router]);

  // Connected but still checking — show spinner
  if (isConnected && isLoading) {
    return (
      <main className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-surface-500">Checking your account...</p>
        </div>
      </main>
    );
  }

  // Connected and redirect is happening
  if (isConnected && !isLoading) {
    return null;
  }

  // Not connected — show landing page with connect wallet prompt
  return (
    <main className="min-h-screen bg-surface-50">
      <AnnouncementPopup />
      <HeroSection />
      <FeatureGrid />

      {/* Connect Wallet CTA */}
      <section className="py-16 flex justify-center">
        <GlassCard className="max-w-md w-full mx-4 text-center" variant="gradient">
          <h2 className="text-2xl font-orbitron font-bold gradient-text mb-3">Get Started</h2>
          <p className="text-surface-500 text-sm mb-6">Connect your wallet to access the KAIRO DAO Aurora Financial Ecosystem.</p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </GlassCard>
      </section>

      {/* Verified Contract Addresses */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-orbitron font-bold text-center text-surface-900 mb-2">
            Verified <span className="gradient-text">Smart Contracts</span>
          </h2>
          <p className="text-center text-surface-500 text-sm mb-8">
            All contracts are verified and open-source on {IS_TESTNET ? `opBNB Testnet (Chain ${CHAIN_ID})` : `opBNB Mainnet (Chain ${CHAIN_ID})`}
          </p>
          <div className="space-y-2">
            {[
              { name: 'KAIRO Token', address: contracts.kairoToken },
              { name: 'Liquidity Pool', address: contracts.liquidityPool },
              { name: 'Staking Manager', address: contracts.stakingManager },
              { name: 'Affiliate Distributor', address: contracts.affiliateDistributor },
              { name: 'Atomic P2P Exchange', address: contracts.atomicP2p },
              { name: IS_TESTNET ? 'USDT (opBNB Testnet)' : 'USDT (opBNB)', address: contracts.usdt },
            ].map((contract) => (
              <a
                key={contract.address}
                href={getExplorerAddressUrl(contract.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 px-4 py-3 rounded-xl border border-surface-200 bg-white/60 hover:border-primary-300 hover:bg-primary-50/30 transition-all group"
              >
                <span className="text-sm font-semibold text-surface-700 group-hover:text-primary-600 transition-colors">
                  {contract.name}
                </span>
                <span className="font-mono text-xs text-surface-400 group-hover:text-primary-500 transition-colors break-all">
                  {contract.address}
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-8 text-center border-t border-surface-200">
        <p className="text-surface-400 text-sm">
          &copy; {new Date().getFullYear()} KAIRO DAO &middot; Aurora Financial Ecosystem
        </p>
      </footer>
    </main>
  );
}
