export const DRAG_SCROLL_EDGE = 56;
export const DRAG_SCROLL_MAX_STEP = 18;

export type DragScrollTargets = {
  horizontal?: HTMLElement | null;
  vertical?: HTMLElement | null;
  verticalSync?: HTMLElement | null;
  verticalPage?: HTMLElement | null;
};

function edgeScrollDelta(clientPos: number, edgeStart: number, edgeEnd: number): number {
  if (clientPos < edgeStart + DRAG_SCROLL_EDGE) {
    const depth = edgeStart + DRAG_SCROLL_EDGE - clientPos;
    const t = Math.min(1, depth / DRAG_SCROLL_EDGE);
    return -t * DRAG_SCROLL_MAX_STEP;
  }
  if (clientPos > edgeEnd - DRAG_SCROLL_EDGE) {
    const depth = clientPos - (edgeEnd - DRAG_SCROLL_EDGE);
    const t = Math.min(1, depth / DRAG_SCROLL_EDGE);
    return t * DRAG_SCROLL_MAX_STEP;
  }
  return 0;
}

/** Пряма мутація scrollLeft/scrollTop без React. Повертає true, якщо скрол змінився. */
export function applyDragEdgeScroll(clientX: number, clientY: number, targets: DragScrollTargets): boolean {
  let scrolled = false;

  const horizontal = targets.horizontal;
  if (horizontal) {
    const rect = horizontal.getBoundingClientRect();
    const deltaX = edgeScrollDelta(clientX, rect.left, rect.right);
    if (deltaX !== 0) {
      horizontal.scrollLeft += deltaX;
      scrolled = true;
    }
  }

  const vertical = targets.vertical;
  if (vertical) {
    const rect = vertical.getBoundingClientRect();
    const deltaY = edgeScrollDelta(clientY, rect.top, rect.bottom);
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
    const deltaY = edgeScrollDelta(clientY, rect.top, rect.bottom);
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
  targets: DragScrollTargets
): boolean {
  const horizontal = targets.horizontal;
  if (horizontal) {
    const rect = horizontal.getBoundingClientRect();
    if (clientX < rect.left + DRAG_SCROLL_EDGE || clientX > rect.right - DRAG_SCROLL_EDGE) {
      return true;
    }
    if (clientY < rect.top + DRAG_SCROLL_EDGE || clientY > rect.bottom - DRAG_SCROLL_EDGE) {
      return true;
    }
  }

  const verticalPage = targets.verticalPage;
  if (verticalPage) {
    const rect = verticalPage.getBoundingClientRect();
    if (clientY < rect.top + DRAG_SCROLL_EDGE || clientY > rect.bottom - DRAG_SCROLL_EDGE) {
      return true;
    }
  }

  return false;
}
