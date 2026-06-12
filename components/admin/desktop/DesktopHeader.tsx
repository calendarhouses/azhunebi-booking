import type { ReactNode } from "react";
import { KhataBrandIcon } from "@/components/ui/icons/KhataBrandIcon";

export interface DesktopHeaderProps {
  pageTitle: string;
  pageIconPath: string;
  /** Іконка ХАТА замість stroke-SVG */
  iconVariant?: "khata";
  /** Оливковий акцент для розділів налаштувань */
  titleAccent?: boolean;
  showMainAction: boolean;
  onCreateBooking?: () => void;
  headerAction?: ReactNode;
}

export function DesktopHeader({
  pageTitle,
  pageIconPath,
  iconVariant,
  titleAccent = false,
  showMainAction,
  onCreateBooking,
  headerAction,
}: DesktopHeaderProps) {
  return (
    <div className="header">
      <h1
        id="pageTitle"
        className={`page-title${titleAccent ? " page-title--settings-tab" : ""}`}
      >
        <div
          className={`page-title-icon${iconVariant === "khata" ? " page-title-icon--khata" : ""}`}
        >
          {iconVariant === "khata" ? (
            <KhataBrandIcon className="page-title-icon__khata" />
          ) : (
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <g dangerouslySetInnerHTML={{ __html: pageIconPath }} />
            </svg>
          )}
        </div>
        {pageTitle}
      </h1>
      {headerAction ? (
        <div className="header__action">{headerAction}</div>
      ) : (
      <button
        type="button"
        className="btn-primary"
        id="mainActionButton"
        style={{ display: showMainAction ? "flex" : "none" }}
        onClick={() => onCreateBooking?.()}
      >
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Нова бронь
      </button>
      )}
    </div>
  );
}
