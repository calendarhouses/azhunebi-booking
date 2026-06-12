export default function BookNotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, sans-serif",
        background: "#F7F5F2",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Комплекс не знайдено</h1>
        <p style={{ color: "#6B7280" }}>Перевірте посилання або зверніться до адміністратора.</p>
      </div>
    </main>
  );
}
