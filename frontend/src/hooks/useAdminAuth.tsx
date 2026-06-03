'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

interface AdminAuthState {
  isAuthenticated: boolean;
  username: string | null;
  isLoading: boolean;
}

interface AdminAuthContextType extends AdminAuthState {
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>;
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AdminAuthState>({
    isAuthenticated: false,
    username: null,
    isLoading: true,
  });

  // Check session on mount
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/admin/me`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        setState({ isAuthenticated: true, username: json.data.username, isLoading: false });
      } else {
        setState({ isAuthenticated: false, username: null, isLoading: false });
      }
    } catch {
      setState({ isAuthenticated: false, username: null, isLoading: false });
    }
  };

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const json = await res.json();
        setState({ isAuthenticated: true, username: json.data.username, isLoading: false });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${BACKEND_URL}/api/v1/admin/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    setState({ isAuthenticated: false, username: null, isLoading: false });
  }, []);

  const apiFetch = useCallback(async (path: string, options?: RequestInit): Promise<Response> => {
    return fetch(`${BACKEND_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  }, []);

  return (
    <AdminAuthContext.Provider value={{ ...state, login, logout, apiFetch }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
