import {
  confirmFlexibleTokensInComment,
  parseEarlyLateTimesFromComment,
} from "@/lib/admin/flexibleSchedule";
import {
  confirmServiceTokensInComment,
  parsePendingServiceIdsFromComment,
} from "@/components/admin/desktop/settings/additionalServicesLogic";
import type { CustomServiceConfig } from "@/components/admin/desktop/types";

export type ReviewFeatureParts = {
  early: boolean;
  late: boolean;
  postLate: boolean;
  serviceNames: string[];
};

function countNights(checkIn?: string, checkOut?: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(checkIn.includes("T") ? checkIn : `${checkIn}T12:00:00`);
  const b = new Date(checkOut.includes("T") ? checkOut : `${checkOut}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

export function hasReviewExceptionInComment(
  comment: string,
  checkIn?: string,
  checkOut?: string
): boolean {
  const raw = String(comment || "");
  if (countNights(checkIn, checkOut) === 1) return true;
  if (/🕒#early⏳:/.test(raw) || /🕒#late⏳:/.test(raw) || /🕒#postlate⏳:/.test(raw)) {
    return true;
  }
  if (parsePendingServiceIdsFromComment(raw).size > 0) return true;
  if (/🇺🇦 УБД: Так/.test(raw)) return true;
  return false;
}

export function confirmPendingReviewTokensInComment(raw: string): string {
  return confirmServiceTokensInComment(confirmFlexibleTokensInComment(raw));
}

function joinUkList(parts: string[]): string {
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} і ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")} і ${parts[parts.length - 1]}`;
}

function serviceNameForPhrase(
  name: string,
  kind: "with_z" | "plain"
): string {
  const trimmed = String(name || "").trim();
  if (!trimmed) return kind === "with_z" ? "додатковою послугою" : "додаткова послуга";
  if (kind === "plain") return trimmed;
  const lower = trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
  if (/трансфер/i.test(trimmed)) return "трансфером";
  return lower;
}

export function parseReviewFeatureParts(
  comment: string,
  servicesById?: Map<number, CustomServiceConfig>
): ReviewFeatureParts {
  const raw = String(comment || "");
  const early = /🕒#early⏳:/.test(raw);
  const late = /🕒#late⏳:/.test(raw);
  const postLate = /🕒#postlate⏳:/.test(raw);
  const pendingIds = parsePendingServiceIdsFromComment(raw);
  const serviceNames: string[] = [];
  for (const id of pendingIds) {
    const svc = servicesById?.get(Number(id));
    serviceNames.push(svc?.name?.trim() || "додаткова послуга");
  }
  return { early, late, postLate, serviceNames };
}

export function buildApprovedFeaturesPhrase(parts: ReviewFeatureParts): string {
  const withZ: string[] = [];
  if (parts.early) withZ.push("раннім заїздом");
  if (parts.late) withZ.push("пізнім виїздом");
  if (parts.postLate) withZ.push("заїздом після пізнього виїзду");
  for (const name of parts.serviceNames) {
    withZ.push(serviceNameForPhrase(name, "with_z"));
  }
  return joinUkList(withZ);
}

export function buildRejectedFeaturesPhrase(parts: ReviewFeatureParts): string {
  const plain: string[] = [];
  if (parts.early) plain.push("ранній заїзд");
  if (parts.late) plain.push("пізній виїзд");
  if (parts.postLate) plain.push("заїзд після пізнього виїзду");
  for (const name of parts.serviceNames) {
    plain.push(serviceNameForPhrase(name, "plain"));
  }
  return joinUkList(plain);
}

export function buildRejectedImpossibleLine(parts: ReviewFeatureParts): string {
  const plain = buildRejectedFeaturesPhrase(parts);
  if (!plain) return "бронювання не можливе";
  const count =
    (parts.early ? 1 : 0) +
    (parts.late ? 1 : 0) +
    (parts.postLate ? 1 : 0) +
    parts.serviceNames.length;
  const verb = count > 1 ? "не можливі" : "не можливий";
  return `${plain} ${verb}`;
}

export function buildRetryHint(parts: ReviewFeatureParts): string {
  const without: string[] = [];
  if (parts.early) without.push("раннього заїзду");
  if (parts.late) without.push("пізнього виїзду");
  if (parts.postLate) without.push("заїзду після пізнього виїзду");
  for (const name of parts.serviceNames) {
    without.push(serviceNameForPhrase(name, "plain"));
  }
  if (!without.length) return "Спробуйте забронювати ще раз на сайті.";
  if (without.length === 1) {
    return `Спробуйте забронювати ще раз без ${without[0]}.`;
  }
  return `Спробуйте забронювати ще раз без: ${joinUkList(without)}.`;
}

export function buildReviewSmsExtraVars(
  comment: string,
  servicesById?: Map<number, CustomServiceConfig>
): Record<string, string> {
  const parts = parseReviewFeatureParts(comment, servicesById);
  const approved = buildApprovedFeaturesPhrase(parts) || "особливими умовами";
  const rejected = buildRejectedFeaturesPhrase(parts) || "особливі умови";
  const { earlyTime, lateTime } = parseEarlyLateTimesFromComment(comment);
  const extras: Record<string, string> = {
    features: approved || rejected,
    approved_features: approved,
    rejected_features: rejected,
    impossible_line: buildRejectedImpossibleLine(parts),
    retry_hint: buildRetryHint(parts),
  };
  if (earlyTime) extras.early_time = earlyTime;
  if (lateTime) extras.late_time = lateTime;
  return extras;
}
