import { create } from 'zustand';

export type TxStatus = 'pending' | 'confirming' | 'success' | 'error';

interface PendingTx {
  hash: string;
  description: string;
  status: TxStatus;
  timestamp: number;
}

interface TransactionState {
  transactions: PendingTx[];
  addTransaction: (tx: Omit<PendingTx, 'timestamp'>) => void;
  updateTransaction: (hash: string, status: TxStatus) => void;
  clearCompleted: () => void;
}

export const useTransactionStore = create<TransactionState>((set) => ({
  transactions: [],
  addTransaction: (tx) =>
    set((s) => ({
      transactions: [{ ...tx, timestamp: Date.now() }, ...s.transactions],
    })),
  updateTransaction: (hash, status) =>
    set((s) => ({
      transactions: s.transactions.map((t) =>
        t.hash === hash ? { ...t, status } : t
      ),
    })),
  clearCompleted: () =>
    set((s) => ({
      transactions: s.transactions.filter(
        (t) => t.status === 'pending' || t.status === 'confirming'
      ),
    })),
}));
