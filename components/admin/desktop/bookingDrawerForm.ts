/** Стан форми drawer (React), без читання DOM під час рендеру. */

export type YesNo = "Так" | "Ні";

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
  pets: YesNo;
  dayGuests: number;
  vat: YesNo;
  /** id спецтарифу → Так/Ні */
  specialTariffs: Record<string, YesNo>;
  status: string;
  earlyCardActive: boolean;
  lateCardActive: boolean;
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
    pets: "Ні",
    dayGuests: 0,
    vat: "Ні",
    specialTariffs: {},
    status: "Нова бронь",
    earlyCardActive: false,
    lateCardActive: false,
  };
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
  "checkIn" | "checkOut" | "cottage" | "guests" | "pets" | "dayGuests" | "vat" | "specialTariffs"
>;

export function pickPriceFormInput(form: BookingDrawerFormState): BookingPriceFormInput {
  return {
    checkIn: form.checkIn,
    checkOut: form.checkOut,
    cottage: form.cottage,
    guests: form.guests,
    pets: form.pets,
    dayGuests: form.dayGuests,
    vat: form.vat,
    specialTariffs: form.specialTariffs,
  };
}
