"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  acceptTeamInvite,
  fetchInviteInfo,
  GAS_AUTH_TOKEN_KEY,
} from "@/lib/gas-api";
import { roleLabelUk } from "@/lib/admin/permissions";
import { isMobileUserAgent } from "@/lib/isMobileUserAgent";
import styles from "../../login/login.module.css";

function setAuthCookie(token: string) {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${GAS_AUTH_TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`;
}

function defaultAdminPath() {
  if (typeof window !== "undefined" && window.location.hostname === "admin.azhunebi.com") {
    return "/";
  }
  if (typeof navigator !== "undefined" && isMobileUserAgent(navigator.userAgent)) {
    return "/admin/mobile";
  }
  return "/admin";
}

export default function InvitePageClient({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"owner" | "admin">("admin");
  const [tenantName, setTenantName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setInfoError(null);
      try {
        const info = await fetchInviteInfo(token);
        if (cancelled) return;
        setEmail(info.email);
        setName(info.name);
        setRole(info.role);
        setTenantName(info.tenantName);
      } catch (e) {
        if (!cancelled) {
          setInfoError(e instanceof Error ? e.message : "Запрошення недійсне");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Пароль щонайменше 6 символів");
      return;
    }
    if (password !== password2) {
      setError("Паролі не збігаються");
      return;
    }
    setSubmitting(true);
    try {
      const session = await acceptTeamInvite({
        inviteToken: token,
        password,
        name: name.trim() || undefined,
      });
      setAuthCookie(session.accessToken);
      const target = defaultAdminPath();
      if (target === "/") {
        window.location.replace("/");
        return;
      }
      router.replace(target);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не вдалося прийняти запрошення");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>АЖ У НЕБІ</div>
        <p className={styles.subtitle}>
          {loading
            ? "Перевіряємо запрошення…"
            : infoError
              ? "Запрошення"
              : `Запрошення до ${tenantName || "команди"}`}
        </p>

        {loading ? null : infoError ? (
          <p className={styles.error}>{infoError}</p>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <p style={{ margin: 0, fontSize: 14, color: "#4b5563", lineHeight: 1.45 }}>
              Логін: <strong>{email}</strong>
              <br />
              Роль: {roleLabelUk(role)}
            </p>

            <label className={styles.label}>
              Імʼя
              <input
                type="text"
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ваше імʼя"
                autoComplete="name"
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
                placeholder="мін. 6 символів"
                autoComplete="new-password"
                required
              />
            </label>

            <label className={styles.label}>
              Повтор пароля
              <input
                type="password"
                className={styles.input}
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            </label>

            {error ? <p className={styles.error}>{error}</p> : null}

            <button type="submit" className={styles.submit} disabled={submitting}>
              {submitting ? "Збереження…" : "Прийняти запрошення"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
