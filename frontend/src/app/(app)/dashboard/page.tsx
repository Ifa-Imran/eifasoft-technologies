'use client';

import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { parseEther } from 'viem';
import { Button, GlassCard, Input } from '@/components/ui';
import { PortfolioOverview } from '@/components/dashboard/PortfolioOverview';
import { ActiveStakesTable } from '@/components/dashboard/ActiveStakesTable';
import { IncomeSummary } from '@/components/dashboard/IncomeSummary';
import { ReferralWidget } from '@/components/dashboard/ReferralWidget';
import { contracts } from '@/config/contracts';
import { MockUSDTABI } from '@/config/abis/MockUSDT';
import { useToast } from '@/components/ui';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const [mintAmount, setMintAmount] = useState('10000');
  const [showMintPanel, setShowMintPanel] = useState(false);

  const { writeContract: mintUsdt, data: mintHash, isPending: mintPending } = useWriteContract();

  const { isSuccess: mintSuccess, isError: mintError } = useWaitForTransactionReceipt({
    hash: mintHash,
  });

  useEffect(() => {
    if (mintSuccess) {
      toast({ type: 'success', title: `Successfully minted ${Number(mintAmount).toLocaleString()} USDT!` });
      setShowMintPanel(false);
    }
    if (mintError) {
      toast({ type: 'error', title: 'Failed to mint USDT' });
    }
  }, [mintSuccess, mintError, toast]);

  const handleMintUsdt = () => {
    const amount = Number(mintAmount);
    if (!amount || amount <= 0) {
      toast({ type: 'error', title: 'Enter a valid amount' });
      return;
    }
    mintUsdt({
      address: contracts.usdt,
      abi: MockUSDTABI,
      functionName: 'mint',
      args: [address!, parseEther(mintAmount)],
    });
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <h2 className="text-2xl font-orbitron font-bold text-surface-900">Connect Your Wallet</h2>
        <p className="text-surface-500 text-center max-w-md">
          Connect your wallet to view your portfolio, manage stakes, and track earnings.
        </p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-orbitron font-bold gradient-text">Dashboard</h1>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowMintPanel(!showMintPanel)}
          >
            {showMintPanel ? 'Close Faucet' : 'Mint USDT'}
          </Button>
          <Link href="/cms">
            <Button variant="primary" size="sm">
              Buy CMS
            </Button>
          </Link>
        </div>
      </div>

      {showMintPanel && (
        <GlassCard className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
            <div className="flex-1 w-full sm:w-auto">
              <label className="block text-sm font-medium text-surface-400 mb-1">
                Testnet USDT Faucet
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Amount"
                  value={mintAmount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMintAmount(e.target.value)}
                  className="w-full sm:w-48"
                  min="1"
                />
                <span className="text-surface-400 text-sm whitespace-nowrap">USDT</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {[1000, 10000, 50000, 100000].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setMintAmount(String(preset))}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    mintAmount === String(preset)
                      ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                      : 'border-surface-700 text-surface-400 hover:border-surface-500'
                  }`}
                >
                  {preset >= 1000 ? `${preset / 1000}K` : preset}
                </button>
              ))}
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleMintUsdt}
              disabled={mintPending || !mintAmount}
            >
              {mintPending ? 'Minting...' : `Mint ${Number(mintAmount || 0).toLocaleString()} USDT`}
            </Button>
          </div>
        </GlassCard>
      )}

      <ReferralWidget />
      <PortfolioOverview />
      <ActiveStakesTable />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IncomeSummary />
      </div>
    </div>
  );
}
