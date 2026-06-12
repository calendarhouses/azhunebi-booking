"use client";

import type { ReactNode } from "react";
import { AdminSessionLoader } from "./AdminSessionLoader";
import { useAuth } from "./AuthProvider";

export function AdminAuthGate({ children }: { children: ReactNode }) {
  const { loading, error, ready } = useAuth();

  if (loading) {
    return <AdminSessionLoader />;
  }

  if (error || !ready) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "#F3F4F6",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            background: "#fff",
            borderRadius: 16,
            padding: 32,
            border: "1px solid #E5E7EB",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Немає доступу</h1>
          <p style={{ color: "#6B7280", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
            {error || "Не вдалося визначити ваш комплекс."}
          </p>
          <a
            href="/login"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              background: "#556B2F",
              color: "#fff",
              borderRadius: 10,
              fontWeight: 600,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            Увійти з іншим акаунтом
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
