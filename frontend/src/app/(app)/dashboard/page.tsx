'use client';

import { useAccount } from 'wagmi';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { GlassCard, StatCard, Button } from '@/components/ui';
import { useTokenBalances } from '@/hooks/useTokenBalances';
import { useUserStakes } from '@/hooks/useUserStakes';
import { useKairoPrice } from '@/hooks/useKairoPrice';
import { useAffiliate } from '@/hooks/useAffiliate';
import { formatUsdt, formatKairo, shortenAddress } from '@/lib/utils';
import { PortfolioOverview } from '@/components/dashboard/PortfolioOverview';
import { ActiveStakesTable } from '@/components/dashboard/ActiveStakesTable';
import { IncomeSummary } from '@/components/dashboard/IncomeSummary';
import { ReferralWidget } from '@/components/dashboard/ReferralWidget';
import { contracts, USDT_DECIMALS } from '@/config/contracts';
import { MockUSDTABI } from '@/config/abis/MockUSDT';
import { parseUnits } from 'viem';
import { useToast } from '@/components/ui/Toast';
import Link from 'next/link';

export default function DashboardPage() {
  const { isConnected, address } = useAccount();
  const { writeContract: writeMint, isPending: mintPending, data: mintHash } = useWriteContract();
  const { isSuccess: mintSuccess } = useWaitForTransactionReceipt({ hash: mintHash });
  const { toast } = useToast();

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

  const handleMintUsdt = () => {
    if (!address) return;
    writeMint({
      address: contracts.usdt,
      abi: MockUSDTABI,
      functionName: 'mint',
      args: [address, parseUnits('100000', USDT_DECIMALS)],
    });
    toast({ type: 'pending', title: 'Minting 100,000 Test USDT...' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-orbitron font-bold gradient-text">Dashboard</h1>
        <div className="flex items-center gap-3">
          <Link href="/cms">
            <Button variant="primary" size="sm">
              Buy CMS
            </Button>
          </Link>
          <Button
            onClick={handleMintUsdt}
            loading={mintPending}
            variant="secondary"
            size="sm"
          >
            Mint 100K Test USDT
          </Button>
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
