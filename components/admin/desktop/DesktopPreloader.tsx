import { AdminLogo } from "./AdminLogo";

export function DesktopPreloader({ hidden }: { hidden?: boolean }) {
  return (
    <div
      id="preloader"
      className={hidden ? "preloader-hidden" : undefined}
      style={{
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? "none" : "auto",
        transition: "opacity 0.4s ease",
      }}
      aria-hidden={hidden}
    >
      <div className="pulse-logo">
        <AdminLogo variant="preloader" />
      </div>
    </div>
  );
}
