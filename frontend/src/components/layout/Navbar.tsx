'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { AnimatedCounter } from '@/components/ui';
import { useKairoPrice } from '@/hooks/useKairoPrice';
import { Bars3Icon } from '@heroicons/react/24/outline';

interface NavbarProps {
  onMenuToggle: () => void;
}

export function Navbar({ onMenuToggle }: NavbarProps) {
  const { price } = useKairoPrice();

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-surface-200">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Left */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuToggle}
            className="lg:hidden text-surface-400 hover:text-surface-700 p-2 rounded-lg hover:bg-surface-100 transition-colors"
          >
            <Bars3Icon className="w-5 h-5" />
          </button>

          {/* Live Price Ticker */}
          {price > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary-50 to-secondary-50 border border-primary-100">
              <div className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
              <span className="text-xs text-surface-500 font-medium">KAIRO</span>
              <AnimatedCounter
                value={price}
                prefix="$"
                decimals={4}
                className="text-sm font-mono font-semibold text-surface-900"
              />
            </div>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          <ConnectButton
            chainStatus="icon"
            accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }}
            showBalance={{ smallScreen: false, largeScreen: true }}
          />
        </div>
      </div>
    </header>
  );
}
