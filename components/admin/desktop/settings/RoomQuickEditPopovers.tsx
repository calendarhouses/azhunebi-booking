"use client";

import { forwardRef, useEffect, useState, type MouseEvent, type RefObject } from "react";
import type { RoomConfig } from "../types";
import {
  QuickEditPopover,
  QUICK_EDIT_POPOVER_TITLE_CLASS,
} from "./QuickEditPopover";
import {
  ROOM_STATUS_LABELS,
  getRoomAvailabilityStatus,
  patchFromAvailabilityStatus,
  type RoomAvailabilityUiStatus,
} from "./roomAvailability";
import {
  ROOM_DISABLED_BADGE_CLASS,
  ROOM_ENABLED_BADGE_CLASS,
  ROOM_NAME_POPOVER_INPUT_CLASS,
  ROOM_NAME_POPOVER_SAVE_CLASS,
} from "./roomChipStyles";

function CounterRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const counterBtnClass =
    "w-8 h-8 rounded-full border border-stone-200 flex items-center justify-center hover:bg-stone-100 hover:border-stone-300 text-stone-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={counterBtnClass}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={`Зменшити ${label}`}
        >
          −
        </button>
        <span className="text-sm font-medium w-4 text-center tabular-nums text-stone-800">{value}</span>
        <button
          type="button"
          className={counterBtnClass}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          aria-label={`Збільшити ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

const STATUS_OPTIONS: {
  value: RoomAvailabilityUiStatus;
  dotClass: string;
}[] = [
  { value: "enabled", dotClass: "bg-olive-600" },
  { value: "disabled", dotClass: "bg-red-400" },
];

export function RoomNameQuickEditPopover({
  open,
  onClose,
  anchorRef,
  initialName,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  initialName: string;
  onSave: (name: string) => void;
}) {
  const [draft, setDraft] = useState(initialName);

  useEffect(() => {
    if (open) setDraft(initialName);
  }, [open, initialName]);

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSave(trimmed);
    onClose();
  };

  return (
    <QuickEditPopover open={open} onClose={onClose} anchorRef={anchorRef}>
      <p className={QUICK_EDIT_POPOVER_TITLE_CLASS}>Назва</p>
      <div className="flex flex-col gap-3">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          className={ROOM_NAME_POPOVER_INPUT_CLASS}
          autoFocus
        />
        <button type="button" onClick={commit} className={ROOM_NAME_POPOVER_SAVE_CLASS}>
          Зберегти
        </button>
      </div>
    </QuickEditPopover>
  );
}

export function RoomCapacityQuickEditPopover({
  open,
  onClose,
  anchorRef,
  room,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  room: RoomConfig;
  onChange: (patch: Pick<RoomConfig, "capacity" | "maxCapacity">) => void;
}) {
  const capacity = room.capacity;
  const maxCapacity = room.maxCapacity ?? room.capacity;

  return (
    <QuickEditPopover open={open} onClose={onClose} anchorRef={anchorRef}>
      <p className={QUICK_EDIT_POPOVER_TITLE_CLASS}>Місткість</p>
      <div className="flex flex-col gap-4">
        <CounterRow
          label="Основні місця"
          value={capacity}
          min={1}
          max={24}
          onChange={(next) => {
            const nextMax = Math.max(next, maxCapacity);
            onChange({ capacity: next, maxCapacity: nextMax });
          }}
        />
        <CounterRow
          label="Максимум гостей"
          value={maxCapacity}
          min={capacity}
          max={32}
          onChange={(next) => onChange({ capacity, maxCapacity: next })}
        />
      </div>
    </QuickEditPopover>
  );
}

export function RoomStatusQuickEditPopover({
  open,
  onClose,
  anchorRef,
  room,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  room: RoomConfig;
  onSelect: (status: RoomAvailabilityUiStatus) => boolean | void;
}) {
  const current = getRoomAvailabilityStatus(room);

  return (
    <QuickEditPopover open={open} onClose={onClose} anchorRef={anchorRef}>
      <p className={QUICK_EDIT_POPOVER_TITLE_CLASS}>Статус</p>
      <div className="flex flex-col gap-0.5">
        {STATUS_OPTIONS.map(({ value, dotClass }) => (
          <button
            key={value}
            type="button"
            className={`flex items-center gap-3 p-2.5 rounded-lg hover:bg-stone-50 cursor-pointer text-sm font-medium text-stone-700 transition-colors w-full text-left ${
              current === value ? "bg-stone-50" : ""
            }`}
            onClick={() => {
              const accepted = onSelect(value);
              if (accepted === false) return;
              onClose();
            }}
          >
            <span className={`h-2 w-2 rounded-full shrink-0 ${dotClass}`} aria-hidden />
            {ROOM_STATUS_LABELS[value]}
          </button>
        ))}
      </div>
    </QuickEditPopover>
  );
}

export const RoomAvailabilityBadge = forwardRef<
  HTMLButtonElement,
  {
    room: RoomConfig;
    onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
    className?: string;
  }
>(function RoomAvailabilityBadge({ room, onClick, className }, ref) {
  const status = getRoomAvailabilityStatus(room);
  const baseClass = status === "enabled" ? ROOM_ENABLED_BADGE_CLASS : ROOM_DISABLED_BADGE_CLASS;
  const statusClass =
    status === "enabled" ? "settings-rooms-card__status--on" : "settings-rooms-card__status--off";
  const dotClass = status === "enabled" ? "bg-olive-600" : "bg-red-400";
  const label = ROOM_STATUS_LABELS[status];

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={`${baseClass} ${statusClass}${className ? ` ${className}` : ""}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass} shrink-0`} aria-hidden />
      {label}
    </button>
  );
});

export { patchFromAvailabilityStatus };
