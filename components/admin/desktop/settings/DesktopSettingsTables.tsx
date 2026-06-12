"use client";

import { Fragment, type CSSProperties } from "react";
import type { AdminModalsApi } from "../useAdminModals";
import type { AdminSettingsPayload, DiscountConfig, DiscountKind } from "../types";
import { RoomSettingsAccordion } from "../../rooms/RoomSettingsAccordion";
import { DiscountSettingsAccordion } from "./DiscountSettingsAccordion";
import { dedupeDiscountsList } from "@/lib/admin/discountDraft";
import { matchesDiscountSection } from "./discountConfig";
import { SettingsDiscountTableRow } from "./SettingsDiscountTableRow";
import { SettingsRoomTableRow } from "./SettingsRoomTableRow";
import { SettingsRoomExpandRow, SETTINGS_DISCOUNT_ACCORDION_ANIMATION_MS } from "./SettingsRoomExpandRow";
import "./settings-discounts.css";

function ActiveBadge({ active, onLabel, offLabel }: { active: boolean; onLabel: string; offLabel: string }) {
  if (active) {
    return (
      <span className="badge confirmed">
        <div className="status-dot-small" style={{ background: "#059669" }} />
        {onLabel}
      </span>
    );
  }
  return (
    <span className="badge cancelled">
      <div className="status-dot-small" style={{ background: "#DC2626" }} />
      {offLabel}
    </span>
  );
}

const editIcon = (
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
    />
  </svg>
);

const deleteIcon = (
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

export interface DesktopSettingsTablesProps {
  settings: AdminSettingsPayload;
  modals: AdminModalsApi;
  layout?: "desktop" | "mobile";
}

const roomsEmptyStateStyle: CSSProperties = {
  padding: "28px 16px",
  textAlign: "center",
  color: "#6B7280",
  fontSize: 14,
  lineHeight: 1.5,
};

export function SettingsRoomsTable({ settings, modals, layout = "desktop" }: DesktopSettingsTablesProps) {
  const isMobile = layout === "mobile";
  const rooms = settings.roomsList || [];

  if (rooms.length === 0) {
    return (
      <tbody id={isMobile ? "settingsRoomsTableBody" : undefined}>
        <tr>
          <td colSpan={isMobile ? 1 : 4} style={roomsEmptyStateStyle}>
            У вас ще немає доданих котеджів
          </td>
        </tr>
      </tbody>
    );
  }

  return (
    <tbody id={isMobile ? "settingsRoomsTableBody" : undefined}>
      {!isMobile ? (
        <tr className="settings-rooms-table-spacer" aria-hidden>
          <td colSpan={4} />
        </tr>
      ) : null}
      {rooms.map((r, index) => (
        <Fragment key={r.id}>
          <SettingsRoomTableRow
            room={r}
            modals={modals}
            isMobile={isMobile}
            isExpanded={!isMobile && modals.roomAccordionKey === r.id}
            onToggleExpand={
              isMobile ? undefined : () => modals.toggleRoomAccordion(r.id)
            }
          />
          {!isMobile ? (
            <SettingsRoomExpandRow open={modals.roomAccordionKey === r.id} colSpan={4}>
              <RoomSettingsAccordion
                roomKey={r.id}
                room={r}
                settings={settings}
                modals={modals}
              />
            </SettingsRoomExpandRow>
          ) : null}
          {!isMobile && index < rooms.length - 1 ? (
            <tr className="settings-rooms-table-spacer" aria-hidden>
              <td colSpan={4} />
            </tr>
          ) : null}
        </Fragment>
      ))}
    </tbody>
  );
}

export function DiscountTableRows({
  discounts,
  settings,
  modals,
  includeLeadingSpacer = true,
}: {
  discounts: DiscountConfig[];
  settings: AdminSettingsPayload;
  modals: AdminModalsApi;
  includeLeadingSpacer?: boolean;
}) {
  if (discounts.length === 0) return null;

  return (
    <>
      {includeLeadingSpacer ? (
        <tr className="settings-discounts-table-spacer" aria-hidden>
          <td colSpan={4} />
        </tr>
      ) : null}
      {discounts.map((d, index) => (
        <Fragment key={d.id}>
          <SettingsDiscountTableRow
            discount={d}
            modals={modals}
            isExpanded={modals.discountAccordionKey === d.id}
            onToggleExpand={() => modals.toggleDiscountAccordion(d.id)}
          />
          <SettingsRoomExpandRow
            open={modals.discountAccordionKey === d.id}
            colSpan={4}
            animationMs={SETTINGS_DISCOUNT_ACCORDION_ANIMATION_MS}
            className="settings-discounts-expand"
          >
            <DiscountSettingsAccordion
              discountKey={d.id}
              discount={d}
              settings={settings}
              modals={modals}
            />
          </SettingsRoomExpandRow>
          {index < discounts.length - 1 ? (
            <tr className="settings-discounts-table-spacer" aria-hidden>
              <td colSpan={4} />
            </tr>
          ) : null}
        </Fragment>
      ))}
    </>
  );
}

export function SettingsDiscountsTable({
  settings,
  modals,
  layout = "desktop",
  sectionKind,
}: DesktopSettingsTablesProps & { sectionKind: DiscountKind }) {
  const isMobile = layout === "mobile";
  const discounts = dedupeDiscountsList(settings.discountsList || []).filter((d) =>
    matchesDiscountSection(d, sectionKind)
  );

  if (discounts.length === 0) {
    return null;
  }

  return (
    <tbody id={isMobile ? "settingsDiscountsTableBody" : undefined}>
      {isMobile ? (
        discounts.map((d) => (
          <tr key={d.id}>
            <td colSpan={4}>
              <strong>{d.name || d.condition}</strong> — {d.discount}
            </td>
          </tr>
        ))
      ) : (
        <DiscountTableRows
          discounts={discounts}
          settings={settings}
          modals={modals}
          includeLeadingSpacer
        />
      )}
    </tbody>
  );
}

export function SettingsSysServicesTable({ settings, modals }: DesktopSettingsTablesProps) {
  const sysServices = settings.sysServicesList || [];
  return (
    <tbody>
      {sysServices.map((s) => (
        <tr key={`sys-${s.id}`}>
          <td>
            <strong>{s.name}</strong>
          </td>
          <td>{s.rooms}</td>
          <td>{s.price}</td>
          <td>
            <ActiveBadge active={s.active} onLabel="Активна" offLabel="Не активна" />
          </td>
          <td>
            <button
              type="button"
              className="btn-icon-only"
              onClick={() => modals.openGenericModal("sysService", s.id)}
            >
              {editIcon}
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  );
}

export function SettingsCustomServicesTable({ settings, modals }: DesktopSettingsTablesProps) {
  const customServices = settings.customServicesList || [];
  return (
    <tbody>
      {customServices.map((s) => (
        <tr key={`cust-${s.id}`}>
          <td>
            <strong>{s.name}</strong>
          </td>
          <td>{s.rooms}</td>
          <td>
            <span style={{ color: "#4B5563", fontSize: 13 }}>{s.price} грн</span>
          </td>
          <td>{s.perDay}</td>
          <td>{s.perGuest}</td>
          <td>
            <span className={`badge ${s.active ? "confirmed" : "cancelled"}`}>
              {s.active ? "Активна" : "Не активна"}
            </span>
          </td>
          <td>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn-icon-only"
                onClick={() => modals.openGenericModal("customService", s.id)}
              >
                {editIcon}
              </button>
              <button
                type="button"
                className="btn-icon-only danger"
                onClick={() => modals.deleteGenericItem("service", s.id)}
              >
                {deleteIcon}
              </button>
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  );
}
