import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Тимчасово недоступно · АЖ У НЕБІ",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        margin: 0,
        display: "grid",
        placeItems: "center",
        padding: "2.5rem 1.5rem",
        background:
          "radial-gradient(1200px 600px at 50% -10%, #e8efe0 0%, #f4f1ea 45%, #ebe6dc 100%)",
        color: "#1c1c1c",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 440 }}>
        <p
          style={{
            margin: "0 0 1.25rem",
            fontSize: "0.8rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#4d6826",
            fontWeight: 600,
          }}
        >
          АЖ У НЕБІ
        </p>
        <h1
          style={{
            margin: "0 0 0.85rem",
            fontSize: "clamp(1.45rem, 4vw, 1.85rem)",
            fontWeight: 650,
            lineHeight: 1.25,
            letterSpacing: "-0.02em",
          }}
        >
          Сайт тимчасово недоступний
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: "1.05rem",
            lineHeight: 1.55,
            color: "rgba(28, 28, 28, 0.72)",
          }}
        >
          Скоро буде ще зручніше й приємніше. Дякуємо за очікування.
        </p>
      </div>
    </main>
  );
}
