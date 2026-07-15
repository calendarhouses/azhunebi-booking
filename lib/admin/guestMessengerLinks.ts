export type GuestMessengerBooking = {
  id?: string;
  name?: string;
  phone?: string;
  cottage?: string;
  checkIn?: string;
  checkOut?: string;
  prepayAmount?: number;
  totalPrice?: number;
};

export type MessengerLinks = {
  whatsapp: string;
  viber: string;
  telegram: string;
  message: string;
};

const UK_MONTHS = [
  "січня", "лютого", "березня", "квітня", "травня", "червня",
  "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
];

function formatGuestDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getDate()} ${UK_MONTHS[d.getMonth()]}`;
}

export function normalizeGuestPhone(raw?: string): string {
  let phone = String(raw || "").replace(/\D/g, "");
  if (phone.length === 9) phone = `380${phone}`;
  if (phone.length === 10 && phone.startsWith("0")) phone = `38${phone}`;
  return phone;
}

export function getPublicSiteBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}

export function buildGuestPaymentUrl(orderId: string, baseUrl?: string): string {
  const base = (baseUrl || getPublicSiteBaseUrl()).replace(/\/$/, "");
  return `${base}/pay/${encodeURIComponent(orderId)}`;
}

export function buildGuestApprovedMessage(
  booking: GuestMessengerBooking,
  opts: { includePaymentLink?: boolean } = {}
): string {
  const firstName = String(booking.name || "Гість").trim().split(/\s+/)[0] || "Гість";
  const dates = `${formatGuestDate(booking.checkIn)} — ${formatGuestDate(booking.checkOut)}`;
  const prepay = Math.round(Number(booking.prepayAmount) || 0);
  const total = Math.round(Number(booking.totalPrice) || 0);

  const lines = [
    `Вітаємо, ${firstName}! Вашу бронь підтверджено 🏡`,
    "",
    `${booking.cottage || "Котедж"}`,
    `📅 ${dates}`,
  ];
  if (prepay > 0) {
    lines.push(`Передплата до оплати: ${prepay.toLocaleString("uk-UA")} грн`);
  } else if (total > 0) {
    lines.push(`Сума: ${total.toLocaleString("uk-UA")} грн`);
  }

  if (opts.includePaymentLink) {
    const orderId = String(booking.id || "").trim();
    const payUrl = orderId ? buildGuestPaymentUrl(orderId) : "";
    if (payUrl) {
      lines.push("", "Оплатити передплату:", payUrl);
    }
  } else {
    lines.push("", "Деталі оплати надішлемо вам окремим повідомленням.");
  }

  lines.push("", "Дякуємо!");
  return lines.join("\n");
}

export function buildGuestPaymentMessage(
  booking: GuestMessengerBooking,
  opts: { paymentUrl?: string; includePaymentLink?: boolean } = {}
): string {
  return buildGuestApprovedMessage(booking, {
    includePaymentLink: opts.includePaymentLink !== false,
  });
}

export function buildMessengerLinks(
  phone: string,
  message: string
): Omit<MessengerLinks, "message"> {
  const digits = normalizeGuestPhone(phone);
  const encoded = encodeURIComponent(message);
  return {
    whatsapp: `https://wa.me/${digits}?text=${encoded}`,
    viber: `viber://chat?number=%2B${digits}&text=${encoded}`,
    telegram: `https://t.me/+${digits}`,
  };
}

export function buildGuestMessengerLinks(
  booking: GuestMessengerBooking,
  opts: { paymentUrl?: string; includePaymentLink?: boolean; approved?: boolean } = {}
): MessengerLinks {
  const message = opts.approved
    ? buildGuestApprovedMessage(booking, { includePaymentLink: opts.includePaymentLink })
    : buildGuestApprovedMessage(booking, { includePaymentLink: false });
  const links = buildMessengerLinks(String(booking.phone || ""), message);
  return { ...links, message };
}
