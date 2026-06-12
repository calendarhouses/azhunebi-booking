/** Типи адмін-панелі (відповідність API + legacy JS) */

export type AdminViewName = "list" | "grid" | "guests" | "reports" | "settings";

export type SettingsTabName =
  | "branding"
  | "rooms"
  | "prices"
  | "discounts"
  | "restrictions";

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
  name: string;
  short: string;
  desc: string;
  capacity: number;
  maxCapacity?: number;
  extraGuestPrice?: number;
  priceWeekday: number;
  priceWeekend: number;
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

export interface CustomServiceConfig {
  id: number;
  name: string;
  rooms: string;
  price: number;
  perDay: string;
  perGuest: string;
  active: boolean;
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
  prepayAmount?: number | string;
  surchargeAmount?: number | string;
  prepayMethod?: string;
  surchargeMethod?: string;
  payments?: BookingPayment[];
  createdAt?: string;
  [key: string]: unknown;
}

export interface AdminSettingsPayload {
  roomsList?: RoomConfig[];
  discountsList?: DiscountConfig[];
  customServicesList?: CustomServiceConfig[];
  sysServicesList?: SysServiceConfig[];
  customPrices?: Record<string, Record<string, number>>;
  restrictions?: Record<string, Record<string, number>>;
  transactions?: TransactionConfig[];
  branding?: Record<string, unknown>;
}

export interface AdminInitResponse {
  settings: AdminSettingsPayload;
  bookings: BookingRecord[];
}

export const INCOME_CATEGORIES = [
  "Плата за раннє заселення/пізнє виселення",
  "Додаткові гості",
  "Домашні тварини",
  "Міні-бар",
  "Чан",
  "Оренда велосипедів",
  "Інший дохід",
];

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
