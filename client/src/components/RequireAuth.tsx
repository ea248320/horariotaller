import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getToken } from '../lib/api';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { organization, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Cargando…
      </div>
    );
  }
  if (!getToken() || !organization) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
