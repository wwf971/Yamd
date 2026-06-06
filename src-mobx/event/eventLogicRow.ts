import type React from 'react';
import type { DocStore } from '../docStore';
import type { CompData, CompEditResult, CompEvent, SelectionState } from '../docStoreTypes';
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
  childIdList,
  segIdList,
}: {
  event: CompEvent;
  store: DocStore;
  docId: string;
  compId: string;
  rowEl: HTMLElement | null;
  childIdList: string[];
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
  if (type === 'childSplitAttempt') {
    return eventRowChildSplitAttempt({
      event,
      store,
      docId,
      compId,
      childIdList,
    });
  }
  if (type === 'childMergePrevAttempt') {
    return eventRowChildMergePrevAttempt({
      event,
      store,
      docId,
      compId,
      childIdList,
    });
  }
  if (type === 'childDeleteAttempt') {
    return eventRowChildDeleteAttempt({
      event,
      store,
      docId,
      compId,
      childIdList,
    });
  }
  if (type === 'childSelectionDeleteAttempt') {
    return eventRowChildSelectionDeleteAttempt({
      event,
      store,
      docId,
      compId,
      childIdList,
    });
  }
  if (type === 'rowIndentAttempt' || type === 'rowOutdentAttempt') {
    return store.sendEventToParent(docId, compId, {
      type,
      sourceId: compId,
      targetId: docId,
      data: {
        ...(event?.data || {}),
        rowId: compId,
      },
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

async function eventRowChildSelectionDeleteAttempt({
  event,
  store,
  docId,
  compId,
  childIdList,
}: {
  event: CompEvent;
  store: DocStore;
  docId: string;
  compId: string;
  childIdList: string[];
}) {
  const compIdChild = pickChildIdFromEvent(event);
  if (!childIdList.includes(compIdChild)) {
    return { code: -1, message: `Child component not found in row. compId=${compIdChild}` };
  }
  const pointAnchor = event?.data?.pointAnchor;
  const pointFocus = event?.data?.pointFocus;
  const compIdAnchor = getPointCompId(pointAnchor);
  const compIdFocus = getPointCompId(pointFocus);
  const childIndexAnchor = childIdList.indexOf(compIdAnchor);
  const childIndexFocus = childIdList.indexOf(compIdFocus);
  if (childIndexAnchor === -1 || childIndexFocus === -1) {
    return store.sendEventToParent(docId, compId, {
      type: 'rowSelectionDeleteAttempt',
      sourceId: compId,
      targetId: docId,
      data: {
        ...(event?.data || {}),
        rowId: compId,
      },
    });
  }
  if (compIdAnchor !== compIdFocus) {
    return eventRowCrossChildSelectionDelete({
      store,
      docId,
      compId,
      childIdList,
      pointAnchor,
      pointFocus,
    });
  }
  const result = await store.sendEventToCompDirect(docId, compIdChild, {
    type: 'selfSelectionDeleteQuery',
    sourceId: compId,
    targetId: docId,
    data: {
      pointAnchor,
      pointFocus,
    },
  });
  if (result.code !== 0) return result;
  return applyCompEditResultFromEvent(store, docId, compId, result.data, 'childSelectionDeleteAttempt');
}

async function eventRowChildSplitAttempt({
  event,
  store,
  docId,
  compId,
  childIdList,
}: {
  event: CompEvent;
  store: DocStore;
  docId: string;
  compId: string;
  childIdList: string[];
}) {
  const compIdChild = pickChildIdFromEvent(event);
  if (!childIdList.includes(compIdChild)) {
    return { code: -1, message: `Child component not found in row. compId=${compIdChild}` };
  }
  const result = await store.sendEventToCompDirect(docId, compIdChild, {
    type: 'selfSplitQuery',
    sourceId: compId,
    targetId: docId,
    data: {
      point: event?.data?.point,
    },
  });
  if (result.code !== 0) return result;
  const editResult = normalizeEditResult(result.data);
  if (!editResult) {
    return { code: -1, message: 'Child split result invalid.' };
  }
  return store.sendEventToParent(docId, compId, {
    type: 'rowSplitAttempt',
    sourceId: compId,
    targetId: docId,
    data: {
      ...(event?.data || {}),
      rowId: compId,
      compIdChild,
      editResult,
    },
  });
}

async function eventRowCrossChildSelectionDelete({
  store,
  docId,
  compId,
  childIdList,
  pointAnchor,
  pointFocus,
}: {
  store: DocStore;
  docId: string;
  compId: string;
  childIdList: string[];
  pointAnchor: any;
  pointFocus: any;
}) {
  const selectionRange = normalizeChildSelectionRange(childIdList, pointAnchor, pointFocus);
  if (!selectionRange) {
    return { code: -1, message: 'Selection range is not in row.' };
  }
  const { pointStart, pointEnd, indexStart, indexEnd } = selectionRange;
  const compIdStart = childIdList[indexStart];
  const compIdEnd = childIdList[indexEnd];
  const resultStart = await store.sendEventToCompDirect(docId, compIdStart, {
    type: 'selfSelectionEdgeDeleteQuery',
    sourceId: compId,
    targetId: docId,
    data: {
      point: pointStart,
      side: 'keepBefore',
    },
  });
  if (resultStart.code !== 0) return resultStart;
  const editStart = normalizeEditResult(resultStart.data);
  const compDataStart = editStart?.compListNext[0];
  if (!editStart || !compDataStart) {
    return { code: -1, message: 'Selection start edit result invalid.' };
  }

  const resultEnd = await store.sendEventToCompDirect(docId, compIdEnd, {
    type: 'selfSelectionEdgeDeleteQuery',
    sourceId: compId,
    targetId: docId,
    data: {
      point: pointEnd,
      side: 'keepAfter',
    },
  });
  if (resultEnd.code !== 0) return resultEnd;
  const editEnd = normalizeEditResult(resultEnd.data);
  const compDataEnd = editEnd?.compListNext[0];
  if (!editEnd || !compDataEnd) {
    return { code: -1, message: 'Selection end edit result invalid.' };
  }

  for (let index = indexStart + 1; index < indexEnd; index += 1) {
    const compIdMiddle = childIdList[index];
    const resultMiddle = await store.sendEventToCompDirect(docId, compIdMiddle, {
      type: 'selfDeleteQuery',
      sourceId: compId,
      targetId: docId,
      data: {},
    });
    if (resultMiddle.code !== 0) return resultMiddle;
  }

  const mergeResult = await createMergedSelectionEdgeList({
    store,
    docId,
    compId,
    compDataStart,
    compDataEnd,
    pointStart,
  });
  const compDataListNext = mergeResult.compDataListNext;
  const childIdListOriginal = childIdList.slice(indexStart, indexEnd + 1);
  return store.applyCompEditResult(docId, compId, {
    op: 'replaceRange',
    compIdListOriginal: childIdListOriginal,
    compListNext: compDataListNext,
    focus: mergeResult.focus,
  }, 'childSelectionDeleteAttempt');
}

async function eventRowChildMergePrevAttempt({
  event,
  store,
  docId,
  compId,
  childIdList,
}: {
  event: CompEvent;
  store: DocStore;
  docId: string;
  compId: string;
  childIdList: string[];
}) {
  const compIdChild = pickChildIdFromEvent(event);
  const childIndex = childIdList.indexOf(compIdChild);
  if (childIndex < 0) {
    return { code: -1, message: `Child component not found in row. compId=${compIdChild}` };
  }
  if (childIndex === 0) {
    return store.sendEventToParent(docId, compId, {
      type: 'rowMergePrevAttempt',
      sourceId: compId,
      targetId: docId,
      data: {
        ...(event?.data || {}),
        rowId: compId,
        compIdChild,
      },
    });
  }
  const compIdPrev = childIdList[childIndex - 1];
  const compDataOther = store.getCompDataById(docId, compIdPrev);
  const result = await store.sendEventToCompDirect(docId, compIdChild, {
    type: 'selfMergeQuery',
    sourceId: compId,
    targetId: docId,
    data: {
      direction: 'left',
      point: event?.data?.point,
      compDataOther,
    },
  });
  if (result.code !== 0) return result;
  return applyCompEditResultFromEvent(store, docId, compId, result.data, 'childMergePrevAttempt');
}

async function eventRowChildDeleteAttempt({
  event,
  store,
  docId,
  compId,
  childIdList,
}: {
  event: CompEvent;
  store: DocStore;
  docId: string;
  compId: string;
  childIdList: string[];
}) {
  const compIdChild = pickChildIdFromEvent(event);
  if (!childIdList.includes(compIdChild)) {
    return { code: -1, message: `Child component not found in row. compId=${compIdChild}` };
  }
  if (childIdList.length <= 1) {
    return store.sendEventToParent(docId, compId, {
      type: 'rowDeleteAttempt',
      sourceId: compId,
      targetId: docId,
      data: {
        ...(event?.data || {}),
        rowId: compId,
        compIdChild,
      },
    });
  }
  const result = await store.sendEventToCompDirect(docId, compIdChild, {
    type: 'selfDeleteQuery',
    sourceId: compId,
    targetId: docId,
    data: {
      point: event?.data?.point,
    },
  });
  if (result.code !== 0) return result;
  const editResult = normalizeEditResult(result.data);
  if (!editResult) {
    return { code: -1, message: 'Child delete result invalid.' };
  }
  const childIndex = childIdList.indexOf(compIdChild);
  const compIdFocus = childIdList[childIndex - 1] || childIdList[childIndex + 1] || '';
  const compDataFocus = compIdFocus ? store.getCompDataById(docId, compIdFocus) : null;
  return store.applyCompEditResult(docId, compId, {
    ...editResult,
    focus: editResult.focus || createFocusTargetForComp(compDataFocus),
  }, 'childDeleteAttempt');
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
      data: {
        direction: 'fromRight',
        isSelectionExtend: event?.data?.isSelectionExtend === true,
        selectionAnchor: event?.data?.selectionAnchor,
      },
    });
  }

  if (direction === 'right' && segIndex < segIdList.length - 1) {
    return store.sendEventToComp(docId, segIdList[segIndex + 1], {
      type: 'focus',
      sourceId: compId,
      targetId: docId,
      data: {
        direction: 'fromLeft',
        isSelectionExtend: event?.data?.isSelectionExtend === true,
        selectionAnchor: event?.data?.selectionAnchor,
      },
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
      isSelectionExtend: event?.data?.isSelectionExtend === true,
      selectionAnchor: event?.data?.selectionAnchor,
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
      isSelectionExtend: event?.data?.isSelectionExtend === true,
      selectionAnchor: event?.data?.selectionAnchor,
    },
  });
}

function applyCompEditResultFromEvent(
  store: DocStore,
  docId: string,
  parentId: string,
  dataEvent: any,
  reason: string,
) {
  const editResult = normalizeEditResult(dataEvent);
  if (!editResult) {
    return { code: -1, message: 'Component edit result invalid.' };
  }
  return store.applyCompEditResult(docId, parentId, editResult, reason);
}

function normalizeEditResult(dataEvent: any): CompEditResult | null {
  const op = String(dataEvent?.op || '');
  const compIdListOriginal = Array.isArray(dataEvent?.compIdListOriginal)
    ? dataEvent.compIdListOriginal.map((id: any) => String(id || '')).filter(Boolean)
    : [];
  const compListNext = Array.isArray(dataEvent?.compListNext)
    ? dataEvent.compListNext.filter((compData: CompData) => compData?.compId)
    : [];
  if (!op || compIdListOriginal.length === 0) return null;
  return {
    op: op as CompEditResult['op'],
    compIdListOriginal,
    compListNext,
    focus: dataEvent?.focus,
  };
}

async function createMergedSelectionEdgeList({
  store,
  docId,
  compId,
  compDataStart,
  compDataEnd,
  pointStart,
}: {
  store: DocStore;
  docId: string;
  compId: string;
  compDataStart: CompData;
  compDataEnd: CompData;
  pointStart: any;
}) {
  const resultMerge = await store.sendEventToCompDirect(docId, compDataEnd.compId, {
    type: 'selfMergeQuery',
    sourceId: compId,
    targetId: docId,
    data: {
      direction: 'left',
      point: pointStart,
      compDataSelf: compDataEnd,
      compDataOther: compDataStart,
    },
  });
  const focusFallback = {
    compId: compDataStart.compId,
    point: { offset: Number(pointStart?.offset || 0) },
  };
  if (resultMerge.code !== 0) {
    return { compDataListNext: [compDataStart, compDataEnd], focus: focusFallback };
  }
  const editMerge = normalizeEditResult(resultMerge.data);
  return editMerge?.compListNext.length
    ? { compDataListNext: editMerge.compListNext, focus: editMerge.focus || focusFallback }
    : { compDataListNext: [compDataStart, compDataEnd], focus: focusFallback };
}

function normalizeChildSelectionRange(childIdList: string[], pointA: any, pointB: any) {
  const compIdA = getPointCompId(pointA);
  const compIdB = getPointCompId(pointB);
  const indexA = childIdList.indexOf(compIdA);
  const indexB = childIdList.indexOf(compIdB);
  if (indexA === -1 || indexB === -1) return null;
  const isForward = indexA < indexB || (indexA === indexB && Number(pointA?.offset || 0) <= Number(pointB?.offset || 0));
  return {
    pointStart: isForward ? pointA : pointB,
    pointEnd: isForward ? pointB : pointA,
    indexStart: Math.min(indexA, indexB),
    indexEnd: Math.max(indexA, indexB),
  };
}

function getPointCompId(point: any) {
  return String(point?.compId || point?.segId || '');
}

function pickChildIdFromEvent(event: CompEvent) {
  return String(event?.data?.compIdChild || event?.data?.segId || event.sourceId || '');
}

function createFocusTargetForComp(compData: CompData | null) {
  const compId = String(compData?.compId || '');
  if (!compId) return undefined;
  const text = String(compData?.data?.text || '');
  return {
    compId,
    point: { offset: text.length },
  };
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
