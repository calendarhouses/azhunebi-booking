export const DRAG_SCROLL_EDGE = 56;
export const DRAG_SCROLL_EDGE_VIEWPORT = 72;
export const DRAG_SCROLL_MAX_STEP = 18;

export type DragScrollTargets = {
  horizontal?: HTMLElement | null;
  vertical?: HTMLElement | null;
  verticalSync?: HTMLElement | null;
  verticalPage?: HTMLElement | null;
};

export type DragScrollOptions = {
  /**
   * Detect proximity using the visual viewport edges (finger near screen edge)
   * instead of only the scroll container bounds.
   */
  viewportEdges?: boolean;
  edgePx?: number;
};

function edgeScrollDelta(
  clientPos: number,
  edgeStart: number,
  edgeEnd: number,
  edgePx: number
): number {
  if (clientPos < edgeStart + edgePx) {
    const depth = edgeStart + edgePx - clientPos;
    const t = Math.min(1, depth / edgePx);
    return -t * DRAG_SCROLL_MAX_STEP;
  }
  if (clientPos > edgeEnd - edgePx) {
    const depth = clientPos - (edgeEnd - edgePx);
    const t = Math.min(1, depth / edgePx);
    return t * DRAG_SCROLL_MAX_STEP;
  }
  return 0;
}

function viewportSize() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

/** Пряма мутація scrollLeft/scrollTop без React. Повертає true, якщо скрол змінився. */
export function applyDragEdgeScroll(
  clientX: number,
  clientY: number,
  targets: DragScrollTargets,
  options?: DragScrollOptions
): boolean {
  let scrolled = false;
  const viewportEdges = Boolean(options?.viewportEdges);
  const edgePx = options?.edgePx ?? (viewportEdges ? DRAG_SCROLL_EDGE_VIEWPORT : DRAG_SCROLL_EDGE);
  const vp = viewportEdges ? viewportSize() : null;

  const horizontal = targets.horizontal;
  if (horizontal) {
    const rect = horizontal.getBoundingClientRect();
    const left = viewportEdges && vp ? 0 : rect.left;
    const right = viewportEdges && vp ? vp.width : rect.right;
    const deltaX = edgeScrollDelta(clientX, left, right, edgePx);
    if (deltaX !== 0) {
      horizontal.scrollLeft += deltaX;
      scrolled = true;
    }
  }

  const vertical = targets.vertical;
  if (vertical) {
    const rect = vertical.getBoundingClientRect();
    const top = viewportEdges && vp ? 0 : rect.top;
    const bottom = viewportEdges && vp ? vp.height : rect.bottom;
    const deltaY = edgeScrollDelta(clientY, top, bottom, edgePx);
    if (deltaY !== 0) {
      vertical.scrollTop += deltaY;
      scrolled = true;
    }
    if (scrolled && targets.verticalSync) {
      targets.verticalSync.scrollTop = vertical.scrollTop;
    }
  }

  const verticalPage = targets.verticalPage;
  if (verticalPage) {
    const rect = verticalPage.getBoundingClientRect();
    const top = viewportEdges && vp ? 0 : rect.top;
    const bottom = viewportEdges && vp ? vp.height : rect.bottom;
    const deltaY = edgeScrollDelta(clientY, top, bottom, edgePx);
    if (deltaY !== 0) {
      verticalPage.scrollTop += deltaY;
      scrolled = true;
    }
  }

  return scrolled;
}

export function isNearDragScrollEdge(
  clientX: number,
  clientY: number,
  targets: DragScrollTargets,
  options?: DragScrollOptions
): boolean {
  const viewportEdges = Boolean(options?.viewportEdges);
  const edgePx = options?.edgePx ?? (viewportEdges ? DRAG_SCROLL_EDGE_VIEWPORT : DRAG_SCROLL_EDGE);
  const vp = viewportEdges && typeof window !== "undefined" ? viewportSize() : null;

  const nearBand = (pos: number, start: number, end: number) =>
    pos < start + edgePx || pos > end - edgePx;

  if (viewportEdges && vp) {
    if (nearBand(clientX, 0, vp.width) || nearBand(clientY, 0, vp.height)) {
      if (targets.horizontal || targets.vertical || targets.verticalPage) return true;
    }
    return false;
  }

  const horizontal = targets.horizontal;
  if (horizontal) {
    const rect = horizontal.getBoundingClientRect();
    if (nearBand(clientX, rect.left, rect.right) || nearBand(clientY, rect.top, rect.bottom)) {
      return true;
    }
  }

  const vertical = targets.vertical;
  if (vertical && vertical !== horizontal) {
    const rect = vertical.getBoundingClientRect();
    if (nearBand(clientY, rect.top, rect.bottom)) return true;
  }

  const verticalPage = targets.verticalPage;
  if (verticalPage) {
    const rect = verticalPage.getBoundingClientRect();
    if (nearBand(clientY, rect.top, rect.bottom)) return true;
  }

  return false;
}
