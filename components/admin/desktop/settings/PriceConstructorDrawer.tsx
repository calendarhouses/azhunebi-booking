"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Banknote, Calendar, CalendarDays, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { RoomSidebarHouseIcon } from "@/components/ui/icons/RoomSidebarHouseIcon";
import { PriceRangeCalendar } from "./PriceRangeCalendar";
import { ALL_WEEKDAY_INDICES } from "./priceConstructorLogic";
import type { PriceFormState } from "./GenericModalContent";
import type { AdminSettingsPayload } from "../types";
import { cn } from "@/components/admin/rooms/room-drawer-ui";

const WEEKDAY_OPTIONS = [
  { label: "Пн", value: 1 },
  { label: "Вт", value: 2 },
  { label: "Ср", value: 3 },
  { label: "Чт", value: 4 },
  { label: "Пт", value: 5 },
  { label: "Сб", value: 6 },
  { label: "Нд", value: 0 },
] as const;

function SectionHeading({
  icon: Icon,
  customIcon,
  children,
}: {
  icon?: LucideIcon;
  customIcon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <h3 className="price-constructor-section-heading">
      {customIcon ??
        (Icon ? <Icon className="price-constructor-section-heading__icon" size={18} strokeWidth={1.5} /> : null)}
      {children}
    </h3>
  );
}

function HousingChipIcon() {
  return <RoomSidebarHouseIcon className="price-constructor-chip__icon" />;
}

type Props = {
  open: boolean;
  saving?: boolean;
  settings: AdminSettingsPayload;
  priceForm: PriceFormState;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  onChange: (updater: (prev: PriceFormState) => PriceFormState) => void;
};

function ToggleCard({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "price-constructor-chip",
        active && "price-constructor-chip--active",
        className
      )}
    >
      {children}
    </button>
  );
}

export function PriceConstructorDrawer({
  open,
  saving,
  settings,
  priceForm,
  onClose,
  onSave,
  onChange,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const rooms = settings.roomsList || [];

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleAllRooms = () => {
    onChange((f) => {
      const nextAll = !f.allRoomsActive;
      return {
        ...f,
        allRoomsActive: nextAll,
        selectedRoomIds: nextAll ? rooms.map((r) => String(r.id)) : [],
      };
    });
  };

  const toggleRoom = (id: string) => {
    onChange((f) => {
      const ids = f.selectedRoomIds.includes(id)
        ? f.selectedRoomIds.filter((x) => x !== id)
        : [...f.selectedRoomIds, id];
      return {
        ...f,
        selectedRoomIds: ids,
        allRoomsActive: ids.length === rooms.length,
      };
    });
  };

  const toggleWeekday = (day: number) => {
    onChange((f) => {
      const set = new Set(f.selectedWeekdays);
      if (set.has(day)) set.delete(day);
      else set.add(day);
      return { ...f, selectedWeekdays: Array.from(set) };
    });
  };

  const allWeekdaysSelected = ALL_WEEKDAY_INDICES.every((d) =>
    priceForm.selectedWeekdays.includes(d)
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="admin-side-drawer-overlay active" onClick={onClose}>
      <aside
        className="admin-side-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="price-constructor-title"
      >
        <div className="admin-side-drawer__header">
          <div>
            <p className="admin-side-drawer__eyebrow">Ціни та тарифи</p>
            <h2 id="price-constructor-title">Конструктор цін</h2>
            <p className="admin-side-drawer__subtitle">Обери житло, дні та період</p>
          </div>
          <button type="button" onClick={onClose} className="admin-side-drawer__close" aria-label="Закрити">
            <X size={18} strokeWidth={2.25} />
          </button>
        </div>

        <div className="admin-side-drawer__body">
          <div className="svc-drawer-block">
            <SectionHeading icon={Banknote}>Яку ціну за добу ставиш?</SectionHeading>
            <div className="price-constructor-price-block flex flex-col items-center justify-center rounded-xl border border-[#5c6b4b] bg-[#5c6b4b]/5 p-6 shadow-sm">
              <div className="flex w-full items-baseline justify-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={priceForm.amount}
                  onChange={(e) =>
                    onChange((f) => ({
                      ...f,
                      amount: e.target.value.replace(/[^\d\s]/g, ""),
                    }))
                  }
                  className="w-full min-w-0 bg-transparent text-center text-5xl font-bold text-stone-900 outline-none placeholder:text-stone-300"
                />
                <span className="shrink-0 text-2xl text-stone-400">₴</span>
              </div>
            </div>
          </div>

          <div className="svc-drawer-block">
            <SectionHeading
              customIcon={<RoomSidebarHouseIcon className="price-constructor-section-heading__icon" />}
            >
              В якій саме хаті змінити ціну?
            </SectionHeading>
            <div className="price-constructor-chip-grid grid grid-cols-2 gap-3">
              <ToggleCard active={priceForm.allRoomsActive} onClick={toggleAllRooms} className="col-span-2">
                <HousingChipIcon />
                У всіх
              </ToggleCard>
              {rooms.map((r) => (
                <ToggleCard
                  key={r.id}
                  active={priceForm.selectedRoomIds.includes(String(r.id))}
                  onClick={() => toggleRoom(String(r.id))}
                >
                  <HousingChipIcon />
                  {r.name}
                </ToggleCard>
              ))}
            </div>
          </div>

          <div className="svc-drawer-block">
            <SectionHeading icon={CalendarDays}>Які дні тижня застосувати?</SectionHeading>
            <div className="price-constructor-chip-grid grid grid-cols-4 gap-3 sm:grid-cols-7">
              <ToggleCard
                active={allWeekdaysSelected}
                onClick={() =>
                  onChange((f) => ({
                    ...f,
                    selectedWeekdays: [...ALL_WEEKDAY_INDICES],
                  }))
                }
                className="col-span-4 sm:col-span-7"
              >
                Усі дні
              </ToggleCard>
              {WEEKDAY_OPTIONS.map(({ label, value }) => (
                <ToggleCard
                  key={value}
                  active={priceForm.selectedWeekdays.includes(value)}
                  onClick={() => toggleWeekday(value)}
                >
                  {label}
                </ToggleCard>
              ))}
            </div>
          </div>

          <div className="svc-drawer-block">
            <SectionHeading icon={Calendar}>На який період?</SectionHeading>
            <PriceRangeCalendar
              settings={settings}
              startDate={priceForm.startDate}
              endDate={priceForm.endDate}
              selectedRoomIds={priceForm.selectedRoomIds}
              allRoomsActive={priceForm.allRoomsActive}
              onRangeChange={(start, end) =>
                onChange((f) => ({
                  ...f,
                  startDate: start,
                  endDate: end,
                  selectionDateStrs: null,
                }))
              }
            />
          </div>
        </div>

        <div className="admin-side-drawer__footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Скасувати
          </button>
          <button type="button" className="btn-primary" disabled={saving} onClick={() => void onSave()}>
            {saving ? "Збереження…" : "Зберегти ціни"}
          </button>
        </div>
      </aside>
    </div>,
    document.body
  );
}
