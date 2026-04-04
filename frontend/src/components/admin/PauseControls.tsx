'use client';

import { useState } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { type Address } from 'viem';
import { PausableABI } from '@/lib/contracts';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

interface ContractPauseCardProps {
  name: string;
  address: Address;
}

const CONTRACTS_LIST: ContractPauseCardProps[] = [];

export function PauseControlItem({ name, address: addr }: ContractPauseCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [action, setAction] = useState<'pause' | 'unpause'>('pause');

  const { data: isPaused, refetch } = useReadContract({
    address: addr,
    abi: PausableABI,
    functionName: 'paused',
    query: { enabled: !!addr, refetchInterval: 10_000 },
  });

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
    query: {
      enabled: !!txHash,
    },
  });

  const handleAction = (act: 'pause' | 'unpause') => {
    setAction(act);
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    writeContract(
      {
        address: addr,
        abi: PausableABI,
        functionName: action,
      },
      {
        onSuccess: () => {
          setConfirmOpen(false);
          setTimeout(() => refetch(), 2000);
        },
      },
    );
  };

  const paused = isPaused === true;
  const loading = isPending || isConfirming;

  return (
    <>
      <div className="flex items-center justify-between py-3 border-b border-dark-700/30 last:border-0">
        <div className="flex items-center gap-3">
          <div className={cn('w-2.5 h-2.5 rounded-full', paused ? 'bg-red-500' : 'bg-emerald-500')} />
          <div>
            <p className="text-sm font-medium text-dark-100">{name}</p>
            <p className="text-[10px] text-dark-500 font-mono">{addr.slice(0, 10)}...{addr.slice(-6)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', paused ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400')}>
            {paused ? 'Paused' : 'Active'}
          </span>
          {paused ? (
            <Button size="sm" variant="primary" onClick={() => handleAction('unpause')} loading={loading} disabled={loading}>
              Unpause
            </Button>
          ) : (
            <Button size="sm" variant="danger" onClick={() => handleAction('pause')} loading={loading} disabled={loading}>
              Pause
            </Button>
          )}
        </div>
      </div>

      <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} title={`Confirm ${action === 'pause' ? 'Pause' : 'Unpause'}`}>
        <div className="space-y-4">
          {action === 'pause' ? (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400 font-medium">This will halt all operations on {name}</p>
              <p className="text-xs text-dark-400 mt-1">Users will not be able to interact with this contract until unpaused.</p>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-sm text-emerald-400 font-medium">Resume operations on {name}</p>
              <p className="text-xs text-dark-400 mt-1">All contract functions will become available again.</p>
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="secondary" size="md" className="flex-1" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant={action === 'pause' ? 'danger' : 'primary'} size="md" className="flex-1" loading={loading} onClick={handleConfirm}>
              {action === 'pause' ? 'Pause Contract' : 'Unpause Contract'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export { CONTRACTS_LIST };
