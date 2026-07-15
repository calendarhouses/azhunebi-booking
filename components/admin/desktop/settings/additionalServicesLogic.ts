import type { CustomServiceConfig, RoomConfig, ServiceInputType } from "../types";

export type ServicePricingMode = "once" | "per_day" | "per_guest" | "per_hour";
export type ServiceSelectionMap = Record<string, number>;

export type ServiceFormState = {
  name: string;
  price: string;
  roomIds: number[];
  perBooking: boolean;
  perDay: boolean;
  perGuest: boolean;
  perHour: boolean;
  active: boolean;
  description: string;
  onSite: boolean;
  inputType: ServiceInputType;
  maxQuantity: number;
  requiresApproval: boolean;
};

export function defaultServiceFormState(): ServiceFormState {
  return {
    name: "",
    price: "",
    roomIds: [],
    perBooking: true,
    perDay: false,
    perGuest: false,
    perHour: false,
    active: true,
    description: "",
    onSite: false,
    inputType: "toggle",
    maxQuantity: 10,
    requiresApproval: false,
  };
}

export function serviceInputType(service: Partial<CustomServiceConfig>): ServiceInputType {
  if (serviceIsHourly(service)) return "counter";
  return service.inputType === "counter" ? "counter" : "toggle";
}

export function serviceIsOnSite(service: Partial<CustomServiceConfig>): boolean {
  if (service.onSite === true) return true;
  return service.onSite !== false && Math.max(0, Number(service.price) || 0) === 0;
}

export function getServiceQty(map: ServiceSelectionMap | undefined, serviceId: number | string): number {
  const qty = map?.[String(serviceId)] ?? 0;
  return Math.max(0, Number(qty) || 0);
}

export function isServiceSelected(map: ServiceSelectionMap | undefined, serviceId: number | string): boolean {
  return getServiceQty(map, serviceId) > 0;
}

export function serviceIsHourly(service: Partial<CustomServiceConfig>): boolean {
  return service.perHour === "Так";
}

export function pricingModeFromService(service: Partial<CustomServiceConfig>): ServicePricingMode {
  if (serviceIsHourly(service)) return "per_hour";
  if (service.perGuest === "Так" && service.perDay !== "Так") return "per_guest";
  if (service.perDay === "Так" && service.perGuest !== "Так") return "per_day";
  if (service.perDay === "Так" && service.perGuest === "Так") return "per_day";
  return "once";
}

export function pricingLabelsFromService(service: Partial<CustomServiceConfig>): string[] {
  if (serviceIsHourly(service)) return ["За годину"];
  const perDay = service.perDay === "Так";
  const perGuest = service.perGuest === "Так";
  const perBooking =
    service.perBooking === "Так" || (service.perBooking !== "Ні" && !perDay && !perGuest);
  const labels: string[] = [];
  if (perBooking) labels.push("За бронь");
  if (perDay) labels.push("За ніч");
  if (perGuest) labels.push("За гостя");
  return labels.length ? labels : ["За бронь"];
}

export function serviceToPricingFlags(
  perBooking: boolean,
  perDay: boolean,
  perGuest: boolean,
  perHour = false
): Pick<CustomServiceConfig, "perDay" | "perGuest" | "perBooking" | "perHour"> {
  return {
    perBooking: perHour ? "Ні" : perBooking ? "Так" : "Ні",
    perDay: perHour ? "Ні" : perDay ? "Так" : "Ні",
    perGuest: perHour ? "Ні" : perGuest ? "Так" : "Ні",
    perHour: perHour ? "Так" : "Ні",
  };
}

export function pricingModeToFlags(mode: ServicePricingMode): Pick<ServiceFormState, "perBooking" | "perDay" | "perGuest" | "perHour"> {
  if (mode === "per_hour") return { perBooking: false, perDay: false, perGuest: false, perHour: true };
  if (mode === "per_day") return { perBooking: false, perDay: true, perGuest: false, perHour: false };
  if (mode === "per_guest") return { perBooking: false, perDay: false, perGuest: true, perHour: false };
  return { perBooking: true, perDay: false, perGuest: false, perHour: false };
}

export function buildServiceForm(service?: Partial<CustomServiceConfig>): ServiceFormState {
  if (!service) return defaultServiceFormState();
  return {
    name: String(service.name || "").trim(),
    price: service.price != null ? String(service.price) : "",
    roomIds: Array.isArray(service.roomIds)
      ? service.roomIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
      : [],
    perBooking: service.perBooking === "Так" || (service.perBooking !== "Ні" && service.perDay !== "Так" && service.perGuest !== "Так" && service.perHour !== "Так"),
    perDay: service.perDay === "Так",
    perGuest: service.perGuest === "Так",
    perHour: service.perHour === "Так",
    active: service.active !== false,
    description: String(service.description || "").trim(),
    onSite: serviceIsOnSite(service),
    inputType: serviceInputType(service),
    maxQuantity: Math.max(1, Number(service.maxQuantity) || 10),
    requiresApproval: service.requiresApproval === true,
  };
}

export function roomsLabelForService(roomIds: number[], roomsList: RoomConfig[]): string {
  if (!roomIds.length) return "Всі будинки";
  const names = roomIds
    .map((id) => roomsList.find((r) => r.id === id)?.name?.trim())
    .filter(Boolean) as string[];
  return names.length ? names.join(", ") : "Всі будинки";
}

export function applyServiceFormToSettings(
  settings: { customServicesList?: CustomServiceConfig[]; roomsList?: RoomConfig[] },
  form: ServiceFormState,
  editId?: number | null
): { customServicesList: CustomServiceConfig[] } | null {
  const name = form.name.trim();
  const price = Math.max(0, Number(form.price) || 0);
  if (!name) return null;

  const roomsList = settings.roomsList || [];
  const rooms = roomsLabelForService(form.roomIds, roomsList);
  const pricingFlags = serviceToPricingFlags(
    form.perHour ? false : form.perBooking || (!form.perDay && !form.perGuest && !form.perHour),
    form.perHour ? false : form.perDay,
    form.perHour ? false : form.perGuest,
    form.perHour
  );
  const payload: Omit<CustomServiceConfig, "id"> = {
    name,
    price,
    rooms,
    roomIds: form.roomIds.length ? [...form.roomIds] : undefined,
    ...pricingFlags,
    active: form.active,
    description: form.description.trim() || undefined,
    onSite: form.onSite,
    inputType: form.perHour ? "counter" : form.inputType,
    maxQuantity: Math.max(1, form.maxQuantity || 10),
    requiresApproval: form.requiresApproval,
  };
  const list = [...(settings.customServicesList || [])];

  if (editId != null) {
    const idx = list.findIndex((s) => s.id === editId);
    if (idx < 0) return null;
    list[idx] = { ...list[idx], ...payload };
    return { customServicesList: list };
  }

  list.push({ id: Date.now(), ...payload });
  return { customServicesList: list };
}

export function serviceAppliesToRoom(service: CustomServiceConfig, room: RoomConfig | null | undefined): boolean {
  if (!service.active || !room) return false;
  if (service.roomIds?.length) {
    return service.roomIds.includes(Number(room.id));
  }
  const label = String(service.rooms || "").trim();
  if (!label || label === "Всі" || label === "Всі будинки") return true;
  return label
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .includes(room.name.trim());
}

export function listServicesForRoom(
  services: CustomServiceConfig[] | undefined,
  room: RoomConfig | null | undefined
): CustomServiceConfig[] {
  return (services || []).filter((service) => serviceAppliesToRoom(service, room));
}

export function calculateServiceFee(
  service: CustomServiceConfig,
  quantity: number,
  opts: { nights: number; adults: number; children: number },
  context: { isPublicBooking?: boolean } = {}
): number {
  const qty = Math.max(0, quantity);
  if (qty <= 0) return 0;
  if (serviceIsOnSite(service)) return 0;
  if (service.requiresApproval && context.isPublicBooking) return 0;

  const unit = Math.max(0, Number(service.price) || 0);
  if (serviceIsHourly(service)) return unit * qty;

  let multiplier = 1;
  if (service.perDay === "Так") multiplier *= Math.max(1, opts.nights);
  if (service.perGuest === "Так") multiplier *= Math.max(1, opts.adults + opts.children);
  return unit * multiplier * qty;
}

export function calculateSelectedServicesTotal(
  services: CustomServiceConfig[],
  selectedServices: ServiceSelectionMap,
  opts: { nights: number; adults: number; children: number },
  context: { isPublicBooking?: boolean } = {}
): number {
  return services.reduce((sum, service) => {
    const qty = getServiceQty(selectedServices, service.id);
    return sum + calculateServiceFee(service, qty, opts, context);
  }, 0);
}

export function formatServicePriceHint(service: CustomServiceConfig): string {
  if (serviceIsOnSite(service)) return "Оплата на місці";
  const price = Math.max(0, Number(service.price) || 0);
  const parts: string[] = [];
  const perHour = serviceIsHourly(service);
  const perBooking =
    service.perBooking === "Так" || (service.perBooking !== "Ні" && service.perDay !== "Так" && service.perGuest !== "Так" && !perHour);
  if (perBooking) parts.push("бронь");
  if (service.perDay === "Так") parts.push("ніч");
  if (service.perGuest === "Так") parts.push("гість");
  if (perHour) parts.push("год");
  if (!parts.length) return `${price.toLocaleString("uk-UA")} ₴`;
  return `${price.toLocaleString("uk-UA")} ₴ / ${parts.join(" · ")}`;
}

export function previewServiceFee(
  form: ServiceFormState,
  opts: { nights: number; adults: number; children: number; quantity?: number }
): number {
  const pseudo: CustomServiceConfig = {
    id: 0,
    name: form.name || "Послуга",
    rooms: "",
    price: Math.max(0, Number(form.price) || 0),
    ...serviceToPricingFlags(
      form.perHour ? false : form.perBooking || (!form.perDay && !form.perGuest && !form.perHour),
      form.perHour ? false : form.perDay,
      form.perHour ? false : form.perGuest,
      form.perHour
    ),
    active: true,
    onSite: form.onSite,
    requiresApproval: form.requiresApproval,
    inputType: form.inputType,
  };
  const qty = Math.max(1, opts.quantity ?? 1);
  return calculateServiceFee(pseudo, qty, opts, { isPublicBooking: form.requiresApproval });
}

const CHILDREN_TOKEN = /👶\s*Діти[^:]*:\s*(\d+)/;
const SERVICE_TOKEN = /🛎️#(\d+):\s*([^|]+)/g;
const SERVICE_PENDING_TOKEN = /🛎️#(\d+)⏳:\s*([^|]+)/g;

export function parseChildrenFromComment(raw: string): number {
  const match = raw.match(CHILDREN_TOKEN);
  if (!match) return 0;
  return Math.max(0, parseInt(match[1], 10) || 0);
}

export function stripChildrenFromComment(raw: string): string {
  return raw.replace(CHILDREN_TOKEN, "").replace(/\|\s*$/, "").replace(/^\|\s*/, "").trim();
}

export function parseSelectedServicesFromComment(raw: string): ServiceSelectionMap {
  const result: ServiceSelectionMap = {};
  for (const match of raw.matchAll(SERVICE_TOKEN)) {
    const value = String(match[2] || "").trim();
    if (value === "Ні") continue;
    if (value === "Так" || value.startsWith("Так")) {
      result[match[1]] = 1;
      continue;
    }
    const qty = parseInt(value, 10);
    if (Number.isFinite(qty) && qty > 0) result[match[1]] = qty;
  }
  for (const match of raw.matchAll(SERVICE_PENDING_TOKEN)) {
    const value = String(match[2] || "").trim();
    if (value === "Ні") continue;
    if (value === "Так" || value.startsWith("Так")) {
      result[match[1]] = 1;
      continue;
    }
    const qty = parseInt(value, 10);
    if (Number.isFinite(qty) && qty > 0) result[match[1]] = qty;
  }
  return result;
}

export function parsePendingServiceIdsFromComment(raw: string): Set<string> {
  const pending = new Set<string>();
  for (const match of raw.matchAll(SERVICE_PENDING_TOKEN)) {
    pending.add(match[1]);
  }
  for (const match of raw.matchAll(SERVICE_TOKEN)) {
    const value = String(match[2] || "");
    if (value.includes("очікує підтвердження")) pending.add(match[1]);
  }
  return pending;
}

export function stripServiceTokensFromComment(raw: string): string {
  return raw
    .replace(SERVICE_TOKEN, "")
    .replace(SERVICE_PENDING_TOKEN, "")
    .replace(/\|\s*\|\s*/g, " | ")
    .replace(/^\|\s*/, "")
    .replace(/\|\s*$/, "")
    .trim();
}

export function buildChildrenCommentToken(children: number): string | null {
  if (children <= 0) return null;
  return `👶 Діти: ${children}`;
}

export function buildServiceCommentTokens(
  selectedServices: ServiceSelectionMap,
  servicesById?: Map<number, CustomServiceConfig>,
  context: { isPublicBooking?: boolean } = {}
): string[] {
  return Object.entries(selectedServices)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const service = servicesById?.get(Number(id));
      const pendingApproval = service?.requiresApproval && context.isPublicBooking;
      if (pendingApproval) {
        return qty > 1 ? `🛎️#${id}⏳: ${qty}` : `🛎️#${id}⏳: Так`;
      }
      return qty > 1 ? `🛎️#${id}: ${qty}` : `🛎️#${id}: Так`;
    });
}

/** Міграція старих токенів (чан, денні гості) у вибрані послуги за назвою. */
export function migrateLegacyServiceSelection(
  services: CustomServiceConfig[],
  legacy: { dayGuests: number; vat: "Так" | "Ні" }
): ServiceSelectionMap {
  const selected: ServiceSelectionMap = {};
  if (legacy.vat === "Так") {
    const chan = services.find((s) => /чан/i.test(s.name));
    if (chan) selected[String(chan.id)] = 1;
  }
  if (legacy.dayGuests > 0) {
    const dayGuests = services.find((s) => /денн/i.test(s.name) && /гост/i.test(s.name));
    if (dayGuests) selected[String(dayGuests.id)] = legacy.dayGuests;
  }
  return selected;
}

export function roomAllowsChildren(room: RoomConfig | null | undefined): boolean {
  return room?.allowChildren !== false;
}

export function roomPricingModel(room: RoomConfig | null | undefined): "per_house" | "per_guest" {
  return room?.pricingModel === "per_guest" ? "per_guest" : "per_house";
}

export function guestCountForPricing(adults: number, children: number, room: RoomConfig | null | undefined): number {
  if (roomPricingModel(room) === "per_guest") {
    return Math.max(1, adults + children);
  }
  return Math.max(1, adults);
}
