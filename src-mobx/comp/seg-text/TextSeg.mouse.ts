import { getCaretOffsetByPoint } from '../../util/caretUtils';
import { getDomPointAtOffset } from './TextSeg.dom';

export function startSelectionDragFromTextSeg(
  segElAnchor: HTMLElement,
  clientXStart: number,
  clientYStart: number,
  onEnd: () => void,
) {
  const rootEl = segElAnchor.closest<HTMLElement>('[data-mobx-doc-id]') || document.body;
  const offsetAnchor = getCaretOffsetByPoint(segElAnchor, clientXStart, clientYStart);
  let isDraggingSelection = false;
  let isEnded = false;

  const cleanup = () => {
    if (isEnded) return;
    isEnded = true;
    window.removeEventListener('mousemove', handleMouseMove, true);
    window.removeEventListener('mouseup', handleMouseUp, true);
    onEnd();
  };

  const handleMouseMove = (event: MouseEvent) => {
    if ((event.buttons & 1) === 0) {
      cleanup();
      return;
    }
    if (!isDraggingSelection) {
      const distance = Math.abs(event.clientX - clientXStart) + Math.abs(event.clientY - clientYStart);
      if (distance <= 3) return;
      isDraggingSelection = true;
    }
    event.preventDefault();
    applySelectionFromTextSegDrag(rootEl, segElAnchor, offsetAnchor, event.clientX, event.clientY);
  };

  const handleMouseUp = () => {
    cleanup();
  };

  window.addEventListener('mousemove', handleMouseMove, true);
  window.addEventListener('mouseup', handleMouseUp, true);
  return cleanup;
}

function applySelectionFromTextSegDrag(
  rootEl: HTMLElement,
  segElAnchor: HTMLElement,
  offsetAnchor: number,
  clientX: number,
  clientY: number,
) {
  const pointAnchor = getDomPointAtOffset(segElAnchor, offsetAnchor);
  const segElFocus = getSegmentElementByClientPoint(rootEl, clientX, clientY);
  const pointFocus = segElFocus
    ? getDomPointAtOffset(segElFocus, getCaretOffsetByPoint(segElFocus, clientX, clientY))
    : null;
  const selection = window.getSelection();
  if (!pointAnchor || !pointFocus || !selection) return false;
  selection.setBaseAndExtent(
    pointAnchor.node,
    pointAnchor.offset,
    pointFocus.node,
    pointFocus.offset,
  );
  return true;
}

function getSegmentElementByClientPoint(rootEl: HTMLElement, clientX: number, clientY: number) {
  const elementHit = document.elementFromPoint(clientX, clientY);
  const segElHit = elementHit?.closest<HTMLElement>('[data-mobx-seg-id]');
  if (segElHit && rootEl.contains(segElHit)) return segElHit;
  return pickNearestSegmentElement(rootEl, clientX, clientY);
}

function pickNearestSegmentElement(rootEl: HTMLElement, clientX: number, clientY: number) {
  let segElNearest: HTMLElement | null = null;
  let distanceNearest = Number.POSITIVE_INFINITY;
  for (const segEl of rootEl.querySelectorAll<HTMLElement>('[data-mobx-seg-id]')) {
    const rect = segEl.getBoundingClientRect();
    const distanceX = clientX < rect.left ? rect.left - clientX : (clientX > rect.right ? clientX - rect.right : 0);
    const distanceY = clientY < rect.top ? rect.top - clientY : (clientY > rect.bottom ? clientY - rect.bottom : 0);
    const distance = distanceX + distanceY * 4;
    if (distance < distanceNearest) {
      distanceNearest = distance;
      segElNearest = segEl;
    }
  }
  return segElNearest;
}
