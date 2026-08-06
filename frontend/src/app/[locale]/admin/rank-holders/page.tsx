'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';

interface RankHolder {
  wallet: string;
  rankLevel: number;
  rankName: string;
  teamVolume: string;
  personalVolume: string;
  directCount: number;
  joinedAt: string;
}

const RANK_COLORS: Record<number, string> = {
  1: 'bg-emerald-100 text-emerald-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-purple-100 text-purple-700',
  4: 'bg-amber-100 text-amber-700',
  5: 'bg-rose-100 text-rose-700',
  6: 'bg-indigo-100 text-indigo-700',
  7: 'bg-pink-100 text-pink-700',
  8: 'bg-cyan-100 text-cyan-700',
  9: 'bg-orange-100 text-orange-700',
  10: 'bg-yellow-100 text-yellow-800',
};

export default function RankHoldersPage() {
  const { apiFetch } = useAdminAuth();
  const [holders, setHolders] = useState<RankHolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterRank, setFilterRank] = useState<number | null>(null);

  const [diagnostics, setDiagnostics] = useState<any>(null);

  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    fetchRankHolders();
  }, []);

  const fetchRankHolders = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/v1/admin/rank-holders');
      const json = await res.json();
      if (res.ok) {
        setHolders(json.data?.holders || []);
        setDiagnostics(json.data?.diagnostics || null);
      } else {
        setError(json.error || 'Failed to fetch rank holders');
      }
    } catch {
      setError('Network error');
    }
    setLoading(false);
  };

  const recalculateRanks = async () => {
    setRecalculating(true);
    setError('');
    try {
      const res = await apiFetch('/api/v1/admin/calculate-rank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (res.ok) {
        await fetchRankHolders();
      } else {
        setError(json.error || 'Failed to recalculate ranks');
      }
    } catch {
      setError('Network error during recalculation');
    }
    setRecalculating(false);
  };

  const filteredHolders = filterRank
    ? holders.filter((h) => h.rankLevel === filterRank)
    : holders;

  // Group by rank for summary
  const rankSummary = holders.reduce<Record<string, number>>((acc, h) => {
    acc[h.rankName] = (acc[h.rankName] || 0) + 1;
    return acc;
  }, {});

  const formatVolume = (v: string) => {
    const num = parseFloat(v || '0');
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
    return `$${num.toFixed(2)}`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-surface-900">Rank Holders</h1>
          <p className="text-sm text-surface-400 mt-1">All current ranked members in the system</p>
        </div>
        <div className="flex gap-2 self-start">
          <button
            onClick={recalculateRanks}
            disabled={recalculating || loading}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition-all flex items-center gap-2"
          >
            {recalculating && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Recalculate
          </button>
          <button
            onClick={fetchRankHolders}
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-danger-50 border border-danger-200 text-danger-600 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Rank Summary Cards */}
      {!loading && holders.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterRank(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterRank === null
                ? 'gradient-primary text-white shadow-md'
                : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
            }`}
          >
            All ({holders.length})
          </button>
          {Object.entries(rankSummary).map(([name, count]) => {
            const level = holders.find((h) => h.rankName === name)?.rankLevel || 0;
            return (
              <button
                key={name}
                onClick={() => setFilterRank(filterRank === level ? null : level)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterRank === level
                    ? 'gradient-primary text-white shadow-md'
                    : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                }`}
              >
                {name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Results Table */}
      {!loading && filteredHolders.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-surface-50 border-b border-surface-100">
                <tr>
                  <th className="text-left text-xs font-medium text-surface-500 uppercase px-6 py-3">#</th>
                  <th className="text-left text-xs font-medium text-surface-500 uppercase px-6 py-3">Wallet</th>
                  <th className="text-left text-xs font-medium text-surface-500 uppercase px-6 py-3">Rank</th>
                  <th className="text-right text-xs font-medium text-surface-500 uppercase px-6 py-3">Team Volume</th>
                  <th className="text-right text-xs font-medium text-surface-500 uppercase px-6 py-3">Personal</th>
                  <th className="text-right text-xs font-medium text-surface-500 uppercase px-6 py-3">Directs</th>
                  <th className="text-right text-xs font-medium text-surface-500 uppercase px-6 py-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {filteredHolders.map((h, idx) => (
                  <tr key={h.wallet} className="hover:bg-primary-50/30 transition-colors">
                    <td className="px-6 py-3 text-sm text-surface-400">{idx + 1}</td>
                    <td className="px-6 py-3">
                      <span className="font-mono text-sm text-surface-700">
                        {h.wallet.slice(0, 6)}...{h.wallet.slice(-4)}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${RANK_COLORS[h.rankLevel] || 'bg-surface-100 text-surface-700'}`}>
                        {h.rankName}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-semibold text-primary-600">
                      {formatVolume(h.teamVolume)}
                    </td>
                    <td className="px-6 py-3 text-right text-sm text-surface-600">
                      {formatVolume(h.personalVolume)}
                    </td>
                    <td className="px-6 py-3 text-right text-sm text-surface-600">
                      {h.directCount}
                    </td>
                    <td className="px-6 py-3 text-right text-sm text-surface-400">
                      {new Date(h.joinedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="card p-12 text-center">
          <svg className="animate-spin h-8 w-8 text-primary-500 mx-auto mb-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-surface-400 text-sm">Loading rank holders...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && holders.length === 0 && !error && (
        <div className="card p-12 text-center">
          <svg className="w-12 h-12 text-surface-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <p className="text-surface-400 text-sm">No ranked members found</p>
          <p className="text-surface-300 text-xs mt-1">Minimum team volume: $10,000</p>
          {diagnostics && (
            <div className="mt-4 text-xs text-surface-400 space-y-1">
              <p>Total Users: {diagnostics.totalUsers} | Active Stakes: {diagnostics.activeStakes}</p>
              <p>Referral Tree Entries: {diagnostics.referralTreeEntries} | Users with Volume: {diagnostics.usersWithVolume}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
