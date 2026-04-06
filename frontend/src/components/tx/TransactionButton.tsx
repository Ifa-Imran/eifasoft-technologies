'use client';

import { Button } from '@/components/ui';
import { useApproval } from '@/hooks/useApproval';
import { Address } from 'viem';
import { MouseEventHandler } from 'react';

interface TransactionButtonProps {
  tokenAddress: Address;
  spenderAddress: Address;
  amount: bigint;
  onExecute: () => void;
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  approveLabel?: string;
  className?: string;
}

export function TransactionButton({
  tokenAddress,
  spenderAddress,
  amount,
  onExecute,
  loading,
  disabled,
  children,
  approveLabel = 'Approve',
  className,
}: TransactionButtonProps) {
  const { hasAllowance, approve, isPending: approving } = useApproval(tokenAddress, spenderAddress);
  const needsApproval = amount > BigInt(0) && !hasAllowance(amount);

  const handleClick: MouseEventHandler<HTMLButtonElement> = () => {
    if (needsApproval) {
      approve(amount);
    } else {
      onExecute();
    }
  };

  return (
    <Button
      onClick={handleClick}
      loading={loading || approving}
      disabled={disabled}
      className={className}
    >
      {needsApproval ? approveLabel : children}
    </Button>
  );
}
