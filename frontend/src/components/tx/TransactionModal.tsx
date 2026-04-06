'use client';

import { Modal } from '@/components/ui';
import { motion } from 'framer-motion';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { getExplorerTxUrl } from '@/config/contracts';

type TxState = 'pending' | 'confirming' | 'success' | 'error';

interface TransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: TxState;
  title?: string;
  txHash?: string;
  error?: string;
}

export function TransactionModal({ open, onOpenChange, state, title, txHash, error }: TransactionModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} size="sm">
      <div className="text-center py-6">
        {(state === 'pending' || state === 'confirming') && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-neon-purple/30 border-t-neon-purple"
          />
        )}

        {state === 'success' && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-16 h-16 mx-auto mb-4"
          >
            <CheckCircleIcon className="w-16 h-16 text-matrix-green" />
          </motion.div>
        )}

        {state === 'error' && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-16 h-16 mx-auto mb-4"
          >
            <XCircleIcon className="w-16 h-16 text-neon-coral" />
          </motion.div>
        )}

        <h3 className="text-lg font-space-grotesk font-bold text-white mb-2">
          {title || (state === 'pending' ? 'Confirm in Wallet' : state === 'confirming' ? 'Processing...' : state === 'success' ? 'Transaction Successful' : 'Transaction Failed')}
        </h3>

        {state === 'pending' && (
          <p className="text-sm text-dark-400">Please confirm the transaction in your wallet</p>
        )}

        {state === 'confirming' && (
          <p className="text-sm text-dark-400">Waiting for blockchain confirmation...</p>
        )}

        {state === 'error' && error && (
          <p className="text-sm text-neon-coral mt-2">{error}</p>
        )}

        {txHash && (
          <a
            href={getExplorerTxUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-4 text-sm text-neon-cyan hover:underline"
          >
            View on Explorer →
          </a>
        )}
      </div>
    </Modal>
  );
}
