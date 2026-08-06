'use client';

import { useState } from 'react';
import { parseUnits } from 'viem';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useTokenBalances } from '@/hooks/useTokenBalances';
import { contracts, IS_TESTNET, USDT_DECIMALS, getExplorerAddressUrl } from '@/config/contracts';
import { MockUSDTABI } from '@/config/abis/MockUSDT';
import { BeakerIcon } from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';

/**
 * Testnet-only widget that lets the connected wallet mint test USDT.
 * Calls MockUSDT.faucet() (mints 10,000 USDT to msg.sender) or
 * MockUSDT.mint(to, amount) for a custom amount.
 * Renders nothing on mainnet.
 */
export function MockUsdtFaucet() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { toast } = useToast();
  const { usdtFormatted } = useTokenBalances();
  const [pending, setPending] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const t = useTranslations('faucet');

  // Hide entirely on mainnet
  if (!IS_TESTNET) return null;
  if (!isConnected || !address) return null;
  if (!contracts.usdt || contracts.usdt === '0x') return null;

  const usdtBalanceNum = Number(usdtFormatted || '0');

  const callFaucet = async () => {
    if (!publicClient) return;
    try {
      setPending(true);
      toast({ type: 'pending', title: t('mintingPending'), description: t('mintingDesc', { amount: '10,000' }) });
      const hash = await writeContractAsync({
        address: contracts.usdt,
        abi: MockUSDTABI,
        functionName: 'faucet',
        args: [],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      toast({ type: 'success', title: t('mintedSuccess', { amount: '10,000' }), txHash: hash });
    } catch (err: any) {
      toast({ type: 'error', title: t('mintFailed'), description: err?.shortMessage || err?.message?.slice(0, 120) });
    } finally {
      setPending(false);
    }
  };

  const callMintCustom = async () => {
    if (!publicClient || !address) return;
    const trimmed = customAmount.trim();
    if (!trimmed) return;
    let amountWei: bigint;
    try {
      amountWei = parseUnits(trimmed, USDT_DECIMALS);
      if (amountWei <= 0n) throw new Error('Amount must be > 0');
    } catch (err: any) {
      toast({ type: 'error', title: t('invalidAmount'), description: err?.message?.slice(0, 120) });
      return;
    }
    try {
      setPending(true);
      toast({ type: 'pending', title: t('mintingPending'), description: t('mintingDesc', { amount: trimmed }) });
      const hash = await writeContractAsync({
        address: contracts.usdt,
        abi: MockUSDTABI,
        functionName: 'mint',
        args: [address, amountWei],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      toast({ type: 'success', title: t('mintedSuccess', { amount: trimmed }), txHash: hash });
      setCustomAmount('');
    } catch (err: any) {
      toast({ type: 'error', title: t('mintFailed'), description: err?.shortMessage || err?.message?.slice(0, 120) });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="card p-5 border-2 border-warn-300/60 bg-gradient-to-r from-warn-50/80 via-amber-50/40 to-yellow-50/40">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-warn-400 to-amber-500 flex items-center justify-center shadow-md shrink-0">
            <BeakerIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-warn-600">
              {t('testnetFaucet')}
            </p>
            <p className="text-sm text-surface-700 mt-0.5">
              {t('mintDesc')}{' '}
              <span className="font-mono font-semibold text-surface-900">
                {usdtBalanceNum.toLocaleString('en-US', { maximumFractionDigits: 2 })} USDT
              </span>
            </p>
            <a
              href={getExplorerAddressUrl(contracts.usdt)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-primary-600 hover:underline inline-block mt-0.5"
            >
              {contracts.usdt.slice(0, 10)}…{contracts.usdt.slice(-8)}
            </a>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            variant="primary"
            size="sm"
            loading={pending}
            disabled={pending}
            onClick={callFaucet}
          >
            {t('mint10000')}
          </Button>

          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              placeholder={t('customPlaceholder')}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="w-28 px-3 py-1.5 text-sm rounded-lg border border-surface-200 focus:outline-none focus:ring-2 focus:ring-warn-300 bg-white"
              disabled={pending}
            />
            <Button
              variant="secondary"
              size="sm"
              loading={pending}
              disabled={pending || !customAmount.trim()}
              onClick={callMintCustom}
            >
              {t('mint')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
