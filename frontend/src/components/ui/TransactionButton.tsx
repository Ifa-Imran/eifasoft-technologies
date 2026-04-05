'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';

type TxState = 'idle' | 'approving' | 'confirming' | 'processing' | 'success' | 'error';

interface TransactionButtonProps {
  label: string;
  onClick: () => Promise<void>;
  variant?: 'primary' | 'secondary' | 'warning' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  requiresApproval?: boolean;
  approvalLabel?: string;
  className?: string;
}

const STATE_LABELS: Record<TxState, (props: TransactionButtonProps) => string> = {
  idle: (p) => p.label,
  approving: (p) => `${p.approvalLabel || 'Approving'}...`,
  confirming: () => 'Confirm in Wallet...',
  processing: () => 'Processing...',
  success: () => 'Confirmed \u2713',
  error: () => 'Failed \u2717',
};

const STATE_VARIANT: Record<TxState, 'primary' | 'secondary' | 'warning' | 'ghost' | 'danger'> = {
  idle: 'primary',
  approving: 'secondary',
  confirming: 'secondary',
  processing: 'secondary',
  success: 'primary',
  error: 'danger',
};

export function TransactionButton(props: TransactionButtonProps) {
  const { onClick, variant, size = 'md', disabled, className } = props;
  const [state, setState] = useState<TxState>('idle');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const handleClick = useCallback(async () => {
    if (state !== 'idle') return;
    try {
      setState(props.requiresApproval ? 'approving' : 'confirming');
      await onClick();
      if (mountedRef.current) {
        setState('success');
        setTimeout(() => { if (mountedRef.current) setState('idle'); }, 2000);
      }
    } catch {
      if (mountedRef.current) {
        setState('error');
        setTimeout(() => { if (mountedRef.current) setState('idle'); }, 3000);
      }
    }
  }, [state, onClick, props.requiresApproval]);

  const isProcessing = state !== 'idle' && state !== 'success' && state !== 'error';
  const buttonVariant = state === 'idle' ? (variant ?? 'primary') : STATE_VARIANT[state];
  const buttonLabel = STATE_LABELS[state](props);

  return (
    <Button
      variant={buttonVariant}
      size={size}
      className={className}
      disabled={disabled || state !== 'idle'}
      loading={isProcessing}
      onClick={handleClick}
    >
      {buttonLabel}
    </Button>
  );
}
