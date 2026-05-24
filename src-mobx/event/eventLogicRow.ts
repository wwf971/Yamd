import type React from 'react';
import type { CompEvent, DocStore, SelectionState } from '../docStore';
import { getCaretOffsetByPoint, getClampedMousePoint } from '../util/caretUtils';

type EventHandler = (event: CompEvent) => Promise<any> | any;

export async function eventRowFocus(
  store: DocStore,
  docId: string,
  compId: string,
  reason: string,
  event?: CompEvent,
  rowEl?: HTMLElement | null,
  segIdList: string[] = [],
) {
  const segTarget = pickSegTargetForRowFocus(store, docId, rowEl, segIdList, event);
  if (segTarget.segId) {
    return store.sendEventToComp(docId, segTarget.segId, {
      type: 'focus',
      sourceId: compId,
      targetId: docId,
      data: {
        ...(event?.data || {}),
        direction: segTarget.direction,
        offset: segTarget.offset,
      },
    });
  }
  return store.updateFocusState(docId, {
    compIdFocused: compId,
    segIdFocused: '',
    offsetFocused: 0,
    reasonLast: reason,
  });
}

export async function eventRowDispatch({
  event,
  store,
  docId,
  compId,
  rowEl,
  segIdList,
}: {
  event: CompEvent;
  store: DocStore;
  docId: string;
  compId: string;
  rowEl: HTMLElement | null;
  segIdList: string[];
}) {
  const type = String(event?.type || '');
  if (type === 'focus') {
    const result = await eventRowFocus(store, docId, compId, 'focus', event, rowEl, segIdList);
    if (result.code !== 0) {
      rowEl?.focus();
    }
    return result.code === 0 ? { ...result, message: 'Row focused.' } : result;
  }
  if (type === 'clickSingle') {
    const result = await eventRowFocus(store, docId, compId, 'clickSingle', event, rowEl, segIdList);
    if (result.code !== 0) {
      rowEl?.focus();
    }
    return result.code === 0 ? { ...result, message: 'Row click received.' } : result;
  }
  if (type === 'segNavigate') {
    return eventRowSegNavigate({
      event,
      store,
      docId,
      compId,
      segIdList,
    });
  }
  return { code: -1, message: `Unsupported event: ${type}` };
}

export function eventRowClick({
  event,
  store,
  docId,
  compId,
  sourceId,
  onEvent,
}: {
  event: React.MouseEvent<HTMLElement>;
  store: DocStore;
  docId: string;
  compId: string;
  sourceId: string;
  onEvent?: EventHandler;
}) {
  const selection = window.getSelection?.();
  if (
    selection
    && selection.rangeCount > 0
    && selection.isCollapsed !== true
    && selection.anchorNode
    && selection.focusNode
    && event.currentTarget.contains(selection.anchorNode)
    && event.currentTarget.contains(selection.focusNode)
  ) {
    return;
  }
  const targetEl = event.target instanceof Element ? event.target : null;
  if (targetEl?.closest('[data-mobx-seg-id]')) {
    return;
  }
  const segElList = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-mobx-seg-id]'));
  const segElTarget = pickNearestSegEl(segElList, event.clientX);
  if (segElTarget) {
    const segId = String(segElTarget.dataset.mobxSegId || '');
    void store.sendEventToComp(docId, segId, {
      type: 'clickSingle',
      sourceId,
      targetId: docId,
      data: {
        segId,
        mousePos: {
          clientX: event.clientX,
          clientY: event.clientY,
        },
      },
    });
    return;
  }
  void eventRowFocus(store, docId, compId, 'clickGap', undefined, event.currentTarget, []);
  if (!onEvent) return;
  onEvent({
    type: 'clickSingle',
    sourceId,
    targetId: docId,
    data: { reason: 'clickGap' },
  });
}

async function eventRowSegNavigate({
  event,
  store,
  docId,
  compId,
  segIdList,
}: {
  event: CompEvent;
  store: DocStore;
  docId: string;
  compId: string;
  segIdList: string[];
}) {
  const direction = String(event?.data?.direction || '');
  const segId = String(event?.data?.segId || event.sourceId || '');
  const segIndex = segIdList.indexOf(segId);
  if (segIndex === -1) {
    return { code: -1, message: `Segment not found in row. segId=${segId}` };
  }

  if (direction === 'left' && segIndex > 0) {
    return store.sendEventToComp(docId, segIdList[segIndex - 1], {
      type: 'focus',
      sourceId: compId,
      targetId: docId,
      data: { direction: 'fromRight' },
    });
  }

  if (direction === 'right' && segIndex < segIdList.length - 1) {
    return store.sendEventToComp(docId, segIdList[segIndex + 1], {
      type: 'focus',
      sourceId: compId,
      targetId: docId,
      data: { direction: 'fromLeft' },
    });
  }

  const result = await store.sendEventToParent(docId, compId, {
    type: 'rowNavigate',
    sourceId: compId,
    targetId: docId,
    data: {
      direction,
      rowId: compId,
      segId,
      x: event?.data?.x,
    },
  });
  if (result.code === 0) {
    return result;
  }

  return store.sendEventToComp(docId, segId, {
    type: 'focus',
    sourceId: compId,
    targetId: docId,
    data: {
      direction: direction === 'left' || direction === 'up' ? 'fromLeft' : 'fromRight',
      offset: direction === 'left' || direction === 'up' ? 0 : undefined,
    },
  });
}

function pickNearestSegEl(segElList: HTMLElement[], clientX: number) {
  if (segElList.length === 0) return null;
  let segElBest = segElList[0];
  let distanceBest = Number.POSITIVE_INFINITY;
  for (const segEl of segElList) {
    const rect = segEl.getBoundingClientRect();
    const xCenter = rect.left + rect.width / 2;
    const distance = Math.abs(xCenter - clientX);
    if (distance < distanceBest) {
      distanceBest = distance;
      segElBest = segEl;
    }
  }
  return segElBest;
}

function pickSegTargetForRowFocus(
  store: DocStore,
  docId: string,
  rowEl: HTMLElement | null | undefined,
  segIdList: string[],
  event?: CompEvent,
) {
  if (segIdList.length === 0) {
    return { segId: '', offset: 0, direction: 'fromLeft' };
  }
  const direction = String(event?.data?.direction || '');
  const mouseClientX = getMouseClientX(rowEl, event);
  const isFromAboveOrBelow = direction === 'fromAbove' || direction === 'fromBelow' || direction === 'fromUp' || direction === 'fromDown';
  const shouldUseMouseX = isFromAboveOrBelow || String(event?.type || '') === 'clickSingle' || direction === 'click';
  const isFromEnd = direction === 'fromRight' || direction === 'fromBelow' || direction === 'fromDown';
  if (shouldUseMouseX && Number.isFinite(mouseClientX)) {
    const directionTarget = direction || 'click';
    const segTarget = pickNearestSegTargetByX(rowEl || null, segIdList, Number(mouseClientX), directionTarget);
    if (segTarget.segId) {
      return {
        segId: segTarget.segId,
        offset: segTarget.offset,
        direction: directionTarget,
      };
    }
  }
  const segId = isFromEnd ? segIdList[segIdList.length - 1] : segIdList[0];
  const text = String(store.getCompDataById(docId, segId)?.data?.text || '');
  return {
    segId,
    offset: isFromEnd ? text.length : 0,
    direction: isFromEnd ? 'fromRight' : 'fromLeft',
  };
}

function pickNearestSegTargetByX(rowEl: HTMLElement | null, segIdList: string[], x: number, direction: string) {
  let segIdBest = '';
  let offsetBest: number | undefined;
  let distanceBest = Number.POSITIVE_INFINITY;
  for (const segId of segIdList) {
    const selector = `[data-mobx-seg-id="${cssEscape(segId)}"]`;
    const segEl = rowEl?.querySelector<HTMLElement>(selector) || document.querySelector<HTMLElement>(selector);
    if (!segEl) continue;
    const rect = segEl.getBoundingClientRect();
    const xClamped = Math.min(rect.right, Math.max(rect.left, x));
    const distance = Math.abs(xClamped - x);
    if (distance < distanceBest) {
      distanceBest = distance;
      segIdBest = segId;
      const point = getClampedMousePoint(segEl, { clientX: x }, focusDirectionForTarget(direction));
      offsetBest = getCaretOffsetByPoint(segEl, point.x, point.y);
    }
  }
  return { segId: segIdBest, offset: offsetBest };
}

function focusDirectionForTarget(direction: string) {
  if (direction === 'click') return 'click';
  if (direction === 'fromAbove' || direction === 'fromBelow' || direction === 'fromLeft' || direction === 'fromRight') {
    return direction;
  }
  if (direction === 'fromUp') return 'fromAbove';
  if (direction === 'fromDown') return 'fromBelow';
  if (direction === 'up') return 'fromBelow';
  if (direction === 'down') return 'fromAbove';
  if (direction === 'right') return 'fromLeft';
  return 'fromRight';
}

function getMouseClientX(rowEl: HTMLElement | null | undefined, event?: CompEvent) {
  const mousePos = event?.data?.mousePos;
  if (Number.isFinite(mousePos?.clientX)) return Number(mousePos.clientX);
  if (Number.isFinite(mousePos?.x)) return Number(mousePos.x);
  if (!rowEl || !Number.isFinite(mousePos?.xRatio)) return undefined;
  const rect = rowEl.getBoundingClientRect();
  return rect.left + rect.width * Number(mousePos.xRatio);
}

function cssEscape(value: string) {
  const cssWithEscape = window.CSS as { escape?: (value: string) => string } | undefined;
  return cssWithEscape?.escape ? cssWithEscape.escape(value) : value.replace(/"/g, '\\"');
}

export function selectionStateReadFromDom(rootEl: HTMLElement): Partial<SelectionState> | null {
  const selection = window.getSelection?.();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }
  const pointAnchor = selectionPointRead(rootEl, selection.anchorNode, selection.anchorOffset);
  const pointFocus = selectionPointRead(rootEl, selection.focusNode, selection.focusOffset);
  if (!pointAnchor || !pointFocus) {
    return null;
  }
  const isCollapsed = selection.isCollapsed === true;
  if (!shouldSelectionStateTrackDomSelection(selection)) {
    return null;
  }
  return {
    isSelectionActive: !isCollapsed,
    mode: isCollapsed ? 'caret' : 'range',
    pointAnchor,
    pointFocus,
  };
}

function shouldSelectionStateTrackDomSelection(selection: Selection) {
  if (!selection.isCollapsed) {
    return true;
  }
  const focusElBase = selection.focusNode?.nodeType === Node.ELEMENT_NODE
    ? selection.focusNode as Element
    : selection.focusNode?.parentElement;
  const focusSegEl = focusElBase?.closest?.('[data-mobx-seg-id]') as HTMLElement | null;
  return focusSegEl?.getAttribute('contenteditable') === 'true';
}

function selectionPointRead(rootEl: HTMLElement, node: Node | null, offset: number) {
  if (!node || !rootEl.contains(node)) {
    return null;
  }
  const elBase = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
  const segEl = elBase?.closest?.('[data-mobx-seg-id]') as HTMLElement | null;
  const compEl = elBase?.closest?.('[data-mobx-comp-id]') as HTMLElement | null;
  if (!segEl || !compEl || !rootEl.contains(segEl)) {
    return null;
  }
  return {
    compId: String(compEl.dataset.mobxCompId || ''),
    segId: String(segEl.dataset.mobxSegId || ''),
    offset: selectionOffsetRead(segEl, node, offset),
  };
}

function selectionOffsetRead(segEl: HTMLElement, node: Node, offset: number) {
  const text = String(segEl.textContent || '');
  const offsetSafe = Math.max(0, Number(offset || 0));
  const range = document.createRange();
  try {
    range.selectNodeContents(segEl);
    range.setEnd(node, offsetSafe);
    return Math.min(text.length, Math.max(0, range.toString().length));
  } catch {
    return Math.min(text.length, offsetSafe);
  }
}
