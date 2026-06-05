import type React from 'react';
import type { DocStore } from '../docStore';
import type { CompEvent } from '../docStoreTypes';
import { getCaretOffsetByPoint, getClampedMousePoint } from '../util/caretUtils';

type EventHandler = (event: CompEvent) => Promise<any> | any;

export async function eventListFocus(
  store: DocStore,
  docId: string,
  compId: string,
  reason: string,
  event?: CompEvent,
  listEl?: HTMLElement | null,
) {
  const segTarget = pickSegTargetForListFocus(store, docId, compId, event, listEl);
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
  store.updateFocusState(docId, {
    compIdFocused: compId,
    segIdFocused: '',
    offsetFocused: 0,
    reasonLast: reason,
  });
  return { code: 0, message: 'List focused.' };
}

export async function eventListDispatch({
  event,
  store,
  docId,
  compId,
  listEl,
}: {
  event: CompEvent;
  store: DocStore;
  docId: string;
  compId: string;
  listEl: HTMLElement | null;
}) {
  const type = String(event?.type || '');
  if (type === 'focus') {
    const result = await eventListFocus(store, docId, compId, 'focus', event, listEl);
    if (result.code !== 0) {
      listEl?.focus();
    }
    return result;
  }
  if (type === 'clickSingle') {
    const result = await eventListFocus(store, docId, compId, 'clickSingle', event, listEl);
    if (result.code !== 0) {
      listEl?.focus();
    }
    return result.code === 0 ? { ...result, message: 'List click received.' } : result;
  }
  if (type === 'rowNavigate') {
    return eventListRowNavigate({
      event,
      store,
      docId,
      compId,
      listEl,
    });
  }
  return { code: -1, message: `Unsupported event: ${type}` };
}

export function eventListClick({
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
  const compElCurrent = event.currentTarget.closest('[data-mobx-comp-id]');
  if (targetEl?.closest('[data-mobx-comp-id]') !== compElCurrent) {
    return;
  }
  void eventListFocus(store, docId, compId, 'clickGap', undefined, event.currentTarget);
  if (!onEvent) return;
  onEvent({
    type: 'clickSingle',
    sourceId,
    targetId: docId,
    data: { reason: 'clickGap' },
  });
}

async function eventListRowNavigate({
  event,
  store,
  docId,
  compId,
  listEl,
}: {
  event: CompEvent;
  store: DocStore;
  docId: string;
  compId: string;
  listEl: HTMLElement | null;
}) {
  const direction = String(event?.data?.direction || '');
  const rowId = String(event?.data?.rowId || event.sourceId || '');
  const rowIdList = collectRowIdsInList(store, docId, compId);
  const rowIndex = rowIdList.indexOf(rowId);
  if (rowIndex === -1) {
    return { code: -1, message: `Row not found in list. rowId=${rowId}` };
  }
  const rowIndexNext = direction === 'left' || direction === 'up' ? rowIndex - 1 : rowIndex + 1;
  const rowIdNext = rowIdList[rowIndexNext] || '';
  if (!rowIdNext) {
    return store.sendEventToParent(docId, compId, event);
  }
  const segTarget = pickSegTargetForRow({
    store,
    docId,
    rowId: rowIdNext,
    listEl,
    direction,
    x: Number(event?.data?.x),
  });
  if (!segTarget.segId) {
    return store.sendEventToComp(docId, rowIdNext, {
      type: 'focus',
      sourceId: compId,
      targetId: docId,
      data: {
        direction: direction === 'up' ? 'fromBelow' : 'fromAbove',
        isSelectionExtend: event?.data?.isSelectionExtend === true,
        selectionAnchor: event?.data?.selectionAnchor,
      },
    });
  }
  return store.sendEventToComp(docId, segTarget.segId, {
    type: 'focus',
    sourceId: compId,
    targetId: docId,
    data: {
      direction: focusDirectionForMove(direction),
      offset: Number.isFinite(segTarget.offset) ? segTarget.offset : undefined,
      mousePos: Number.isFinite(Number(event?.data?.x)) ? { clientX: Number(event?.data?.x) } : undefined,
      isSelectionExtend: event?.data?.isSelectionExtend === true,
      selectionAnchor: event?.data?.selectionAnchor,
    },
  });
}

function collectRowIdsInList(store: DocStore, docId: string, listId: string) {
  const compData = store.getCompDataById(docId, listId);
  if (!compData || String(compData.compName || '') !== 'List') return [];
  const rowIdList: string[] = [];
  const mainCompId = String(compData.mainCompId || '').trim();
  if (isCompName(store, docId, mainCompId, 'Row')) {
    rowIdList.push(mainCompId);
  }
  const childIdList = Array.isArray(compData.childIdList) ? compData.childIdList : [];
  for (const childIdRaw of childIdList) {
    const childId = String(childIdRaw || '');
    if (isCompName(store, docId, childId, 'Row')) {
      rowIdList.push(childId);
    } else if (isCompName(store, docId, childId, 'List')) {
      rowIdList.push(...collectRowIdsInList(store, docId, childId));
    }
  }
  return rowIdList;
}

function pickSegTargetForRow({
  store,
  docId,
  rowId,
  listEl,
  direction,
  x,
}: {
  store: DocStore;
  docId: string;
  rowId: string;
  listEl: HTMLElement | null;
  direction: string;
  x: number;
}) {
  const segIdList = getRowSegIdList(store, docId, rowId);
  if (segIdList.length === 0) return { segId: '', offset: undefined };
  if ((direction === 'up' || direction === 'down') && Number.isFinite(x)) {
    const segTarget = pickNearestSegTargetByX(listEl, segIdList, x, direction);
    if (segTarget.segId) return segTarget;
  }
  const segId = direction === 'left' || direction === 'up' ? segIdList[segIdList.length - 1] : segIdList[0];
  return { segId, offset: undefined };
}

function pickSegTargetForListFocus(
  store: DocStore,
  docId: string,
  listId: string,
  event?: CompEvent,
  listEl?: HTMLElement | null,
) {
  const rowIdList = collectRowIdsInList(store, docId, listId);
  if (rowIdList.length === 0) {
    return { segId: '', offset: 0, direction: 'fromLeft' };
  }
  const direction = String(event?.data?.direction || '');
  const mouseClientX = getMouseClientX(listEl, event);
  const isFromAboveOrBelow = direction === 'fromAbove' || direction === 'fromBelow' || direction === 'fromUp' || direction === 'fromDown';
  const shouldUseMouseX = isFromAboveOrBelow || String(event?.type || '') === 'clickSingle' || direction === 'click';
  const isFromEnd = direction === 'fromRight' || direction === 'fromBelow' || direction === 'fromDown';
  const rowId = isFromEnd ? rowIdList[rowIdList.length - 1] : rowIdList[0];
  const segIdList = getRowSegIdList(store, docId, rowId);
  if (segIdList.length === 0) {
    return { segId: '', offset: 0, direction: isFromEnd ? 'fromRight' : 'fromLeft' };
  }
  if (shouldUseMouseX && Number.isFinite(mouseClientX)) {
    const directionTarget = direction || 'click';
    const segTarget = pickNearestSegTargetByX(listEl || null, segIdList, Number(mouseClientX), directionTarget);
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

function pickNearestSegTargetByX(listEl: HTMLElement | null, segIdList: string[], x: number, direction: string) {
  let segIdBest = '';
  let offsetBest: number | undefined;
  let distanceBest = Number.POSITIVE_INFINITY;
  for (const segId of segIdList) {
    const selector = `[data-mobx-seg-id="${cssEscape(segId)}"]`;
    const segEl = listEl?.querySelector<HTMLElement>(selector) || document.querySelector<HTMLElement>(selector);
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

function getRowSegIdList(store: DocStore, docId: string, rowId: string) {
  const rowData = store.getCompDataById(docId, rowId);
  const childIdList = Array.isArray(rowData?.childIdList) ? rowData.childIdList : [];
  return childIdList.map((childIdRaw) => String(childIdRaw || '')).filter((childId) => (
    isCompName(store, docId, childId, 'TextSeg')
  ));
}

function isCompName(store: DocStore, docId: string, compId: string, compName: string) {
  if (!compId) return false;
  return String(store.getCompDataById(docId, compId)?.compName || '') === compName;
}

function focusDirectionForMove(direction: string) {
  if (direction === 'left') return 'fromRight';
  if (direction === 'right') return 'fromLeft';
  if (direction === 'up') return 'fromBelow';
  return 'fromAbove';
}

function focusDirectionForTarget(direction: string) {
  if (direction === 'click') return 'click';
  if (direction === 'fromAbove' || direction === 'fromBelow' || direction === 'fromLeft' || direction === 'fromRight') {
    return direction;
  }
  if (direction === 'fromUp') return 'fromAbove';
  if (direction === 'fromDown') return 'fromBelow';
  return focusDirectionForMove(direction);
}

function getMouseClientX(listEl: HTMLElement | null | undefined, event?: CompEvent) {
  const mousePos = event?.data?.mousePos;
  if (Number.isFinite(mousePos?.clientX)) return Number(mousePos.clientX);
  if (Number.isFinite(mousePos?.x)) return Number(mousePos.x);
  if (!listEl || !Number.isFinite(mousePos?.xRatio)) return undefined;
  const rect = listEl.getBoundingClientRect();
  return rect.left + rect.width * Number(mousePos.xRatio);
}

function cssEscape(value: string) {
  const cssWithEscape = window.CSS as { escape?: (value: string) => string } | undefined;
  return cssWithEscape?.escape ? cssWithEscape.escape(value) : value.replace(/"/g, '\\"');
}
