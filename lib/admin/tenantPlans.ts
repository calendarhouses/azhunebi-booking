export const TENANT_PLAN_IDS = ["basic", "pro", "enterprise"] as const;

export type TenantPlanId = (typeof TENANT_PLAN_IDS)[number];

export const TENANT_PLAN_LABELS: Record<TenantPlanId, string> = {
  basic: "Базовий",
  pro: "Профі",
  enterprise: "Enterprise",
};

export function normalizeTenantPlanId(plan?: string | null): TenantPlanId {
  const raw = (plan || "basic").toLowerCase();
  if (raw === "pro" || raw === "enterprise") return raw;
  return "basic";
}

export function getTenantPlanLabel(plan?: string | null): string {
  return TENANT_PLAN_LABELS[normalizeTenantPlanId(plan)];
}
