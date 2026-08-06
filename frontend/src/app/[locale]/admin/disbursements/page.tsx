'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';

interface Disbursement {
  id: number;
  target_wallet: string;
  amount: string;
  note: string | null;
  admin_username: string;
  created_at: string;
}

interface DisbursementTotal {
  direct: string;
  rollup: string;
  total: string;
  directDisbursed?: string;
  rollupFromDownline?: string;
  grandTotal?: string;
}

export default function DisbursementsPage() {
  const { apiFetch } = useAdminAuth();

  // Form state
  const [targetWallet, setTargetWallet] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  // Confirmation modal
  const [showConfirm, setShowConfirm] = useState(false);

  // History state
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Wallet total lookup
  const [lookupWallet, setLookupWallet] = useState('');
  const [walletTotal, setWalletTotal] = useState<DisbursementTotal | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, [page]);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await apiFetch(`/api/v1/admin/disbursements?page=${page}&limit=20`);
      const json = await res.json();
      if (res.ok) {
        const items = json.data?.disbursements || json.data || [];
        setDisbursements(Array.isArray(items) ? items : []);
        setHasMore((Array.isArray(items) ? items : []).length === 20);
      }
    } catch {
      // silent
    }
    setHistoryLoading(false);
  };

  const handleDisburse = async () => {
    setSubmitting(true);
    setSubmitError('');
    setSubmitSuccess('');
    setShowConfirm(false);

    try {
      const res = await apiFetch('/api/v1/admin/disburse', {
        method: 'POST',
        body: JSON.stringify({
          wallet: targetWallet.trim(),
          amount: parseFloat(amount),
          note: note.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        const rollupCount = json.data?.uplineRollups?.length || 0;
        const disbId = json.data?.disbursementId || json.data?.disbursement?.id || '?';
        setSubmitSuccess(`Disbursement #${disbId} created successfully with ${rollupCount} upline rollups`);
        setTargetWallet('');
        setAmount('');
        setNote('');
        fetchHistory();
      } else {
        setSubmitError(json.error || 'Failed to create disbursement');
      }
    } catch {
      setSubmitError('Network error');
    }
    setSubmitting(false);
  };

  const handleLookup = async () => {
    if (!lookupWallet.trim()) return;
    setLookupLoading(true);
    setWalletTotal(null);
    try {
      const res = await apiFetch(`/api/v1/admin/disbursement-total/${lookupWallet.trim()}`);
      const json = await res.json();
      if (res.ok) {
        const d = json.data;
        setWalletTotal({
          direct: d?.directDisbursed || d?.direct || '0',
          rollup: d?.rollupFromDownline || d?.rollup || '0',
          total: d?.grandTotal || d?.total || '0',
        });
      }
    } catch {
      // silent
    }
    setLookupLoading(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-surface-900">Volume Disbursements</h1>
        <p className="text-sm text-surface-400 mt-1">Mark volumes as disbursed and sync to upline MLM tree</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Disbursement Form */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-surface-800 mb-4">New Disbursement</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-2">Target Wallet</label>
              <input
                type="text"
                value={targetWallet}
                onChange={(e) => setTargetWallet(e.target.value)}
                className="input-field w-full text-sm"
                placeholder="0x..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-surface-500 mb-2">Amount (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-field w-full text-sm"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-surface-500 mb-2">Note (optional)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="input-field w-full text-sm"
                placeholder="Reason for disbursement"
              />
            </div>

            {submitError && (
              <div className="bg-danger-50 border border-danger-200 text-danger-600 text-sm px-4 py-3 rounded-xl">
                {submitError}
              </div>
            )}

            {submitSuccess && (
              <div className="bg-success-50 border border-success-200 text-success-700 text-sm px-4 py-3 rounded-xl">
                {submitSuccess}
              </div>
            )}

            <button
              onClick={() => setShowConfirm(true)}
              disabled={!targetWallet.trim() || !amount || parseFloat(amount) <= 0 || submitting}
              className="btn-primary w-full"
            >
              Submit Disbursement
            </button>
          </div>
        </div>

        {/* Wallet Total Lookup */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-surface-800 mb-4">Wallet Total Lookup</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-2">Wallet Address</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={lookupWallet}
                  onChange={(e) => setLookupWallet(e.target.value)}
                  className="input-field flex-1 text-sm"
                  placeholder="0x..."
                />
                <button
                  onClick={handleLookup}
                  disabled={lookupLoading || !lookupWallet.trim()}
                  className="btn-secondary"
                >
                  {lookupLoading ? '...' : 'Lookup'}
                </button>
              </div>
            </div>

            {walletTotal && (
              <div className="space-y-3 mt-4">
                <div className="flex justify-between items-center p-3 bg-surface-50 rounded-xl">
                  <span className="text-sm text-surface-500">Direct Disbursements</span>
                  <span className="text-sm font-semibold text-surface-800">
                    ${parseFloat(walletTotal.direct).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-surface-50 rounded-xl">
                  <span className="text-sm text-surface-500">Rollup from Downline</span>
                  <span className="text-sm font-semibold text-surface-800">
                    ${parseFloat(walletTotal.rollup).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-primary-50 rounded-xl border border-primary-200">
                  <span className="text-sm font-medium text-primary-700">Total</span>
                  <span className="text-lg font-bold gradient-text">
                    ${parseFloat(walletTotal.total).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-surface-900 mb-4">Confirm Disbursement</h3>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-sm text-surface-500">Wallet</span>
                <span className="text-sm font-mono text-surface-700">
                  {targetWallet.slice(0, 6)}...{targetWallet.slice(-4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-surface-500">Amount</span>
                <span className="text-sm font-semibold text-primary-600">${parseFloat(amount).toFixed(2)}</span>
              </div>
              {note && (
                <div className="flex justify-between">
                  <span className="text-sm text-surface-500">Note</span>
                  <span className="text-sm text-surface-700">{note}</span>
                </div>
              )}
              <p className="text-xs text-surface-400 mt-2">
                This will create a disbursement record and propagate rollups to the upline tree.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleDisburse}
                disabled={submitting}
                className="btn-primary flex-1"
              >
                {submitting ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disbursement History */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-surface-800">Disbursement History</h2>
          {historyLoading && (
            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {disbursements.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-50 border-b border-surface-100">
                  <tr>
                    <th className="text-left text-xs font-medium text-surface-500 uppercase px-6 py-3">ID</th>
                    <th className="text-left text-xs font-medium text-surface-500 uppercase px-6 py-3">Wallet</th>
                    <th className="text-right text-xs font-medium text-surface-500 uppercase px-6 py-3">Amount</th>
                    <th className="text-left text-xs font-medium text-surface-500 uppercase px-6 py-3">Note</th>
                    <th className="text-left text-xs font-medium text-surface-500 uppercase px-6 py-3">Admin</th>
                    <th className="text-right text-xs font-medium text-surface-500 uppercase px-6 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {disbursements.map((d) => (
                    <tr key={d.id} className="hover:bg-primary-50/30 transition-colors">
                      <td className="px-6 py-3 text-sm text-surface-500">#{d.id}</td>
                      <td className="px-6 py-3">
                        <span className="font-mono text-sm text-surface-700">
                          {d.target_wallet.slice(0, 6)}...{d.target_wallet.slice(-4)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-semibold text-primary-600">
                        ${parseFloat(d.amount).toFixed(2)}
                      </td>
                      <td className="px-6 py-3 text-sm text-surface-500 max-w-[150px] truncate">
                        {d.note || '-'}
                      </td>
                      <td className="px-6 py-3 text-sm text-surface-600">{d.admin_username}</td>
                      <td className="px-6 py-3 text-right text-sm text-surface-500">
                        {new Date(d.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-surface-100 flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-sm"
              >
                Previous
              </button>
              <span className="text-sm text-surface-500">Page {page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasMore}
                className="btn-secondary text-sm"
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <div className="p-12 text-center">
            <p className="text-surface-400 text-sm">No disbursements recorded yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
