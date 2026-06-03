'use client';

import { useState } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';

interface Promotion {
  wallet_address: string;
  previous_rank: number;
  new_rank: number;
  team_volume: string;
  direct_count: number;
  changed_at: string;
}

const RANK_NAMES: Record<number, string> = {
  0: 'Unranked',
  1: 'Bronze',
  2: 'Silver',
  3: 'Gold',
  4: 'Platinum',
  5: 'Diamond',
  6: 'Crown',
  7: 'Royal',
  8: 'Imperial',
};

function getRankName(rank: number) {
  return RANK_NAMES[rank] || `Rank ${rank}`;
}

function getRankColor(rank: number) {
  const colors: Record<number, string> = {
    0: 'text-surface-400',
    1: 'text-amber-700',
    2: 'text-surface-500',
    3: 'text-amber-500',
    4: 'text-primary-600',
    5: 'text-secondary-600',
    6: 'text-accent-600',
    7: 'text-danger-500',
    8: 'text-primary-900',
  };
  return colors[rank] || 'text-surface-700';
}

export default function RankPromotionsPage() {
  const { apiFetch } = useAdminAuth();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [results, setResults] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const res = await apiFetch(`/api/v1/admin/rank-promotions?${params.toString()}`);
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

  const copyToClipboard = () => {
    const text = results
      .map(
        (r) =>
          `${r.wallet_address}\t${getRankName(r.previous_rank)}\t${getRankName(r.new_rank)}\t${r.team_volume}\t${r.direct_count}\t${new Date(r.changed_at).toLocaleString()}`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Rank Promotion Tracker</h1>
        <p className="text-sm text-surface-400 mt-1">Track users who advanced ranks within date ranges</p>
      </div>

      {/* Filters */}
      <div className="card p-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-2">From Date</label>
            <input
              type="datetime-local"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="input-field text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-2">To Date</label>
            <input
              type="datetime-local"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="input-field text-sm"
            />
          </div>

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

          {results.length > 0 && (
            <button
              onClick={copyToClipboard}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-danger-50 border border-danger-200 text-danger-600 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Summary */}
      {results.length > 0 && (
        <div className="card p-4">
          <p className="text-sm text-surface-500">
            <span className="font-semibold text-surface-900">{results.length}</span> promotion{results.length !== 1 ? 's' : ''} found in the selected range
          </p>
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-50 border-b border-surface-100">
                <tr>
                  <th className="text-left text-xs font-medium text-surface-500 uppercase px-6 py-3">Wallet</th>
                  <th className="text-center text-xs font-medium text-surface-500 uppercase px-6 py-3">Previous Rank</th>
                  <th className="text-center text-xs font-medium text-surface-500 uppercase px-6 py-3">New Rank</th>
                  <th className="text-right text-xs font-medium text-surface-500 uppercase px-6 py-3">Team Volume</th>
                  <th className="text-right text-xs font-medium text-surface-500 uppercase px-6 py-3">Directs</th>
                  <th className="text-right text-xs font-medium text-surface-500 uppercase px-6 py-3">Promoted At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {results.map((row, idx) => (
                  <tr key={idx} className="hover:bg-primary-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm text-surface-700">
                        {row.wallet_address.slice(0, 6)}...{row.wallet_address.slice(-4)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-sm font-medium ${getRankColor(row.previous_rank)}`}>
                        {getRankName(row.previous_rank)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-sm font-semibold ${getRankColor(row.new_rank)}`}>
                        {getRankName(row.new_rank)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-surface-600">
                      {parseFloat(row.team_volume).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-surface-600">
                      {row.direct_count}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-surface-500">
                      {new Date(row.changed_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && results.length === 0 && (
        <div className="card p-12 text-center">
          <svg className="w-12 h-12 text-surface-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <p className="text-surface-400 text-sm">Select a date range and click Search to view rank promotions</p>
        </div>
      )}
    </div>
  );
}
