/** TurboSMS message/status + message/details delivery states */

export type SmsDeliveryVariant =
  | "queued"
  | "pending"
  | "delivered"
  | "failed"
  | "unknown"
  | "local_ok"
  | "local_fail";

export type SmsDeliveryStatusView = {
  variant: SmsDeliveryVariant;
  label: string;
  /** Still waiting for carrier update — poll API */
  isPending: boolean;
  isSuccess: boolean;
  isFailure: boolean;
};

const STATUS_MAP: Record<
  string,
  Pick<SmsDeliveryStatusView, "variant" | "label" | "isPending" | "isSuccess" | "isFailure">
> = {
  Queued: {
    variant: "queued",
    label: "У черзі",
    isPending: true,
    isSuccess: false,
    isFailure: false,
  },
  Accepted: {
    variant: "pending",
    label: "У мережі оператора",
    isPending: true,
    isSuccess: false,
    isFailure: false,
  },
  Sent: {
    variant: "pending",
    label: "Відправлено",
    isPending: true,
    isSuccess: false,
    isFailure: false,
  },
  Delivered: {
    variant: "delivered",
    label: "Доставлено",
    isPending: false,
    isSuccess: true,
    isFailure: false,
  },
  Read: {
    variant: "delivered",
    label: "Прочитано",
    isPending: false,
    isSuccess: true,
    isFailure: false,
  },
  Expired: {
    variant: "failed",
    label: "Термін минув",
    isPending: false,
    isSuccess: false,
    isFailure: true,
  },
  Undelivered: {
    variant: "failed",
    label: "Не доставлено",
    isPending: false,
    isSuccess: false,
    isFailure: true,
  },
  Rejected: {
    variant: "failed",
    label: "Відхилено",
    isPending: false,
    isSuccess: false,
    isFailure: true,
  },
  Failed: {
    variant: "failed",
    label: "Помилка доставки",
    isPending: false,
    isSuccess: false,
    isFailure: true,
  },
  Cancelled: {
    variant: "failed",
    label: "Скасовано",
    isPending: false,
    isSuccess: false,
    isFailure: true,
  },
  Unknown: {
    variant: "unknown",
    label: "Невідомий статус",
    isPending: false,
    isSuccess: false,
    isFailure: false,
  },
};

export function resolveSmsDeliveryStatus(entry: {
  ok: boolean;
  deliveryStatus?: string;
  error?: string;
  messageId?: string | null;
}): SmsDeliveryStatusView {
  if (!entry.ok) {
    return {
      variant: "local_fail",
      label: entry.error || "Не надіслано",
      isPending: false,
      isSuccess: false,
      isFailure: true,
    };
  }

  const raw = entry.deliveryStatus?.trim();
  if (raw && STATUS_MAP[raw]) {
    return STATUS_MAP[raw];
  }

  if (raw) {
    return {
      variant: "unknown",
      label: raw,
      isPending: false,
      isSuccess: false,
      isFailure: false,
    };
  }

  if (entry.messageId) {
    return {
      variant: "queued",
      label: "Очікує статус…",
      isPending: true,
      isSuccess: false,
      isFailure: false,
    };
  }

  return {
    variant: "local_ok",
    label: "Надіслано",
    isPending: false,
    isSuccess: true,
    isFailure: false,
  };
}

export function isSmsDeliveryFinal(status?: string): boolean {
  if (!status) return false;
  const view = STATUS_MAP[status];
  return view ? !view.isPending : true;
}
