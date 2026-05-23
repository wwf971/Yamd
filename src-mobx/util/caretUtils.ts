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
  const textPoint = getTextPointAtOffset(element, offset);
  const selection = window.getSelection();
  if (!selection) return false;
  const range = document.createRange();
  if (textPoint) {
    range.setStart(textPoint.node, textPoint.offset);
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

export function getCaretOffsetByPoint(element: HTMLElement | null, x: number, y: number) {
  if (!element) return 0;
  const documentWithCaret = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (documentWithCaret.caretRangeFromPoint) {
    const range = documentWithCaret.caretRangeFromPoint(x, y);
    if (range && element.contains(range.startContainer)) {
      return getOffsetFromNodePoint(element, range.startContainer, range.startOffset);
    }
  }
  if (documentWithCaret.caretPositionFromPoint) {
    const position = documentWithCaret.caretPositionFromPoint(x, y);
    if (position && element.contains(position.offsetNode)) {
      return getOffsetFromNodePoint(element, position.offsetNode, position.offset);
    }
  }
  return getClosestOffsetByPoint(element, x, y);
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

function getTextPointAtOffset(element: HTMLElement, offset: number) {
  const offsetTarget = clampOffset(element, offset);
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let offsetPassed = 0;
  let nodeLast: Node | null = null;
  while (true) {
    const node = walker.nextNode();
    if (!node) break;
    nodeLast = node;
    const textLength = String(node.textContent || '').length;
    if (offsetTarget <= offsetPassed + textLength) {
      return {
        node,
        offset: Math.max(0, offsetTarget - offsetPassed),
      };
    }
    offsetPassed += textLength;
  }
  if (!nodeLast) return null;
  return {
    node: nodeLast,
    offset: String(nodeLast.textContent || '').length,
  };
}

function getOffsetFromNodePoint(element: HTMLElement, nodeTarget: Node, offset: number) {
  const range = document.createRange();
  try {
    range.selectNodeContents(element);
    range.setEnd(nodeTarget, Math.max(0, Number(offset || 0)));
    return clampOffset(element, range.toString().length);
  } catch {
    return clampOffset(element, offset);
  }
}

function getClosestOffsetByPoint(element: HTMLElement, x: number, y: number) {
  const textLength = getTextLength(element);
  let offsetBest = 0;
  let distanceBest = Number.POSITIVE_INFINITY;
  for (let offset = 0; offset <= textLength; offset += 1) {
    const rect = getRectAtOffset(element, offset);
    if (!rect) continue;
    const xCurrent = offset > 0 ? rect.right : rect.left;
    const yCurrent = rect.top + rect.height / 2;
    const distance = Math.abs(xCurrent - x) + Math.abs(yCurrent - y) * 4;
    if (distance < distanceBest) {
      distanceBest = distance;
      offsetBest = offset;
    }
  }
  return offsetBest;
}

function getRectAtOffset(element: HTMLElement, offset: number) {
  const textPoint = getTextPointAtOffset(element, offset);
  if (!textPoint) return null;
  const textLength = getTextLength(element);
  const range = document.createRange();
  if (offset > 0) {
    const pointPrev = getTextPointAtOffset(element, offset - 1);
    if (!pointPrev) return null;
    range.setStart(pointPrev.node, pointPrev.offset);
    range.setEnd(textPoint.node, textPoint.offset);
  } else if (textLength > 0) {
    const pointNext = getTextPointAtOffset(element, 1);
    if (!pointNext) return null;
    range.setStart(textPoint.node, textPoint.offset);
    range.setEnd(pointNext.node, pointNext.offset);
  } else {
    return element.getBoundingClientRect();
  }
  const rect = range.getBoundingClientRect();
  return rect.width || rect.height ? rect : null;
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
