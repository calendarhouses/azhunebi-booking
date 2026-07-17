"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  Calendar,
  Infinity,
  List,
  Percent,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { RoomSidebarHouseIcon } from "@/components/ui/icons/RoomSidebarHouseIcon";
import { isDiscountDraftId } from "@/lib/admin/discountDraft";
import { showToast } from "../adminGlobals";
import type { AdminModalsApi } from "../useAdminModals";
import type { AdminSettingsPayload, DiscountConfig, DiscountKind } from "../types";
import {
  buildDiscountConfigFromForm,
  parseDiscountToForm,
  type DiscountAccordionForm,
  type SpecialGuestCategory,
} from "./discountConfig";
import { PriceRangeCalendar } from "./PriceRangeCalendar";
import { DiscountBentoCollapse } from "./DiscountBentoCollapse";
import { SETTINGS_DISCOUNT_ACCORDION_ANIMATION_MS } from "./SettingsRoomExpandRow";
import { scrollMainContentToId } from "./scrollMainContent";
import "./settings-discounts.css";

type DiscountSettingsAccordionProps = {
  discountKey: number;
  discount: DiscountConfig;
  settings: AdminSettingsPayload;
  modals: AdminModalsApi;
};

const CARD_HEADING_CLASS =
  "flex items-center gap-2 whitespace-nowrap text-sm font-medium text-stone-800 shrink-0";

const SEGMENT_GRID_CLASS = "grid grid-cols-2 gap-3 w-full";

const HOUSING_CHIP_IDLE =
  "flex w-full items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-600 text-sm font-medium cursor-pointer transition-colors hover:bg-stone-50 hover:text-stone-800";

const HOUSING_CHIP_ACTIVE =
  "flex w-full items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-[#5c6b4b] bg-[#5c6b4b]/5 text-[#5c6b4b] text-sm font-medium cursor-pointer transition-colors shadow-sm";

const HUGE_NUMBER_INPUT_CLASS =
  "text-5xl font-bold text-stone-900 bg-transparent text-center outline-none w-24 placeholder:text-stone-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

const CONDITIONS_CENTER_CLASS =
  "flex-1 flex flex-col justify-center items-center h-full w-full gap-2";

const OTHER_NAME_INPUT_CLASS =
  "w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 outline-none focus:border-[#5c6b4b] transition-colors placeholder:text-stone-400";

function HousingChipIcon() {
  return <RoomSidebarHouseIcon className="discount-housing-chip__icon" />;
}

function waitForAccordionClose(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, SETTINGS_DISCOUNT_ACCORDION_ANIMATION_MS);
  });
}

function segmentButtonClass(active: boolean): string {
  return active ? HOUSING_CHIP_ACTIVE : HOUSING_CHIP_IDLE;
}

function SpecialTariffConditions({
  form,
  patch,
}: {
  form: DiscountAccordionForm;
  patch: (partial: Partial<DiscountAccordionForm>) => void;
}) {
  const selectCategory = (id: SpecialGuestCategory) => {
    if (id === "other") {
      patch({ guestCategory: "other" });
      return;
    }
    patch({ guestCategory: id, name: "" });
  };

  return (
    <div className="w-full">
      <div className={SEGMENT_GRID_CLASS}>
        <button
          type="button"
          className={segmentButtonClass(form.guestCategory === "ubd")}
          onClick={() => selectCategory("ubd")}
        >
          УБД
        </button>
        <button
          type="button"
          className={segmentButtonClass(form.guestCategory === "anniversary")}
          onClick={() => selectCategory("anniversary")}
        >
          Річниця
        </button>
        <button
          type="button"
          className={`col-span-2 ${segmentButtonClass(form.guestCategory === "birthday")}`}
          onClick={() => selectCategory("birthday")}
        >
          День народження
        </button>
        <button
          type="button"
          className={`col-span-2 ${segmentButtonClass(form.guestCategory === "other")}`}
          onClick={() => selectCategory("other")}
        >
          Інше
        </button>
      </div>
      <DiscountBentoCollapse open={form.guestCategory === "other"}>
        <div className="pt-3">
          <input
          type="text"
          aria-label="Назва знижки"
          className={OTHER_NAME_INPUT_CLASS}
          placeholder="Напиши назву цієї знижки"
          value={form.name}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => patch({ name: e.target.value })}
          />
        </div>
      </DiscountBentoCollapse>
    </div>
  );
}

const BENTO_CARD_CLASS =
  "discount-bento-card bg-white rounded-2xl border border-stone-200 p-6 flex flex-col h-full min-h-[220px]";

const BENTO_BOTTOM_CARD_CLASS =
  "discount-bento-card bg-white rounded-2xl border border-stone-200 p-6 flex flex-col";

function BentoCardHeading({
  icon: Icon,
  customIcon,
  children,
}: {
  icon?: LucideIcon;
  customIcon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <h3 className={`${CARD_HEADING_CLASS} mb-6`}>
      {customIcon ??
        (Icon ? <Icon className="text-stone-400 shrink-0" size={18} strokeWidth={1.5} /> : null)}
      {children}
    </h3>
  );
}

function BentoNumberInput({
  value,
  onChange,
  min = 1,
  max = 365,
  maxUnit = "днів",
  ariaLabel,
  className,
  placeholder = "0",
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  maxUnit?: "днів" | "ночей";
  ariaLabel: string;
  className?: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value > 0 ? String(value) : "");
  const maxToastAtRef = useRef(0);

  useEffect(() => {
    setDraft(value > 0 ? String(value) : "");
  }, [value]);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  const notifyMaxExceeded = () => {
    const now = Date.now();
    if (now - maxToastAtRef.current < 2500) return;
    maxToastAtRef.current = now;
    showToast(`Максимум — ${max} ${maxUnit}`);
  };

  const applyParsed = (parsed: number, opts?: { notifyOverflow?: boolean }) => {
    if (parsed > max) {
      setDraft(String(max));
      onChange(max);
      if (opts?.notifyOverflow) notifyMaxExceeded();
      return;
    }
    const clamped = clamp(parsed);
    setDraft(String(clamped));
    onChange(clamped);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={3}
      aria-label={ariaLabel}
      className={className}
      placeholder={placeholder}
      value={draft}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, "");
        if (raw === "") {
          setDraft("");
          return;
        }
        const parsed = parseInt(raw, 10);
        if (Number.isNaN(parsed)) return;
        applyParsed(parsed, { notifyOverflow: parsed > max });
      }}
      onBlur={() => {
        const parsed = parseInt(draft, 10);
        if (!draft || Number.isNaN(parsed) || parsed < min) {
          onChange(min);
          setDraft(String(min));
          return;
        }
        applyParsed(parsed, { notifyOverflow: parsed > max });
      }}
    />
  );
}

function ConditionsCard({
  kind,
  form,
  patch,
}: {
  kind: DiscountKind;
  form: DiscountAccordionForm;
  patch: (partial: Partial<DiscountAccordionForm>) => void;
}) {
  if (kind === "promo_code") {
    return (
      <input
        type="text"
        aria-label="Промокод"
        className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-4 text-2xl font-mono uppercase w-full text-center tracking-widest outline-none focus:border-olive-400 transition-colors"
        placeholder="ВВЕДІТЬ КОД"
        value={form.promoCode}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => patch({ promoCode: e.target.value.toUpperCase() })}
      />
    );
  }

  if (kind === "long_stay") {
    return (
      <div className="flex-1 flex flex-col justify-center items-center h-full w-full gap-2">
        <BentoNumberInput
          ariaLabel="Мінімальна кількість ночей"
          className={HUGE_NUMBER_INPUT_CLASS}
          value={form.minNights}
          max={365}
          maxUnit="ночей"
          onChange={(n) => patch({ minNights: n })}
        />
        <p className="text-sm text-stone-400 font-medium">мінімальна кількість ночей</p>
      </div>
    );
  }

  if (kind === "early_booking") {
    return (
      <div className="flex flex-col items-center gap-2 w-full">
        <BentoNumberInput
          ariaLabel="Днів до заїзду"
          className={HUGE_NUMBER_INPUT_CLASS}
          value={form.daysBefore}
          max={365}
          onChange={(n) => patch({ daysBefore: n })}
        />
        <p className="text-sm text-stone-400 font-medium">днів до заїзду (раннє бронювання)</p>
      </div>
    );
  }

  if (kind === "last_minute") {
    return (
      <div className="flex flex-col items-center gap-2 w-full">
        <BentoNumberInput
          ariaLabel="Днів до заїзду"
          className={HUGE_NUMBER_INPUT_CLASS}
          value={form.daysBefore}
          max={365}
          onChange={(n) => patch({ daysBefore: n })}
        />
        <p className="text-sm text-stone-400 font-medium">або менше днів до заїзду</p>
      </div>
    );
  }

  if (kind === "ubd") {
    return <SpecialTariffConditions form={form} patch={patch} />;
  }

  return null;
}

export function DiscountSettingsAccordion({
  discountKey,
  discount,
  settings,
  modals,
}: DiscountSettingsAccordionProps) {
  const [form, setForm] = useState<DiscountAccordionForm>(() => parseDiscountToForm(discount));
  const [saving, setSaving] = useState(false);
  const isDraft = isDiscountDraftId(discountKey);
  const roomsList = settings.roomsList || [];

  useEffect(() => {
    setForm(parseDiscountToForm(discount));
  }, [discount]);

  const patch = useCallback((partial: Partial<DiscountAccordionForm>) => {
    setForm((prev) => ({ ...prev, ...partial }));
  }, []);

  const allRoomIds = useMemo(
    () => (roomsList || []).map((r) => String(r.id)),
    [roomsList]
  );

  const isAllHousingSelected =
    form.allRooms ||
    (allRoomIds.length > 0 && allRoomIds.every((id) => form.selectedRoomIds.includes(id)));

  const toggleAllHousing = () => {
    if (isAllHousingSelected) {
      patch({ allRooms: false, selectedRoomIds: [] });
      return;
    }
    patch({ allRooms: true, selectedRoomIds: [] });
  };

  const toggleRoom = (roomId: string) => {
    if (form.allRooms) {
      patch({ allRooms: false, selectedRoomIds: [roomId] });
      return;
    }
    const ids = form.selectedRoomIds.includes(roomId)
      ? form.selectedRoomIds.filter((x) => x !== roomId)
      : [...form.selectedRoomIds, roomId];
    const allSelected = allRoomIds.length > 0 && allRoomIds.every((id) => ids.includes(id));
    patch({
      selectedRoomIds: ids,
      allRooms: allSelected,
    });
  };

  const isRoomChipActive = (roomId: string) =>
    form.allRooms || form.selectedRoomIds.includes(roomId);

  const closeAccordionAnimated = async () => {
    modals.closeDiscountAccordion();
    await waitForAccordionClose();
  };

  const scrollToDiscountRow = useCallback(() => {
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        scrollMainContentToId(`discount-row-${discountKey}`, { offset: 16 });
      }, 150);
    });
  }, [discountKey]);

  const scrollToPeriodCard = useCallback(() => {
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        scrollMainContentToId(`discount-period-card-${discountKey}`, { offset: 16 });
      }, 150);
    });
  }, [discountKey]);

  const handleSave = async () => {
    if (!form.kind) {
      showToast("Обери тип знижки");
      return;
    }
    if (form.kind === "promo_code" && !form.promoCode.trim()) {
      showToast("Введи промокод");
      return;
    }
    if (form.kind === "ubd" && form.guestCategory === "other" && !form.name.trim()) {
      showToast("Введи назву знижки");
      return;
    }
    if (!form.allRooms && form.selectedRoomIds.length === 0) {
      showToast("Обери хоча б одне житло");
      return;
    }
    if (!form.value || form.value <= 0) {
      showToast("Вкажи розмір знижки");
      return;
    }
    if (form.periodMode === "range" && (!form.periodStart || !form.periodEnd)) {
      showToast("Обери період дії");
      return;
    }

    setSaving(true);
    try {
      const payload = buildDiscountConfigFromForm({ ...form, active: form.active }, roomsList);
      if (isDraft) {
        await closeAccordionAnimated();
        await modals.saveDiscountSettings(discountKey, payload);
      } else {
        await modals.saveDiscountSettings(discountKey, payload);
        await closeAccordionAnimated();
      }
      showToast("Знижку збережено");
    } catch {
      showToast("Не вдалося зберегти");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    await closeAccordionAnimated();
    if (isDraft) {
      modals.discardDiscountDraft(discountKey, { skipClose: true });
    }
  };

  if (!form.kind) {
    return (
      <div className="bg-stone-50/50 p-6 border-t border-stone-100">
        <p className="text-sm text-stone-500">Обери шаблон знижки вище, щоб налаштувати умови.</p>
      </div>
    );
  }

  const isPeriodRange = form.periodMode === "range";

  const selectPeriodRange = () => {
    if (form.periodMode !== "range") {
      patch({ periodMode: "range" });
      scrollToPeriodCard();
      return;
    }
    scrollToPeriodCard();
  };

  const selectAlways = () => {
    const wasRange = form.periodMode === "range";
    patch({ periodMode: "always", periodStart: "", periodEnd: "" });
    if (wasRange) scrollToDiscountRow();
  };

  return (
    <div
      id={`discount-settings-${discountKey}`}
      className="discount-settings-panel bg-stone-50/50 p-6 border-t border-stone-100"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 items-stretch discount-bento-top-grid">
        {/* Card 1: розмір знижки */}
        <div className={BENTO_CARD_CLASS}>
          <BentoCardHeading icon={Percent}>Яку знижку робимо?</BentoCardHeading>
          <div className="flex-1 flex flex-col w-full min-h-0">
            <div className="flex-1 flex items-center justify-center w-full">
              <BentoNumberInput
                ariaLabel="Розмір знижки"
                className={`${HUGE_NUMBER_INPUT_CLASS} w-full`}
                value={form.value}
                onChange={(n) => patch({ value: n })}
              />
            </div>
            <div className={`${SEGMENT_GRID_CLASS} mt-auto shrink-0 pt-4`}>
              <button
                type="button"
                className={segmentButtonClass(form.valueType === "percent")}
                onClick={() => patch({ valueType: "percent" })}
              >
                <Percent size={16} strokeWidth={1.5} />
                Відсоток
              </button>
              <button
                type="button"
                className={segmentButtonClass(form.valueType === "amount")}
                onClick={() => patch({ valueType: "amount" })}
              >
                <Banknote size={16} strokeWidth={1.5} />
                Сума
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: умови */}
        <div className={BENTO_CARD_CLASS}>
          <BentoCardHeading icon={List}>Які умови застосування?</BentoCardHeading>
          <div
            className={`${CONDITIONS_CENTER_CLASS} self-stretch${form.kind === "ubd" ? " !justify-start" : ""}`}
          >
            <ConditionsCard kind={form.kind} form={form} patch={patch} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 items-start">
        {/* Card 3: період дії */}
        <div id={`discount-period-card-${discountKey}`} className={BENTO_BOTTOM_CARD_CLASS}>
          <BentoCardHeading icon={Calendar}>На який період?</BentoCardHeading>
          <div className={`${SEGMENT_GRID_CLASS} mb-4`} role="group" aria-label="Період дії">
            <button
              type="button"
              className={segmentButtonClass(!isPeriodRange)}
              onClick={selectAlways}
            >
              <Infinity size={16} strokeWidth={1.5} />
              Завжди
            </button>
            <button
              type="button"
              className={segmentButtonClass(isPeriodRange)}
              onClick={selectPeriodRange}
            >
              <Calendar size={16} strokeWidth={1.5} />
              Обрати дати
            </button>
          </div>
          <DiscountBentoCollapse open={!isPeriodRange}>
            <div className="flex flex-col items-center justify-center text-center py-6">
              <Infinity className="text-stone-300 mb-3" size={40} strokeWidth={1.5} />
              <p className="text-sm text-stone-500 font-medium">Знижка діє без обмежень у часі</p>
            </div>
          </DiscountBentoCollapse>
          <DiscountBentoCollapse open={isPeriodRange}>
            <div className="pt-1 pb-1" onClick={(e) => e.stopPropagation()}>
              <PriceRangeCalendar
                settings={settings}
                startDate={form.periodStart}
                endDate={form.periodEnd}
                selectedRoomIds={[]}
                allRoomsActive
                showDayPrices={false}
                onRangeChange={(start, end) => patch({ periodStart: start, periodEnd: end })}
              />
            </div>
          </DiscountBentoCollapse>
        </div>

        {/* Card 4: житло */}
        <div className={BENTO_BOTTOM_CARD_CLASS}>
          <BentoCardHeading
            customIcon={
              <RoomSidebarHouseIcon className="text-stone-400 shrink-0 discount-bento-heading-icon" />
            }
          >
            В якій хаті діє?
          </BentoCardHeading>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className={`col-span-2 ${isAllHousingSelected ? HOUSING_CHIP_ACTIVE : HOUSING_CHIP_IDLE}`}
              onClick={toggleAllHousing}
            >
              <HousingChipIcon />
              Усі хати
            </button>
            {roomsList.map((room) => (
              <button
                key={room.id}
                type="button"
                className={isRoomChipActive(String(room.id)) ? HOUSING_CHIP_ACTIVE : HOUSING_CHIP_IDLE}
                onClick={() => toggleRoom(String(room.id))}
              >
                <HousingChipIcon />
                {room.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <footer className="discount-settings-panel__footer flex items-center justify-end gap-3 pt-2 border-t border-stone-100">
        <button
          type="button"
          className="discount-bento-cancel-btn"
          onClick={() => void handleCancel()}
        >
          Скасувати
        </button>
        <button
          type="button"
          className="discount-settings-panel__save bg-[#5c6b4b] hover:bg-[#4a563c] text-white px-6 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-60"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? "Збереження..." : "Зберегти"}
        </button>
      </footer>
    </div>
  );
}
