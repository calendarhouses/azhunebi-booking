/** Кастомні селекти та chip-кнопки (логіка з Vanilla JS) */

export const ADMIN_SELECTABLE_SOURCES = [
  "Адмінка",
  "Instagram",
  "Telegram",
  "Телефон",
] as const;

export function toggleCustomSelect(wrapperId: string): void {
  const wrapper = document.getElementById(wrapperId);
  if (wrapper?.classList.contains("source-readonly")) return;
  document.querySelectorAll(".custom-select-wrapper").forEach((w) => {
    if (w.id !== wrapperId) w.classList.remove("open");
  });
  wrapper?.classList.toggle("open");
}

export function selectOption(
  wrapperId: string,
  inputId: string,
  value: string,
  element: HTMLElement | null = null,
  displayText: string | null = null
): void {
  const input = document.getElementById(inputId) as HTMLInputElement | null;
  const wrapper = document.getElementById(wrapperId);
  const span = wrapper?.querySelector("span");
  if (input) input.value = value;
  if (span) span.innerText = displayText || value;
  wrapper?.classList.remove("open");

  if (element) {
    wrapper?.querySelectorAll(".custom-option").forEach((opt) => {
      opt.classList.remove("selected");
    });
    element.classList.add("selected");
  }

  if (inputId === "adminCottage") {
    (window as Window & { updatePricePreview?: () => void }).updatePricePreview?.();
  }
  if (inputId === "reportPeriodVal") {
    const w = window as Window & { reportRangePicker?: { clear: () => void }; calculateAnalytics?: () => void };
    if (value !== "custom" && w.reportRangePicker) w.reportRangePicker.clear();
    w.calculateAnalytics?.();
  }
}

export function setBookingSourceDefault(): void {
  const def = "Адмінка";
  const wrapper = document.getElementById("sourceWrapper");
  wrapper?.classList.remove("source-readonly");
  const input = document.getElementById("adminSource") as HTMLInputElement | null;
  const text = document.getElementById("sourceSelectedText");
  if (input) input.value = def;
  if (text) text.innerText = def;
  document.querySelectorAll("#sourceWrapper .custom-option").forEach((opt) => {
    opt.classList.remove("selected");
    if (opt.textContent?.trim() === def) opt.classList.add("selected");
  });
}

export function setBookingSourceFromSaved(savedSource: string): void {
  let src = savedSource || "Адмінка";
  if (src === "Telegram Бот") src = "Telegram";
  const wrapper = document.getElementById("sourceWrapper");

  if (src === "Сайт") {
    wrapper?.classList.add("source-readonly");
    const input = document.getElementById("adminSource") as HTMLInputElement | null;
    const text = document.getElementById("sourceSelectedText");
    if (input) input.value = "Сайт";
    if (text) text.innerText = "Сайт";
    document.querySelectorAll("#sourceWrapper .custom-option").forEach((opt) => {
      opt.classList.remove("selected");
    });
    return;
  }

  wrapper?.classList.remove("source-readonly");
  if (!ADMIN_SELECTABLE_SOURCES.includes(src as (typeof ADMIN_SELECTABLE_SOURCES)[number])) {
    src = "Адмінка";
  }
  const input = document.getElementById("adminSource") as HTMLInputElement | null;
  const text = document.getElementById("sourceSelectedText");
  if (input) input.value = src;
  if (text) text.innerText = src;
  document.querySelectorAll("#sourceWrapper .custom-option").forEach((opt) => {
    opt.classList.remove("selected");
    if (opt.textContent?.trim() === src) opt.classList.add("selected");
  });
}

export function closeCustomSelectsOnOutsideClick(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  if (!target.closest(".custom-select-wrapper")) {
    document.querySelectorAll(".custom-select-wrapper").forEach((w) => w.classList.remove("open"));
  }
}

export function toggleAllRoomsChip(): void {
  const allBtn = document.getElementById("chip-room-all");
  if (!allBtn) return;
  const isActive = !allBtn.classList.contains("active");
  if (isActive) {
    allBtn.classList.add("active");
    document.querySelectorAll(".room-chip").forEach((c) => c.classList.add("active"));
  } else {
    allBtn.classList.remove("active");
    document.querySelectorAll(".room-chip").forEach((c) => c.classList.remove("active"));
  }
}

export function toggleSingleRoomChip(el: HTMLElement): void {
  el.classList.toggle("active");
  const allChips = document.querySelectorAll(".room-chip");
  const activeChips = document.querySelectorAll(".room-chip.active");
  const allBtn = document.getElementById("chip-room-all");
  if (allChips.length === activeChips.length) allBtn?.classList.add("active");
  else allBtn?.classList.remove("active");
}

export function selectDayChip(el: HTMLElement): void {
  document.querySelectorAll(".day-chip").forEach((c) => c.classList.remove("active"));
  el.classList.add("active");
  const hidden = document.getElementById("mPriceDays") as HTMLInputElement | null;
  if (hidden) hidden.value = el.getAttribute("data-val") || "all";
}

export function selectPeriodChip(el: HTMLElement): void {
  document.querySelectorAll(".period-chip").forEach((c) => c.classList.remove("active"));
  el.classList.add("active");
  const hidden = document.getElementById("mPricePeriod") as HTMLInputElement | null;
  if (hidden) hidden.value = el.getAttribute("data-val") || "1";
}

export function toggleAllDiscRooms(): void {
  const allBtn = document.getElementById("chip-disc-room-all");
  if (!allBtn) return;
  const isActive = !allBtn.classList.contains("active");
  if (isActive) {
    allBtn.classList.add("active");
    document.querySelectorAll(".disc-room-chip").forEach((c) => c.classList.add("active"));
  } else {
    allBtn.classList.remove("active");
    document.querySelectorAll(".disc-room-chip").forEach((c) => c.classList.remove("active"));
  }
}

export function toggleSingleDiscRoom(el: HTMLElement): void {
  el.classList.toggle("active");
  const allChips = document.querySelectorAll(".disc-room-chip");
  const activeChips = document.querySelectorAll(".disc-room-chip.active");
  const allBtn = document.getElementById("chip-disc-room-all");
  if (allChips.length === activeChips.length) allBtn?.classList.add("active");
  else allBtn?.classList.remove("active");
}
