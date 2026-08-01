"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  fetchAdminBoot,
  GAS_AUTH_TOKEN_KEY,
  signInWithPassword,
} from "@/lib/gas-api";
import { setAdminBootHandoff } from "@/lib/admin/adminBootHandoff";
import { prefetchAdminInitData } from "@/lib/admin/adminInitPrefetch";
import { setLastAdminTenantId } from "@/lib/admin/adminPreloaderLogo";
import { setAdminTenantId } from "@/components/admin/desktop/adminApi";
import { isMobileUserAgent } from "@/lib/isMobileUserAgent";
import styles from "./login.module.css";

function setAuthCookie(token: string) {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${GAS_AUTH_TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`;
}

function defaultAdminPath() {
  if (
    typeof window !== "undefined" &&
    window.location.hostname === "admin.azhunebi.com"
  ) {
    return "/";
  }
  if (typeof navigator !== "undefined" && isMobileUserAgent(navigator.userAgent)) {
    return "/admin/mobile";
  }
  return "/admin";
}

export default function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const next =
    nextParam === "/" || (nextParam && nextParam.startsWith("/admin"))
      ? nextParam
      : defaultAdminPath();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const { session, error: signInError } = await signInWithPassword(
        email.trim(),
        password
      );

      if (signInError || !session) {
        setError(signInError || "Невірний логін або пароль");
        return;
      }

      setAuthCookie(session.accessToken);

      // Warm admin path before navigate: one adminBoot + start adminInitData in parallel.
      // Handoff avoids a second adminBoot in AuthProvider; SPA nav keeps the prefetch alive.
      const boot = await fetchAdminBoot(session.accessToken);
      if (boot.session && boot.membership?.tenantId) {
        setAdminTenantId(boot.membership.tenantId);
        setLastAdminTenantId(boot.membership.tenantId);
        setAdminBootHandoff({
          token: session.accessToken,
          session: boot.session,
          membership: boot.membership,
          error: boot.error,
        });
        void prefetchAdminInitData(boot.membership.tenantId, session.accessToken);
      } else if (boot.error) {
        setError(boot.error);
        return;
      }

      const target = next.startsWith("/admin") || next === "/" ? next : defaultAdminPath();
      // Always SPA navigate so in-memory boot handoff + init prefetch survive.
      router.replace(target);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>АЖ У НЕБІ</div>
        <p className={styles.subtitle}>Панель управління комплексом</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label}>
            Логін
            <input
              type="text"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Логін"
              autoComplete="username"
              required
            />
          </label>

          <label className={styles.label}>
            Пароль
            <input
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </label>

          {error ? <p className={styles.error}>{error}</p> : null}

          <button type="submit" className={styles.submit} disabled={submitting}>
            {submitting ? "Вхід…" : "Увійти"}
          </button>
        </form>
      </div>
    </div>
  );
}
