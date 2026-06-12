"use client";

import { useFormState, useFormStatus } from "react-dom";
import styles from "../login/login.module.css";
import { registerAction, type RegisterActionState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.submit} disabled={pending}>
      {pending ? "Створення…" : "Створити комплекс"}
    </button>
  );
}

const initialState: RegisterActionState = { error: null };

export default function RegisterPageClient() {
  const [state, formAction] = useFormState(registerAction, initialState);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          ХАТА<span>.</span>
        </div>
        <p className={styles.subtitle}>Реєстрація нового комплексу</p>

        <form className={styles.form} action={formAction}>
          <label className={styles.label}>
            Назва комплексу
            <input
              name="tenantName"
              type="text"
              className={styles.input}
              placeholder="Лісова Пісня"
              autoComplete="organization"
              required
            />
          </label>

          <label className={styles.label}>
            Email
            <input
              name="email"
              type="email"
              className={styles.input}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label className={styles.label}>
            Пароль
            <input
              name="password"
              type="password"
              className={styles.input}
              placeholder="••••••••"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          {state.error ? <p className={styles.error}>{state.error}</p> : null}

          <SubmitButton />

          <p style={{ margin: 0, marginTop: 8, textAlign: "center", fontSize: 13, color: "#6B7280" }}>
            Уже маєте акаунт?{" "}
            <a href="/login" style={{ color: "#556B2F", fontWeight: 700, textDecoration: "none" }}>
              Увійти
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}

