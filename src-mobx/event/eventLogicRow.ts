import type React from 'react';
import type { CompEvent, DocStore, SelectionState } from '../docStore';

type EventHandler = (event: CompEvent) => Promise<any> | any;

export function eventRowFocus(store: DocStore, docId: string, compId: string, reason: string) {
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
    eventRowFocus(store, docId, compId, 'focus');
    rowEl?.focus();
    return { code: 0, message: 'Row focused.' };
  }
  if (type === 'clickSingle') {
    eventRowFocus(store, docId, compId, 'clickSingle');
    rowEl?.focus();
    return { code: 0, message: 'Row click received.' };
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
  eventRowFocus(store, docId, compId, 'clickGap');
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
