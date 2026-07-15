import { dobaWord } from "@/components/admin/desktop/adminPlural";
import type { PublicBranding } from "./types";

export type PrepaymentMode = "percent" | "nights" | "fixed";

export type PrepaymentPolicy = {
  mode: PrepaymentMode;
  value: number;
};

const DEFAULT_POLICY: PrepaymentPolicy = { mode: "percent", value: 50 };

function hasExplicitPrepaymentValue(branding?: PublicBranding | null): boolean {
  const raw = branding?.prepayment_value;
  return raw !== undefined && raw !== null && String(raw).trim() !== "";
}

export function readPrepaymentPolicy(branding?: PublicBranding | null): PrepaymentPolicy {
  const mode = (branding?.prepayment_mode as PrepaymentMode) || "percent";

  if (!branding?.prepayment_mode && !hasExplicitPrepaymentValue(branding)) {
    return DEFAULT_POLICY;
  }

  const value = hasExplicitPrepaymentValue(branding)
    ? Math.max(0, Math.round(Number(branding?.prepayment_value) || 0))
    : DEFAULT_POLICY.value;

  if (mode === "nights") {
    return { mode: "nights", value: Math.min(30, value) };
  }
  if (mode === "fixed") {
    return { mode: "fixed", value };
  }
  return { mode: "percent", value: Math.min(100, value) };
}

export function formatPrepaymentLabel(policy: PrepaymentPolicy): string {
  if (policy.value <= 0) return "0 грн";
  if (policy.mode === "percent") return `${policy.value}%`;
  if (policy.mode === "fixed") return `${policy.value.toLocaleString("uk-UA")} грн`;
  return `${policy.value} ${dobaWord(policy.value)}`;
}

export function formatPrepaymentGuestLabel(policy: PrepaymentPolicy): string {
  if (policy.value <= 0) return "Без передплати";
  return `Передплата ${formatPrepaymentLabel(policy)}`;
}

export function calculatePrepaymentAmount(
  policy: PrepaymentPolicy,
  opts: { totalPrice: number; basePriceTotal: number; nights: number }
): number {
  if (policy.value <= 0) return 0;

  const total = Math.max(0, Math.round(opts.totalPrice));
  if (total <= 0) return 0;

  if (policy.mode === "fixed") {
    return Math.min(total, Math.round(policy.value));
  }

  if (policy.mode === "nights") {
    const nights = Math.max(1, opts.nights);
    const nightRate = Math.round(Math.max(0, opts.basePriceTotal) / nights);
    return Math.min(total, nightRate * Math.round(policy.value));
  }

  const pct = Math.min(100, Math.round(policy.value));
  return Math.round((total * pct) / 100);
}
