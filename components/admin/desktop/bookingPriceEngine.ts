import { parseSafeDate } from "./adminDates";
import { nightWord } from "./adminPlural";
import { bookingHasEarlyLate } from "./bookingUtils";
import type {
  AdminSettingsPayload,
  BookingRecord,
  DiscountConfig,
  RoomConfig,
} from "./types";

export type ManualPriceSnapshot = {
  base: number | null;
  extra: number | null;
  pet: number | null;
  dayGuest: number | null;
  early: number | null;
  late: number | null;
  discount: number | null;
  discountEdited: boolean;
};

export type FormStateSnapshot = {
  checkIn: string;
  checkOut: string;
  cottage: string;
  guests: number;
  pets: string;
  dayGuests: number;
  early: string | null;
  late: string | null;
};

export function getDayPrice(
  room: RoomConfig,
  dateObj: Date,
  customPrices: AdminSettingsPayload["customPrices"]
): number {
  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
  let price = isWeekend ? room.priceWeekend : room.priceWeekday;
  const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;
  const roomPrices = customPrices?.[room.id] || customPrices?.[String(room.id)];
  if (roomPrices?.[dateStr]) price = roomPrices[dateStr];
  return price;
}

export function getRestrictionMinNights(
  restrictions: AdminSettingsPayload["restrictions"],
  roomId: number | string,
  dateObj: Date
): number {
  const ds = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;
  const rid = String(roomId);
  const map = restrictions || {};
  if (map[roomId as string]?.[ds]) return Number(map[roomId as string][ds]) || 0;
  if (map[rid]?.[ds]) return Number(map[rid][ds]) || 0;
  return 0;
}

export function getBookingMinNightsRequired(
  room: RoomConfig,
  checkIn: Date,
  checkOut: Date,
  restrictions: AdminSettingsPayload["restrictions"]
): number {
  let maxMin = 0;
  const d = new Date(checkIn);
  d.setHours(0, 0, 0, 0);
  const end = new Date(checkOut);
  end.setHours(0, 0, 0, 0);
  while (d < end) {
    const m = getRestrictionMinNights(restrictions, room.id, d);
    if (m > maxMin) maxMin = m;
    d.setDate(d.getDate() + 1);
  }
  return maxMin;
}

export function parseFormDates(checkInStr: string, checkOutStr: string): { d1: Date; d2: Date; nights: number } {
  const safeIn = checkInStr.includes(".") ? checkInStr.split(".").reverse().join("-") : checkInStr;
  const safeOut = checkOutStr.includes(".") ? checkOutStr.split(".").reverse().join("-") : checkOutStr;
  const d1 = new Date(safeIn);
  const d2 = new Date(safeOut);
  let nights = Math.round((d2.getTime() - d1.getTime()) / 86400000);
  if (nights < 1 || Number.isNaN(nights)) nights = 1;
  return { d1, d2, nights };
}

export function checkBookingOverlap(params: {
  roomName: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  selectedEarlyTime: string | null;
  selectedLateTime: string | null;
  allBookings: BookingRecord[];
  editingRow: number | string | null;
  editingId?: string | null;
}): { isOverlap: boolean; overlapReason: string } {
  const {
    roomName,
    checkIn,
    checkOut,
    selectedEarlyTime,
    selectedLateTime,
    allBookings,
    editingRow,
    editingId,
  } =
    params;

  const currentIn = new Date(checkIn);
  currentIn.setHours(0, 0, 0, 0);
  const currentOut = new Date(checkOut);
  currentOut.setHours(0, 0, 0, 0);

  const currentHasEarly = !!selectedEarlyTime;
  const currentHasLate = !!selectedLateTime;

  for (const b of allBookings) {
    if (editingId && String(b.id) === String(editingId)) continue;
    if (editingRow != null && String(b.row) === String(editingRow)) continue;
    if (String(b.status).toLowerCase().includes("скас")) continue;
    if (b.cottage !== roomName) continue;

    const exIn = parseSafeDate(b.checkIn);
    exIn.setHours(0, 0, 0, 0);
    const exOut = parseSafeDate(b.checkOut);
    exOut.setHours(0, 0, 0, 0);

    const comment = b.comment ? String(b.comment) : "";
    const { hasEarly: exHasEarly, hasLate: exHasLate } = bookingHasEarlyLate(comment);

    if (currentIn < exOut && currentOut > exIn) {
      return { isOverlap: true, overlapReason: "Ці дати вже повністю зайняті іншим гостем." };
    }
    if (currentIn.getTime() === exOut.getTime()) {
      if (exHasLate) {
        return {
          isOverlap: true,
          overlapReason:
            "Попередній гість має <b>Пізній виїзд</b>. Заселення в цей день неможливе.",
        };
      }
      if (currentHasEarly) {
        return {
          isOverlap: true,
          overlapReason: "Попередній гість ще не виїхав. Ваш <b>Ранній заїзд</b> неможливий.",
        };
      }
    }
    if (currentOut.getTime() === exIn.getTime()) {
      if (currentHasLate) {
        return {
          isOverlap: true,
          overlapReason: "Наступний гість вже заїжджає. Ваш <b>Пізній виїзд</b> неможливий.",
        };
      }
      if (exHasEarly) {
        return {
          isOverlap: true,
          overlapReason: "Наступний гість має <b>Ранній заїзд</b>.",
        };
      }
    }
  }
  return { isOverlap: false, overlapReason: "" };
}

function resolveDiscountPercent(
  nights: number,
  room: RoomConfig,
  discountsList: DiscountConfig[],
  isUbd: boolean
): number {
  const currentRoomId = String(room.id);
  let discountPercent = 0;
  for (const d of discountsList) {
    if (d.active === false) continue;
    const condNights = parseInt(String(d.condition).replace(/\D/g, ""), 10) || 0;
    const dPct = parseInt(String(d.discount).replace(/\D/g, ""), 10) / 100;
    if (nights < condNights) continue;
    const appliesToRoom =
      (d.roomsIds && (d.roomsIds.includes("all") || d.roomsIds.includes(currentRoomId))) ||
      (!d.roomsIds && String(d.rooms).includes("Всі"));
    if (appliesToRoom && dPct > discountPercent) discountPercent = dPct;
  }
  if (isUbd) discountPercent += 0.1;
  return discountPercent;
}

export type BookingPriceResult = {
  empty: boolean;
  isOverlap: boolean;
  overlapReason: string;
  nights: number;
  restrViolation: boolean;
  requiredMinNights: number;
  restrWarningHtml: string;
  basePriceTotal: number;
  extraGuestFee: number;
  petFee: number;
  dayGuestFee: number;
  earlyFee: number;
  lateFee: number;
  early50: number;
  late50: number;
  discountPercent: number;
  discountAmount: number;
  totalPrice: number;
  isVat: boolean;
  selectedEarlyTime: string | null;
  selectedLateTime: string | null;
};

export function computeBookingPrice(params: {
  checkInStr: string;
  checkOutStr: string;
  roomName: string;
  guests: number;
  pets: string;
  dayGuests: number;
  isVat: boolean;
  isUbd: boolean;
  selectedEarlyTime: string | null;
  selectedLateTime: string | null;
  room: RoomConfig | undefined;
  settings: AdminSettingsPayload;
  allBookings: BookingRecord[];
  editingRow: number | string | null;
  editingId?: string | null;
  isInitialLoad: boolean;
  manual: ManualPriceSnapshot;
  prevForm: FormStateSnapshot | null;
  savedBooking?: BookingRecord | null;
}): BookingPriceResult {
  const emptyResult: BookingPriceResult = {
    empty: true,
    isOverlap: false,
    overlapReason: "",
    nights: 0,
    restrViolation: false,
    requiredMinNights: 0,
    restrWarningHtml: "",
    basePriceTotal: 0,
    extraGuestFee: 0,
    petFee: 0,
    dayGuestFee: 0,
    earlyFee: 0,
    lateFee: 0,
    early50: 0,
    late50: 0,
    discountPercent: 0,
    discountAmount: 0,
    totalPrice: 0,
    isVat: false,
    selectedEarlyTime: params.selectedEarlyTime,
    selectedLateTime: params.selectedLateTime,
  };

  if (!params.checkInStr || !params.checkOutStr || !params.roomName || !params.room) {
    return emptyResult;
  }

  const { d1, d2, nights } = parseFormDates(params.checkInStr, params.checkOutStr);
  const room = params.room;
  const customPrices = params.settings.customPrices || {};
  const restrictions = params.settings.restrictions || {};
  const discountsList = params.settings.discountsList || [];

  const overlap = checkBookingOverlap({
    roomName: params.roomName,
    checkIn: d1,
    checkOut: d2,
    nights,
    selectedEarlyTime: params.selectedEarlyTime,
    selectedLateTime: params.selectedLateTime,
    allBookings: params.allBookings,
    editingRow: params.editingRow,
    editingId: params.editingId,
  });

  if (overlap.isOverlap) {
    return { ...emptyResult, empty: false, isOverlap: true, overlapReason: overlap.overlapReason, nights };
  }

  const requiredMinNights = getBookingMinNightsRequired(room, d1, d2, restrictions);
  const restrViolation = requiredMinNights > 0 && nights < requiredMinNights;
  const restrWarningHtml = restrViolation
    ? `<div style="background:#FFFBEB; border:1px solid #FCD34D; border-radius:10px; padding:12px 14px; margin-bottom:16px; font-size:13px; color:#92400E; line-height:1.45;"><strong>Обмеження для гостей на сайті:</strong> мінімум <b>${requiredMinNights}</b> ${nightWord(requiredMinNights)} (зараз ${nights} ${nightWord(nights)}). У адмінці зберегти можна.</div>`
    : "";

  let basePriceTotal = 0;
  for (let i = 0; i < nights; i++) {
    const curr = new Date(d1);
    curr.setDate(curr.getDate() + i);
    basePriceTotal += getDayPrice(room, curr, customPrices);
  }

  let guests = params.guests;
  const maxCap = room.maxCapacity || room.capacity || 10;
  if (guests > maxCap) guests = maxCap;

  const extraGuests = Math.max(0, guests - room.capacity);
  const dynamicExtraPrice = room.extraGuestPrice !== undefined ? room.extraGuestPrice : 2500;
  let extraGuestFee = extraGuests * dynamicExtraPrice * nights;
  let petFee = params.pets === "Так" ? 500 + 200 * nights : 0;
  let dayGuestFee = params.dayGuests * 500;

  const early50 = Math.round(getDayPrice(room, d1, customPrices) * 0.5);
  const late50 = Math.round(getDayPrice(room, d2, customPrices) * 0.5);
  let earlyFee = params.selectedEarlyTime ? early50 : 0;
  let lateFee = params.selectedLateTime ? late50 : 0;

  const currState: FormStateSnapshot = {
    checkIn: params.checkInStr,
    checkOut: params.checkOutStr,
    cottage: params.roomName,
    guests,
    pets: params.pets,
    dayGuests: params.dayGuests,
    early: params.selectedEarlyTime,
    late: params.selectedLateTime,
  };

  let isDiscEdited = params.manual.discountEdited;
  const man = params.manual;

  if (!params.isInitialLoad && params.prevForm) {
    const isDatesChanged =
      params.prevForm.checkIn !== currState.checkIn ||
      params.prevForm.checkOut !== currState.checkOut ||
      params.prevForm.cottage !== currState.cottage;

    if (!isDatesChanged) {
      if (man.base !== null) basePriceTotal = man.base;
      if (params.prevForm.guests === currState.guests && man.extra !== null) extraGuestFee = man.extra;
      if (params.prevForm.pets === currState.pets && man.pet !== null) petFee = man.pet;
      if (params.prevForm.dayGuests === currState.dayGuests && man.dayGuest !== null) dayGuestFee = man.dayGuest;
      if (params.prevForm.early === currState.early && man.early !== null) earlyFee = man.early;
      if (params.prevForm.late === currState.late && man.late !== null) lateFee = man.late;
    } else {
      isDiscEdited = false;
    }
  }

  if (params.isInitialLoad && params.savedBooking) {
    const b = params.savedBooking;
    if (b.basePrice !== undefined && b.basePrice !== "") basePriceTotal = Number(b.basePrice);
    if (b.extraGuestFee !== undefined && b.extraGuestFee !== "") extraGuestFee = Number(b.extraGuestFee);
    if (b.petFee !== undefined && b.petFee !== "") petFee = Number(b.petFee);
    if (b.dayGuestFee !== undefined && b.dayGuestFee !== "") dayGuestFee = Number(b.dayGuestFee);
    if (b.earlyFee !== undefined && b.earlyFee !== "") earlyFee = Number(b.earlyFee);
    if (b.lateFee !== undefined && b.lateFee !== "") lateFee = Number(b.lateFee);
  }

  const discountPercent = resolveDiscountPercent(nights, room, discountsList, params.isUbd);
  const amountToDiscount = basePriceTotal + extraGuestFee;
  let discountAmount = 0;
  if (isDiscEdited && man.discount !== null) {
    discountAmount = man.discount;
  } else {
    discountAmount = Math.round(amountToDiscount * discountPercent);
  }

  let totalPrice =
    amountToDiscount - discountAmount + petFee + dayGuestFee + earlyFee + lateFee;

  if (params.isInitialLoad && params.savedBooking?.totalPrice != null && params.savedBooking.totalPrice !== "") {
    totalPrice = Number(params.savedBooking.totalPrice);
    discountAmount =
      basePriceTotal + extraGuestFee + petFee + dayGuestFee + earlyFee + lateFee - totalPrice;
    if (discountAmount < 0) discountAmount = 0;
  }

  return {
    empty: false,
    isOverlap: false,
    overlapReason: "",
    nights,
    restrViolation,
    requiredMinNights,
    restrWarningHtml,
    basePriceTotal,
    extraGuestFee,
    petFee,
    dayGuestFee,
    earlyFee,
    lateFee,
    early50,
    late50,
    discountPercent,
    discountAmount,
    totalPrice,
    isVat: params.isVat,
    selectedEarlyTime: params.selectedEarlyTime,
    selectedLateTime: params.selectedLateTime,
  };
}

export function recalculateTotalFromManualLines(params: {
  base: number;
  extra: number;
  pet: number;
  dayGuest: number;
  early: number;
  late: number;
  discountPercent: number;
  manualDiscount: number | null;
  discountEdited: boolean;
}): { discount: number; total: number; discountEdited: boolean } {
  const discountEdited = params.discountEdited;
  let discount = 0;
  if (discountEdited && params.manualDiscount !== null) {
    discount = params.manualDiscount;
  } else {
    discount = Math.round((params.base + params.extra) * params.discountPercent);
  }
  let total = params.base + params.extra + params.pet + params.dayGuest + params.early + params.late - discount;
  if (total < 0) total = 0;
  return { discount, total, discountEdited };
}
