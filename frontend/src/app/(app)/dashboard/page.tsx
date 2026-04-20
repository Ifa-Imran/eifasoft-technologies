'use client';

import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '@/components/ui';
import { PortfolioOverview } from '@/components/dashboard/PortfolioOverview';
import { ActiveStakesTable } from '@/components/dashboard/ActiveStakesTable';
import { IncomeSummary } from '@/components/dashboard/IncomeSummary';
import { ReferralWidget } from '@/components/dashboard/ReferralWidget';
import { contracts } from '@/config/contracts';
import { MockUSDTABI } from '@/config/abis/MockUSDT';
import { useToast } from '@/components/ui';
import { useEffect } from 'react';
import Link from 'next/link';

export default function DashboardPage() {
  const { isConnected } = useAccount();
  const { toast } = useToast();

  const { writeContract: mintUsdt, data: mintHash, isPending: mintPending } = useWriteContract();

  const { isSuccess: mintSuccess, isError: mintError } = useWaitForTransactionReceipt({
    hash: mintHash,
  });

  useEffect(() => {
    if (mintSuccess) {
      toast({ type: 'success', title: 'Successfully minted 10,000 USDT!' });
    }
    if (mintError) {
      toast({ type: 'error', title: 'Failed to mint USDT' });
    }
  }, [mintSuccess, mintError, toast]);

  const handleMintUsdt = () => {
    mintUsdt({
      address: contracts.usdt,
      abi: MockUSDTABI,
      functionName: 'faucet',
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
            onClick={handleMintUsdt}
            disabled={mintPending}
          >
            {mintPending ? 'Minting...' : 'Mint 10K USDT'}
          </Button>
          <Link href="/cms">
            <Button variant="primary" size="sm">
              Buy CMS
            </Button>
          </Link>
        </div>
      </div>

      <ReferralWidget />
      <PortfolioOverview />
      <ActiveStakesTable />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IncomeSummary />
      </div>
    </div>
  );
}
