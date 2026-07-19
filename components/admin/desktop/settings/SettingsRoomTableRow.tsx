"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { ChevronDown, Users } from "lucide-react";
import { RoomSidebarHouseIcon } from "@/components/ui/icons/RoomSidebarHouseIcon";
import { isRoomDraftId } from "@/lib/admin/roomDraft";
import {
  formatPublishingErrorMessage,
  validatePublishing,
} from "@/lib/admin/validatePublishing";
import { showPublishingToast } from "../adminGlobals";
import type { AdminModalsApi } from "../useAdminModals";
import type { RoomConfig } from "../types";
import type { RoomAvailabilityUiStatus } from "./roomAvailability";
import { formatCapacityWithChildrenLabel } from "./roomCapacityLabel";
import {
  RoomAvailabilityBadge,
  RoomCapacityQuickEditPopover,
  RoomNameQuickEditPopover,
  RoomStatusQuickEditPopover,
  patchFromAvailabilityStatus,
} from "./RoomQuickEditPopovers";
import {
  ROOM_ACTION_DELETE_CLASS,
  ROOM_ACTION_EDIT_CLASS,
  ROOM_CAPACITY_CHIP_CLASS,
  ROOM_NAME_CHIP_CLASS,
  ROOM_NAME_CHIP_ICON_CLASS,
  ROOM_NAME_CHIP_TABLE_TEXT,
} from "./roomChipStyles";

type QuickEditField = "name" | "capacity" | "status" | null;

const ROOM_CHIP_LOCKED_CLASS = "settings-rooms-row__chip--locked";

const ROOM_CHIP_CLASS = {
  name: `${ROOM_NAME_CHIP_CLASS} ${ROOM_NAME_CHIP_TABLE_TEXT}`,
  capacity: ROOM_CAPACITY_CHIP_CLASS,
} as const;

const ROOM_CHIP_ICON_CLASS = {
  name: ROOM_NAME_CHIP_ICON_CLASS,
  capacity: "text-stone-400 shrink-0 inline-flex",
} as const;

function roomNameDisplay(name: string): string {
  return name.trim() || "Назва житла";
}

function openRoomFromRow(
  onToggle: (() => void) | undefined,
  quickEdit: QuickEditField,
  e: KeyboardEvent<HTMLTableRowElement>
) {
  if (quickEdit || !onToggle) return;
  if (e.target !== e.currentTarget) return;
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    onToggle();
  }
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

export function SettingsRoomTableRow({
  room: roomFromProps,
  modals,
  isMobile = false,
  isExpanded = false,
  onToggleExpand,
}: {
  room: RoomConfig;
  modals: AdminModalsApi;
  isMobile?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const [room, setRoom] = useState(roomFromProps);
  const [quickEdit, setQuickEdit] = useState<QuickEditField>(null);

  const nameAnchorRef = useRef<HTMLButtonElement>(null);
  const capacityAnchorRef = useRef<HTMLButtonElement>(null);
  const statusAnchorRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setRoom(roomFromProps);
  }, [roomFromProps]);

  useEffect(() => {
    if (isExpanded) setQuickEdit(null);
  }, [isExpanded]);

  const isDraft = isRoomDraftId(room.id);
  const nameIsEmpty = !room.name.trim();

  const patchRoom = (patch: Partial<RoomConfig>, options?: { debounceMs?: number }) => {
    setRoom((prev) => {
      const next: RoomConfig = { ...prev, ...patch };
      if (patch.availabilityStatus !== undefined) {
        const uiStatus: RoomAvailabilityUiStatus =
          patch.availabilityStatus === "enabled" ? "enabled" : "disabled";
        Object.assign(next, patchFromAvailabilityStatus(uiStatus));
      }
      if (patch.name !== undefined) {
        next.short = patch.name;
      }
      return next;
    });
    modals.patchRoomQuickEdit(room.id, patch, options);
  };

  const handleDelete = () => {
    if (isDraft) {
      modals.discardRoomDraft(room.id);
      return;
    }
    modals.deleteGenericItem("room", room.id);
  };

  const handleStatusSelect = (status: RoomAvailabilityUiStatus): boolean => {
    if (status === "enabled") {
      const result = validatePublishing(room);
      if (!result.ok) {
        showPublishingToast(formatPublishingErrorMessage(result.missing));
        return false;
      }
    }
    patchRoom(patchFromAvailabilityStatus(status));
    return true;
  };

  const toggleQuickEdit = (field: QuickEditField, e: MouseEvent) => {
    if (isExpanded && (field === "name" || field === "capacity")) return;
    e.stopPropagation();
    setQuickEdit((prev) => (prev === field ? null : field));
  };

  const chipLocked = isExpanded;

  if (isMobile) {
    return (
      <tr
        className="settings-rooms-row settings-rooms-row--mobile cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={() => modals.openRoomDrawer(room.id)}
        onKeyDown={(e) =>
          openRoomFromRow(() => modals.openRoomDrawer(room.id), quickEdit, e)
        }
      >
        <td className="settings-rooms-row__head">
          <button
            ref={nameAnchorRef}
            type="button"
            className={`settings-rooms-card__name${chipLocked ? ` ${ROOM_CHIP_LOCKED_CLASS}` : ""}`}
            onClick={(e) => toggleQuickEdit("name", e)}
            tabIndex={chipLocked ? -1 : undefined}
            aria-disabled={chipLocked || undefined}
          >
            <span className="settings-rooms-card__name-icon" aria-hidden>
              <RoomSidebarHouseIcon className="w-full h-full" />
            </span>
            <span
              className={`settings-rooms-row__name${nameIsEmpty ? " settings-rooms-row__name--placeholder" : ""}`}
            >
              {roomNameDisplay(room.name)}
            </span>
          </button>
          <RoomAvailabilityBadge
            ref={statusAnchorRef}
            room={room}
            onClick={(e) => toggleQuickEdit("status", e)}
          />
          <RoomNameQuickEditPopover
            open={quickEdit === "name"}
            onClose={() => setQuickEdit(null)}
            anchorRef={nameAnchorRef}
            initialName={room.name}
            onSave={(name) => patchRoom({ name, short: name })}
          />
          <RoomStatusQuickEditPopover
            open={quickEdit === "status"}
            onClose={() => setQuickEdit(null)}
            anchorRef={statusAnchorRef}
            room={room}
            onSelect={handleStatusSelect}
          />
        </td>
        <td className="settings-rooms-row__meta">
          <button
            ref={capacityAnchorRef}
            type="button"
            className={`settings-rooms-card__capacity${chipLocked ? ` ${ROOM_CHIP_LOCKED_CLASS}` : ""}`}
            onClick={(e) => toggleQuickEdit("capacity", e)}
            tabIndex={chipLocked ? -1 : undefined}
            aria-disabled={chipLocked || undefined}
          >
            <span className="settings-rooms-card__capacity-icon" aria-hidden>
              <Users size={15} strokeWidth={2} />
            </span>
            {formatCapacityWithChildrenLabel(room)}
          </button>
          <RoomCapacityQuickEditPopover
            open={quickEdit === "capacity"}
            onClose={() => setQuickEdit(null)}
            anchorRef={capacityAnchorRef}
            room={room}
            onChange={(patch) => patchRoom(patch, { debounceMs: 400 })}
          />
        </td>
        <td className="settings-rooms-row__action" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="settings-rooms-card__edit tap-btn"
            onClick={() => modals.openRoomDrawer(room.id)}
          >
            Редагувати
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr
      className={`settings-rooms-row cursor-pointer${isDraft ? " settings-rooms-row--draft" : ""}${isExpanded ? " is-expanded" : ""}`}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onClick={() => {
        if (quickEdit) return;
        onToggleExpand?.();
      }}
      onKeyDown={(e) => openRoomFromRow(onToggleExpand, quickEdit, e)}
    >
      <td>
        <button
          ref={nameAnchorRef}
          type="button"
          className={`${ROOM_CHIP_CLASS.name} inline-flex items-end gap-1.5${chipLocked ? ` ${ROOM_CHIP_LOCKED_CLASS}` : ""}`}
          onClick={(e) => toggleQuickEdit("name", e)}
          tabIndex={chipLocked ? -1 : undefined}
          aria-disabled={chipLocked || undefined}
        >
          <span className={ROOM_CHIP_ICON_CLASS.name} aria-hidden>
            <RoomSidebarHouseIcon className="w-full h-full" />
          </span>
          <span
            className={`settings-rooms-row__name${nameIsEmpty ? " settings-rooms-row__name--placeholder" : ""}`}
          >
            {roomNameDisplay(room.name)}
          </span>
        </button>
        {onToggleExpand ? (
          <ChevronDown size={16} strokeWidth={2} className="settings-rooms-row__chevron" aria-hidden />
        ) : null}
        {room.desc ? <span className="settings-room-row-desc">{room.desc}</span> : null}
        <RoomNameQuickEditPopover
          open={quickEdit === "name"}
          onClose={() => setQuickEdit(null)}
          anchorRef={nameAnchorRef}
          initialName={room.name}
          onSave={(name) => patchRoom({ name, short: name })}
        />
      </td>
      <td>
        <button
          ref={capacityAnchorRef}
          type="button"
          className={`${ROOM_CHIP_CLASS.capacity}${chipLocked ? ` ${ROOM_CHIP_LOCKED_CLASS}` : ""}`}
          onClick={(e) => toggleQuickEdit("capacity", e)}
          tabIndex={chipLocked ? -1 : undefined}
          aria-disabled={chipLocked || undefined}
        >
          <span className={ROOM_CHIP_ICON_CLASS.capacity} aria-hidden>
            <Users size={14} strokeWidth={2} />
          </span>
          {formatCapacityWithChildrenLabel(room)}
        </button>
        <RoomCapacityQuickEditPopover
          open={quickEdit === "capacity"}
          onClose={() => setQuickEdit(null)}
          anchorRef={capacityAnchorRef}
          room={room}
          onChange={(patch) => patchRoom(patch, { debounceMs: 400 })}
        />
      </td>
      <td>
        <RoomAvailabilityBadge
          ref={statusAnchorRef}
          room={room}
          onClick={(e) => toggleQuickEdit("status", e)}
        />
        <RoomStatusQuickEditPopover
          open={quickEdit === "status"}
          onClose={() => setQuickEdit(null)}
          anchorRef={statusAnchorRef}
          room={room}
          onSelect={handleStatusSelect}
        />
      </td>
      <td className="settings-rooms-row__actions" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-1">
          <button
            type="button"
            className={ROOM_ACTION_EDIT_CLASS}
            onClick={() => onToggleExpand?.()}
            aria-label="Редагувати"
          >
            {editIcon}
          </button>
          <button
            type="button"
            className={ROOM_ACTION_DELETE_CLASS}
            onClick={handleDelete}
            aria-label="Видалити"
          >
            {deleteIcon}
          </button>
        </div>
      </td>
    </tr>
  );
}
