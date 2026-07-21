"use client";

import { CheckCircle2, Clock3, Loader2, Send, XCircle } from "lucide-react";
import {
  resolveSmsDeliveryStatus,
  type SmsDeliveryVariant,
} from "@/lib/sms/smsDeliveryStatus";
import type { SmsJournalEntry } from "@/lib/sms/smsSettings";

type SmsJournalStatusBadgeProps = {
  entry: SmsJournalEntry;
  compact?: boolean;
};

function StatusIcon({ variant, pending }: { variant: SmsDeliveryVariant; pending: boolean }) {
  const spin = pending ? " sms-delivery-badge__icon--spin" : "";
  switch (variant) {
    case "delivered":
    case "local_ok":
      return <CheckCircle2 size={15} className={`sms-delivery-badge__icon${spin}`} aria-hidden />;
    case "failed":
    case "local_fail":
      return <XCircle size={15} className="sms-delivery-badge__icon" aria-hidden />;
    case "pending":
      return <Send size={15} className={`sms-delivery-badge__icon${spin}`} aria-hidden />;
    case "queued":
      return pending ? (
        <Loader2 size={15} className="sms-delivery-badge__icon sms-delivery-badge__icon--spin" aria-hidden />
      ) : (
        <Clock3 size={15} className="sms-delivery-badge__icon" aria-hidden />
      );
    default:
      return <Clock3 size={15} className="sms-delivery-badge__icon" aria-hidden />;
  }
}

export function SmsJournalStatusBadge({ entry, compact = false }: SmsJournalStatusBadgeProps) {
  const status = resolveSmsDeliveryStatus(entry);

  return (
    <span
      className={`sms-delivery-badge sms-delivery-badge--${status.variant}${status.isPending ? " is-pending" : ""}`}
      title={entry.deliveryTime ? `Оновлено: ${entry.deliveryTime}` : undefined}
    >
      <StatusIcon variant={status.variant} pending={status.isPending} />
      {!compact ? <span>{status.label}</span> : null}
    </span>
  );
}

export function hasPendingSmsDeliveries(journal: SmsJournalEntry[]): boolean {
  return journal.some((entry) => {
    const s = resolveSmsDeliveryStatus(entry);
    return s.isPending;
  });
}
