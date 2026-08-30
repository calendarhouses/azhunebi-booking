/** Типи адмін-панелі (відповідність API + legacy JS) */

export type AdminViewName = "list" | "grid" | "guests" | "reports" | "settings";

export type SettingsTabName =
  | "branding"
  | "rooms"
  | "prices"
  | "discounts"
  | "restrictions"
  | "services"
  | "payment"
  | "sms"
  | "team"
  | "activity";

export type RoomPricingModel = "per_house" | "per_guest";

export type RoomRules = {
  checkInTime: string;
  checkOutTime: string;
  pets: {
    isPetsFriendly: boolean;
    description: string;
  };
  selfCheckIn: {
    enabled: boolean;
    description: string;
  };
};

export type RoomAmenityItem = {
  /** id із нашого словника */
  id: string;
  isActive: boolean;
  customText?: string;
  isFeatured: boolean;
};

/** Головні фішки на публічній картці житла (до 3 рядків) */
export type RoomSiteHighlight = {
  iconId: string;
  text: string;
};

export type RoomAmenitiesByCategory = Record<string, RoomAmenityItem[]>;

/** Доступність житла в таблиці налаштувань (швидке редагування + бейдж) */
export type RoomAvailabilityStatus = "enabled" | "disabled" | "maintenance";

export interface RoomConfig {
  id: number;
  /** Публічна назва на сайті */
  name: string;
  /** Назва в шахматці / адмінці */
  short: string;
  desc: string;
  capacity: number;
  maxCapacity?: number;
  extraGuestPrice?: number;
  /** Режим нарахування за додаткового гостя: за ніч (default) або за весь період */
  extraGuestFeeMode?: "per_night" | "per_stay";
  /** Категорія житла (глемпи, намети…) — id з roomCategoriesList */
  categoryId?: string | null;
  /** Модель ціноутворення: за будинок (default) або за гостя */
  pricingModel?: RoomPricingModel;
  /** Ціна за 1 гостя за ніч (для per_guest); якщо не задано — priceWeekday/weekend */
  pricePerGuest?: number;
  /**
   * Ціна за 1 гостя при броні на 1 ніч (per_guest).
   * 0 / не задано — як pricePerGuest (або денний тариф).
   */
  pricePerGuestOneNight?: number;
  /** Чи дозволені діти при бронюванні */
  allowChildren?: boolean;
  /** Мінімальний вік дитини (років). Ігнорується, якщо allowChildren === false */
  minChildAge?: number | null;
  /** Базова ціна за ніч при броні на 2+ ночі (дні поза weekendDays) */
  priceWeekday: number;
  /** Базова ціна за ніч при броні на 2+ ночі (дні з weekendDays) */
  priceWeekend: number;
  /**
   * Дні тижня з «вихідним» тарифом (`Date.getDay()`: 0=Нд…6=Сб).
   * Якщо не задано — пт+сб+нд (як раніше).
   */
  weekendDays?: number[];
  /**
   * Ціна за бронь на 1 ніч (звичайні дні). 0 / не задано — як priceWeekday.
   * На сітці/календарі показується базова; у калькуляторі при nights===1 підставляється ця.
   */
  priceOneNightWeekday?: number;
  /** Ціна за бронь на 1 ніч (дні з weekendDays). 0 / не задано — як priceWeekend. */
  priceOneNightWeekend?: number;
  active: boolean;
  /** Статус доступності; якщо відсутній — виводиться з `active` */
  availabilityStatus?: RoomAvailabilityStatus;
  /** Публічні URL фото (Google Drive / GAS storage) */
  photos?: string[];
  /** Розгорнутий опис для сторінки/бота */
  detailedDescription?: string;
  /** Правила перебування */
  rules?: RoomRules;
  /** Зручності по категоріях */
  amenities?: RoomAmenitiesByCategory;
  /** До 3 фішок для блоку premium-features на сайті */
  siteHighlights?: RoomSiteHighlight[];
}

export type RoomCategory = {
  id: string;
  name: string;
  /** Порядок на сайті та в шахматці */
  sort?: number;
  /** Прихована категорія не показується гостям */
  hidden?: boolean;
};

export type DiscountKind =
  | "long_stay"
  | "early_booking"
  | "last_minute"
  | "promo_code"
  | "ubd";

export interface DiscountConfig {
  id: number;
  /** Відображувана назва знижки */
  name?: string;
  kind?: DiscountKind;
  /** Увімкнено / вимкнено */
  active?: boolean;
  condition: string;
  discount: string;
  rooms: string;
  roomsIds?: string[];
  minNights?: number;
  daysBefore?: number;
  promoCode?: string;
  valueType?: "percent" | "amount";
  value?: number;
  /** Категорія для спецтарифів */
  guestCategory?: "ubd" | "birthday" | "anniversary" | "other";
  /** Період дії */
  periodMode?: "always" | "range";
  periodStart?: string;
  periodEnd?: string;
}

export type ServiceInputType = "toggle" | "counter";

export interface CustomServiceConfig {
  id: number;
  name: string;
  rooms: string;
  roomIds?: number[];
  price: number;
  perDay: string;
  perGuest: string;
  /** Погодинна оплата (кількість = години) */
  perHour?: string;
  /** Одноразово за бронь (можна комбінувати з perDay / perGuest) */
  perBooking?: string;
  active: boolean;
  /** Підказка для гостя на сайті та в броні */
  description?: string;
  /** Оплата на місці — не входить у онлайн-розрахунок */
  onSite?: boolean;
  /** toggle = Так/Ні; counter = кількість */
  inputType?: ServiceInputType;
  /** Макс. кількість для counter (default 10) */
  maxQuantity?: number;
  /** Потрібне підтвердження адміністратора — сума не в загальній ціні одразу */
  requiresApproval?: boolean;
}

export interface SysServiceConfig {
  id: number;
  name: string;
  rooms: string;
  price: number;
  active: boolean;
}

export interface TransactionConfig {
  id: number;
  type: "income" | "expense";
  category: string;
  amount: number;
  date: string;
  comment?: string;
}

export interface BookingPayment {
  id: string;
  date: string;
  amount: number;
  method: string;
  type: string;
  note?: string;
}

export interface BookingRecord {
  row: number | string;
  id: string;
  /** Стабільний id житла з tenant_settings.roomsList — не змінюється при перейменуванні */
  roomId?: number | string;
  assignmentState?: "assigned" | "holding";
  checkIn: string;
  checkOut: string;
  cottage: string;
  status: string;
  name: string;
  phone: string;
  guests?: number;
  pets?: string | boolean;
  totalPrice?: number | string;
  paidAmount?: number | string;
  source?: string;
  comment?: string;
  extraGuestFee?: number | string;
  petFee?: number | string;
  dayGuestFee?: number | string;
  earlyFee?: number | string;
  lateFee?: number | string;
  basePrice?: number | string;
  discountAmount?: number | string;
  /** Quick manual adjust only (not catalog auto). Absent on legacy rows. */
  manualDiscountAmount?: number | string;
  prepayAmount?: number | string;
  surchargeAmount?: number | string;
  prepayMethod?: string;
  surchargeMethod?: string;
  payments?: BookingPayment[];
  createdAt?: string;
  /** Ручний колір картки на шаховатці (#RRGGBB). Порожній = авто за статусом. */
  custom_color?: string | null;
  [key: string]: unknown;
}

export interface AdminSettingsPayload {
  roomsList?: RoomConfig[];
  roomCategoriesList?: RoomCategory[];
  discountsList?: DiscountConfig[];
  customServicesList?: CustomServiceConfig[];
  sysServicesList?: SysServiceConfig[];
  customPrices?: Record<string, Record<string, number>>;
  restrictions?: Record<string, Record<string, number>>;
  closedDates?: Record<string, Record<string, true>>;
  transactions?: TransactionConfig[];
  branding?: Record<string, unknown>;
  flexibleScheduleSettings?: import("@/lib/admin/flexibleSchedule").FlexibleScheduleSettings;
  icalSyncSettings?: import("@/lib/ical").IcalSyncSettings;
  smsSettings?: import("@/lib/sms/smsSettings").SmsSettings;
  /** Online payment (Mono) — public/admin shape never includes raw token */
  paymentSettings?: import("@/lib/payment/paymentSettings").PaymentSettingsPublic;
  /** message_id map for today's arrival/departure/cleaning Telegram messages */
  telegramTurnoversState?: Record<string, unknown>;
}

export interface AdminInitResponse {
  settings: AdminSettingsPayload;
  bookings: BookingRecord[];
}

export const BASE_INCOME_CATEGORIES = [
  "Плата за раннє заселення/пізнє виселення",
  "Додаткові гості",
  "Домашні тварини",
  "Міні-бар",
  "Інший дохід",
] as const;

/** @deprecated використай buildIncomeCategories(customServicesList) */
export const INCOME_CATEGORIES = [
  ...BASE_INCOME_CATEGORIES.slice(0, 4),
  "Чан",
  "Оренда велосипедів",
  "Інший дохід",
];

export function buildIncomeCategories(
  customServicesList?: Array<{ name?: string }> | null
): string[] {
  const fromServices = (customServicesList || [])
    .map((s) => String(s.name || "").trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [...BASE_INCOME_CATEGORIES, ...fromServices]) {
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export const EXPENSE_CATEGORIES = [
  "Прибирання",
  "Прасування",
  "Користування електроенергією",
  "Утримання прилеглої території",
  "Розхідні матеріали",
  "Реклама",
  "Адміністрування та SMM",
  "Податки",
  "Інші витрати",
];
