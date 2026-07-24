import { getGuestWord } from "./adminPlural";
import { findRoomForBooking, isHutshubBooking } from "./bookingUtils";
import { adminRoomLabel } from "@/lib/admin/roomDisplay";
import type { BookingRecord, RoomConfig } from "./types";

declare const html2canvas: (
  element: HTMLElement,
  options?: Record<string, unknown>
) => Promise<HTMLCanvasElement>;

export interface PaymentCardInfo {
  amount?: number;
  method?: string;
}

function resolveRoomsList(roomsList?: RoomConfig[]): RoomConfig[] | undefined {
  if (roomsList !== undefined) return roomsList;
  if (typeof window !== "undefined" && window.roomsList) return window.roomsList;
  return undefined;
}

export async function capturePremiumCard(
  b: BookingRecord,
  roomsList?: RoomConfig[]
): Promise<string | null> {
  const isHutshub = isHutshubBooking(b);
  const list = resolveRoomsList(roomsList);
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "-9999px";
  container.style.width = "800px";
  container.style.background = isHutshub
    ? "linear-gradient(135deg, #C9D6D2 0%, #B2C4BE 100%)"
    : "linear-gradient(135deg, #2C351B 0%, #1A1F10 100%)";
  container.style.padding = "60px 120px";
  container.style.boxSizing = "border-box";
  container.style.fontFamily = "'Inter', sans-serif";
  container.style.display = "flex";
  container.style.justifyContent = "center";

  const card = document.createElement("div");
  card.style.width = "100%";
  card.style.background = "#FFFFFF";
  card.style.borderRadius = "20px";
  card.style.padding = "35px";
  card.style.boxShadow = "0 20px 40px rgba(0,0,0,0.4)";
  card.style.position = "relative";
  card.style.overflow = "hidden";

  const topAccent = document.createElement("div");
  topAccent.style.position = "absolute";
  topAccent.style.top = "0";
  topAccent.style.left = "0";
  topAccent.style.width = "100%";
  topAccent.style.height = "6px";
  topAccent.style.background = isHutshub
    ? "linear-gradient(90deg, #1A332A 0%, #4A6B5F 100%)"
    : "linear-gradient(90deg, #556B2F 0%, #8FBC8F 100%)";
  card.appendChild(topAccent);

  const iconCottage = `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #D97706; flex-shrink: 0;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>`;
  const iconCalendar = `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #3B82F6; flex-shrink: 0;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke-width="2"></rect><line x1="16" y1="2" x2="16" y2="6" stroke-width="2"></line><line x1="8" y1="2" x2="8" y2="6" stroke-width="2"></line><line x1="3" y1="10" x2="21" y2="10" stroke-width="2"></line></svg>`;
  const iconUsers = `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #0EA5E9;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>`;
  const iconPaw = `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #F97316;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>`;
  const iconClock = `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #8B5CF6;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
  const iconVat = `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #E11D48;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"></path></svg>`;
  const iconShield = `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #10B981;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>`;
  const iconDiscount = `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #DC2626;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>`;
  const iconSum = `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 8px; color: #4B5563; flex-shrink: 0;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>`;
  const iconPaid = `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 8px; color: #059669; flex-shrink: 0;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;

  let displayPhone = String(b.phone || "").replace(/\D/g, "");
  if (displayPhone.length === 9) displayPhone = "380" + displayPhone;
  if (displayPhone.length === 10 && displayPhone.startsWith("0")) displayPhone = "38" + displayPhone;
  if (displayPhone) displayPhone = "+" + displayPhone;

  let guestWord = "гостей";
  guestWord = getGuestWord(Number(b.guests)).toUpperCase();

  let inDate = "—";
  let outDate = "—";
  try {
    if (b.checkIn)
      inDate = new Date(b.checkIn).toLocaleDateString("uk-UA", {
        day: "numeric",
        month: "long",
      });
    if (b.checkOut)
      outDate = new Date(b.checkOut).toLocaleDateString("uk-UA", {
        day: "numeric",
        month: "long",
      });
  } catch {
    /* ignore */
  }

  const total = Number(b.totalPrice) || 0;
  const paid = Number(b.paidAmount) || 0;
  const balance = total - paid;

  const rawComment = b.comment ? String(b.comment) : "";
  const hasVat = rawComment.includes("♨️ Чан: Так");
  const hasUBD = rawComment.includes("🇺🇦 УБД: Так");

  const matchDay = rawComment.match(/👥 Денні гості[^:]*:\s*(\d+)/);
  const dayGuestsCount = matchDay ? matchDay[1] : 0;

  const matchEarly = rawComment.match(/🕒 Ранній заїзд: з (\d{2}:\d{2})/);
  const earlyTime = matchEarly ? matchEarly[1] : null;

  const matchLate = rawComment.match(/🕒 Пізній виїзд: до (\d{2}:\d{2})/);
  const lateTime = matchLate ? matchLate[1] : null;

  let extraGuestsCount = 0;
  let cottageDisplay = String(b.cottage || "");
  if (list) {
    const roomObj = findRoomForBooking(b, list) || list.find(
      (r) => String(b.cottage).includes(r.name) || String(b.cottage).includes(r.short)
    );
    if (roomObj) cottageDisplay = adminRoomLabel(roomObj);
    const cap = roomObj ? roomObj.capacity || 2 : 2;
    extraGuestsCount = Math.max(0, parseInt(String(b.guests), 10) - cap);
  }

  const discAmt = Number(b.discountAmount) || 0;
  let basePrice = Number(b.basePrice);
  if (!basePrice && basePrice !== 0) {
    basePrice =
      total +
      discAmt -
      ((Number(b.extraGuestFee) || 0) +
        (Number(b.petFee) || 0) +
        (Number(b.dayGuestFee) || 0) +
        (Number(b.earlyFee) || 0) +
        (Number(b.lateFee) || 0));
  }

  const cleanComment = rawComment
    .replace(/👥 Денні гості[^|]+(\|\s*)?/g, "")
    .replace(/♨️ Чан: Так\s*(\|\s*)?/g, "")
    .replace(/🇺🇦 УБД: Так\s*(\|\s*)?/g, "")
    .replace(/🕒 Ранній заїзд: з \d{2}:\d{2}(\s*\|\s*)?/g, "")
    .replace(/🕒 Пізній виїзд: до \d{2}:\d{2}(\s*\|\s*)?/g, "")
    .replace(/Коментар гостя:/gi, "")
    .replace(/^\|\s*/, "")
    .replace(/\|\s*$/, "")
    .trim();

  let extraHtml = "";
  const rowStyle = `display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; font-size: 15px; color: #4B5563;`;
  const labelStyle = `display:flex; align-items:center; gap: 8px; font-weight: 600;`;
  const valStyle = `font-weight: 800; color: #111827;`;

  extraHtml += `<div style="${rowStyle}"><span style="${labelStyle}">${iconCottage} Базова вартість:</span> <span style="${valStyle}">${basePrice} ₴</span></div>`;

  if (Number(b.extraGuestFee) > 0) {
    const label =
      extraGuestsCount > 0 ? `Дод. гості (${extraGuestsCount}):` : `Дод. гості:`;
    extraHtml += `<div style="${rowStyle}"><span style="${labelStyle}">${iconUsers} ${label}</span> <span style="${valStyle}">+${b.extraGuestFee} ₴</span></div>`;
  }
  if (Number(b.petFee) > 0) {
    extraHtml += `<div style="${rowStyle}"><span style="${labelStyle}">${iconPaw} Тварини:</span> <span style="${valStyle}">+${b.petFee} ₴</span></div>`;
  }
  if (Number(b.dayGuestFee) > 0) {
    const label =
      Number(dayGuestsCount) > 0 ? `Денні гості (${dayGuestsCount}):` : `Денні гості:`;
    extraHtml += `<div style="${rowStyle}"><span style="${labelStyle}">${iconUsers} ${label}</span> <span style="${valStyle}">+${b.dayGuestFee} ₴</span></div>`;
  }
  if (Number(b.earlyFee) > 0) {
    const label = earlyTime ? `Ранній заїзд (з ${earlyTime}):` : `Ранній заїзд:`;
    extraHtml += `<div style="${rowStyle}"><span style="${labelStyle}">${iconClock} ${label}</span> <span style="${valStyle}">+${b.earlyFee} ₴</span></div>`;
  }
  if (Number(b.lateFee) > 0) {
    const label = lateTime ? `Пізній виїзд (до ${lateTime}):` : `Пізній виїзд:`;
    extraHtml += `<div style="${rowStyle}"><span style="${labelStyle}">${iconClock} ${label}</span> <span style="${valStyle}">+${b.lateFee} ₴</span></div>`;
  }
  if (hasVat) {
    extraHtml += `<div style="${rowStyle}"><span style="${labelStyle}">${iconVat} Чан:</span> <span style="${valStyle}; color: #556B2F;">Так</span></div>`;
  }
  if (hasUBD) {
    extraHtml += `<div style="${rowStyle}"><span style="${labelStyle}">${iconShield} УБД:</span> <span style="${valStyle}; color: #556B2F;">Так</span></div>`;
  }
  if (Number(b.discountAmount) > 0) {
    extraHtml += `<div style="${rowStyle}; margin-top: 16px; padding-top: 12px; border-top: 1px dashed #E5E7EB; color: #DC2626;"><span style="${labelStyle}; color:#DC2626;">${iconDiscount} Знижка:</span> <span style="font-weight: 900;">-${b.discountAmount} ₴</span></div>`;
  }

  let commentHtml = "";
  if (cleanComment !== "") {
    commentHtml = `
            <div style="margin-top: 20px; padding: 16px; background: #F9FAFB; border-left: 4px solid #556B2F; border-radius: 6px; font-size: 15px; color: #374151;">
                <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #9CA3AF; margin-bottom: 8px; letter-spacing: 0.5px;">Коментар гостя</div>
                <div style="line-height: 1.4; font-weight: 500; font-style: italic;">"${cleanComment.replace(/\n/g, "<br>")}"</div>
            </div>
        `;
  }

  let finText = "";
  let finColor = "";
  let finBg = "";
  let finBorder = "";
  const statusClass = String(b.status).toLowerCase();

  if (isHutshub) {
    finText = "ПІДТВЕРДЖЕНО (HUTSHUB)";
    finBg = "#C9D6D2";
    finColor = "#1A332A";
    finBorder = "rgba(26, 51, 42, 0.2)";
  } else if (statusClass.includes("скас")) {
    finText = "СКАСОВАНО";
    finBg = "#F3F4F6";
    finColor = "#6B7280";
    finBorder = "#E5E7EB";
  } else if (total === 0) {
    finText = "БЕЗ ЦІНИ";
    finBg = "#F3F4F6";
    finColor = "#4B5563";
    finBorder = "#E5E7EB";
  } else if (paid === 0) {
    finText = `ОЧІКУЄ АВАНС: ${Math.round(total / 2)} ₴`;
    finBg = "#FEF3C7";
    finColor = "#B45309";
    finBorder = "#FDE68A";
  } else if (balance <= 0) {
    finText = `ОПЛАЧЕНО ПОВНІСТЮ`;
    finBg = "#D1FAE5";
    finColor = "#059669";
    finBorder = "#A7F3D0";
  } else {
    finText = `ЗАЛИШОК ДО СПЛАТИ: ${balance} ₴`;
    finBg = "#FEE2E2";
    finColor = "#DC2626";
    finBorder = "#FECACA";
  }

  const hutshubBadge = isHutshub
    ? `<span style="font-size: 11px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; color: #1A332A; background: #C9D6D2; border: 1px solid rgba(26,51,42,0.15); padding: 6px 12px; border-radius: 8px;">Hutshub</span>`
    : "";
  const paymentBlockHtml = isHutshub
    ? `<div style="margin-top: 5px; padding: 16px 18px; background: #F4F7F5; border-radius: 12px; border: 1px solid rgba(26,51,42,0.12); font-size: 15px; color: #1A332A; font-weight: 700; text-align: center;">💳 Оплата на платформі Hutshub</div>`
    : `<div style="margin-top: 5px; padding-top: 16px; border-top: 1px dashed #E5E7EB;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="color: #6B7280; font-weight: 700; font-size: 16px; display:flex; align-items:center;">
                        ${iconSum} Сума:
                    </span> 
                    <span style="font-weight: 800; color: #111827; font-size: 18px;">${total} ₴</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #6B7280; font-weight: 700; font-size: 16px; display:flex; align-items:center;">
                        ${iconPaid} Внесено:
                    </span> 
                    <span style="font-weight: 900; color: #059669; font-size: 18px;">${paid} ₴</span>
                </div>
            </div>`;

  card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #E5E7EB; padding-bottom: 20px; margin-bottom: 20px;">
            <div style="display: flex; flex-direction: column; gap: 6px;">
                <span style="font-weight: 900; font-size: 24px; color: #111827; letter-spacing: -0.5px; line-height: 1.1;">${b.name || "Гість"}</span>
                <span style="font-size: 16px; color: #6B7280; font-weight: 600;">${displayPhone}</span>
            </div>
            <div style="text-align: right; display: flex; flex-direction: column; justify-content: center; align-items: flex-end; gap: 8px;">
                ${hutshubBadge}
                <span style="font-size: 14px; color: ${isHutshub ? "#1A332A" : "#556B2F"}; font-weight: 800; background: ${isHutshub ? "rgba(255,255,255,0.45)" : "#F0FDF4"}; border: 1px solid ${isHutshub ? "rgba(26,51,42,0.12)" : "#DCF1D3"}; padding: 8px 16px; border-radius: 8px; white-space: nowrap;">${b.guests} ${guestWord}</span>
            </div>
        </div>
        
        <div style="font-size: 16px; color: #4B5563; display: flex; flex-direction: column; gap: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #6B7280; font-weight: 600; display:flex; align-items:center;">
                    <span style="margin-right:8px; display:flex;">${iconCottage}</span> Котедж:
                </span> 
                <span style="font-weight: 800; color: #111827; font-size: 18px; text-align: right;">${cottageDisplay}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #6B7280; font-weight: 600; display:flex; align-items:center;">
                    <span style="margin-right:8px; display:flex;">${iconCalendar}</span> Дати:
                </span> 
                <span style="font-weight: 800; color: ${isHutshub ? "#1A332A" : "#556B2F"}; font-size: 17px; text-align: right;">${inDate} — ${outDate}</span>
            </div>
            
            ${!isHutshub && extraHtml ? `<div style="margin-top: 5px; padding: 18px 20px; background: #FAFAFA; border-radius: 12px; border: 1px dashed #D1D5DB;">${extraHtml}</div>` : ""}

            ${paymentBlockHtml}
        </div>

        ${commentHtml}

        <div style="margin-top: 25px; display: flex; align-items: center; justify-content: center; padding: 14px; border-radius: 10px; font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; background: ${finBg}; color: ${finColor}; border: 1px solid ${finBorder};">
            ${finText}
        </div>
    `;

  container.appendChild(card);
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      width: 800,
      height: container.offsetHeight,
      windowWidth: 800,
      scale: 2,
      backgroundColor: null,
      useCORS: true,
    });
    document.body.removeChild(container);
    return canvas.toDataURL("image/jpeg", 0.9);
  } catch (err) {
    console.error("Помилка скріншоту:", err);
    if (document.body.contains(container)) document.body.removeChild(container);
    return null;
  }
}

export async function capturePaymentCard(
  b: BookingRecord,
  paymentInfo?: PaymentCardInfo
): Promise<string | null> {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "-9999px";
  container.style.width = "800px";
  container.style.background = "linear-gradient(135deg, #2C351B 0%, #1A1F10 100%)";
  container.style.padding = "60px 120px";
  container.style.boxSizing = "border-box";
  container.style.fontFamily = "'Inter', sans-serif";
  container.style.display = "flex";
  container.style.justifyContent = "center";

  const formatMoneyUa = (n: number) =>
    (Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₴";

  const getMethodStyle = (method: string) => {
    const m = String(method || "").toLowerCase();
    if (m.includes("фоп"))
      return { bg: "#EFF6FF", border: "#93C5FD", color: "#1D4ED8", label: "ФОП" };
    if (m.includes("карт"))
      return { bg: "#F5F3FF", border: "#C4B5FD", color: "#6D28D9", label: "КАРТКА" };
    return { bg: "#ECFDF5", border: "#6EE7B7", color: "#047857", label: "ГОТІВКА" };
  };

  const method = paymentInfo?.method || b.surchargeMethod || "Готівка";
  const methodStyle = getMethodStyle(String(method));
  const payAmount = Number(paymentInfo?.amount) || 0;
  const total = Number(b.totalPrice) || 0;
  const paid = Number(b.paidAmount) || 0;
  const balance = total - paid;

  let displayPhone = String(b.phone || "").replace(/\D/g, "");
  if (displayPhone.length === 9) displayPhone = "380" + displayPhone;
  if (displayPhone.length === 10 && displayPhone.startsWith("0")) displayPhone = "38" + displayPhone;
  if (displayPhone) displayPhone = "+" + displayPhone;

  const roomsForPay = resolveRoomsList();
  const matchedPayRoom = roomsForPay ? findRoomForBooking(b, roomsForPay) : null;
  const cottageDisplayPay = matchedPayRoom
    ? adminRoomLabel(matchedPayRoom)
    : String(b.cottage || "—");

  let inDate = "—";
  let outDate = "—";
  try {
    if (b.checkIn)
      inDate = new Date(b.checkIn).toLocaleDateString("uk-UA", {
        day: "numeric",
        month: "long",
      });
    if (b.checkOut)
      outDate = new Date(b.checkOut).toLocaleDateString("uk-UA", {
        day: "numeric",
        month: "long",
      });
  } catch {
    /* ignore */
  }

  const iconCottage = `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #D97706; flex-shrink: 0;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>`;
  const iconCalendar = `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #3B82F6; flex-shrink: 0;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke-width="2"></rect><line x1="16" y1="2" x2="16" y2="6" stroke-width="2"></line><line x1="8" y1="2" x2="8" y2="6" stroke-width="2"></line><line x1="3" y1="10" x2="21" y2="10" stroke-width="2"></line></svg>`;
  const iconUser = `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #0EA5E9; flex-shrink: 0;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>`;
  const iconCash = `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #059669; flex-shrink: 0;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>`;
  const iconSum = `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #4B5563; flex-shrink: 0;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
  const iconPaid = `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #059669; flex-shrink: 0;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;

  const rowStyle =
    "display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 20px; margin-bottom: 12px; font-size: 15px; color: #4B5563;";
  const labelStyle =
    "display: flex; align-items: center; gap: 8px; font-weight: 600; color: #6B7280;";
  const valStyle = "font-weight: 800; color: #111827; text-align: right;";
  const payRowStyle =
    "display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 20px; margin-bottom: 12px; font-size: 15px;";
  const payValStyle =
    "font-weight: 900; color: #111827; font-size: 18px; text-align: right; white-space: nowrap;";
  const payValGreen =
    "font-weight: 900; color: #059669; font-size: 18px; text-align: right; white-space: nowrap;";

  const finText =
    balance <= 0 ? "ОПЛАЧЕНО ПОВНІСТЮ" : `ЗАЛИШОК: ${formatMoneyUa(balance)}`;
  const finBg = balance <= 0 ? "#D1FAE5" : "#FEE2E2";
  const finColor = balance <= 0 ? "#059669" : "#DC2626";
  const finBorder = balance <= 0 ? "#A7F3D0" : "#FECACA";

  const card = document.createElement("div");
  card.style.width = "100%";
  card.style.background = "#FFFFFF";
  card.style.borderRadius = "20px";
  card.style.padding = "35px";
  card.style.boxShadow = "0 20px 40px rgba(0,0,0,0.4)";
  card.style.position = "relative";
  card.style.overflow = "hidden";

  const topAccent = document.createElement("div");
  topAccent.style.position = "absolute";
  topAccent.style.top = "0";
  topAccent.style.left = "0";
  topAccent.style.width = "100%";
  topAccent.style.height = "6px";
  topAccent.style.background = "linear-gradient(90deg, #556B2F 0%, #8FBC8F 100%)";
  card.appendChild(topAccent);

  card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #E5E7EB; padding-bottom: 20px; margin-bottom: 20px;">
            <div style="display: flex; flex-direction: column; gap: 6px;">
                <span style="font-weight: 900; font-size: 24px; color: #111827; letter-spacing: -0.5px; line-height: 1.1;">Внесено решту оплати</span>
                <span style="font-size: 14px; color: #6B7280; font-weight: 600;">Підтвердження доплати</span>
            </div>
            <span style="font-size: 13px; font-weight: 900; letter-spacing: 0.5px; background: ${methodStyle.bg}; border: 2px solid ${methodStyle.border}; color: ${methodStyle.color}; padding: 10px 18px; border-radius: 10px; white-space: nowrap;">${methodStyle.label}</span>
        </div>

        <div style="font-size: 16px; display: flex; flex-direction: column; gap: 14px;">
            <div style="${rowStyle}">
                <span style="${labelStyle}">${iconCottage} Котедж:</span>
                <span style="${valStyle}; font-size: 18px;">${cottageDisplayPay}</span>
            </div>
            <div style="${rowStyle}">
                <span style="${labelStyle}">${iconUser} Гість:</span>
                <span style="${valStyle}">${String(b.name || "Гість").replace(" (Ручна бронь)", "")}</span>
            </div>
            <div style="${rowStyle}">
                <span style="${labelStyle}">${iconUser} Телефон:</span>
                <span style="${valStyle}">${displayPhone || "—"}</span>
            </div>
            <div style="${rowStyle}">
                <span style="${labelStyle}">${iconCalendar} Дати:</span>
                <span style="${valStyle}; color: #556B2F; font-size: 16px;">${inDate} — ${outDate}</span>
            </div>

            <div style="margin-top: 5px; padding: 18px 20px; background: #FAFAFA; border-radius: 12px; border: 1px dashed #D1D5DB;">
                <div style="${payRowStyle}; margin-bottom: 16px;">
                    <span style="${labelStyle}">${iconCash} Доплата:</span>
                    <span style="${payValStyle}">${formatMoneyUa(payAmount)}</span>
                </div>
                <div style="${payRowStyle}">
                    <span style="${labelStyle}">${iconSum} Загальна сума:</span>
                    <span style="${payValStyle}">${formatMoneyUa(total)}</span>
                </div>
                <div style="${payRowStyle}; margin-bottom: 0;">
                    <span style="${labelStyle}">${iconPaid} Всього внесено:</span>
                    <span style="${payValGreen}">${formatMoneyUa(paid)}</span>
                </div>
            </div>
        </div>

        <div style="margin-top: 25px; display: flex; align-items: center; justify-content: center; padding: 14px; border-radius: 10px; font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; background: ${finBg}; color: ${finColor}; border: 1px solid ${finBorder};">
            ${finText}
        </div>
    `;

  container.appendChild(card);
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      width: 800,
      height: container.offsetHeight,
      windowWidth: 800,
      scale: 2,
      backgroundColor: null,
      useCORS: true,
    });
    document.body.removeChild(container);
    return canvas.toDataURL("image/jpeg", 0.9);
  } catch (err) {
    console.error("Помилка скріншоту оплати:", err);
    if (document.body.contains(container)) document.body.removeChild(container);
    return null;
  }
}

export async function captureCleaningCard(b: BookingRecord): Promise<string | null> {
  const isHutshub = isHutshubBooking(b);
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "-9999px";
  container.style.width = "800px";
  container.style.background = isHutshub
    ? "linear-gradient(135deg, #C9D6D2 0%, #B2C4BE 100%)"
    : "linear-gradient(135deg, #2C351B 0%, #1A1F10 100%)";
  container.style.padding = "60px 120px";
  container.style.boxSizing = "border-box";
  container.style.fontFamily = "'Inter', sans-serif";
  container.style.display = "flex";
  container.style.justifyContent = "center";

  const card = document.createElement("div");
  card.style.width = "100%";
  card.style.background = "#FFFFFF";
  card.style.borderRadius = "20px";
  card.style.padding = "35px";
  card.style.boxShadow = "0 20px 40px rgba(0,0,0,0.4)";
  card.style.position = "relative";
  card.style.overflow = "hidden";

  const topAccent = document.createElement("div");
  topAccent.style.position = "absolute";
  topAccent.style.top = "0";
  topAccent.style.left = "0";
  topAccent.style.width = "100%";
  topAccent.style.height = "6px";
  topAccent.style.background = isHutshub
    ? "linear-gradient(90deg, #1A332A 0%, #4A6B5F 100%)"
    : "linear-gradient(90deg, #556B2F 0%, #8FBC8F 100%)";
  card.appendChild(topAccent);

  const iconCottage = `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #D97706; flex-shrink: 0;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>`;
  const iconCalendar = `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #3B82F6; flex-shrink: 0;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke-width="2"></rect><line x1="16" y1="2" x2="16" y2="6" stroke-width="2"></line><line x1="8" y1="2" x2="8" y2="6" stroke-width="2"></line><line x1="3" y1="10" x2="21" y2="10" stroke-width="2"></line></svg>`;
  const iconUsers = `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #0EA5E9;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>`;
  const iconPaw = `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #F97316;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>`;
  const iconClock = `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #8B5CF6;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
  const iconVat = `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #E11D48;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"></path></svg>`;

  let inDate = "—";
  let outDate = "—";
  try {
    if (b.checkIn)
      inDate = new Date(b.checkIn).toLocaleDateString("uk-UA", {
        day: "numeric",
        month: "long",
      });
    if (b.checkOut)
      outDate = new Date(b.checkOut).toLocaleDateString("uk-UA", {
        day: "numeric",
        month: "long",
      });
  } catch {
    /* ignore */
  }

  const roomsForClean = resolveRoomsList();
  const matchedCleanRoom = roomsForClean ? findRoomForBooking(b, roomsForClean) : null;
  const cottageDisplay = matchedCleanRoom
    ? adminRoomLabel(matchedCleanRoom)
    : String(b.cottage || "—");

  const rawComment = b.comment ? String(b.comment) : "";
  const hasVat = rawComment.includes("♨️ Чан: Так");
  const matchDay = rawComment.match(/👥 Денні гості[^:]*:\s*(\d+)/);
  const dayGuestsCount = matchDay ? matchDay[1] : 0;
  const matchEarly = rawComment.match(/🕒 Ранній заїзд: з (\d{2}:\d{2})/);
  const earlyTime = matchEarly ? matchEarly[1] : null;
  const matchLate = rawComment.match(/🕒 Пізній виїзд: до (\d{2}:\d{2})/);
  const lateTime = matchLate ? matchLate[1] : null;

  const cleanComment = rawComment
    .replace(/👥 Денні гості[^|]+(\|\s*)?/g, "")
    .replace(/♨️ Чан: Так\s*(\|\s*)?/g, "")
    .replace(/🇺🇦 УБД: Так\s*(\|\s*)?/g, "")
    .replace(/🕒 Ранній заїзд: з \d{2}:\d{2}(\s*\|\s*)?/g, "")
    .replace(/🕒 Пізній виїзд: до \d{2}:\d{2}(\s*\|\s*)?/g, "")
    .replace(/Коментар гостя:/gi, "")
    .replace(/^[|\s]+|[|\s]+$/g, "")
    .trim();

  let extraHtml = "";
  const rowStyle = `display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; font-size: 15px; color: #4B5563;`;
  const labelStyle = `display:flex; align-items:center; gap: 8px; font-weight: 600;`;
  const valStyle = `font-weight: 800; color: #556B2F;`;

  if (b.pets === "Так" || b.pets === true) {
    extraHtml += `<div style="${rowStyle}"><span style="${labelStyle}">${iconPaw} Тварини:</span> <span style="${valStyle}">Так</span></div>`;
  }
  if (Number(dayGuestsCount) > 0) {
    extraHtml += `<div style="${rowStyle}"><span style="${labelStyle}">${iconUsers} Денні гості:</span> <span style="${valStyle}">${dayGuestsCount} осіб</span></div>`;
  }
  if (earlyTime) {
    extraHtml += `<div style="${rowStyle}"><span style="${labelStyle}">${iconClock} Ранній заїзд:</span> <span style="${valStyle}">з ${earlyTime}</span></div>`;
  }
  if (lateTime) {
    extraHtml += `<div style="${rowStyle}"><span style="${labelStyle}">${iconClock} Пізній виїзд:</span> <span style="${valStyle}">до ${lateTime}</span></div>`;
  }
  if (hasVat) {
    extraHtml += `<div style="${rowStyle}"><span style="${labelStyle}">${iconVat} Чан:</span> <span style="${valStyle}">Так</span></div>`;
  }

  let commentHtml = "";
  if (cleanComment !== "") {
    commentHtml = `
            <div style="margin-top: 20px; padding: 16px; background: #F9FAFB; border-left: 4px solid #556B2F; border-radius: 6px; font-size: 15px; color: #374151;">
                <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #9CA3AF; margin-bottom: 8px; letter-spacing: 0.5px;">Коментар гостя</div>
                <div style="line-height: 1.4; font-weight: 500; font-style: italic;">"${cleanComment.replace(/\n/g, "<br>")}"</div>
            </div>
        `;
  }

  let guestWordTxt = "гостей";
  const guestsNum = Number(b.guests) || 2;
  const n = Math.abs(guestsNum) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) guestWordTxt = "гостей";
  else if (n1 > 1 && n1 < 5) guestWordTxt = "гості";
  else if (n1 === 1) guestWordTxt = "гість";

  const cleaningTitle = isHutshub ? "Нова бронь | Hutshub" : "Нова Бронь";
  const cleaningSubtitle = isHutshub ? "Підготовка котеджу" : "Наряд на підготовку";

  card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #E5E7EB; padding-bottom: 20px; margin-bottom: 20px;">
            <div style="display: flex; flex-direction: column; gap: 6px;">
                <span style="font-weight: 900; font-size: 24px; color: #111827; letter-spacing: -0.5px; line-height: 1.1;">${cleaningTitle}</span>
                <span style="font-size: 14px; color: #6B7280; font-weight: 600;">${cleaningSubtitle}</span>
            </div>
            <div style="text-align: right; display: flex; flex-direction: column; justify-content: center; gap: 8px;">
                <span style="font-size: 14px; color: ${isHutshub ? "#1A332A" : "#556B2F"}; font-weight: 800; background: ${isHutshub ? "rgba(255,255,255,0.45)" : "#F0FDF4"}; border: 1px solid ${isHutshub ? "rgba(26,51,42,0.12)" : "#DCF1D3"}; padding: 8px 16px; border-radius: 8px; white-space: nowrap;">${guestsNum} ${guestWordTxt.toUpperCase()}</span>
            </div>
        </div>
        
        <div style="font-size: 16px; color: #4B5563; display: flex; flex-direction: column; gap: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #6B7280; font-weight: 600; display:flex; align-items:center;">
                    <span style="margin-right:8px; display:flex;">${iconCottage}</span> Котедж:
                </span> 
                <span style="font-weight: 800; color: #111827; font-size: 18px; text-align: right;">${cottageDisplay}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #6B7280; font-weight: 600; display:flex; align-items:center;">
                    <span style="margin-right:8px; display:flex;">${iconCalendar}</span> Дати:
                </span> 
                <span style="font-weight: 800; color: ${isHutshub ? "#1A332A" : "#556B2F"}; font-size: 17px; text-align: right;">${inDate} — ${outDate}</span>
            </div>
            
            ${!isHutshub && extraHtml ? `<div style="margin-top: 5px; padding: 18px 20px; background: #FAFAFA; border-radius: 12px; border: 1px dashed #D1D5DB;">${extraHtml}</div>` : ""}
        </div>

        ${!isHutshub ? commentHtml : ""}
    `;

  container.appendChild(card);
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      width: 800,
      height: container.offsetHeight,
      windowWidth: 800,
      scale: 2,
      backgroundColor: null,
      useCORS: true,
    });
    document.body.removeChild(container);
    return canvas.toDataURL("image/jpeg", 0.9);
  } catch (err) {
    if (document.body.contains(container)) document.body.removeChild(container);
    return null;
  }
}
