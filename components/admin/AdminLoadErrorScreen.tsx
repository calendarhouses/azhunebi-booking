"use client";

import { parseAdminFetchError } from "@/lib/admin/parseAdminApiError";

type AdminLoadErrorScreenProps = {
  error: string | null;
  onRetry?: () => void;
};

export function AdminLoadErrorScreen({ error, onRetry }: AdminLoadErrorScreenProps) {
  if (!error) return null;

  const message = parseAdminFetchError(new Error(error));

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#F3F4F6",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          background: "#fff",
          borderRadius: 16,
          padding: 32,
          border: "1px solid #E5E7EB",
          boxShadow: "0 12px 40px rgba(18, 26, 18, 0.08)",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: "#1a1a1a" }}>
          Не вдалося завантажити дані
        </h1>
        <p style={{ color: "#6B7280", fontSize: 14, lineHeight: 1.65, marginBottom: 24 }}>
          {message}
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              style={{
                padding: "12px 20px",
                background: "#3a4f35",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Спробувати знову
            </button>
          ) : null}
          <a
            href="/login"
            style={{
              padding: "12px 20px",
              background: "#fff",
              color: "#3a4f35",
              border: "1.5px solid #3a4f35",
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            На сторінку входу
          </a>
        </div>
      </div>
    </div>
  );
}
