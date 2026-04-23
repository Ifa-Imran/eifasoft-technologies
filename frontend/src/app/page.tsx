'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useRegistration } from '@/hooks/useRegistration';
import { HeroSection } from '@/components/landing/HeroSection';

import { FeatureGrid } from '@/components/landing/FeatureGrid';
import { GlassCard } from '@/components/ui';

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
            All contracts are verified and open-source on opBNB Mainnet (Chain 204)
          </p>
          <div className="space-y-2">
            {[
              { name: 'KAIRO Token', address: '0x3DA7B98DE7085eda9b991fAD4762b274E9ADb496' },
              { name: 'Liquidity Pool', address: '0xe3084fadF0db28F5f97162da1dde542a50cBc264' },
              { name: 'Staking Manager', address: '0xB6724041A765e0BE0B212dB57Ff317cCEF5A1EDd' },
              { name: 'Affiliate Distributor', address: '0xf53C1735e345dEBe19a3168BFE6AA3CC07FdBCD6' },
              { name: 'CMS (Membership)', address: '0x04Ecd8106bEcd7FFee528F363dD2121343296F2e' },
              { name: 'Atomic P2P Exchange', address: '0x12a2e94da17e90fa2A36F7C311c4B0A22300e46E' },
              { name: 'USDT (opBNB)', address: '0x9e5AAC1Ba1a2e6aEd6b32689DFcF62A509Ca96f3' },
            ].map((contract) => (
              <a
                key={contract.address}
                href={`https://opbnbscan.com/address/${contract.address}`}
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
