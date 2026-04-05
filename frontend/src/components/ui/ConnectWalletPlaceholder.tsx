'use client';

import { WalletIcon } from '@heroicons/react/24/outline';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { GlassCard } from '@/components/ui/GlassCard';

interface ConnectWalletPlaceholderProps {
  context?: string;
}

export function ConnectWalletPlaceholder({ context = 'data' }: ConnectWalletPlaceholderProps) {
  return (
    <div className="flex items-center justify-center py-20 px-4">
      <GlassCard className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-glass flex items-center justify-center mx-auto mb-6">
          <WalletIcon className="w-10 h-10 text-gray-600" />
        </div>
        <h2 className="text-xl font-orbitron font-bold text-white mb-2">
          Connect Your Wallet
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Connect your wallet to view your {context}
        </p>
        <div className="flex justify-center">
          <ConnectButton />
        </div>
      </GlassCard>
    </div>
  );
}
