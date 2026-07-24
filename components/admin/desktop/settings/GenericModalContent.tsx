"use client";

import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type {
  AdminSettingsPayload,
  CustomServiceConfig,
  DiscountConfig,
  RoomConfig,
  RoomAmenitiesByCategory,
  RoomRules,
  TransactionConfig,
} from "../types";
import { buildIncomeCategories, EXPENSE_CATEGORIES } from "../types";
import { RoomPhotosUpload } from "./RoomPhotosUpload";
import { AMENITIES_CATEGORIES, buildDefaultAmenitiesState } from "@/constants/amenitiesDict";
import { adminRoomLabel } from "@/lib/admin/roomDisplay";

export type GenericModalType =
  | "room"
  | "price"
  | "restriction"
  | "discount"
  | "customService"
  | "sysService"
  | "transaction";

export type PendingRestrictionModal = {
  roomIds: string[];
  useCustomRange: boolean;
  startDate: string;
  endDate: string;
  rangeLabel: string;
  minNights: number;
} | null;

export type RoomFormState = {
  name: string;
  /** Назва в шахматці / адмінці (окремо від публічної) */
  short: string;
  desc: string;
  capacity: number;
  maxCapacity: number;
  extraGuestPrice: number;
  pricingModel: "per_house" | "per_guest";
  pricePerGuest: number;
  allowChildren: boolean;
  /** null = без обмеження по віку (коли діти дозволені) */
  minChildAge: number | null;
  priceWeekday: number;
  priceWeekend: number;
  active: boolean;
  photos: string[];
  detailedDescription: string;
  rules: RoomRules;
  amenities: RoomAmenitiesByCategory;
};

export type PriceFormState = {
  selectedRoomIds: string[];
  allRoomsActive: boolean;
  amount: string;
  startDate: string;
  endDate: string;
  /** JS Date.getDay(): 0 = Нд, 1 = Пн, … 6 = Сб */
  selectedWeekdays: number[];
  /** Точні дати з виділення шахматки (до зміни періоду в календарі) */
  selectionDateStrs: string[] | null;
};

export type RestrictionFormState = {
  selectedRoomIds: string[];
  allRoomsActive: boolean;
  minNights: number;
  periodMonths: string;
  dayType: string;
  useCustomRange: boolean;
  startDate: string;
  endDate: string;
  rangeLabel: string;
};

export type DiscountFormState = {
  days: number;
  percent: number;
  selectedIds: string[];
  allSelected: boolean;
};

export type CustomServiceFormState = {
  name: string;
  price: string;
  perDay: string;
  perGuest: string;
  active: boolean;
};

export type SysServiceFormState = {
  name: string;
  price: string;
  active: boolean;
};

export type TransactionFormState = {
  type: "income" | "expense";
  category: string;
  amount: string;
  date: string;
  comment: string;
};

function Chip({
  active,
  onClick,
  children,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`chip-btn ${active ? "active" : ""} ${className}`.trim()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function buildRoomForm(room: Partial<RoomConfig>): RoomFormState {
  const rules: RoomRules = {
    checkInTime: room.rules?.checkInTime || "15:00",
    checkOutTime: room.rules?.checkOutTime || "11:00",
    pets: {
      isPetsFriendly: room.rules?.pets?.isPetsFriendly ?? false,
      description: room.rules?.pets?.description || "За узгодженням",
    },
    selfCheckIn: {
      enabled: room.rules?.selfCheckIn?.enabled ?? false,
      description: room.rules?.selfCheckIn?.description || "",
    },
  };

  const defaults = buildDefaultAmenitiesState();
  const amenities: RoomAmenitiesByCategory = room.amenities
    ? Object.keys(defaults).reduce((acc, catId) => {
        const base = defaults[catId] || [];
        const existing = room.amenities?.[catId] || [];
        const merged = base.map((b) => {
          const ex = existing.find((x) => x.id === b.id);
          return ex
            ? {
                id: b.id,
                isActive: !!(ex as any).isActive,
                isFeatured: !!(ex as any).isFeatured,
                customText: (ex as any).customText ? String((ex as any).customText) : undefined,
              }
            : b;
        });
        // keep unknown items (forward-compatible)
        const unknown = existing.filter((x) => !base.some((b) => b.id === x.id));
        (acc as any)[catId] = [...merged, ...unknown];
        return acc;
      }, {} as RoomAmenitiesByCategory)
    : (defaults as unknown as RoomAmenitiesByCategory);

  return {
    name: room.name || "",
    short: room.short?.trim() || room.name || "",
    desc: room.desc || "",
    capacity: room.capacity ?? 2,
    maxCapacity: room.maxCapacity ?? room.capacity ?? 4,
    extraGuestPrice: room.extraGuestPrice !== undefined ? room.extraGuestPrice : 2500,
    pricingModel: room.pricingModel === "per_guest" ? "per_guest" : "per_house",
    pricePerGuest: room.pricePerGuest ?? room.priceWeekday ?? 4000,
    allowChildren: room.allowChildren !== false,
    minChildAge:
      room.minChildAge != null && Number.isFinite(Number(room.minChildAge))
        ? Math.max(0, Math.min(17, Math.round(Number(room.minChildAge))))
        : null,
    priceWeekday: room.priceWeekday ?? 4000,
    priceWeekend: room.priceWeekend ?? 5000,
    active: room.active !== false,
    photos: Array.isArray(room.photos) ? [...room.photos] : [],
    detailedDescription: room.detailedDescription || "",
    rules,
    amenities,
  };
}

export function buildDiscountForm(d: Partial<DiscountConfig>, id: number | null): DiscountFormState {
  const condVal = parseInt(String(d.condition || "").replace(/\D/g, ""), 10) || 2;
  const discVal = parseInt(String(d.discount || "").replace(/\D/g, ""), 10) || 15;
  let selectedIds = d.roomsIds || [];
  if (id && selectedIds.length === 0 && d.rooms === "Всі котеджі") selectedIds = ["all"];
  const allSelected = selectedIds.includes("all");
  return { days: condVal, percent: discVal, selectedIds, allSelected };
}

export function buildRestrictionForm(pre: PendingRestrictionModal): RestrictionFormState {
  const preIds = pre?.roomIds || [];
  return {
    selectedRoomIds: preIds,
    allRoomsActive: false,
    minNights: pre?.minNights || 2,
    periodMonths: "1",
    dayType: "all",
    useCustomRange: !!pre?.useCustomRange,
    startDate: pre?.startDate || "",
    endDate: pre?.endDate || "",
    rangeLabel: pre?.rangeLabel || "",
  };
}

export function buildCustomServiceForm(s: Partial<CustomServiceConfig>): CustomServiceFormState {
  return {
    name: s.name || "",
    price: String(s.price ?? 0),
    perDay: s.perDay || "Ні",
    perGuest: s.perGuest || "Ні",
    active: s.active !== false,
  };
}

export function buildTransactionForm(
  t: Partial<TransactionConfig>,
  customServicesList?: CustomServiceConfig[] | null
): TransactionFormState {
  const type = t.type === "income" ? "income" : "expense";
  const cats =
    type === "income" ? buildIncomeCategories(customServicesList) : EXPENSE_CATEGORIES;
  return {
    type,
    category: t.category || cats[0],
    amount: t.amount ? String(t.amount) : "",
    date: t.date || new Date().toISOString().split("T")[0],
    comment: t.comment || "",
  };
}

export interface GenericModalContentProps {
  type: GenericModalType;
  settings: AdminSettingsPayload;
  roomForm: RoomFormState;
  setRoomForm: Dispatch<SetStateAction<RoomFormState>>;
  priceForm: PriceFormState;
  setPriceForm: Dispatch<SetStateAction<PriceFormState>>;
  restrictionForm?: RestrictionFormState;
  setRestrictionForm?: Dispatch<SetStateAction<RestrictionFormState>>;
  discountForm: DiscountFormState;
  setDiscountForm: Dispatch<SetStateAction<DiscountFormState>>;
  customServiceForm: CustomServiceFormState;
  setCustomServiceForm: Dispatch<SetStateAction<CustomServiceFormState>>;
  sysServiceForm: SysServiceFormState;
  setSysServiceForm: Dispatch<SetStateAction<SysServiceFormState>>;
  transactionForm: TransactionFormState;
  setTransactionForm: Dispatch<SetStateAction<TransactionFormState>>;
  roomEditId?: number | null;
  roomInitialTab?: "main" | "photos" | "rules" | "amenities";
  roomPhotosBusy?: boolean;
  onRoomPhotosSelected?: (files: FileList) => void;
}

export function GenericModalContent({
  type,
  settings,
  roomForm,
  setRoomForm,
  priceForm,
  setPriceForm,
  restrictionForm,
  setRestrictionForm,
  discountForm,
  setDiscountForm,
  customServiceForm,
  setCustomServiceForm,
  sysServiceForm,
  setSysServiceForm,
  transactionForm,
  setTransactionForm,
  roomEditId = null,
  roomInitialTab = "main",
  roomPhotosBusy = false,
  onRoomPhotosSelected,
}: GenericModalContentProps) {
  const rooms = settings.roomsList || [];
  const activeRooms = rooms.filter((r) => r.active);

  if (type === "room") {
    return (
      <RoomModalTabs
        roomForm={roomForm}
        setRoomForm={setRoomForm}
        roomEditId={roomEditId}
        initialTab={roomInitialTab}
        roomPhotosBusy={roomPhotosBusy}
        onRoomPhotosSelected={onRoomPhotosSelected}
      />
    );
  }

  if (type === "restriction") {
    if (!restrictionForm || !setRestrictionForm) return null;
    const toggleAllRestr = () => {
      setRestrictionForm((f) => {
        const nextAll = !f.allRoomsActive;
        return {
          ...f,
          allRoomsActive: nextAll,
          selectedRoomIds: nextAll ? activeRooms.map((r) => String(r.id)) : [],
        };
      });
    };
    const toggleRestrRoom = (id: string) => {
      setRestrictionForm((f) => {
        const ids = f.selectedRoomIds.includes(id)
          ? f.selectedRoomIds.filter((x) => x !== id)
          : [...f.selectedRoomIds, id];
        return {
          ...f,
          selectedRoomIds: ids,
          allRoomsActive: ids.length === activeRooms.length,
        };
      });
    };
    return (
      <>
        <div className="form-group">
          <label>Оберіть котеджі:</label>
          <div className="chips-container">
            <Chip active={restrictionForm.allRoomsActive} onClick={toggleAllRestr}>
              Усі котеджі
            </Chip>
            {activeRooms.map((r) => (
              <Chip
                key={r.id}
                className="restr-room-chip"
                active={restrictionForm.selectedRoomIds.includes(String(r.id))}
                onClick={() => toggleRestrRoom(String(r.id))}
              >
                {adminRoomLabel(r)}
              </Chip>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label>Мінімальна кількість діб:</label>
          <input
            type="number"
            value={restrictionForm.minNights}
            min={1}
            max={30}
            onChange={(e) =>
              setRestrictionForm((f) => ({
                ...f,
                minNights: parseInt(e.target.value, 10) || 2,
              }))
            }
          />
        </div>
        {!restrictionForm.useCustomRange && (
          <div className="form-group">
            <label>Оберіть період:</label>
            <div className="chips-container">
              {[
                ["1", "Поточний місяць"],
                ["3", "Наступні 3 місяці"],
                ["12", "Наступний рік (12 міс)"],
              ].map(([val, label]) => (
                <Chip
                  key={val}
                  className="restr-period-chip"
                  active={restrictionForm.periodMonths === val}
                  onClick={() => setRestrictionForm((f) => ({ ...f, periodMonths: val }))}
                >
                  {label}
                </Chip>
              ))}
            </div>
          </div>
        )}
        {restrictionForm.useCustomRange && (
          <div className="form-group">
            <label>Обраний діапазон на шахматці:</label>
            <p style={{ fontSize: 13, color: "#4B5563", margin: "8px 0 0", lineHeight: 1.5 }}>
              {restrictionForm.rangeLabel}
            </p>
          </div>
        )}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Оберіть дні тижня:</label>
          <div className="chips-container">
            {[
              ["all", "Усі дні"],
              ["weekdays", "Будні"],
              ["weekends", "Вихідні"],
            ].map(([val, label]) => (
              <Chip
                key={val}
                className="restr-day-chip"
                active={restrictionForm.dayType === val}
                onClick={() => setRestrictionForm((f) => ({ ...f, dayType: val }))}
              >
                {label}
              </Chip>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (type === "discount") {
    const toggleAllDisc = () => {
      setDiscountForm((f) => ({
        ...f,
        allSelected: !f.allSelected,
        selectedIds: !f.allSelected ? ["all"] : [],
      }));
    };
    const toggleDiscRoom = (id: string) => {
      setDiscountForm((f) => {
        if (f.allSelected) {
          return { ...f, allSelected: false, selectedIds: [id] };
        }
        const ids = f.selectedIds.includes(id)
          ? f.selectedIds.filter((x) => x !== id)
          : [...f.selectedIds, id];
        return { ...f, selectedIds: ids, allSelected: false };
      });
    };
    return (
      <>
        <div className="form-group">
          <label>Кількість діб від:</label>
          <input
            type="number"
            value={discountForm.days}
            min={1}
            onChange={(e) =>
              setDiscountForm((f) => ({ ...f, days: parseInt(e.target.value, 10) || 2 }))
            }
          />
        </div>
        <div className="form-group">
          <label>Знижка (%):</label>
          <input
            type="number"
            value={discountForm.percent}
            min={1}
            max={100}
            onChange={(e) =>
              setDiscountForm((f) => ({ ...f, percent: parseInt(e.target.value, 10) || 15 }))
            }
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Застосувати до котеджів:</label>
          <div className="chips-container">
            <Chip active={discountForm.allSelected} onClick={toggleAllDisc}>
              Усі котеджі
            </Chip>
            {rooms.map((r) => (
              <Chip
                key={r.id}
                className="disc-room-chip"
                active={
                  discountForm.allSelected || discountForm.selectedIds.includes(String(r.id))
                }
                onClick={() => toggleDiscRoom(String(r.id))}
              >
                {adminRoomLabel(r)}
              </Chip>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (type === "customService") {
    return (
      <>
        <div className="form-group">
          <label>Назва послуги:</label>
          <input
            type="text"
            value={customServiceForm.name}
            onChange={(e) => setCustomServiceForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Напр. Чан"
          />
        </div>
        <div className="form-group">
          <label>Ціна (грн):</label>
          <input
            type="number"
            value={customServiceForm.price}
            min={0}
            onChange={(e) => setCustomServiceForm((f) => ({ ...f, price: e.target.value }))}
          />
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label>Подобова:</label>
            <select
              value={customServiceForm.perDay}
              onChange={(e) => setCustomServiceForm((f) => ({ ...f, perDay: e.target.value }))}
            >
              <option value="Так">Так</option>
              <option value="Ні">Ні</option>
            </select>
          </div>
          <div className="form-group">
            <label>За гостя:</label>
            <select
              value={customServiceForm.perGuest}
              onChange={(e) => setCustomServiceForm((f) => ({ ...f, perGuest: e.target.value }))}
            >
              <option value="Так">Так</option>
              <option value="Ні">Ні</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Статус:</label>
          <select
            value={customServiceForm.active ? "true" : "false"}
            onChange={(e) =>
              setCustomServiceForm((f) => ({ ...f, active: e.target.value === "true" }))
            }
          >
            <option value="true">Активна</option>
            <option value="false">Не активна</option>
          </select>
        </div>
      </>
    );
  }

  if (type === "sysService") {
    return (
      <>
        <div className="form-group">
          <label>Назва послуги:</label>
          <input type="text" value={sysServiceForm.name} disabled style={{ background: "#E5E7EB" }} />
        </div>
        <div className="form-group">
          <label>Ціна (грн):</label>
          <input
            type="number"
            value={sysServiceForm.price}
            min={0}
            onChange={(e) => setSysServiceForm((f) => ({ ...f, price: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label>Статус:</label>
          <select
            value={sysServiceForm.active ? "true" : "false"}
            onChange={(e) =>
              setSysServiceForm((f) => ({ ...f, active: e.target.value === "true" }))
            }
          >
            <option value="true">Активна</option>
            <option value="false">Не активна</option>
          </select>
        </div>
      </>
    );
  }

  if (type === "transaction") {
    const incomeCats = buildIncomeCategories(settings.customServicesList);
    const cats = transactionForm.type === "income" ? incomeCats : EXPENSE_CATEGORIES;
    return (
      <>
        <div className="form-group">
          <label>Тип транзакції:</label>
          <div
            className="mode-toggle"
            style={{
              margin: 0,
              width: "100%",
              display: "flex",
              padding: 4,
              background: "#F3F4F6",
              borderRadius: 10,
              height: 42,
            }}
          >
            <button
              type="button"
              className={`mode-btn pet-btn ${transactionForm.type === "income" ? "active" : ""}`}
              style={{ color: "#059669" }}
              onClick={() =>
                setTransactionForm((f) => ({
                  ...f,
                  type: "income",
                  category: incomeCats[0],
                }))
              }
            >
              Дохід
            </button>
            <button
              type="button"
              className={`mode-btn pet-btn ${transactionForm.type === "expense" ? "active" : ""}`}
              style={{ color: "#DC2626" }}
              onClick={() =>
                setTransactionForm((f) => ({
                  ...f,
                  type: "expense",
                  category: EXPENSE_CATEGORIES[0],
                }))
              }
            >
              Витрата
            </button>
          </div>
        </div>
        <div className="form-group">
          <label>Категорія:</label>
          <select
            value={transactionForm.category}
            onChange={(e) => setTransactionForm((f) => ({ ...f, category: e.target.value }))}
          >
            {cats.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label>Сума (грн):</label>
            <input
              type="number"
              value={transactionForm.amount}
              min={1}
              required
              onChange={(e) => setTransactionForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Дата:</label>
            <input
              type="date"
              value={transactionForm.date}
              required
              onChange={(e) => setTransactionForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Коментар (необов&apos;язково):</label>
          <input
            type="text"
            value={transactionForm.comment}
            placeholder="Напр., закупка миючих засобів"
            onChange={(e) => setTransactionForm((f) => ({ ...f, comment: e.target.value }))}
          />
        </div>
      </>
    );
  }

  return null;
}

function RoomModalTabs({
  roomForm,
  setRoomForm,
  roomEditId,
  initialTab = "main",
  roomPhotosBusy,
  onRoomPhotosSelected,
}: {
  roomForm: RoomFormState;
  setRoomForm: Dispatch<SetStateAction<RoomFormState>>;
  roomEditId: number | null;
  initialTab?: "main" | "photos" | "rules" | "amenities";
  roomPhotosBusy: boolean;
  onRoomPhotosSelected?: (files: FileList) => void;
}) {
  const [tab, setTab] = useState<"main" | "photos" | "rules" | "amenities">(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab, roomEditId]);

  const tabs = useMemo(
    () => [
      { id: "main" as const, label: "Основне" },
      { id: "photos" as const, label: "Фотографії" },
      { id: "rules" as const, label: "Правила перебування" },
      { id: "amenities" as const, label: "Зручності" },
    ],
    []
  );

  const tabBtnStyle = (active: boolean) =>
    ({
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid #E5E7EB",
      background: active ? "#111827" : "#FFFFFF",
      color: active ? "#FFFFFF" : "#111827",
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
      whiteSpace: "nowrap",
    }) as const;

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 8,
          marginBottom: 12,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={tabBtnStyle(tab === t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "main" ? (
        <>
          <div className="form-group">
            <label>Назва житла на сайті:</label>
            <input
              type="text"
              value={roomForm.name}
              onChange={(e) => setRoomForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Напр. Будиночок біля озера"
            />
          </div>
          <div className="form-group">
            <label>Назва житла в шахматці:</label>
            <input
              type="text"
              value={roomForm.short}
              onChange={(e) => setRoomForm((f) => ({ ...f, short: e.target.value }))}
              placeholder="Напр. Будиночок 1"
            />
          </div>
          <div className="form-group">
            <label>Опис (Коротка назва):</label>
            <input
              type="text"
              value={roomForm.desc}
              onChange={(e) => setRoomForm((f) => ({ ...f, desc: e.target.value }))}
              placeholder="Напр. Стандарт"
            />
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Базова місткість (входить в ціну):</label>
              <input
                type="number"
                value={roomForm.capacity}
                min={1}
                onChange={(e) =>
                  setRoomForm((f) => ({ ...f, capacity: parseInt(e.target.value, 10) || 2 }))
                }
              />
            </div>
            <div className="form-group">
              <label>Максимальна місткість:</label>
              <input
                type="number"
                value={roomForm.maxCapacity}
                min={1}
                onChange={(e) =>
                  setRoomForm((f) => ({
                    ...f,
                    maxCapacity: parseInt(e.target.value, 10) || f.capacity,
                  }))
                }
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Ціна (будні), грн / ніч:</label>
              <input
                type="number"
                value={roomForm.priceWeekday}
                min={0}
                onChange={(e) =>
                  setRoomForm((f) => ({ ...f, priceWeekday: parseInt(e.target.value, 10) || 0 }))
                }
              />
            </div>
            <div className="form-group">
              <label>Ціна (вихідні), грн / ніч:</label>
              <input
                type="number"
                value={roomForm.priceWeekend}
                min={0}
                onChange={(e) =>
                  setRoomForm((f) => ({ ...f, priceWeekend: parseInt(e.target.value, 10) || 0 }))
                }
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Ціна за дод. гостя (грн):</label>
              <input
                type="number"
                value={roomForm.extraGuestPrice}
                min={0}
                onChange={(e) =>
                  setRoomForm((f) => ({ ...f, extraGuestPrice: parseInt(e.target.value, 10) || 0 }))
                }
              />
            </div>
            <div className="form-group">
              <label>Модель ціни:</label>
              <div className="mode-toggle" style={{ margin: 0, width: "100%" }}>
                <button
                  type="button"
                  className={`mode-btn${roomForm.pricingModel === "per_house" ? " active" : ""}`}
                  onClick={() => setRoomForm((f) => ({ ...f, pricingModel: "per_house" }))}
                >
                  За будинок
                </button>
                <button
                  type="button"
                  className={`mode-btn${roomForm.pricingModel === "per_guest" ? " active" : ""}`}
                  onClick={() => setRoomForm((f) => ({ ...f, pricingModel: "per_guest" }))}
                >
                  За гостя
                </button>
              </div>
            </div>
          </div>

          {roomForm.pricingModel === "per_guest" ? (
            <div className="form-group">
              <label>Ціна за 1 гостя / ніч (грн):</label>
              <input
                type="number"
                min={0}
                value={roomForm.pricePerGuest}
                onChange={(e) =>
                  setRoomForm((f) => ({ ...f, pricePerGuest: parseInt(e.target.value, 10) || 0 }))
                }
              />
            </div>
          ) : null}

          <label className="form-group" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={roomForm.allowChildren}
              onChange={(e) =>
                setRoomForm((f) => ({
                  ...f,
                  allowChildren: e.target.checked,
                  minChildAge: e.target.checked ? f.minChildAge : null,
                }))
              }
            />
            <span>Дозволити бронювання з дітьми</span>
          </label>

          {roomForm.allowChildren ? (
            <div className="form-group">
              <label>Мінімальний вік дитини (років):</label>
              <input
                type="number"
                min={0}
                max={17}
                value={roomForm.minChildAge ?? 0}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setRoomForm((f) => ({ ...f, minChildAge: 0 }));
                    return;
                  }
                  const n = Math.max(0, Math.min(17, parseInt(raw, 10) || 0));
                  setRoomForm((f) => ({ ...f, minChildAge: n }));
                }}
              />
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#78716c" }}>
                Наприклад, 10 — діти молодше не підійдуть. 0 — без обмеження по віку.
              </p>
            </div>
          ) : null}

          <div className="form-grid">
            <div className="form-group">
              <label>Доступність:</label>
              <div
                className="mode-toggle"
                style={{
                  margin: 0,
                  width: "100%",
                  display: "flex",
                  padding: 4,
                  background: "#F3F4F6",
                  borderRadius: 10,
                  height: 42,
                }}
              >
                <button
                  type="button"
                  className={`mode-btn room-status-btn ${roomForm.active ? "active" : ""}`}
                  onClick={() => setRoomForm((f) => ({ ...f, active: true }))}
                >
                  Увімкнено
                </button>
                <button
                  type="button"
                  className={`mode-btn room-status-btn ${!roomForm.active ? "active" : ""}`}
                  onClick={() => setRoomForm((f) => ({ ...f, active: false }))}
                >
                  Вимкнено
                </button>
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Розгорнутий опис:</label>
            <textarea
              value={roomForm.detailedDescription}
              onChange={(e) => setRoomForm((f) => ({ ...f, detailedDescription: e.target.value }))}
              placeholder="Опишіть котедж детально: планування, краєвиди, що включено, сценарії відпочинку..."
              style={{ minHeight: 140 }}
            />
          </div>
        </>
      ) : null}

      {tab === "photos" ? (
        <>
          {onRoomPhotosSelected ? (
            <RoomPhotosUpload
              photos={roomForm.photos}
              busy={roomPhotosBusy}
              roomId={roomEditId}
              onFilesSelected={onRoomPhotosSelected}
            />
          ) : null}
        </>
      ) : null}

      {tab === "rules" ? (
        <>
          <div className="form-grid">
            <div className="form-group">
              <label>Час заїзду:</label>
              <input
                type="time"
                value={roomForm.rules.checkInTime}
                onChange={(e) =>
                  setRoomForm((f) => ({ ...f, rules: { ...f.rules, checkInTime: e.target.value } }))
                }
              />
            </div>
            <div className="form-group">
              <label>Час виїзду:</label>
              <input
                type="time"
                value={roomForm.rules.checkOutTime}
                onChange={(e) =>
                  setRoomForm((f) => ({ ...f, rules: { ...f.rules, checkOutTime: e.target.value } }))
                }
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>Тварини:</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className={`chip-btn ${roomForm.rules.pets.isPetsFriendly ? "active" : ""}`}
                onClick={() =>
                  setRoomForm((f) => ({
                    ...f,
                    rules: {
                      ...f.rules,
                      pets: { ...f.rules.pets, isPetsFriendly: true },
                    },
                  }))
                }
              >
                Pets‑friendly
              </button>
              <button
                type="button"
                className={`chip-btn ${!roomForm.rules.pets.isPetsFriendly ? "active" : ""}`}
                onClick={() =>
                  setRoomForm((f) => ({
                    ...f,
                    rules: {
                      ...f.rules,
                      pets: { ...f.rules.pets, isPetsFriendly: false },
                    },
                  }))
                }
              >
                Без тварин
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Опис правил щодо тварин:</label>
            <input
              type="text"
              value={roomForm.rules.pets.description}
              onChange={(e) =>
                setRoomForm((f) => ({
                  ...f,
                  rules: { ...f.rules, pets: { ...f.rules.pets, description: e.target.value } },
                }))
              }
              placeholder="Напр. За узгодженням / +500 грн / лише маленькі породи..."
            />
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>Самостійне заселення:</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className={`chip-btn ${roomForm.rules.selfCheckIn.enabled ? "active" : ""}`}
                onClick={() =>
                  setRoomForm((f) => ({
                    ...f,
                    rules: {
                      ...f.rules,
                      selfCheckIn: { ...f.rules.selfCheckIn, enabled: true },
                    },
                  }))
                }
              >
                Так
              </button>
              <button
                type="button"
                className={`chip-btn ${!roomForm.rules.selfCheckIn.enabled ? "active" : ""}`}
                onClick={() =>
                  setRoomForm((f) => ({
                    ...f,
                    rules: {
                      ...f.rules,
                      selfCheckIn: { ...f.rules.selfCheckIn, enabled: false },
                    },
                  }))
                }
              >
                Ні
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Опис самостійного заселення:</label>
            <textarea
              value={roomForm.rules.selfCheckIn.description}
              onChange={(e) =>
                setRoomForm((f) => ({
                  ...f,
                  rules: {
                    ...f.rules,
                    selfCheckIn: { ...f.rules.selfCheckIn, description: e.target.value },
                  },
                }))
              }
              placeholder="Напр. Код від сейфу/замка, інструкція, де забрати ключ..."
              style={{ minHeight: 120 }}
            />
          </div>
        </>
      ) : null}

      {tab === "amenities" ? (
        <>
          {AMENITIES_CATEGORIES.map((cat) => (
            <div key={cat.id} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, margin: "6px 0 10px" }}>
                {cat.title}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {cat.items.map((it) => {
                  const current = (roomForm.amenities?.[cat.id] || []).find((x) => x.id === it.id);
                  const isActive = current?.isActive ?? false;
                  const isFeatured = current?.isFeatured ?? false;
                  const customText = current?.customText ?? "";

                  return (
                    <div
                      key={it.id}
                      style={{
                        border: "1px solid #E5E7EB",
                        borderRadius: 12,
                        padding: 12,
                        background: "#fff",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{it.label}</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            className={`chip-btn ${isActive ? "active" : ""}`}
                            onClick={() =>
                              setRoomForm((f) => ({
                                ...f,
                                amenities: updateAmenity(f.amenities, cat.id, it.id, {
                                  isActive: !isActive,
                                }),
                              }))
                            }
                          >
                            {isActive ? "Увімкнено" : "Вимкнено"}
                          </button>
                          <button
                            type="button"
                            className={`chip-btn ${isFeatured ? "active" : ""}`}
                            onClick={() =>
                              setRoomForm((f) => ({
                                ...f,
                                amenities: updateAmenity(f.amenities, cat.id, it.id, {
                                  isFeatured: !isFeatured,
                                }),
                              }))
                            }
                          >
                            Featured
                          </button>
                        </div>
                      </div>

                      <div style={{ marginTop: 10 }}>
                        <label style={{ fontSize: 11, fontWeight: 800, color: "#6B7280" }}>
                          Кастомний текст (опційно)
                        </label>
                        <input
                          type="text"
                          value={customText}
                          onChange={(e) =>
                            setRoomForm((f) => ({
                              ...f,
                              amenities: updateAmenity(f.amenities, cat.id, it.id, {
                                customText: e.target.value,
                              }),
                            }))
                          }
                          placeholder="Напр. Дрова включено / Безкоштовно / До 5 осіб..."
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      ) : null}
    </>
  );
}

function updateAmenity(
  amenities: RoomAmenitiesByCategory,
  categoryId: string,
  amenityId: string,
  patch: Partial<{ isActive: boolean; isFeatured: boolean; customText?: string }>
) {
  const next: RoomAmenitiesByCategory = { ...(amenities || (buildDefaultAmenitiesState() as any)) };
  const list = Array.isArray(next[categoryId]) ? [...next[categoryId]] : [];
  const idx = list.findIndex((x) => x.id === amenityId);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch };
  } else {
    list.push({
      id: amenityId,
      isActive: !!patch.isActive,
      isFeatured: !!patch.isFeatured,
      customText: patch.customText,
    });
  }
  next[categoryId] = list;
  return next;
}

export function genericModalTitle(type: GenericModalType, id: number | null): string {
  switch (type) {
    case "room":
      return id ? "Редагувати котедж" : "Додати котедж";
    case "price":
      return "Конструктор цін";
    case "restriction":
      return "Конструктор обмежень";
    case "discount":
      return id ? "Редагувати знижку" : "Додати знижку";
    case "customService":
      return id ? "Редагувати послугу" : "Додати послугу";
    case "sysService":
      return "Налаштування системної послуги";
    case "transaction":
      return id ? "Редагувати транзакцію" : "Нова транзакція";
    default:
      return "Налаштування";
  }
}
