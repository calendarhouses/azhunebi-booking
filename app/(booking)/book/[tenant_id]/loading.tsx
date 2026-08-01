import { BRAND_ICONS } from "@/lib/brandIcons";

/**
 * Streamed instantly while the page resolves tenant data — without it the
 * browser shows a blank/black window for the whole server round-trip.
 * Styles are inline because the site stylesheet is linked by the page itself.
 */
export default function BookTenantLoading() {
  return (
    <div
      id="preloader"
      role="status"
      aria-label="Завантаження"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "#F7F5F2",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <style>{`@keyframes bookBootPulse{0%{transform:scale(1);opacity:1}50%{transform:scale(1.05);opacity:.7}100%{transform:scale(1);opacity:1}}`}</style>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BRAND_ICONS.icon512}
        alt="АЖ У НЕБІ"
        width={150}
        height={150}
        decoding="async"
        style={{
          width: 150,
          height: 150,
          objectFit: "contain",
          animation: "bookBootPulse 1.5s infinite",
        }}
      />
    </div>
  );
}
