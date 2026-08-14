// Measure the caret position for a text offset, relative to the root
// element, without touching the DOM selection. Used by the pseudo-element
// caret in dom caret mode.
export function calcCaretOverlayPos(rootEl: HTMLElement, offset: number) {
  const rootRect = rootEl.getBoundingClientRect();
  const posFallback = { left: 1, top: 0, height: rootRect.height || 16 };
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
  let offsetRemain = Math.max(0, Number(offset || 0));
  let nodeText: Text | null = null;
  let offsetLocal = 0;
  let nodeCurrent = walker.nextNode() as Text | null;
  while (nodeCurrent) {
    const lengthNode = nodeCurrent.textContent?.length || 0;
    if (offsetRemain <= lengthNode) {
      nodeText = nodeCurrent;
      offsetLocal = offsetRemain;
      break;
    }
    offsetRemain -= lengthNode;
    nodeText = nodeCurrent;
    offsetLocal = lengthNode;
    nodeCurrent = walker.nextNode() as Text | null;
  }
  if (!nodeText) {
    return posFallback;
  }
  const range = document.createRange();
  range.setStart(nodeText, Math.min(offsetLocal, nodeText.textContent?.length || 0));
  range.collapse(true);
  const rectList = range.getClientRects();
  const rect = rectList.length > 0 ? rectList[0] : range.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    return posFallback;
  }
  return {
    left: rect.left - rootRect.left,
    top: rect.top - rootRect.top,
    height: rect.height || rootRect.height || 16,
  };
}

export function calcTextSegBulletPosition(textEl: HTMLElement | null, basisEl: HTMLElement | null) {
  if (!textEl) {
    return { posYBulletPreferred: null, messageBulletMeasure: 'TextSeg element missing.' };
  }
  if (!basisEl) {
    return { posYBulletPreferred: null, messageBulletMeasure: 'Basis element missing.' };
  }
  const basisRect = basisEl.getBoundingClientRect();
  const lineRect = getFirstTextLineRect(textEl) || getFallbackLineRect(textEl);
  if (!lineRect) {
    return { posYBulletPreferred: null, messageBulletMeasure: 'Text line missing.' };
  }
  return {
    posYBulletPreferred: lineRect.top - basisRect.top + lineRect.height * 0.55,
    messageBulletMeasure: 'measured',
  };
}

export function resetCaretBlink(rootEl: HTMLElement | null) {
  if (!rootEl?.getAnimations) return;
  for (const animation of rootEl.getAnimations({ subtree: true })) {
    if ((animation as CSSAnimation).animationName !== 'mobx-text-seg-caret-blink') continue;
    animation.currentTime = 0;
    animation.play();
  }
}

export function createTextSegRenderDebugText(compId: string, text: string, counterRender: number) {
  const textMain = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 32);
  return `render ${counterRender} id ${compId} text ${textMain}`;
}

export function applyRangeSelectionByOffset(element: HTMLElement | null, offsetStart: number, offsetEnd: number) {
  if (!element) return false;
  const pointStart = getDomPointAtOffset(element, offsetStart);
  const pointEnd = getDomPointAtOffset(element, offsetEnd);
  const selection = window.getSelection();
  if (!pointStart || !pointEnd || !selection) return false;
  const range = document.createRange();
  range.setStart(pointStart.node, pointStart.offset);
  range.setEnd(pointEnd.node, pointEnd.offset);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

export function getDomPointAtOffset(element: HTMLElement, offsetRaw: number) {
  const offsetTarget = Math.min(
    String(element.textContent || '').length,
    Math.max(0, Number(offsetRaw || 0)),
  );
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let offsetPassed = 0;
  let textNodeLast: Node | null = null;
  while (true) {
    const nodeCurrent = walker.nextNode();
    if (!nodeCurrent) break;
    textNodeLast = nodeCurrent;
    const textLength = String(nodeCurrent.textContent || '').length;
    if (offsetTarget <= offsetPassed + textLength) {
      return {
        node: nodeCurrent,
        offset: Math.max(0, offsetTarget - offsetPassed),
      };
    }
    offsetPassed += textLength;
  }
  if (textNodeLast) {
    return {
      node: textNodeLast,
      offset: String(textNodeLast.textContent || '').length,
    };
  }
  return {
    node: element,
    offset: 0,
  };
}

function getFirstTextLineRect(textEl: HTMLElement) {
  const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT);
  const lineHeight = getLineHeight(textEl);
  while (true) {
    const nodeCurrent = walker.nextNode();
    if (!nodeCurrent) break;
    const textCurrent = String(nodeCurrent.textContent || '');
    if (!textCurrent) continue;
    const range = document.createRange();
    range.setStart(nodeCurrent, 0);
    range.setEnd(nodeCurrent, Math.min(1, textCurrent.length));
    const rect = Array.from(range.getClientRects())[0] || null;
    range.detach?.();
    if (rect && rect.height > 0) {
      return {
        top: rect.top + (rect.height - lineHeight) / 2,
        height: lineHeight,
      };
    }
  }
  return null;
}

function getFallbackLineRect(textEl: HTMLElement) {
  const rect = textEl.getBoundingClientRect();
  const lineHeight = getLineHeight(textEl);
  return {
    top: rect.top,
    height: lineHeight,
  };
}

function getLineHeight(textEl: HTMLElement) {
  const style = window.getComputedStyle(textEl);
  const fontSize = Number.parseFloat(style.fontSize) || 14;
  return Number.parseFloat(style.lineHeight) || fontSize * 1.25;
}
