type ConfirmBridge = {
  openCustomConfirm?: (title: string, desc: string, action: () => void) => void;
  closeCustomConfirm?: () => void;
};

function bridgeWindow(): ConfirmBridge | null {
  if (typeof window === "undefined") return null;
  return window as Window & ConfirmBridge;
}

/** Відкриває підтвердження через React-модалку (window bridge), якщо доступна. */
export function openCustomConfirm(
  title: string,
  desc: string,
  action: () => void
): void {
  const bridge = bridgeWindow()?.openCustomConfirm;
  if (bridge && bridge !== openCustomConfirm) {
    bridge(title, desc, action);
    return;
  }

  const titleEl = document.getElementById("confirmModalTitle");
  const descEl = document.getElementById("confirmModalDesc");
  const btn = document.getElementById("confirmModalActionBtn");
  const modal = document.getElementById("customConfirmModal");
  if (!titleEl || !descEl || !btn || !modal) return;
  titleEl.innerText = title;
  descEl.innerText = desc;
  btn.onclick = action;
  modal.classList.add("active");
}

export function closeCustomConfirm(): void {
  const bridge = bridgeWindow()?.closeCustomConfirm;
  if (bridge && bridge !== closeCustomConfirm) {
    bridge();
  }
  document.getElementById("customConfirmModal")?.classList.remove("active");
}
