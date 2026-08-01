/** DOM-хелпери форми drawer (відповідність legacy onclick) */

import { formatRoomDisplayLabel } from "./bookingUtils";

export function setModeToggle(groupSelector: string, value: string, activeClass = "active"): void {
  document.querySelectorAll(groupSelector).forEach((el) => {
    const btn = el as HTMLElement;
    const match = btn.getAttribute("data-val") === value || btn.getAttribute("data-status") === value;
    btn.classList.toggle(activeClass, !!match);
  });
}

export function setHiddenInput(id: string, value: string): void {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (el) el.value = value;
}

export function togglePet(val: "Так" | "Ні"): void {
  setModeToggle(".pet-btn", val);
  setHiddenInput("adminPets", val);
}

export function toggleVat(val: "Так" | "Ні"): void {
  setModeToggle(".chan-btn", val);
  setHiddenInput("adminVat", val);
}

export function toggleUBD(val: "Так" | "Ні"): void {
  setModeToggle(".ubd-btn", val);
  setHiddenInput("adminUBD", val);
}

export function setBookingStatus(status: string): void {
  setModeToggle(".status-btn", status);
}

export function selectPayMethod(type: "prepay" | "surcharge", method: string): void {
  const hiddenInput = document.getElementById(
    type === "prepay" ? "adminPrepayMethod" : "adminSurchargeMethod"
  ) as HTMLInputElement | null;
  const container = document.getElementById(type === "prepay" ? "prepayMethods" : "surchargeMethods");
  if (hiddenInput) hiddenInput.value = method;
  container?.querySelectorAll(".pay-chip").forEach((chip) => {
    chip.classList.toggle("active", chip.getAttribute("data-method") === method);
  });
}

export function calculateBalanceLive(): void {
  const total = Number((document.getElementById("adminTotalPrice") as HTMLInputElement)?.value) || 0;
  const prepay = Number((document.getElementById("adminPrepayAmount") as HTMLInputElement)?.value) || 0;
  const surcharge =
    Number((document.getElementById("adminSurchargeAmount") as HTMLInputElement)?.value) || 0;
  const paid = prepay + surcharge;
  const balance = total - paid;

  const prepayBtnText = document.getElementById("prepayBtnText");
  if (prepayBtnText) prepayBtnText.innerText = String(Math.round(total / 2));

  const balEl = document.getElementById("adminBalance");
  if (!balEl) return;

  if (balance <= 0) {
    balEl.innerText = "Оплачено повністю (0 грн)";
    balEl.style.color = "#059669";
    balEl.style.background = "#D1FAE5";
    balEl.style.borderColor = "#A7F3D0";
  } else {
    balEl.innerText = `${balance} грн`;
    balEl.style.color = "#DC2626";
    balEl.style.background = "#FEE2E2";
    balEl.style.borderColor = "#FECACA";
  }

  const activeStatusBtn = document.querySelector(".status-btn.active");
  const currentStatus = activeStatusBtn?.getAttribute("data-status") || "";
  if (currentStatus === "Скасовано") return;
  if (paid > 0) {
    document.querySelectorAll(".status-btn").forEach((b) => b.classList.remove("active"));
    document.querySelector('.status-btn[data-status="Підтверджено"]')?.classList.add("active");
  } else if (currentStatus === "Підтверджено") {
    document.querySelectorAll(".status-btn").forEach((b) => b.classList.remove("active"));
    document.querySelector('.status-btn[data-status="Очікує оплату"]')?.classList.add("active");
  }
}

export function fillSurcharge(): void {
  const total = Number((document.getElementById("adminTotalPrice") as HTMLInputElement)?.value) || 0;
  const prepay = Number((document.getElementById("adminPrepayAmount") as HTMLInputElement)?.value) || 0;
  const remainder = total - prepay;
  if (remainder > 0) {
    (document.getElementById("adminSurchargeAmount") as HTMLInputElement).value = String(remainder);
    calculateBalanceLive();
  }
}

export function setHalfPrepayment(): void {
  const total = Number((document.getElementById("adminTotalPrice") as HTMLInputElement)?.value) || 0;
  const chip = document.getElementById("prepayBtnText");
  const fromPolicy = Number(chip?.textContent?.replace(/\s/g, "") || "");
  const amount =
    Number.isFinite(fromPolicy) && fromPolicy > 0 ? fromPolicy : Math.round(total / 2);
  (document.getElementById("adminPrepayAmount") as HTMLInputElement).value = String(amount);
  calculateBalanceLive();
}

export function renderCottageOptions(
  rooms: { id: string; name: string; label: string; desc: string }[],
  onSelect: (roomKey: string, display: string) => void
): void {
  const cottageOptions = document.getElementById("cottageOptions");
  if (!cottageOptions) return;
  cottageOptions.innerHTML = rooms
    .map((r) => {
      const desc = String(r.desc || "").trim();
      const descHtml = desc
        ? ` <span style="font-size:12px; color:#9CA3AF;">${desc}</span>`
        : "";
      const label = r.label || r.name;
      return `<div class="custom-option" data-room="${r.id}">${label}${descHtml}</div>`;
    })
    .join("");
  cottageOptions.querySelectorAll(".custom-option").forEach((el) => {
    el.addEventListener("click", () => {
      const roomKey = (el as HTMLElement).getAttribute("data-room") || "";
      const room = rooms.find((x) => x.id === roomKey);
      onSelect(roomKey, formatRoomDisplayLabel(room?.label || room?.name || roomKey, room?.desc));
    });
  });
}

export function resetFlexibleSchedule(): void {
  if (document.getElementById("adminCardEarly")) {
    document.getElementById("adminCardEarly")!.classList.remove("active");
  }
  if (document.getElementById("adminCardLate")) {
    document.getElementById("adminCardLate")!.classList.remove("active");
  }
  document.querySelectorAll(".t-chip").forEach((c) => c.classList.remove("selected"));
  const labelEarly = document.getElementById("adminLabelPriceEarly");
  const labelLate = document.getElementById("adminLabelPriceLate");
  if (labelEarly) labelEarly.innerHTML = "Оберіть час";
  if (labelLate) labelLate.innerHTML = "Оберіть час";
}

export function applyEarlyLateChips(early: string | null, late: string | null): void {
  if (early) {
    document.getElementById("adminCardEarly")?.classList.add("active");
    document.querySelectorAll("#adminCardEarly .t-chip").forEach((c) => {
      c.classList.toggle("selected", c.textContent?.trim() === early);
    });
  }
  if (late) {
    document.getElementById("adminCardLate")?.classList.add("active");
    document.querySelectorAll("#adminCardLate .t-chip").forEach((c) => {
      c.classList.toggle("selected", c.textContent?.trim() === late);
    });
  }
}
