import { AdminLogo } from "../desktop/AdminLogo";

export interface MobileTopBarProps {
  title: string;
  showMainAction: boolean;
  onCreateBooking?: () => void;
}

export function MobileTopBar({ title, showMainAction, onCreateBooking }: MobileTopBarProps) {
  return (
    <div className="top-bar">
      <div className="top-logo">
        <AdminLogo variant="sidebar" />
      </div>
      <div className="top-title" id="mobileTopTitle">
        {title}
      </div>
      <button
        type="button"
        className="top-action-btn tap-btn"
        id="mainActionButton"
        style={{ display: showMainAction ? "flex" : "none" }}
        onClick={() => onCreateBooking?.()}
        aria-label="Нова бронь"
      >
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>
    </div>
  );
}
