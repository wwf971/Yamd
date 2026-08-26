import { getCaretOffsetByPoint } from '../../util/caretUtils';
import { getDomPointAtOffset } from './TextSeg.dom';

// Start a monitored selection drag that takes over immediately: every mouse
// move builds the DOM range programmatically. Used by the dom caret mode of
// TextSeg, where the caller prevents the mousedown default first (the browser
// would otherwise confine the native drag to the contentEditable host).
export function startSelectionDragFromTextSeg(
  segElAnchor: HTMLElement,
  clientXStart: number,
  clientYStart: number,
  onEnd: () => void,
) {
  return startSelectionDragMonitored(segElAnchor, clientXStart, clientYStart, onEnd, () => true);
}

// Start a monitored selection drag that leaves native selection alone while
// the pointer stays where the browser can handle it, and takes over with a
// programmatic range once the drag crosses an editing-host boundary, e.g.
// from a plain segment into a contentEditable segment (a text block). Native
// drags cannot form that selection, the browser stops them at the
// editing-host border. Plain-to-plain drags never take over.
//
// The takeover only wins when the drag starts in plain text. A native drag
// that starts inside a contentEditable host stays confined to the host and
// overrides programmatic ranges for the rest of the gesture, so such a drag
// must be prevented at mousedown and run fully programmatic from the start
// (startSelectionDragFromTextSeg), as the DOM caret mode of TextSeg and the
// editable TextBlockSeg do.
export function startSelectionDragAcrossEditableBoundary(
  segElAnchor: HTMLElement,
  clientXStart: number,
  clientYStart: number,
  onEnd: () => void,
) {
  const isAnchorEditingHost = isEditingHostElement(segElAnchor);
  return startSelectionDragMonitored(
    segElAnchor,
    clientXStart,
    clientYStart,
    onEnd,
    (segElTarget) => {
      if (!segElTarget || segElTarget === segElAnchor) return false;
      return isAnchorEditingHost || isEditingHostElement(segElTarget);
    },
  );
}

function isEditingHostElement(segEl: HTMLElement) {
  return segEl.getAttribute('contenteditable') === 'true';
}

// The shared drag monitor. checkTakeoverNeeded is asked once per mouse move
// with the segment element under the pointer; the first true switches the
// drag to programmatic ranges for the rest of the gesture (mixing native and
// programmatic updates within one drag would fight over the anchor).
function startSelectionDragMonitored(
  segElAnchor: HTMLElement,
  clientXStart: number,
  clientYStart: number,
  onEnd: () => void,
  checkTakeoverNeeded: (segElTarget: HTMLElement | null) => boolean,
) {
  const rootEl = segElAnchor.closest<HTMLElement>('[data-mobx-doc-id]') || document.body;
  const offsetAnchor = getCaretOffsetByPoint(segElAnchor, clientXStart, clientYStart);
  let isDraggingSelection = false;
  let isTakenOver = false;
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
    if (!isTakenOver) {
      const segElTarget = getSegmentElementByClientPoint(rootEl, event.clientX, event.clientY);
      if (!checkTakeoverNeeded(segElTarget)) return;
      isTakenOver = true;
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
