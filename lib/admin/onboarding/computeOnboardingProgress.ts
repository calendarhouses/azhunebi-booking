import type { RoomConfig } from "@/components/admin/desktop/types";
import type {
  OnboardingProgressInput,
  OnboardingProgressResult,
  OnboardingStep,
  OnboardingStepId,
} from "./types";

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function isBasicSettingsComplete(
  settings: OnboardingProgressInput["settings"],
  _tenantName?: string | null
): boolean {
  const branding = (settings.branding || {}) as Record<string, unknown>;
  // Крок 1 має відображати реальний стан форми профілю, а не назву тенанта з акаунта.
  // Мінімум для "complete": заповнені назва об'єкта та контактний телефон.
  return hasText(branding.site_title) && hasText(branding.contact_phone);
}

export function isFirstRoomComplete(settings: OnboardingProgressInput["settings"]): boolean {
  return (settings.roomsList?.length ?? 0) > 0;
}

export function roomHasActiveAmenities(room: RoomConfig): boolean {
  const amenities = room.amenities;
  if (!amenities || typeof amenities !== "object") return false;

  for (const items of Object.values(amenities)) {
    if (!Array.isArray(items)) continue;
    if (items.some((item) => item.isActive)) return true;
  }
  return false;
}

export function isAmenitiesComplete(settings: OnboardingProgressInput["settings"]): boolean {
  const rooms = settings.roomsList || [];
  return rooms.some(roomHasActiveAmenities);
}

export function roomHasBasePrice(room: RoomConfig): boolean {
  return (Number(room.priceWeekday) || 0) > 0 || (Number(room.priceWeekend) || 0) > 0;
}

export function isPricesComplete(settings: OnboardingProgressInput["settings"]): boolean {
  const rooms = settings.roomsList || [];
  if (rooms.length === 0) return false;

  const customPrices = settings.customPrices || {};

  return rooms.some((room) => {
    if (roomHasBasePrice(room)) return true;
    const byRoom = customPrices[room.id] ?? customPrices[String(room.id)];
    return Boolean(byRoom && Object.keys(byRoom).length > 0);
  });
}

const STEP_DEFINITIONS: {
  id: OnboardingStepId;
  title: string;
  description: string;
  actionLabel: string;
  check: (input: OnboardingProgressInput) => boolean;
}[] = [
  {
    id: "basics",
    title: "Як тебе знатимуть гості",
    description: "Назва об'єкта та базові контакти для зв'язку.",
    actionLabel: "Заповнити",
    check: ({ settings, tenantName }) => isBasicSettingsComplete(settings, tenantName),
  },
  {
    id: "first_room",
    title: "Що будемо здавати?",
    description: "Додай свій перший котедж, номер або глемп.",
    actionLabel: "Створити",
    check: ({ settings }) => isFirstRoomComplete(settings),
  },
  {
    id: "amenities",
    title: "Що є всередині?",
    description: "Відзнач головні фішки та комфорт для гостей.",
    actionLabel: "Зберегти",
    check: ({ settings }) => isAmenitiesComplete(settings),
  },
  {
    id: "prices",
    title: "Скільки це коштує?",
    description: "Встанови базові тарифи на будні та вихідні.",
    actionLabel: "Встановити",
    check: ({ settings }) => isPricesComplete(settings),
  },
];

export function computeOnboardingProgress(
  input: OnboardingProgressInput
): OnboardingProgressResult {
  const steps: OnboardingStep[] = STEP_DEFINITIONS.map((def) => {
    const complete = def.check(input);
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      actionLabel: def.actionLabel,
      status: complete ? "complete" : "pending",
    };
  });

  const completedCount = steps.filter((s) => s.status === "complete").length;
  const totalSteps = steps.length;
  const percent =
    totalSteps === 0 ? 0 : Math.round((completedCount / totalSteps) * 100);

  return {
    percent,
    completedCount,
    totalSteps,
    steps,
    isComplete: percent >= 100,
  };
}
