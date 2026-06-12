"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  fetchMembership,
  getSession,
  GAS_AUTH_TOKEN_KEY,
  signOut as gasSignOut,
  type GasUser,
} from "@/lib/gas-api";
import { clearAdminTenantId, setAdminTenantId } from "@/components/admin/desktop/adminApi";

export type TenantMembership = {
  tenantId: string;
  role: string;
  tenantName: string | null;
  plan: string | null;
};

type AuthContextValue = {
  user: GasUser | null;
  membership: TenantMembership | null;
  loading: boolean;
  error: string | null;
  ready: boolean;
  signOut: () => Promise<void>;
  refreshMembership: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

function clearAuthCookie() {
  document.cookie = `${GAS_AUTH_TOKEN_KEY}=; path=/; max-age=0; SameSite=Lax`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GasUser | null>(null);
  const [membership, setMembership] = useState<TenantMembership | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  const applyMembership = useCallback((m: TenantMembership | null) => {
    setMembership(m);
    if (m?.tenantId) {
      setAdminTenantId(m.tenantId);
    } else {
      clearAdminTenantId();
    }
  }, []);

  const refreshMembership = useCallback(async () => {
    const session = await getSession();
    setUser(session?.user ?? null);
    if (!session) {
      applyMembership(null);
      setError(null);
      return;
    }
    const { membership: m, error: err } = await fetchMembership(session.accessToken);
    applyMembership(m);
    setError(err);
  }, [applyMembership]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setLoading(true);
      const session = await getSession();

      if (cancelled) return;

      setUser(session?.user ?? null);
      userIdRef.current = session?.user?.id ?? null;

      if (!session) {
        applyMembership(null);
        setError(null);
        setLoading(false);
        return;
      }

      const { membership: m, error: err } = await fetchMembership(session.accessToken);
      if (cancelled) return;
      applyMembership(m);
      setError(err);
      setLoading(false);
    };

    void init();

    const onStorage = (event: StorageEvent) => {
      if (event.key === GAS_AUTH_TOKEN_KEY) {
        void refreshMembership();
      }
    };

    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
    };
  }, [applyMembership, refreshMembership]);

  const signOut = useCallback(async () => {
    clearAdminTenantId();
    clearAuthCookie();
    await gasSignOut();
    setUser(null);
    applyMembership(null);
    setError(null);
    window.location.replace("/login");
  }, [applyMembership]);

  const ready = !loading && !!user && !!membership?.tenantId && !error;

  const value = useMemo(
    () => ({
      user,
      membership,
      loading,
      error,
      ready,
      signOut,
      refreshMembership,
    }),
    [user, membership, loading, error, ready, signOut, refreshMembership]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
