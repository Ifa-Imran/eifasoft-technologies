'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { erc20Abi, Address, maxUint256 } from 'viem';
import { useToast } from '@/components/ui/Toast';
import { useEffect } from 'react';

export function useApproval(tokenAddress: Address, spenderAddress: Address) {
  const { address } = useAccount();
  const { toast } = useToast();

  const { data: allowance, isLoading, refetch } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, spenderAddress] : undefined,
    query: {
      enabled: !!address && tokenAddress !== '0x' && spenderAddress !== '0x',
      refetchInterval: 10000,
    },
  });

  const { writeContract: writeApprove, isPending, data: approveHash } = useWriteContract();

  const { isSuccess: approveSuccess, isError: approveError } = useWaitForTransactionReceipt({ hash: approveHash });

  useEffect(() => { if (approveSuccess) { toast({ type: 'success', title: 'Approved!' }); refetch(); } }, [approveSuccess]);
  useEffect(() => { if (approveError) toast({ type: 'error', title: 'Approval failed' }); }, [approveError]);

  const approve = (amount?: bigint) => {
    writeApprove({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'approve',
      args: [spenderAddress, amount ?? maxUint256],
    });
    toast({ type: 'pending', title: 'Approving token...', description: 'Confirm in wallet' });
  };

  const hasAllowance = (amount: bigint) => {
    return (allowance as bigint) >= amount;
  };

  return {
    allowance: (allowance as bigint) ?? BigInt(0),
    hasAllowance,
    approve,
    isLoading,
    isPending,
    refetch,
  };
}
