import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getAuthMe, loginWithGoogle, logoutAuth } from './api';

interface AuthUser {
  email: string;
  sub?: string;
}

interface AuthContextValue {
  authenticated: boolean;
  loading: boolean;
  user: AuthUser | null;
  loginWithGoogleCredential: (credential: string, next?: string) => Promise<string>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await getAuthMe();
      setAuthenticated(result.authenticated);
      setUser(result.authenticated ? (result.user ?? null) : null);
    } catch {
      setAuthenticated(false);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const result = await getAuthMe();
        if (cancelled) return;
        setAuthenticated(result.authenticated);
        setUser(result.authenticated ? (result.user ?? null) : null);
      } catch {
        if (cancelled) return;
        setAuthenticated(false);
        setUser(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const loginWithGoogleCredential = useCallback(async (credential: string, next?: string) => {
    const result = await loginWithGoogle(credential, next);
    const me = await getAuthMe();
    if (!me.authenticated) {
      setAuthenticated(false);
      setUser(null);
      throw new Error('Session cookie was not established');
    }
    setAuthenticated(true);
    setUser(me.user ?? result.user);
    return result.next;
  }, []);

  const logout = useCallback(async () => {
    await logoutAuth();
    setAuthenticated(false);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    authenticated,
    loading,
    user,
    loginWithGoogleCredential,
    logout,
    refresh,
  }), [authenticated, loading, user, loginWithGoogleCredential, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
