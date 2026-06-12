import type { DiscountConfig } from "@/components/admin/desktop/types";
import {
  getDiscountKind,
  getSpecialTariffToggleLabel,
  resolveDiscountActive,
} from "@/components/admin/desktop/settings/discountConfig";
import { isDiscountDraftId } from "@/lib/admin/discountDraft";

export type YesNo = "Так" | "Ні";

export type SpecialTariffToggle = {
  id: string;
  label: string;
  discount: DiscountConfig;
};

export function listActiveSpecialTariffDiscounts(
  discountsList: DiscountConfig[] = []
): SpecialTariffToggle[] {
  return discountsList
    .filter((d) => !isDiscountDraftId(d.id) && resolveDiscountActive(d) && getDiscountKind(d) === "ubd")
    .map((d) => ({
      id: String(d.id),
      label: getSpecialTariffToggleLabel(d),
      discount: d,
    }));
}

export function defaultSpecialTariffState(toggles: SpecialTariffToggle[]): Record<string, YesNo> {
  const state: Record<string, YesNo> = {};
  for (const toggle of toggles) {
    state[toggle.id] = "Ні";
  }
  return state;
}

export function specialTariffCommentToken(label: string): string {
  const trimmed = label.trim();
  if (trimmed === "УБД") return "🇺🇦 УБД: Так";
  return `🏷️ ${trimmed}: Так`;
}

export function buildSpecialTariffCommentParts(
  state: Record<string, YesNo>,
  toggles: SpecialTariffToggle[]
): string[] {
  const parts: string[] = [];
  for (const toggle of toggles) {
    if (state[toggle.id] === "Так") {
      parts.push(specialTariffCommentToken(toggle.label));
    }
  }
  return parts;
}

export function stripSpecialTariffTokensFromComment(
  raw: string,
  toggles: SpecialTariffToggle[]
): string {
  let text = raw || "";
  for (const toggle of toggles) {
    const token = specialTariffCommentToken(toggle.label);
    text = text.replace(new RegExp(escapeRegExp(token) + "\\s*(\\|\\s*)?", "g"), "").trim();
  }
  text = text.replace(/🇺🇦 УБД: Так\s*(\|\s*)?/g, "").trim();
  text = text.replace(/🏷️ [^|]+: Так\s*(\|\s*)?/g, "").trim();
  return text;
}

export function parseSpecialTariffState(
  raw: string,
  toggles: SpecialTariffToggle[]
): Record<string, YesNo> {
  const state = defaultSpecialTariffState(toggles);
  const text = raw || "";

  for (const toggle of toggles) {
    if (text.includes(specialTariffCommentToken(toggle.label))) {
      state[toggle.id] = "Так";
    }
  }

  // Legacy: «УБД: Так» лише для спецтарифу з категорією УБД (не для «ХАТА» тощо)
  if (text.includes("🇺🇦 УБД: Так")) {
    for (const toggle of toggles) {
      const cat = toggle.discount.guestCategory;
      const isUbdCategory = !cat || cat === "ubd";
      if (isUbdCategory && toggle.label === "УБД") {
        state[toggle.id] = "Так";
      }
    }
  }

  return state;
}

export function enabledSpecialTariffIds(state: Record<string, YesNo>): string[] {
  return Object.entries(state)
    .filter(([, value]) => value === "Так")
    .map(([id]) => id);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
