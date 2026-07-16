"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GAS_AUTH_TOKEN_KEY, signInWithPassword } from "@/lib/gas-api";
import { isMobileUserAgent } from "@/lib/isMobileUserAgent";
import styles from "./login.module.css";

function setAuthCookie(token: string) {
  document.cookie = `${GAS_AUTH_TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
}

function defaultAdminPath() {
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
    nextParam && nextParam.startsWith("/admin")
      ? nextParam
      : defaultAdminPath();

  const [email, setEmail] = useState("test@gmail.com");
  const [password, setPassword] = useState("test");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { session, error: signInError } = await signInWithPassword(
      email.trim(),
      password
    );

    setSubmitting(false);

    if (signInError || !session) {
      setError(signInError || "Невірний email або пароль");
      return;
    }

    setAuthCookie(session.accessToken);
    const target = next.startsWith("/admin") ? next : defaultAdminPath();
    router.replace(target);
    router.refresh();
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>АЖ У НЕБІ</div>
        <p className={styles.subtitle}>Панель управління комплексом</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label}>
            Email
            <input
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="test@gmail.com"
              autoComplete="email"
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
