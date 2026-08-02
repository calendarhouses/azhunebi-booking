"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GAS_AUTH_TOKEN_KEY,
  signInWithPassword,
} from "@/lib/gas-api";
import { resolveAdminBoot } from "@/lib/admin/adminBootHandoff";
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

/** Warm admin boot/init without blocking or failing the login form. */
function warmAdminAfterLogin(accessToken: string): void {
  void (async () => {
    try {
      // Shares one GAS adminBoot with AuthProvider via resolveAdminBoot.
      const boot = await resolveAdminBoot(accessToken);
      if (!boot.session || !boot.membership?.tenantId) return;
      setAdminTenantId(boot.membership.tenantId);
      setLastAdminTenantId(boot.membership.tenantId);
      void prefetchAdminInitData(boot.membership.tenantId, accessToken);
    } catch (err) {
      console.warn("[login] warm admin failed:", err);
    }
  })();
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
      // Do not await boot here — boot failures were surfacing as "bad password".
      warmAdminAfterLogin(session.accessToken);

      const target = next.startsWith("/admin") || next === "/" ? next : defaultAdminPath();
      // admin.azhunebi.com uses "/" for both login and admin (middleware rewrite).
      // Soft router.replace("/") is a no-op and can leave the user stuck on login.
      if (target === "/") {
        window.location.replace("/");
        return;
      }
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
