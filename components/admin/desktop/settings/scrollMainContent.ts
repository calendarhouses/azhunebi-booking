const DEFAULT_OFFSET = 20;
const DEFAULT_DURATION_MS = 720;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function getMainContentScrollContainer(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(".boso-admin-mobile .main-content") ??
    document.querySelector<HTMLElement>(".main-content")
  );
}

let activeScrollRaf: number | null = null;
let userScrollCancelCleanup: (() => void) | null = null;

function detachUserScrollCancel(): void {
  userScrollCancelCleanup?.();
  userScrollCancelCleanup = null;
}

function attachUserScrollCancel(main: HTMLElement): void {
  detachUserScrollCancel();
  const cancel = () => {
    if (activeScrollRaf != null) {
      cancelAnimationFrame(activeScrollRaf);
      activeScrollRaf = null;
    }
    detachUserScrollCancel();
  };
  main.addEventListener("wheel", cancel, { passive: true, once: true });
  main.addEventListener("touchstart", cancel, { passive: true, once: true });
  userScrollCancelCleanup = () => {
    main.removeEventListener("wheel", cancel);
    main.removeEventListener("touchstart", cancel);
  };
}

function cancelActiveMainScroll(): void {
  if (activeScrollRaf != null) {
    cancelAnimationFrame(activeScrollRaf);
    activeScrollRaf = null;
  }
  detachUserScrollCancel();
}

export function scrollMainContentToElement(
  target: HTMLElement | null | undefined,
  options?: { offset?: number; durationMs?: number }
): void {
  if (!target) return;
  const main = getMainContentScrollContainer();
  if (!main) return;

  const offset = options?.offset ?? DEFAULT_OFFSET;
  const durationMs = options?.durationMs ?? DEFAULT_DURATION_MS;

  if (activeScrollRaf != null) {
    cancelAnimationFrame(activeScrollRaf);
    activeScrollRaf = null;
  }
  detachUserScrollCancel();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const targetTop = target.getBoundingClientRect().top;
      const mainTop = main.getBoundingClientRect().top;
      const destination = Math.max(0, main.scrollTop + (targetTop - mainTop) - offset);
      const start = main.scrollTop;
      const distance = destination - start;

      if (Math.abs(distance) < 2) return;

      cancelActiveMainScroll();
      attachUserScrollCancel(main);

      const startTime = performance.now();

      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / durationMs, 1);
        main.scrollTop = start + distance * easeInOutCubic(progress);
        if (progress < 1) {
          activeScrollRaf = requestAnimationFrame(step);
        } else {
          activeScrollRaf = null;
          detachUserScrollCancel();
        }
      };

      activeScrollRaf = requestAnimationFrame(step);
    });
  });
}

export const DISCOUNT_ACTIVE_SECTION_HEADING_ID = "discount-active-section-heading";

export function scrollMainContentToId(
  elementId: string,
  options?: { offset?: number; durationMs?: number }
): void {
  scrollMainContentToElement(document.getElementById(elementId), options);
}

export function scrollMainContentToDiscountRow(
  discountKey: number,
  options?: { offset?: number; durationMs?: number }
): void {
  scrollMainContentToId(`discount-row-${discountKey}`, options);
}

export function scrollMainContentToScrollTop(
  scrollTop: number,
  options?: { durationMs?: number }
): void {
  const main = getMainContentScrollContainer();
  if (!main) return;

  const durationMs = options?.durationMs ?? DEFAULT_DURATION_MS;
  const maxScroll = Math.max(0, main.scrollHeight - main.clientHeight);
  const destination = Math.max(0, Math.min(maxScroll, scrollTop));
  const start = main.scrollTop;
  const distance = destination - start;

  if (Math.abs(distance) < 2) return;

  cancelActiveMainScroll();
  attachUserScrollCancel(main);

  const startTime = performance.now();

  const step = (now: number) => {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / durationMs, 1);
    main.scrollTop = start + distance * easeInOutCubic(progress);
    if (progress < 1) {
      activeScrollRaf = requestAnimationFrame(step);
    } else {
      activeScrollRaf = null;
      detachUserScrollCancel();
    }
  };

  activeScrollRaf = requestAnimationFrame(step);
}

/** Після зміни фільтра: вгору якщо скрол за межами сторінки; при зростанні контенту — до growScrollElementId або низу. */
export function scrollMainContentAfterFilterChange(options: {
  scrollTopBefore: number;
  scrollHeightBefore: number;
  clientHeightBefore: number;
  maxScrollBefore: number;
  durationMs?: number;
  /** Замість скролу в самий низ — до цього елемента (напр. «ТВОЇ АКТИВНІ ЗНИЖКИ»). */
  growScrollElementId?: string;
}): void {
  const main = getMainContentScrollContainer();
  if (!main) return;

  const durationMs = options.durationMs ?? 380;
  const maxScrollAfter = Math.max(0, main.scrollHeight - main.clientHeight);
  const current = main.scrollTop;

  const needsPullUp = options.scrollTopBefore > maxScrollAfter + 2;

  if (needsPullUp) {
    const startScroll = Math.max(current, options.scrollTopBefore);
    const pad = Math.max(0, startScroll - maxScrollAfter);
    if (pad > 0) {
      main.style.paddingBottom = `${pad}px`;
      main.scrollTop = startScroll;
    }
    scrollMainContentToScrollTop(maxScrollAfter, { durationMs });
    window.setTimeout(() => {
      main.style.paddingBottom = "";
    }, durationMs + 40);
    return;
  }

  const wasAtPageBottom =
    options.scrollTopBefore + options.clientHeightBefore >= options.scrollHeightBefore - 32;

  if (wasAtPageBottom && maxScrollAfter > options.maxScrollBefore + 2) {
    const capTarget = options.growScrollElementId
      ? document.getElementById(options.growScrollElementId)
      : null;
    if (capTarget) {
      scrollMainContentToElement(capTarget, { offset: 16, durationMs });
    } else {
      scrollMainContentToScrollTop(maxScrollAfter, { durationMs });
    }
  }
}
