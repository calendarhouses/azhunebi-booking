"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { RoomFormState } from "@/components/admin/desktop/settings/GenericModalContent";
import type { RoomDrawerTab } from "@/components/admin/desktop/useAdminModals";
import { useMobileUi } from "@/components/admin/mobile/MobileUiContext";
import { AMENITIES_CATEGORIES, buildDefaultAmenitiesState } from "@/constants/amenitiesDict";
import { AmenityCategoryIcon, AmenityIcon } from "@/constants/amenityIcons";
import { LineIcon } from "@/components/ui/LineIcon";
import {
  amenityCardActiveClass,
  amenityCardClass,
  amenityCardIdleClass,
  amenityCheckActiveClass,
  amenityCheckClass,
  amenityCheckIdleClass,
  btnDangerClass,
  btnPrimaryClass,
  btnSecondaryClass,
  cn,
  fieldLabelClass,
  iconSlotMdClass,
  iconSlotSmClass,
  inputClass,
  sectionBlockClass,
  sectionHeadingClass,
  tabActiveClass,
  tabIdleClass,
} from "./room-drawer-ui";

type Props = {
  open: boolean;
  title: string;
  initialTab: RoomDrawerTab;
  roomId: number | null;
  roomForm: RoomFormState;
  saving?: boolean;
  loading?: boolean;
  onClose: () => void;
  onSave: () => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  onRoomFormChange: (updater: (prev: RoomFormState) => RoomFormState) => void;
};

const TAB_LABELS: Record<RoomDrawerTab, string> = {
  main: "Основна інформація",
  amenities: "Зручності",
};

function updateAmenity(
  amenities: RoomFormState["amenities"],
  categoryId: string,
  amenityId: string,
  patch: Partial<{ isActive: boolean; isFeatured: boolean; customText?: string }>
) {
  const next = { ...(amenities || buildDefaultAmenitiesState()) };
  const list = Array.isArray(next[categoryId]) ? [...next[categoryId]] : [];
  const idx = list.findIndex((x) => x.id === amenityId);
  if (idx >= 0) list[idx] = { ...list[idx], ...patch };
  else
    list.push({
      id: amenityId,
      isActive: !!patch.isActive,
      isFeatured: !!patch.isFeatured,
      customText: patch.customText,
    });
  next[categoryId] = list;
  return next;
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <label className={cn(fieldLabelClass, "flex items-center gap-2.5")}>
        {icon ? <span className={iconSlotSmClass}>{icon}</span> : null}
        {label}
      </label>
      {children}
    </div>
  );
}

function SectionBlock({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={sectionBlockClass}>
      <h3 className={cn(sectionHeadingClass, "mb-4 flex items-center gap-2.5")}>
        {icon ? <span className={iconSlotMdClass}>{icon}</span> : null}
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function TinyIcon({ children }: { children: ReactNode }) {
  return (
    <LineIcon className="h-4 w-4" size={16}>
      {children}
    </LineIcon>
  );
}

function AmenityCard({
  label,
  amenityId,
  active,
  onToggle,
}: {
  label: string;
  amenityId: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={active}
      onClick={onToggle}
      className={cn(amenityCardClass, active ? amenityCardActiveClass : amenityCardIdleClass)}
    >
      <span
        className={cn(
          iconSlotMdClass,
          "group-hover:scale-[1.03] group-hover:border-[#556B2F]/20 group-hover:shadow-[0_2px_8px_rgba(85,107,47,0.1)]",
          active && "scale-[1.02] border-[#556B2F]/25 bg-white"
        )}
      >
        <AmenityIcon id={amenityId} className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-slate-800">{label}</span>
      <span
        className={cn(
          amenityCheckClass,
          active ? amenityCheckActiveClass : amenityCheckIdleClass
        )}
        aria-hidden
      >
        <LineIcon className="h-3.5 w-3.5" size={14}>
          <path d="M5 13l4 4L19 7" />
        </LineIcon>
      </span>
    </button>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export function RoomSettingsDrawer({
  open,
  title,
  initialTab,
  roomId,
  roomForm,
  saving,
  loading = false,
  onClose,
  onSave,
  onDelete,
  onRoomFormChange,
}: Props) {
  const isMobile = useMobileUi();
  const [tab, setTab] = useState<RoomDrawerTab>(initialTab);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [initialTab, open]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const html = document.documentElement;
    const prevBody = document.body.style.overflow;
    const prevHtml = html.style.overflow;
    document.body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      html.style.overflow = prevHtml;
    };
  }, [open]);

  return (
    <div
      className={cn(
        "room-settings-drawer-layer fixed inset-0 z-[3200] transition-opacity duration-300",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        className="room-settings-drawer-backdrop absolute inset-0 bg-slate-900/40 backdrop-blur-[4px]"
        onClick={onClose}
        aria-label="Закрити панель"
      />
      <aside
        className={cn(
          "room-settings-drawer flex flex-col bg-white antialiased",
          isMobile
            ? cn(
                "absolute bottom-0 left-0 right-0 max-h-[92dvh] w-full rounded-t-[22px]",
                "shadow-[0_-16px_40px_rgba(15,23,42,0.12)]",
                "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                "pb-[env(safe-area-inset-bottom,0px)]",
                open ? "translate-y-0" : "translate-y-full"
              )
            : cn(
                "absolute right-0 top-0 h-full w-full max-w-2xl",
                "shadow-[-16px_0_40px_rgba(15,23,42,0.08)]",
                "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                open ? "translate-x-0" : "translate-x-full"
              )
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-drawer-title"
      >
        {isMobile ? <div className="m-sheet-handle mt-3 shrink-0" aria-hidden /> : null}
        <header
          className={cn(
            "room-settings-drawer__header shrink-0 border-b border-slate-200",
            isMobile ? "px-5 pb-4 pt-1" : "p-6"
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2
                id="room-drawer-title"
                className={cn(
                  "font-semibold tracking-tight text-slate-900",
                  isMobile ? "text-lg" : "text-xl"
                )}
              >
                {title}
              </h2>
              <p className="mt-1 text-sm text-slate-500">Основні параметри та зручності котеджу</p>
            </div>
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              onClick={onClose}
              aria-label="Закрити"
            >
              <CloseIcon />
            </button>
          </div>
          <div
            className={cn(
              "room-settings-drawer__tabs mt-5",
              isMobile ? "" : "flex flex-wrap gap-2"
            )}
            role="tablist"
            aria-label="Розділи котеджу"
          >
            {(["main", "amenities"] as RoomDrawerTab[]).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  "room-settings-drawer__tab",
                  tab === t && "is-active",
                  !isMobile && (tab === t ? tabActiveClass : tabIdleClass)
                )}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>
        </header>

        <div className={cn("room-settings-drawer__body flex-1 overflow-y-auto", isMobile ? "px-5 py-4" : "p-6")}>
          {loading ? (
            <div className="animate-pulse space-y-6">
              <div className="h-28 rounded-xl bg-slate-100" />
              <div className="h-28 rounded-xl bg-slate-100" />
              <div className="h-28 rounded-xl bg-slate-100" />
            </div>
          ) : (
            <div
              key={tab}
              className="space-y-6"
              style={{ animation: "roomTabFadeIn 220ms ease-out forwards" }}
            >
              {tab === "main" ? (
                <>
                  <SectionBlock
                    title="Ідентифікація"
                    icon={
                      <TinyIcon>
                        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1v-9.5Z" />
                      </TinyIcon>
                    }
                  >
                    <Field
                      label="Назва котеджу"
                      icon={
                        <TinyIcon>
                          <path d="M4 7h16M4 12h10" />
                        </TinyIcon>
                      }
                    >
                      <input
                        className={inputClass}
                        value={roomForm.name}
                        onChange={(e) =>
                          onRoomFormChange((f) => ({ ...f, name: e.target.value }))
                        }
                        placeholder="Наприклад, Котедж «Сосна»"
                      />
                    </Field>
                    <Field
                      label="Короткий опис"
                      icon={
                        <TinyIcon>
                          <path d="M4 6h16M4 12h16M4 18h10" />
                        </TinyIcon>
                      }
                    >
                      <input
                        className={inputClass}
                        value={roomForm.desc}
                        onChange={(e) =>
                          onRoomFormChange((f) => ({ ...f, desc: e.target.value }))
                        }
                        placeholder="Стандарт, сімейний, з терасою…"
                      />
                    </Field>
                  </SectionBlock>

                  <SectionBlock
                    title="Місткість"
                    icon={
                      <TinyIcon>
                        <circle cx="12" cy="8" r="3" />
                        <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
                      </TinyIcon>
                    }
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field
                        label="Базова місткість"
                        icon={
                          <TinyIcon>
                            <path d="M4 12h16M12 4v16" />
                          </TinyIcon>
                        }
                      >
                        <input
                          type="number"
                          min={1}
                          className={inputClass}
                          value={roomForm.capacity}
                          onChange={(e) =>
                            onRoomFormChange((f) => ({
                              ...f,
                              capacity: Number(e.target.value) || 1,
                            }))
                          }
                        />
                      </Field>
                      <Field
                        label="Максимальна місткість"
                        icon={
                          <TinyIcon>
                            <path d="M5 12h14M12 5l7 7-7 7" />
                          </TinyIcon>
                        }
                      >
                        <input
                          type="number"
                          min={1}
                          className={inputClass}
                          value={roomForm.maxCapacity}
                          onChange={(e) =>
                            onRoomFormChange((f) => ({
                              ...f,
                              maxCapacity: Number(e.target.value) || f.capacity,
                            }))
                          }
                        />
                      </Field>
                    </div>
                  </SectionBlock>

                  <SectionBlock
                    title="Базові ціни"
                    icon={
                      <TinyIcon>
                        <path d="M12 3v18" />
                        <path d="M6 8h12M8 12h8M10 16h4" />
                      </TinyIcon>
                    }
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field
                        label="Базова ціна (будні)"
                        icon={
                          <TinyIcon>
                            <path d="M6 3v18M6 12h7a3 3 0 100-6H6" />
                          </TinyIcon>
                        }
                      >
                        <input
                          type="number"
                          min={0}
                          className={inputClass}
                          value={roomForm.priceWeekday}
                          onChange={(e) =>
                            onRoomFormChange((f) => ({
                              ...f,
                              priceWeekday: Number(e.target.value) || 0,
                            }))
                          }
                        />
                      </Field>
                      <Field
                        label="Базова ціна (вихідні)"
                        icon={
                          <TinyIcon>
                            <path d="M8 3v3M16 3v3M5 8h14M6 8v11h12V8" />
                          </TinyIcon>
                        }
                      >
                        <input
                          type="number"
                          min={0}
                          className={inputClass}
                          value={roomForm.priceWeekend}
                          onChange={(e) =>
                            onRoomFormChange((f) => ({
                              ...f,
                              priceWeekend: Number(e.target.value) || 0,
                            }))
                          }
                        />
                      </Field>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-500">
                      Специфічні тарифи на дати — у розділі «Конструктор цін».
                    </p>
                  </SectionBlock>
                </>
              ) : null}

              {tab === "amenities" ? (
                <div className="space-y-6">
                  {AMENITIES_CATEGORIES.map((cat) => (
                    <section key={cat.id} className={sectionBlockClass}>
                      <div className="mb-4 flex items-center gap-3">
                        <span className={iconSlotMdClass}>
                          <AmenityCategoryIcon categoryId={cat.id} className="h-[18px] w-[18px]" />
                        </span>
                        <h3 className="text-sm font-semibold text-slate-900">{cat.title}</h3>
                      </div>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {cat.items.map((it) => {
                          const current = (roomForm.amenities?.[cat.id] || []).find(
                            (x) => x.id === it.id
                          );
                          const active = !!current?.isActive;
                          return (
                            <AmenityCard
                              key={it.id}
                              amenityId={it.id}
                              label={it.label}
                              active={active}
                              onToggle={() =>
                                onRoomFormChange((f) => ({
                                  ...f,
                                  amenities: updateAmenity(f.amenities, cat.id, it.id, {
                                    isActive: !active,
                                  }),
                                }))
                              }
                            />
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <footer
          className={cn(
            "room-settings-drawer__footer flex shrink-0 items-center justify-between gap-4 border-t border-slate-200 bg-slate-50",
            isMobile ? "px-5 py-3" : "px-6 py-4"
          )}
        >
          <div>
            {onDelete && roomId ? (
              <button type="button" className={btnDangerClass} onClick={() => void onDelete()}>
                Видалити котедж
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className={btnSecondaryClass} onClick={onClose}>
              Скасувати
            </button>
            <button
              type="button"
              className={btnPrimaryClass}
              disabled={saving}
              onClick={() => void onSave()}
            >
              {saving ? "Збереження…" : "Зберегти"}
            </button>
          </div>
        </footer>

        <style>{`
          @keyframes roomTabFadeIn {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </aside>
    </div>
  );
}
