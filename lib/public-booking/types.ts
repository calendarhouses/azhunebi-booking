import type {
  AdminSettingsPayload,
  BookingRecord,
  CustomServiceConfig,
  RoomAmenitiesByCategory,
  RoomRules,
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
  priceWeekday: number;
  priceWeekend: number;
  active: boolean;
  photos?: string[];
  detailedDescription?: string;
  rules?: RoomRules;
  amenities?: RoomAmenitiesByCategory;
}

export interface PublicDiscount {
  id: number;
  condition: string;
  discount: string;
  rooms?: string;
  roomsIds?: string[];
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
  sysServicesList: SysServiceConfig[];
  customServicesList: CustomServiceConfig[];
}

export type BookedRange = {
  start: Date;
  end: Date;
  hasEarly: boolean;
  hasLate: boolean;
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
  totalPrice: number;
  prepayment: number;
  nights: number;
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
