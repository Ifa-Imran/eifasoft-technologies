'use client';

import { useState } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useRouter } from '@/i18n/navigation';
import { LanguageSwitcher } from '@/components/ui';
import { useTranslations } from 'next-intl';

export default function AdminLoginPage() {
  const { login, isAuthenticated } = useAdminAuth();
  const router = useRouter();
  const tAdmin = useTranslations('admin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated
  if (isAuthenticated) {
    router.replace('/admin/staking-volume');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const success = await login(username, password);
    if (success) {
      router.replace('/admin/staking-volume');
    } else {
      setError(tAdmin('invalidCredentials'));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 px-4">
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md">
        <div className="card p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold gradient-text mb-2">{tAdmin('title')}</h1>
            <p className="text-sm text-surface-400">{tAdmin('signInPrompt')}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-surface-600 mb-1.5">
                {tAdmin('username')}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field w-full"
                placeholder={tAdmin('usernamePlaceholder')}
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-600 mb-1.5">
                {tAdmin('password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field w-full"
                placeholder={tAdmin('passwordPlaceholder')}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="bg-danger-50 border border-danger-200 text-danger-600 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {loading ? tAdmin('signingIn') : tAdmin('signIn')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
