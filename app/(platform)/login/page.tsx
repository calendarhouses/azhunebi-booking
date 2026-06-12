import { Suspense } from "react";
import LoginPage from "./LoginPageClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Inter, sans-serif",
            color: "#6B7280",
          }}
        >
          Завантаження…
        </div>
      }
    >
      <LoginPage />
    </Suspense>
  );
}
