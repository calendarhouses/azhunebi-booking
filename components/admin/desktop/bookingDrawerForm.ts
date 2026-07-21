/** Стан форми drawer (React), без читання DOM під час рендеру. */

import type { ServiceSelectionMap } from "./settings/additionalServicesLogic";

export type YesNo = "Так" | "Ні";
export type { ServiceSelectionMap };

export type BookingDrawerFormState = {
  name: string;
  phone: string;
  source: string;
  comment: string;
  cottage: string;
  cottageLabel: string;
  roomId: number | string | null;
  checkIn: string;
  checkOut: string;
  guests: number;
  children: number;
  /** Вік наймолодшої дитини (років), якщо children > 0 */
  youngestChildAge: number;
  /** @deprecated legacy — лишається для зворотної сумісності при парсингу */
  pets: YesNo;
  /** @deprecated legacy */
  dayGuests: number;
  /** @deprecated legacy */
  vat: YesNo;
  selectedServices: ServiceSelectionMap;
  /** id спецтарифу → Так/Ні */
  specialTariffs: Record<string, YesNo>;
  promoCode: string;
  status: string;
  earlyCardActive: boolean;
  lateCardActive: boolean;
  /** Ручний колір шахматки (#RRGGBB) або "" */
  customColor: string;
};

export type SchedulePriceLabels = {
  early: string;
  late: string;
};

export function defaultBookingDrawerForm(): BookingDrawerFormState {
  return {
    name: "",
    phone: "",
    source: "Адмінка",
    comment: "",
    cottage: "",
    cottageLabel: "Оберіть котедж",
    roomId: null,
    checkIn: "",
    checkOut: "",
    guests: 2,
    children: 0,
    youngestChildAge: 5,
    pets: "Ні",
    dayGuests: 0,
    vat: "Ні",
    selectedServices: {},
    specialTariffs: {},
    promoCode: "",
    status: "Очікує оплату",
    earlyCardActive: false,
    lateCardActive: false,
    customColor: "",
  };
}

export function getRoomMaxCapacity(
  roomName: string,
  roomsList: { id?: number | string; name: string; maxCapacity?: number; capacity?: number }[],
  roomId?: number | string | null
): number {
  const room =
    (roomId != null && roomId !== ""
      ? roomsList.find((r) => String(r.id) === String(roomId))
      : undefined) || roomsList.find((r) => r.name === roomName);
  return room ? room.maxCapacity || room.capacity || 10 : 10;
}

export function clampOccupantsForRoom(
  adults: number,
  children: number,
  roomName: string,
  roomsList: { id?: number | string; name: string; maxCapacity?: number; capacity?: number }[],
  roomId?: number | string | null
): { adults: number; children: number } {
  const maxCap = getRoomMaxCapacity(roomName, roomsList, roomId);
  let nextAdults = Math.max(1, adults);
  let nextChildren = Math.max(0, children);
  if (nextAdults + nextChildren > maxCap) {
    nextChildren = Math.max(0, maxCap - nextAdults);
    if (nextAdults + nextChildren > maxCap) {
      nextAdults = Math.max(1, maxCap - nextChildren);
    }
  }
  return { adults: nextAdults, children: nextChildren };
}

export function clampGuestsForRoom(
  guests: number,
  roomName: string,
  roomsList: { name: string; maxCapacity?: number; capacity?: number }[]
): { guests: number; clamped: boolean; maxCap: number } {
  const room = roomsList.find((r) => r.name === roomName);
  const maxCap = room ? room.maxCapacity || room.capacity || 10 : 10;
  if (guests > maxCap) {
    return { guests: maxCap, clamped: true, maxCap };
  }
  return { guests: Math.max(1, guests), clamped: false, maxCap };
}

/** Поля форми, потрібні калькулятору ціни */
export type BookingPriceFormInput = Pick<
  BookingDrawerFormState,
  | "checkIn"
  | "checkOut"
  | "cottage"
  | "guests"
  | "children"
  | "pets"
  | "dayGuests"
  | "vat"
  | "selectedServices"
  | "specialTariffs"
  | "promoCode"
>;

export function pickPriceFormInput(form: BookingDrawerFormState): BookingPriceFormInput {
  return {
    checkIn: form.checkIn,
    checkOut: form.checkOut,
    cottage: form.cottage,
    guests: form.guests,
    children: form.children,
    pets: form.pets,
    dayGuests: form.dayGuests,
    vat: form.vat,
    selectedServices: form.selectedServices,
    specialTariffs: form.specialTariffs,
    promoCode: form.promoCode,
  };
}
