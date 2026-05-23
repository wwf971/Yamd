export type CaretMousePoint = {
  x?: number;
  y?: number;
  clientX?: number;
  clientY?: number;
  xRatio?: number;
};

export function getCaretOffset(element: HTMLElement | null) {
  if (!element) return 0;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;
  const anchorNode = selection.anchorNode;
  if (!anchorNode || !element.contains(anchorNode)) return 0;
  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  return clampOffset(element, preCaretRange.toString().length);
}

export function isCaretAtStart(element: HTMLElement | null) {
  return getCaretOffset(element) <= 0;
}

export function isCaretAtEnd(element: HTMLElement | null) {
  if (!element) return false;
  return getCaretOffset(element) >= getTextLength(element);
}

export function applyCaretByOffset(element: HTMLElement | null, offset: number) {
  if (!element) return false;
  const textNode = getTextNode(element);
  const selection = window.getSelection();
  if (!selection) return false;
  const range = document.createRange();
  if (textNode) {
    range.setStart(textNode, clampOffset(element, offset));
  } else {
    range.setStart(element, 0);
  }
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

export function applyCaretByPoint(element: HTMLElement | null, x: number, y: number) {
  if (!element) return false;
  const documentWithCaret = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (documentWithCaret.caretRangeFromPoint) {
    const range = documentWithCaret.caretRangeFromPoint(x, y);
    if (!range || !element.contains(range.startContainer)) return false;
    const selection = window.getSelection();
    if (!selection) return false;
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }
  if (documentWithCaret.caretPositionFromPoint) {
    const position = documentWithCaret.caretPositionFromPoint(x, y);
    if (!position || !element.contains(position.offsetNode)) return false;
    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    const selection = window.getSelection();
    if (!selection) return false;
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }
  return false;
}

export function applyCaretByDirection(
  element: HTMLElement | null,
  direction: string,
  mousePoint?: CaretMousePoint | null,
) {
  if (!element) return false;
  if (mousePoint) {
    const point = getClampedMousePoint(element, mousePoint, direction);
    if (applyCaretByPoint(element, point.x, point.y)) {
      return true;
    }
  }
  const isStartDirection = direction === 'fromLeft' || direction === 'fromAbove' || direction === 'fromUp';
  return applyCaretByOffset(element, isStartDirection ? 0 : getTextLength(element));
}

export function getCaretClientX(element: HTMLElement | null) {
  if (!element) return 0;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return element.getBoundingClientRect().left;
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (rect.width || rect.height) return rect.left;
  const fallbackRect = getCaretRect(element);
  if (!fallbackRect) return element.getBoundingClientRect().left;
  return getCaretOffset(element) > 0 ? fallbackRect.right : fallbackRect.left;
}

export function isCaretOnFirstLine(element: HTMLElement | null, threshold = 5) {
  if (!element) return false;
  const caretRect = getCaretRect(element);
  if (!caretRect) return true;
  const firstRect = getLineEdgeRect(element, 'first');
  if (!firstRect) return true;
  return Math.abs(caretRect.top - firstRect.top) <= threshold;
}

export function isCaretOnLastLine(element: HTMLElement | null, threshold = 5) {
  if (!element) return false;
  const caretRect = getCaretRect(element);
  if (!caretRect) return true;
  const lastRect = getLineEdgeRect(element, 'last');
  if (!lastRect) return true;
  return Math.abs(caretRect.bottom - lastRect.bottom) <= threshold;
}

export function getTextLength(element: HTMLElement | null) {
  return String(element?.textContent || '').length;
}

export function getClampedMousePoint(
  element: HTMLElement,
  mousePoint: CaretMousePoint,
  direction: string,
) {
  const rect = element.getBoundingClientRect();
  const lineBounds = getTextLineBounds(element);
  const xMin = rect.left + 1;
  const xMax = rect.right - 1;
  const yMin = (lineBounds?.top ?? rect.top) + 1;
  const yMax = (lineBounds?.bottom ?? rect.bottom) - 1;
  const xRaw = Number.isFinite(mousePoint.x)
    ? Number(mousePoint.x)
    : (Number.isFinite(mousePoint.clientX)
      ? Number(mousePoint.clientX)
      : (Number.isFinite(mousePoint.xRatio) ? rect.left + rect.width * Number(mousePoint.xRatio) : rect.left + rect.width / 2));
  const x = Math.min(xMax, Math.max(xMin, xRaw));
  let yTarget = Number.isFinite(mousePoint.y)
    ? Number(mousePoint.y)
    : (Number.isFinite(mousePoint.clientY) ? Number(mousePoint.clientY) : rect.top + rect.height / 2);
  if (direction === 'fromAbove') {
    yTarget = yMin;
  } else if (direction === 'fromBelow') {
    yTarget = yMax;
  }
  const y = Math.min(yMax, Math.max(yMin, yTarget));
  return { x, y };
}

function clampOffset(element: HTMLElement, offset: number) {
  return Math.min(getTextLength(element), Math.max(0, Number(offset || 0)));
}

function getTextNode(element: HTMLElement) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  return walker.nextNode();
}

function getCaretRect(element: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer)) return null;
  const rect = range.getBoundingClientRect();
  if (rect.width || rect.height) return rect;
  const rects = range.getClientRects();
  if (rects.length > 0) return rects[0];
  const textNode = getTextNode(element);
  if (!textNode) return null;
  const offset = clampOffset(element, getCaretOffset(element));
  const textLength = getTextLength(element);
  const rangeFallback = document.createRange();
  if (offset > 0) {
    rangeFallback.setStart(textNode, offset - 1);
    rangeFallback.setEnd(textNode, offset);
  } else if (textLength > 0) {
    rangeFallback.setStart(textNode, 0);
    rangeFallback.setEnd(textNode, 1);
  } else {
    return element.getBoundingClientRect();
  }
  const rectFallback = rangeFallback.getBoundingClientRect();
  return rectFallback.width || rectFallback.height ? rectFallback : null;
}

function getLineEdgeRect(element: HTMLElement, edge: 'first' | 'last') {
  const range = document.createRange();
  range.selectNodeContents(element);
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 || rect.height > 0);
  if (rects.length === 0) return null;
  return edge === 'first' ? rects[0] : rects[rects.length - 1];
}

function getTextLineBounds(element: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(element);
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 || rect.height > 0);
  if (rects.length === 0) {
    return null;
  }
  let top = rects[0].top;
  let bottom = rects[0].bottom;
  for (const rect of rects) {
    if (rect.top < top) top = rect.top;
    if (rect.bottom > bottom) bottom = rect.bottom;
  }
  return { top, bottom };
}
