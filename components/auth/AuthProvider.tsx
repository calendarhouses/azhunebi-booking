"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  fetchMembership,
  getSession,
  getStoredAuthToken,
  GAS_AUTH_TOKEN_KEY,
  signOut as gasSignOut,
  type GasUser,
} from "@/lib/gas-api";
import { clearAdminTenantId, setAdminTenantId } from "@/components/admin/desktop/adminApi";
import { getCachedTenantLogoUrl } from "@/lib/admin/brandingLogoCache";
import {
  ADMIN_PRELOADER_LOGO_SRC,
  getLastAdminTenantId,
  resolveAdminPreloaderLogoUrl,
  setLastAdminTenantId,
} from "@/lib/admin/adminPreloaderLogo";
import {
  clearAdminInitPrefetch,
  prefetchAdminInitData,
} from "@/lib/admin/adminInitPrefetch";

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
  preloaderLogoUrl: string;
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
  const [preloaderLogoUrl, setPreloaderLogoUrl] = useState<string>(() => {
    if (typeof window === "undefined") return ADMIN_PRELOADER_LOGO_SRC;
    const tenantId = getLastAdminTenantId();
    return resolveAdminPreloaderLogoUrl(
      tenantId ? getCachedTenantLogoUrl(tenantId) : null
    );
  });
  const syncPreloaderLogo = useCallback((tenantId: string | null | undefined) => {
    if (!tenantId) {
      setPreloaderLogoUrl(ADMIN_PRELOADER_LOGO_SRC);
      return;
    }
    setLastAdminTenantId(tenantId);
    setPreloaderLogoUrl(
      resolveAdminPreloaderLogoUrl(getCachedTenantLogoUrl(tenantId))
    );
  }, []);

  const applyMembership = useCallback((m: TenantMembership | null) => {
    setMembership(m);
    syncPreloaderLogo(m?.tenantId);
    if (m?.tenantId) {
      setAdminTenantId(m.tenantId);
    } else {
      clearAdminTenantId();
      clearAdminInitPrefetch();
    }
  }, [syncPreloaderLogo]);

  const refreshMembership = useCallback(async () => {
    const token = getStoredAuthToken();
    const [session, membershipResult] = await Promise.all([
      getSession(),
      token
        ? fetchMembership(token)
        : Promise.resolve({ membership: null as TenantMembership | null, error: null as string | null }),
    ]);
    setUser(session?.user ?? null);
    if (!session) {
      applyMembership(null);
      setError(null);
      return;
    }
    const { membership: m, error: err } =
      membershipResult.membership || membershipResult.error
        ? membershipResult
        : await fetchMembership(session.accessToken);
    applyMembership(m);
    setError(err);
    if (session?.accessToken && m?.tenantId) {
      void prefetchAdminInitData(m.tenantId, session.accessToken);
    }
  }, [applyMembership]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setLoading(true);

      const token = getStoredAuthToken();
      const lastTenantId = getLastAdminTenantId();
      if (token && lastTenantId) {
        setAdminTenantId(lastTenantId);
        void prefetchAdminInitData(lastTenantId, token);
      }

      // Session + membership in parallel when token exists (was sequential waterfall).
      const [session, membershipResult] = await Promise.all([
        getSession(),
        token
          ? fetchMembership(token)
          : Promise.resolve({ membership: null as TenantMembership | null, error: null as string | null }),
      ]);

      if (cancelled) return;

      setUser(session?.user ?? null);

      if (!session) {
        applyMembership(null);
        setError(null);
        setLoading(false);
        return;
      }

      const { membership: m, error: err } =
        membershipResult.membership || membershipResult.error
          ? membershipResult
          : await fetchMembership(session.accessToken);
      if (cancelled) return;
      applyMembership(m);
      setError(err);
      if (m?.tenantId) {
        void prefetchAdminInitData(m.tenantId, session.accessToken);
      }
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
    clearAdminInitPrefetch();
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
      preloaderLogoUrl,
      signOut,
      refreshMembership,
    }),
    [user, membership, loading, error, ready, preloaderLogoUrl, signOut, refreshMembership]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
