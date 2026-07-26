import type {
  AdminSettingsPayload,
  BookingRecord,
  CustomServiceConfig,
  DiscountKind,
  RoomAmenitiesByCategory,
  RoomRules,
  RoomSiteHighlight,
  SysServiceConfig,
} from "@/components/admin/desktop/types";

export interface PublicRoom {
  id: number;
  name: string;
  short: string;
  desc: string;
  capacity: number;
  maxCapacity?: number;
  extraGuestPrice?: number;
  pricingModel?: "per_house" | "per_guest";
  pricePerGuest?: number;
  allowChildren?: boolean;
  /** Мінімальний вік дитини (років). Ігнорується, якщо allowChildren === false */
  minChildAge?: number | null;
  priceWeekday: number;
  priceWeekend: number;
  active: boolean;
  photos?: string[];
  detailedDescription?: string;
  rules?: RoomRules;
  amenities?: RoomAmenitiesByCategory;
  siteHighlights?: RoomSiteHighlight[];
}

export interface PublicDiscount {
  id: number;
  condition: string;
  discount: string;
  rooms?: string;
  roomsIds?: string[];
  active?: boolean;
  promoCode?: string;
  minNights?: number;
  daysBefore?: number;
  name?: string;
  kind?: DiscountKind;
  guestCategory?: "ubd" | "birthday" | "anniversary" | "other";
}

export interface PublicBranding {
  primary_color?: string;
  site_title?: string;
  site_description?: string;
  contact_phone?: string;
  contact_email?: string;
  logo_url?: string;
  hero_image_url?: string;
  intro_logo_text?: string;
  telegram_url?: string;
  maps_embed_url?: string;
  maps_external_url?: string;
  /** percent | nights | fixed */
  prepayment_mode?: "percent" | "nights" | "fixed";
  /** 50 = 50%, 1 = одна ніч, 5000 = фіксована сума */
  prepayment_value?: number;
  /** Сторінка правил перед підтвердженням броні */
  stay_rules?: import("./stayRules").StayRulesContent;
  [key: string]: unknown;
}

export interface PublicTenantPayload {
  tenantId: string;
  tenantName: string;
  subdomain: string;
  branding: PublicBranding;
  rooms: PublicRoom[];
  discounts: PublicDiscount[];
  customPrices: Record<string, Record<string, number>>;
}

export interface PublicSiteRuntime extends PublicTenantPayload {
  bookings: BookingRecord[];
  restrictions: AdminSettingsPayload["restrictions"];
  closedDates: AdminSettingsPayload["closedDates"];
  sysServicesList: SysServiceConfig[];
  customServicesList: CustomServiceConfig[];
  flexibleScheduleSettings?: AdminSettingsPayload["flexibleScheduleSettings"];
}

export type BookedRange = {
  start: Date;
  end: Date;
  hasEarly: boolean;
  hasLate: boolean;
  /** Parsed late checkout time when hasLate (e.g. "20:00"). */
  lateTime?: string | null;
};

export type PublicServiceLine = {
  id: number;
  name: string;
  fee: number;
  quantity?: number;
  quotedFee?: number;
  onSite?: boolean;
  pendingApproval?: boolean;
};

export type PublicPriceBreakdown = {
  basePrice: number;
  extraGuestFee: number;
  petFee: number;
  dayGuestFee: number;
  earlyFee: number;
  lateFee: number;
  discountAmount: number;
  discountPercent: number;
  discountLines: { label: string; amount: number }[];
  totalPrice: number;
  prepayment: number;
  prepaymentLabel: string;
  nights: number;
  serviceLines: PublicServiceLine[];
};

export type PaymentData = {
  merchantAccount: string;
  merchantDomainName: string;
  orderReference: string;
  orderDate: number;
  amount: number;
  currency: string;
  productName: string;
  signature: string;
};
