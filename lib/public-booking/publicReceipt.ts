import { nightWord } from "@/components/admin/desktop/adminPlural";
import { formatPriceUa } from "./roomHelpers";
import { formatRoomDisplayName } from "./roomDisplay";

type ServiceLine = {
  name: string;
  fee: number;
  quantity?: number;
  onSite?: boolean;
  pendingApproval?: boolean;
};

export type PublicBookingReceiptData = {
  cottage?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  childCount?: number;
  name?: string;
  phone?: string;
  comment?: string;
  earlyTime?: string | null;
  lateTime?: string | null;
  totalPrice?: number;
  prepayment?: number;
  paidAmount?: number;
  basePrice?: number;
  extraGuestFee?: number;
  petFee?: number;
  dayGuestFee?: number;
  earlyFee?: number;
  lateFee?: number;
  discountAmount?: number;
  discountPercent?: number;
  discountLines?: { label: string; amount: number }[];
  prepayAmount?: number;
  prepaymentLabel?: string;
  nights?: number;
  serviceLines?: ServiceLine[];
  flow?: "instant" | "pending_review";
  orderId?: string;
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateLabel(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return escapeHtml(value);
  return d.toLocaleDateString("uk-UA", { day: "numeric", month: "long" });
}

function money(amount: number): string {
  return `${formatPriceUa(Math.round(amount))} ₴`;
}

function extractGuestComment(raw?: string): string {
  if (!raw?.trim()) return "";
  const marker = "Коментар гостя:";
  const idx = raw.indexOf(marker);
  const text = idx >= 0 ? raw.slice(idx + marker.length).trim() : "";
  return text.replace(/\s+/g, " ").trim();
}

function metaRow(key: string, value: string): string {
  return `
    <div class="receipt-meta-row">
      <span class="receipt-meta-row__key">${escapeHtml(key)}</span>
      <span class="receipt-meta-row__val">${value}</span>
    </div>
  `;
}

function itemRow(label: string, value: string, extraClass = ""): string {
  return `
    <div class="receipt-item${extraClass ? ` ${extraClass}` : ""}">
      <span class="receipt-item__label">${escapeHtml(label)}</span>
      <span class="receipt-item__value">${value}</span>
    </div>
  `;
}

function block(title: string, body: string, extraClass = ""): string {
  if (!body.trim()) return "";
  return `
    <section class="receipt-block${extraClass ? ` ${extraClass}` : ""}">
      <h4 class="receipt-block__title">${title}</h4>
      <div class="receipt-block__body">${body}</div>
    </section>
  `;
}

export function buildPublicReceiptHtml(raw: PublicBookingReceiptData): string {
  const total = Number(raw.totalPrice) || 0;
  const prepay = Number(raw.prepayment) || Number(raw.paidAmount) || 0;
  const remainder = Math.max(0, total - prepay);
  const guests = Number(raw.guests) || 0;
  const children = Number(raw.childCount) || 0;
  const nights = Number(raw.nights) || 0;

  const guestParts: string[] = [];
  if (guests > 0) guestParts.push(`${guests} ${guests === 1 ? "дорослий" : "дорослих"}`);
  if (children > 0) {
    guestParts.push(`${children} ${children === 1 ? "дитина" : "дітей"}`);
  }
  const guestLabel = guestParts.length ? guestParts.join(", ") : "—";

  const checkInLabel = formatDateLabel(raw.checkIn);
  const checkOutLabel = formatDateLabel(raw.checkOut);
  const nightsLabel = nights > 0 ? ` (${nights} ${nightWord(nights)})` : "";
  const roomName = escapeHtml(formatRoomDisplayName({ name: String(raw.cottage || "") }));

  const orderLines: string[] = [];
  if (raw.basePrice && raw.basePrice > 0) {
    orderLines.push(itemRow("Проживання", money(raw.basePrice)));
  }
  if (raw.extraGuestFee && raw.extraGuestFee > 0) {
    orderLines.push(itemRow("Додаткові гості", money(raw.extraGuestFee)));
  }
  for (const service of raw.serviceLines || []) {
    const qty = service.quantity && service.quantity > 1 ? ` × ${service.quantity}` : "";
    const label = `${service.name}${qty}`;
    if (service.pendingApproval) {
      orderLines.push(itemRow(label, "Очікує підтвердження", "receipt-item--muted"));
    } else if (service.onSite) {
      orderLines.push(itemRow(label, "Оплата на місці", "receipt-item--muted"));
    } else if (service.fee > 0) {
      orderLines.push(itemRow(label, money(service.fee)));
    }
  }
  if (raw.earlyFee && raw.earlyFee > 0) {
    orderLines.push(itemRow("Ранній заїзд", money(raw.earlyFee)));
  }
  if (raw.lateFee && raw.lateFee > 0) {
    orderLines.push(itemRow("Пізній виїзд", money(raw.lateFee)));
  }
  if (raw.discountLines?.length) {
    for (const line of raw.discountLines) {
      if (!line.amount) continue;
      orderLines.push(
        itemRow(
          line.label,
          `−${formatPriceUa(Math.round(line.amount))} ₴`,
          "receipt-item--discount"
        )
      );
    }
  } else if (raw.discountAmount && raw.discountAmount > 0) {
    const pct = raw.discountPercent ? ` (${Math.round(raw.discountPercent * 100)}%)` : "";
    orderLines.push(
      itemRow(
        `Знижка${pct}`,
        `−${formatPriceUa(Math.round(raw.discountAmount))} ₴`,
        "receipt-item--discount"
      )
    );
  }

  const wishes: string[] = [];
  if (raw.earlyTime) wishes.push(itemRow("Ранній заїзд", `з ${escapeHtml(raw.earlyTime)}`));
  if (raw.lateTime) wishes.push(itemRow("Пізній виїзд", `до ${escapeHtml(raw.lateTime)}`));
  const guestComment = escapeHtml(extractGuestComment(raw.comment));
  if (guestComment) wishes.push(itemRow("Коментар", guestComment, "receipt-item--note"));

  const finance = `
    ${itemRow("Загальна сума", money(total), "receipt-item--total")}
    ${itemRow("Внесена передоплата", money(prepay))}
    ${itemRow("Доплата на місці", money(remainder), remainder > 0 ? "receipt-item--due" : "")}
  `;

  return `
    <div class="receipt-premium">
      <header class="receipt-premium__head">
        <span class="receipt-premium__badge">Підтвердження бронювання</span>
        <h3 class="receipt-premium__room">${roomName}</h3>
        <div class="receipt-premium__ornament" aria-hidden="true"><span></span></div>
      </header>

      <div class="receipt-premium__meta">
        ${metaRow("Дати", `${checkInLabel} — ${checkOutLabel}${nightsLabel}`)}
        ${metaRow("Гості", guestLabel)}
      </div>

      <div class="receipt-premium__split" aria-hidden="true"></div>

      ${block("Деталі замовлення", orderLines.join(""))}
      ${block("Особливі побажання", wishes.join(""))}
      ${block("Фінанси", finance, "receipt-block--finance")}

      <p class="receipt-premium__footer">Чекаємо на вас!</p>
    </div>
  `;
}

export function buildPublicPendingReceiptHtml(raw: PublicBookingReceiptData): string {
  const total = Number(raw.totalPrice) || 0;
  const guests = Number(raw.guests) || 0;
  const children = Number(raw.childCount) || 0;
  const nights = Number(raw.nights) || 0;

  const guestParts: string[] = [];
  if (guests > 0) guestParts.push(`${guests} ${guests === 1 ? "дорослий" : "дорослих"}`);
  if (children > 0) {
    guestParts.push(`${children} ${children === 1 ? "дитина" : "дітей"}`);
  }
  const guestLabel = guestParts.length ? guestParts.join(", ") : "—";

  const checkInLabel = formatDateLabel(raw.checkIn);
  const checkOutLabel = formatDateLabel(raw.checkOut);
  const nightsLabel = nights > 0 ? ` (${nights} ${nightWord(nights)})` : "";
  const roomName = escapeHtml(formatRoomDisplayName({ name: String(raw.cottage || "") }));

  const orderLines: string[] = [];
  if (raw.basePrice && raw.basePrice > 0) {
    orderLines.push(itemRow("Проживання", money(raw.basePrice)));
  }
  for (const service of raw.serviceLines || []) {
    const qty = service.quantity && service.quantity > 1 ? ` × ${service.quantity}` : "";
    const label = `${service.name}${qty}`;
    if (service.pendingApproval) {
      orderLines.push(itemRow(label, "За запитом", "receipt-item--muted"));
    } else if (service.onSite) {
      orderLines.push(itemRow(label, "Оплата на місці", "receipt-item--muted"));
    } else if (service.fee > 0) {
      orderLines.push(itemRow(label, money(service.fee)));
    }
  }
  if (raw.discountLines?.length) {
    for (const line of raw.discountLines) {
      if (!line.amount) continue;
      orderLines.push(
        itemRow(
          line.label,
          `−${formatPriceUa(Math.round(line.amount))} ₴`,
          "receipt-item--discount"
        )
      );
    }
  }

  const wishes: string[] = [];
  if (raw.earlyTime) wishes.push(itemRow("Ранній заїзд", `з ${escapeHtml(raw.earlyTime)} · запит`));
  if (raw.lateTime) wishes.push(itemRow("Пізній виїзд", `до ${escapeHtml(raw.lateTime)} · запит`));

  return `
    <div class="receipt-premium receipt-premium--pending">
      <header class="receipt-premium__head">
        <span class="receipt-premium__badge receipt-premium__badge--pending">Заявка надіслана</span>
        <h3 class="receipt-premium__room">${roomName}</h3>
        <div class="receipt-premium__ornament" aria-hidden="true"><span></span></div>
      </header>

      <div class="receipt-premium__meta">
        ${metaRow("Дати", `${checkInLabel} — ${checkOutLabel}${nightsLabel}`)}
        ${metaRow("Гості", guestLabel)}
        ${raw.phone ? metaRow("Телефон", escapeHtml(raw.phone)) : ""}
      </div>

      <div class="receipt-premium__split" aria-hidden="true"></div>

      ${block("Орієнтовний розрахунок", orderLines.join(""))}
      ${block("Особливі побажання", wishes.join(""))}
      ${block(
        "Далі",
        itemRow(
          "Статус",
          "Очікує підтвердження",
          "receipt-item--muted"
        ) +
          itemRow(
            "Орієнтовна сума",
            money(total),
            "receipt-item--total"
          ) +
          itemRow(
            "Оплата",
            "Після підтвердження",
            "receipt-item--muted"
          ),
        "receipt-block--finance"
      )}

      <p class="receipt-premium__footer">Ми надішлемо вам SMS з деталями та посиланням на оплату.</p>
    </div>
  `;
}
