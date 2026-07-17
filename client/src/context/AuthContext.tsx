import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, getToken, setToken } from '../lib/api';
import type { BusinessType, Organization } from '../lib/types';

interface AuthContextValue {
  organization: Organization | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    businessType: BusinessType;
  }) => Promise<void>;
  logout: () => void;
  refreshOrganization: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;
    api<{ organization: Organization }>('/auth/me')
      .then((data) => setOrganization(data.organization))
      .catch(() => setOrganization(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ token: string; organization: Organization }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setToken(data.token);
    setOrganization(data.organization);
  }, []);

  const register = useCallback(
    async (input: { name: string; email: string; password: string; businessType: BusinessType }) => {
      const data = await api<{ token: string; organization: Organization }>('/auth/register', {
        method: 'POST',
        body: input,
      });
      setToken(data.token);
      setOrganization(data.organization);
    },
    [],
  );

  const logout = useCallback(() => {
    setToken(null);
    setOrganization(null);
    window.location.href = '/';
  }, []);

  const refreshOrganization = useCallback(async () => {
    const data = await api<{ organization: Organization }>('/auth/me');
    setOrganization(data.organization);
  }, []);

  const value = useMemo(
    () => ({ organization, loading, login, register, logout, refreshOrganization }),
    [organization, loading, login, register, logout, refreshOrganization],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
