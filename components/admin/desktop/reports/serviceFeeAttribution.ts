import { parseSafeDate } from "../adminDates";
import {
  calculateServiceFee,
  getServiceQty,
  migrateLegacyServiceSelection,
  parseChildrenFromComment,
  parseSelectedServicesFromComment,
  type ServiceSelectionMap,
} from "../settings/additionalServicesLogic";
import type { BookingRecord, CustomServiceConfig } from "../types";

export type AttributedServiceLine = {
  id: string;
  name: string;
  amount: number;
};

function parseLegacyFromComment(comment: string): { dayGuests: number; vat: "Так" | "Ні" } {
  const matchDay = comment.match(/👥 Денні гості[^:]*:\s*(\d+)/);
  const dayGuests = matchDay ? Math.max(0, parseInt(matchDay[1], 10) || 0) : 0;
  const vat: "Так" | "Ні" = comment.includes("♨️ Чан: Так") ? "Так" : "Ні";
  return { dayGuests, vat };
}

function mergeSelections(
  primary: ServiceSelectionMap,
  legacy: ServiceSelectionMap
): ServiceSelectionMap {
  const out: ServiceSelectionMap = { ...legacy };
  for (const [id, qty] of Object.entries(primary)) {
    if (!qty || qty <= 0) continue;
    out[id] = Math.max(out[id] || 0, qty);
  }
  return out;
}

/** Атрибуція суми додаткових послуг броні за токенами comment + dayGuestFee. */
export function attributeBookingServiceFees(params: {
  booking: BookingRecord;
  services: CustomServiceConfig[];
  nights?: number;
}): { lines: AttributedServiceLine[]; leftoverOther: number } {
  const { booking, services } = params;
  if (!services.length) {
    const stored =
      booking.dayGuestFee !== undefined && booking.dayGuestFee !== ""
        ? Number(booking.dayGuestFee) || 0
        : 0;
    return { lines: [], leftoverOther: stored > 0 ? stored : 0 };
  }

  const inD = parseSafeDate(String(booking.checkIn));
  const outD = parseSafeDate(String(booking.checkOut));
  const nights =
    params.nights ??
    Math.max(1, Math.round((outD.getTime() - inD.getTime()) / 86400000));
  const adults = Math.max(1, parseInt(String(booking.guests), 10) || 2);
  const children = parseChildrenFromComment(String(booking.comment || ""));
  const comment = String(booking.comment || "");

  const fromTokens = parseSelectedServicesFromComment(comment);
  const legacy = migrateLegacyServiceSelection(services, parseLegacyFromComment(comment));
  const selected = mergeSelections(fromTokens, legacy);

  const calculated: AttributedServiceLine[] = [];
  for (const service of services) {
    const id = String(service.id);
    const qty = getServiceQty(selected, id);
    if (qty <= 0) continue;
    const amount = calculateServiceFee(service, qty, { nights, adults, children }, {
      isPublicBooking: false,
    });
    if (amount <= 0) continue;
    calculated.push({ id, name: service.name || `Послуга ${id}`, amount });
  }

  const calcTotal = calculated.reduce((s, l) => s + l.amount, 0);
  const stored =
    booking.dayGuestFee !== undefined && booking.dayGuestFee !== ""
      ? Number(booking.dayGuestFee) || 0
      : 0;

  if (stored > 0 && calcTotal <= 0) {
    return { lines: [], leftoverOther: stored };
  }

  if (calcTotal <= 0) {
    return { lines: [], leftoverOther: 0 };
  }

  const scale = stored > 0 ? stored / calcTotal : 1;
  const lines = calculated.map((line) => ({
    ...line,
    amount: Math.round(line.amount * scale),
  }));

  const attributed = lines.reduce((s, l) => s + l.amount, 0);
  const leftoverOther =
    stored > 0 ? Math.max(0, Math.round(stored) - attributed) : 0;

  return { lines: lines.filter((l) => l.amount > 0), leftoverOther };
}

export function matchServiceByCategoryName(
  category: string,
  services: CustomServiceConfig[]
): CustomServiceConfig | undefined {
  const cat = String(category || "").trim().toLowerCase();
  if (!cat) return undefined;
  return services.find((s) => String(s.name || "").trim().toLowerCase() === cat);
}

export function serviceDetailKey(serviceId: string | number): string {
  return `svc:${serviceId}`;
}

export function isServiceDetailKey(key: string): boolean {
  return key.startsWith("svc:");
}

export function serviceIdFromDetailKey(key: string): string {
  return key.slice(4);
}
