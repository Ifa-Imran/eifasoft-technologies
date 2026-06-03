'use client';

import { useState } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';

interface StakeEntry {
  id: number;
  amount: string;
  created_at: string;
}

interface VolumeResult {
  wallet: string;
  newVolume: string;
  stakeCount: number;
  stakes: StakeEntry[];
}

type Preset = '24h' | '48h' | '7d' | 'custom';

export default function StakingVolumePage() {
  const { apiFetch } = useAdminAuth();
  const [preset, setPreset] = useState<Preset>('24h');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [wallet, setWallet] = useState('');
  const [results, setResults] = useState<VolumeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (preset !== 'custom') {
        params.set('preset', preset);
      } else {
        if (fromDate) params.set('from', fromDate);
        if (toDate) params.set('to', toDate);
      }
      if (wallet.trim()) params.set('wallet', wallet.trim());

      const res = await apiFetch(`/api/v1/admin/staking-volume?${params.toString()}`);
      const json = await res.json();
      if (res.ok) {
        setResults(json.data || []);
      } else {
        setError(json.error || 'Failed to fetch data');
      }
    } catch {
      setError('Network error');
    }
    setLoading(false);
  };

  const totalVolume = results.reduce((sum, r) => sum + parseFloat(r.newVolume || '0'), 0);
  const totalStakes = results.reduce((sum, r) => sum + r.stakeCount, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-surface-900">Staking Volume Tracker</h1>
        <p className="text-sm text-surface-400 mt-1">Monitor new staking activity by wallet within timeframes</p>
      </div>

      {/* Filters */}
      <div className="card p-6">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Preset Buttons */}
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-2">Time Range</label>
            <div className="flex gap-2">
              {(['24h', '48h', '7d'] as Preset[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPreset(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    preset === p
                      ? 'gradient-primary text-white shadow-md'
                      : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPreset('custom')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  preset === 'custom'
                    ? 'gradient-primary text-white shadow-md'
                    : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                }`}
              >
                Custom
              </button>
            </div>
          </div>

          {/* Custom Date Range */}
          {preset === 'custom' && (
            <>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-2">From</label>
                <input
                  type="datetime-local"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-2">To</label>
                <input
                  type="datetime-local"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="input-field text-sm"
                />
              </div>
            </>
          )}

          {/* Wallet Filter */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-surface-500 mb-2">Wallet Address</label>
            <input
              type="text"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              className="input-field w-full text-sm"
              placeholder="0x... (optional)"
            />
          </div>

          {/* Search Button */}
          <button
            onClick={handleSearch}
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Search
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-danger-50 border border-danger-200 text-danger-600 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-4">
            <p className="text-xs text-surface-400 uppercase tracking-wide">Total Wallets</p>
            <p className="text-2xl font-bold text-surface-900 mt-1">{results.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-surface-400 uppercase tracking-wide">Total Stakes</p>
            <p className="text-2xl font-bold text-surface-900 mt-1">{totalStakes}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-surface-400 uppercase tracking-wide">Total Volume</p>
            <p className="text-2xl font-bold gradient-text mt-1">{totalVolume.toFixed(4)}</p>
          </div>
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-surface-50 border-b border-surface-100">
              <tr>
                <th className="text-left text-xs font-medium text-surface-500 uppercase px-6 py-3">Wallet Address</th>
                <th className="text-right text-xs font-medium text-surface-500 uppercase px-6 py-3">Stakes</th>
                <th className="text-right text-xs font-medium text-surface-500 uppercase px-6 py-3">New Volume</th>
                <th className="text-center text-xs font-medium text-surface-500 uppercase px-6 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {results.map((row) => (
                <tr key={row.wallet} className="hover:bg-primary-50/30 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-surface-700">
                      {row.wallet.slice(0, 6)}...{row.wallet.slice(-4)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-surface-700">
                    {row.stakeCount}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-primary-600">
                    {parseFloat(row.newVolume).toFixed(4)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => setExpandedRow(expandedRow === row.wallet ? null : row.wallet)}
                      className="text-primary-500 hover:text-primary-700 text-sm font-medium"
                    >
                      {expandedRow === row.wallet ? 'Hide' : 'View'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          </div>
          {/* Expanded Stake Details */}
          {expandedRow && (
            <div className="border-t border-surface-100 bg-surface-50 p-4 sm:p-6">
              <h4 className="text-sm font-semibold text-surface-700 mb-3">
                Stakes for {expandedRow.slice(0, 6)}...{expandedRow.slice(-4)}
              </h4>
              <div className="space-y-2">
                {results
                  .find((r) => r.wallet === expandedRow)
                  ?.stakes.map((s) => (
                    <div
                      key={s.id}
                      className="flex justify-between items-center bg-white rounded-lg px-4 py-2 border border-surface-100"
                    >
                      <span className="text-sm text-surface-600">
                        {new Date(s.created_at).toLocaleString()}
                      </span>
                      <span className="text-sm font-medium text-primary-600">
                        {parseFloat(s.amount).toFixed(4)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!loading && results.length === 0 && (
        <div className="card p-12 text-center">
          <svg className="w-12 h-12 text-surface-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-surface-400 text-sm">Select a time range and click Search to view staking volume</p>
        </div>
      )}
    </div>
  );
}
