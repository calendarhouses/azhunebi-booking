import { AdminLogo } from "../desktop/AdminLogo";

export interface MobileTopBarProps {
  title: string;
  showMainAction: boolean;
  onCreateBooking?: () => void;
  publicBookUrl?: string;
}

export function MobileTopBar({
  title,
  showMainAction,
  onCreateBooking,
  publicBookUrl,
}: MobileTopBarProps) {
  return (
    <div className="top-bar">
      <div className="top-logo">
        <AdminLogo variant="sidebar" />
      </div>
      <div className="top-title" id="mobileTopTitle">
        {title}
      </div>
      <div className="top-bar-actions">
        {publicBookUrl ? (
          <a
            href={publicBookUrl}
            target="_blank"
            rel="noreferrer"
            className="top-link-btn tap-btn"
            aria-label="Відкрити сайт бронювання"
            title="Сайт бронювання"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
              />
            </svg>
          </a>
        ) : null}
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
    </div>
  );
}
