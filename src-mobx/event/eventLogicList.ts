import type React from 'react';
import { runInAction } from 'mobx';
import type { DocStore } from '../docStore';
import type { CompData, CompEditResult, CompEvent, CompFocusTarget } from '../docStoreTypes';
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
  if (type === 'rowSplitAttempt') {
    return eventListRowSplitAttempt({
      event,
      store,
      docId,
      compId,
    });
  }
  if (type === 'rowMergePrevAttempt') {
    return eventListRowMergePrevAttempt({
      event,
      store,
      docId,
      compId,
    });
  }
  if (type === 'rowDeleteAttempt') {
    return eventListRowDeleteAttempt({
      event,
      store,
      docId,
      compId,
    });
  }
  if (type === 'rowSelectionDeleteAttempt') {
    return eventListRowSelectionDeleteAttempt({
      event,
      store,
      docId,
      compId,
    });
  }
  if (type === 'rowIndentAttempt') {
    const rowId = String(event?.data?.rowId || '');
    const compIdChild = String(event?.data?.compIdChild || '');
    return store.indentEntryByRowId(docId, rowId, compIdChild);
  }
  if (type === 'rowOutdentAttempt') {
    const rowId = String(event?.data?.rowId || '');
    const compIdChild = String(event?.data?.compIdChild || '');
    return store.outdentEntryByRowId(docId, rowId, compIdChild);
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

async function eventListRowSplitAttempt({
  event,
  store,
  docId,
  compId,
}: {
  event: CompEvent;
  store: DocStore;
  docId: string;
  compId: string;
}) {
  const rowId = String(event?.data?.rowId || '');
  const compIdChild = String(event?.data?.compIdChild || '');
  const editResult = normalizeEditResult(event?.data?.editResult);
  if (!editResult || editResult.compListNext.length < 2) {
    return { code: -1, message: 'Row split result invalid.' };
  }
  const rowData = store.getCompDataById(docId, rowId);
  const listData = store.getCompDataById(docId, compId);
  if (!rowData || String(rowData.compName || '') !== 'Row' || !listData || String(listData.compName || '') !== 'List') {
    return { code: -1, message: 'Row split target missing.' };
  }

  const childIdList = getChildIdList(rowData);
  const childIndex = childIdList.indexOf(compIdChild);
  if (childIndex < 0) {
    return { code: -1, message: `Split child not found. compId=${compIdChild}` };
  }

  const compDataLeft = editResult.compListNext[0];
  const compDataListRight = editResult.compListNext.slice(1);
  const childIdListLeft = [
    ...childIdList.slice(0, childIndex),
    compDataLeft.compId,
  ];
  const childIdListRight = [
    ...compDataListRight.map((compData) => compData.compId),
    ...childIdList.slice(childIndex + 1),
  ];
  const rowDataLeft = createRowComp(rowId, childIdListLeft, rowData);
  const rowDataRight = createRowComp(createCompId(store, docId, 'row'), childIdListRight, rowData);

  const childIdListList = getChildIdList(listData);
  const isRowListChild = childIdListList.includes(rowId);
  if (isRowListChild) {
    const result = runInAction(() => {
      for (const compDataNext of editResult.compListNext) {
        store.replaceCompData(docId, compDataNext);
      }
      store.replaceCompData(docId, rowDataLeft);
      return store.insertChildAfter(docId, compId, rowId, rowDataRight, {
        focus: editResult.focus,
        reason: 'rowSplitAttempt',
      });
    });
    return result.code === 0 ? { ...result, message: 'Row split.' } : result;
  }

  const isRowListMain = String(listData.mainCompId || '') === rowId;
  if (!isRowListMain) {
    return { code: -1, message: 'Row is not in this list.' };
  }

  const listIdParent = String(store.getParentCompId(docId, compId) || '');
  if (listIdParent) {
    const splitForMainRow = prepareSplitForMainRow({
      compIdOriginal: compIdChild,
      compDataLeft,
      compDataListRight,
      focus: editResult.focus,
    });
    const rowDataBefore = createRowComp(createCompId(store, docId, 'row'), [
      ...childIdList.slice(0, childIndex),
      ...splitForMainRow.compIdListLeft,
    ], rowData);
    const rowDataOriginalNext = createRowComp(rowId, [
      ...splitForMainRow.compIdListRight,
      ...childIdList.slice(childIndex + 1),
    ], rowData);
    const listDataNext = {
      ...listData,
      mainCompId: rowId,
    };
    const result = runInAction(() => {
      splitForMainRow.compDataListNext.forEach((compDataNext) => {
        store.replaceCompData(docId, compDataNext);
      });
      store.replaceCompData(docId, rowDataOriginalNext);
      return store.replaceChildRange(docId, listIdParent, [compId], [rowDataBefore, listDataNext], {
        focus: splitForMainRow.focus,
        reason: 'rowSplitAttempt',
      });
    });
    return result.code === 0 ? { ...result, message: 'Main row split before nested list.' } : result;
  }

  const listDataNext = {
    ...listData,
    childIdList: [rowDataRight.compId, ...childIdListList.filter((childId) => childId !== rowDataRight.compId)],
  };
  runInAction(() => {
    for (const compDataNext of editResult.compListNext) {
      store.replaceCompData(docId, compDataNext);
    }
    store.replaceCompData(docId, rowDataLeft);
    store.replaceCompData(docId, rowDataRight);
    store.replaceCompData(docId, listDataNext);
    store.clearSelectionState(docId);
    if (editResult.focus) {
      store.applyFocusAfterEdit(docId, editResult.focus, 'rowSplitAttempt');
    }
  });
  return { code: 0, message: 'Root main row split.' };
}

async function eventListRowMergePrevAttempt({
  event,
  store,
  docId,
  compId,
}: {
  event: CompEvent;
  store: DocStore;
  docId: string;
  compId: string;
}) {
  const rowId = String(event?.data?.rowId || '');
  const mergeTarget = getPreviousRowMergeTarget(store, docId, compId, rowId);
  if (!mergeTarget) {
    return store.sendEventToParent(docId, compId, event);
  }
  const rowData = store.getCompDataById(docId, mergeTarget.rowId);
  const rowDataPrev = store.getCompDataById(docId, mergeTarget.rowIdPrev);
  const childIdList = getChildIdList(rowData);
  const childIdListPrev = getChildIdList(rowDataPrev);
  const compIdCurrentFirst = childIdList[0] || '';
  const compIdPrevLast = childIdListPrev[childIdListPrev.length - 1] || '';
  if (!compIdCurrentFirst || !compIdPrevLast) {
    return { code: -1, message: 'Rows are not mergeable.' };
  }

  const compDataOther = store.getCompDataById(docId, compIdPrevLast);
  const result = await store.sendEventToCompDirect(docId, compIdCurrentFirst, {
    type: 'selfMergeQuery',
    sourceId: compId,
    targetId: docId,
    data: {
      direction: 'left',
      compDataOther,
      point: event?.data?.point,
    },
  });
  if (result.code !== 0) return result;
  const editResult = normalizeEditResult(result.data);
  if (!editResult || editResult.compListNext.length === 0) {
    return { code: -1, message: 'Row merge result invalid.' };
  }

  const compDataListMoved = childIdList.slice(1)
    .map((childId) => store.getCompDataById(docId, childId))
    .filter((compData): compData is CompData => Boolean(compData));
  const focus = editResult.focus;
  if (mergeTarget.entryId !== mergeTarget.rowId && mergeTarget.isRowPrevParentMain !== true) {
    editResult.compListNext.forEach((compDataNext) => {
      store.replaceCompData(docId, compDataNext);
    });
    store.replaceCompData(docId, createRowComp(
      mergeTarget.rowId,
      [...editResult.compListNext.map((compData) => compData.compId), ...compDataListMoved.map((compData) => compData.compId)],
      rowData,
    ));
    if (rowDataPrev) {
      store.replaceCompData(docId, { ...rowDataPrev, childIdList: [] });
    }
    const resultRemovePrev = store.replaceChildRange(docId, mergeTarget.listIdParent, [mergeTarget.rowIdPrev], [], {
      focus,
      reason: 'rowMergePrevAttempt',
    });
    return resultRemovePrev.code === 0 ? { code: 0, message: 'Main row merged with previous row.' } : resultRemovePrev;
  }

  const replaceResult = store.replaceChildRange(
    docId,
    mergeTarget.rowIdPrev,
    [compIdPrevLast],
    [...editResult.compListNext, ...compDataListMoved],
    { focus, reason: 'rowMergePrevAttempt' },
  );
  if (replaceResult.code !== 0) return replaceResult;

  const rowDataDetached = store.getCompDataById(docId, mergeTarget.rowId);
  if (rowDataDetached) {
    store.replaceCompData(docId, { ...rowDataDetached, childIdList: [compIdCurrentFirst] });
  }
  const entryDataDetached = mergeTarget.entryId !== mergeTarget.rowId
    ? store.getCompDataById(docId, mergeTarget.entryId)
    : null;
  if (entryDataDetached) {
    store.replaceCompData(docId, { ...entryDataDetached, childIdList: [], mainCompId: undefined });
  }
  store.replaceChildRange(docId, mergeTarget.listIdParent, [mergeTarget.entryId], [], {
    focus,
    reason: 'rowMergePrevAttempt',
  });
  return { code: 0, message: 'Row merged with previous row.' };
}

async function eventListRowDeleteAttempt({
  event,
  store,
  docId,
  compId,
}: {
  event: CompEvent;
  store: DocStore;
  docId: string;
  compId: string;
}) {
  const rowId = String(event?.data?.rowId || '');
  const rowData = store.getCompDataById(docId, rowId);
  if (!rowData || String(rowData.compName || '') !== 'Row') {
    return { code: -1, message: `Row not found. rowId=${rowId}` };
  }
  const childIdList = getChildIdList(rowData);
  const compIdChild = String(event?.data?.compIdChild || childIdList[0] || '');
  if (childIdList.length > 1 && compIdChild) {
    const childIndex = childIdList.indexOf(compIdChild);
    const compIdFocus = childIdList[childIndex - 1] || childIdList[childIndex + 1] || '';
    return store.replaceChildRange(docId, rowId, [compIdChild], [], {
      focus: createFocusTargetForComp(store.getCompDataById(docId, compIdFocus)),
      reason: 'rowDeleteAttempt',
    });
  }

  const entryInfo = getEntryInfoForRow(store, docId, compId, rowId);
  if (!entryInfo) {
    return { code: -1, message: 'Cannot delete row.' };
  }
  const focus = pickFocusNearEntry(store, docId, entryInfo.listIdParent, entryInfo.entryId);
  const rowDataDetached = store.getCompDataById(docId, rowId);
  if (rowDataDetached) {
    store.replaceCompData(docId, { ...rowDataDetached, childIdList: compIdChild ? [compIdChild] : [] });
  }
  const entryDataDetached = entryInfo.entryId !== rowId ? store.getCompDataById(docId, entryInfo.entryId) : null;
  if (entryDataDetached) {
    store.replaceCompData(docId, { ...entryDataDetached, childIdList: [], mainCompId: undefined });
  }
  return store.replaceChildRange(docId, entryInfo.listIdParent, [entryInfo.entryId], [], {
    focus,
    reason: 'rowDeleteAttempt',
  });
}

async function eventListRowSelectionDeleteAttempt({
  event,
  store,
  docId,
  compId,
}: {
  event: CompEvent;
  store: DocStore;
  docId: string;
  compId: string;
}) {
  const pointAnchor = event?.data?.pointAnchor;
  const pointFocus = event?.data?.pointFocus;
  const rowEntryList = collectDirectRowEntries(store, docId, compId);
  const selectionRange = normalizeRowSelectionRange(store, docId, rowEntryList, pointAnchor, pointFocus);
  if (!selectionRange) {
    return store.sendEventToParent(docId, compId, event);
  }
  const {
    pointStart,
    pointEnd,
    entryStart,
    entryEnd,
    indexStart,
    indexEnd,
  } = selectionRange;
  if (indexStart === indexEnd) {
    return { code: -1, message: 'Same-row selection should be handled by Row.' };
  }

  const rowDataStart = store.getCompDataById(docId, entryStart.rowId);
  const rowDataEnd = store.getCompDataById(docId, entryEnd.rowId);
  const childIdListStart = getChildIdList(rowDataStart);
  const childIdListEnd = getChildIdList(rowDataEnd);
  const childIndexStart = childIdListStart.indexOf(getPointCompId(pointStart));
  const childIndexEnd = childIdListEnd.indexOf(getPointCompId(pointEnd));
  if (childIndexStart === -1 || childIndexEnd === -1 || !rowDataStart || !rowDataEnd) {
    return { code: -1, message: 'Selection row edge is invalid.' };
  }

  const resultStart = await store.sendEventToCompDirect(docId, childIdListStart[childIndexStart], {
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
    return { code: -1, message: 'Cross-row start edit result invalid.' };
  }

  const resultEnd = await store.sendEventToCompDirect(docId, childIdListEnd[childIndexEnd], {
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
    return { code: -1, message: 'Cross-row end edit result invalid.' };
  }

  const resultValidate = await validateSelectedChildrenForDelete({
    store,
    docId,
    compId,
    rowEntryList,
    indexStart,
    indexEnd,
    childIdListStart,
    childIdListEnd,
    childIndexStart,
    childIndexEnd,
  });
  if (resultValidate.code !== 0) return resultValidate;
  const compIdListDelete = Array.isArray(resultValidate.data?.compIdListDelete)
    ? resultValidate.data.compIdListDelete.map((compIdDelete: any) => String(compIdDelete || '')).filter(Boolean)
    : [];

  const compDataListEdge = await createMergedSelectionEdgeList({
    store,
    docId,
    compId,
    compDataStart,
    compDataEnd,
    pointStart,
  });
  compDataListEdge.forEach((compDataNext) => {
    store.replaceCompData(docId, compDataNext);
  });

  const childIdListMerged = [
    ...childIdListStart.slice(0, childIndexStart),
    ...compDataListEdge.map((compData) => compData.compId),
    ...childIdListEnd.slice(childIndexEnd + 1),
  ];
  compIdListDelete.forEach((compIdDelete) => {
    store.removeCompSubtree(docId, compIdDelete);
  });
  store.replaceCompData(docId, createRowComp(entryStart.rowId, childIdListMerged, rowDataStart));

  const entryIdListRemoved = rowEntryList
    .slice(indexStart + 1, indexEnd + 1)
    .map((entryInfo) => entryInfo.entryId);
  if (entryIdListRemoved.length > 0) {
    const resultRemoveRows = removeDirectRowEntries(store, docId, compId, entryIdListRemoved);
    if (resultRemoveRows.code !== 0) return resultRemoveRows;
  }
  store.clearSelectionState(docId);
  store.applyFocusAfterEdit(docId, {
    compId: compDataListEdge[0]?.compId || compDataStart.compId,
    point: { offset: Number(pointStart?.offset || 0) },
  }, 'rowSelectionDeleteAttempt');
  return { code: 0, message: 'Row selection deleted.' };
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

function getPreviousRowMergeTarget(store: DocStore, docId: string, listId: string, rowId: string) {
  const listData = store.getCompDataById(docId, listId);
  if (!listData || String(listData.compName || '') !== 'List') return null;
  const childIdList = getChildIdList(listData);
  const mainCompId = String(listData.mainCompId || '');
  const rowIndex = childIdList.indexOf(rowId);
  if (rowIndex >= 0) {
    const entryIdPrev = rowIndex > 0 ? childIdList[rowIndex - 1] : mainCompId;
    if (isCompName(store, docId, entryIdPrev, 'Row')) {
      return {
        listIdParent: listId,
        entryId: rowId,
        rowId,
        rowIdPrev: entryIdPrev,
      };
    }
    return null;
  }
  if (mainCompId !== rowId) {
    return null;
  }
  const listIdParent = String(store.getParentCompId(docId, listId) || '');
  const listParentData = store.getCompDataById(docId, listIdParent);
  const childIdListParent = getChildIdList(listParentData);
  const entryIndex = childIdListParent.indexOf(listId);
  if (entryIndex === 0) {
    const rowIdPrev = String(listParentData?.mainCompId || '');
    if (isCompName(store, docId, rowIdPrev, 'Row')) {
      return {
        listIdParent,
        entryId: listId,
        rowId,
        rowIdPrev,
        isRowPrevParentMain: true,
      };
    }
    return null;
  }
  if (entryIndex < 0) {
    return null;
  }
  const entryIdPrev = childIdListParent[entryIndex - 1];
  if (!isCompName(store, docId, entryIdPrev, 'Row')) {
    return null;
  }
  return {
    listIdParent,
    entryId: listId,
    rowId,
    rowIdPrev: entryIdPrev,
  };
}

function getEntryInfoForRow(store: DocStore, docId: string, listId: string, rowId: string) {
  const listData = store.getCompDataById(docId, listId);
  if (!listData || String(listData.compName || '') !== 'List') return null;
  const childIdList = getChildIdList(listData);
  if (childIdList.includes(rowId)) {
    return {
      listIdParent: listId,
      entryId: rowId,
      rowId,
    };
  }
  if (String(listData.mainCompId || '') !== rowId) {
    return null;
  }
  const listIdParent = String(store.getParentCompId(docId, listId) || '');
  if (!listIdParent) {
    return null;
  }
  return {
    listIdParent,
    entryId: listId,
    rowId,
  };
}

function pickFocusNearEntry(store: DocStore, docId: string, listId: string, entryId: string): CompFocusTarget | undefined {
  const listData = store.getCompDataById(docId, listId);
  const childIdList = getChildIdList(listData);
  const entryIndex = childIdList.indexOf(entryId);
  const entryIdFocus = childIdList[entryIndex - 1] || childIdList[entryIndex + 1] || String(listData?.mainCompId || '');
  const rowIdFocus = isCompName(store, docId, entryIdFocus, 'Row')
    ? entryIdFocus
    : String(store.getCompDataById(docId, entryIdFocus)?.mainCompId || '');
  const compIdFocus = getLastChildIdInRow(store, docId, rowIdFocus) || getFirstChildIdInRow(store, docId, rowIdFocus);
  return createFocusTargetForComp(store.getCompDataById(docId, compIdFocus));
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
  if (resultMerge.code !== 0) {
    return [compDataStart, compDataEnd];
  }
  const editMerge = normalizeEditResult(resultMerge.data);
  return editMerge?.compListNext.length ? editMerge.compListNext : [compDataStart, compDataEnd];
}

async function validateSelectedChildrenForDelete({
  store,
  docId,
  compId,
  rowEntryList,
  indexStart,
  indexEnd,
  childIdListStart,
  childIdListEnd,
  childIndexStart,
  childIndexEnd,
}: {
  store: DocStore;
  docId: string;
  compId: string;
  rowEntryList: Array<{ rowId: string; entryId: string }>;
  indexStart: number;
  indexEnd: number;
  childIdListStart: string[];
  childIdListEnd: string[];
  childIndexStart: number;
  childIndexEnd: number;
}) {
  const compIdListDelete = [
    ...childIdListStart.slice(childIndexStart + 1),
    ...rowEntryList.slice(indexStart + 1, indexEnd).flatMap((entryInfo) => {
      const rowData = store.getCompDataById(docId, entryInfo.rowId);
      return getChildIdList(rowData);
    }),
    ...childIdListEnd.slice(0, childIndexEnd),
  ];
  for (const compIdDelete of compIdListDelete) {
    const resultDelete = await store.sendEventToCompDirect(docId, compIdDelete, {
      type: 'selfDeleteQuery',
      sourceId: compId,
      targetId: docId,
      data: {},
    });
    if (resultDelete.code !== 0) return resultDelete;
  }
  return { code: 0, message: 'Selected children are deletable.', data: { compIdListDelete } };
}

function normalizeRowSelectionRange(
  store: DocStore,
  docId: string,
  rowEntryList: Array<{ rowId: string; entryId: string }>,
  pointA: any,
  pointB: any,
) {
  const rowIdA = getRowIdByChildId(store, docId, getPointCompId(pointA), rowEntryList);
  const rowIdB = getRowIdByChildId(store, docId, getPointCompId(pointB), rowEntryList);
  const indexA = rowEntryList.findIndex((entryInfo) => entryInfo.rowId === rowIdA);
  const indexB = rowEntryList.findIndex((entryInfo) => entryInfo.rowId === rowIdB);
  if (indexA === -1 || indexB === -1) return null;
  const childIdListA = getChildIdList(store.getCompDataById(docId, rowIdA));
  const childIdListB = getChildIdList(store.getCompDataById(docId, rowIdB));
  const childIndexA = childIdListA.indexOf(getPointCompId(pointA));
  const childIndexB = childIdListB.indexOf(getPointCompId(pointB));
  const isForward = indexA < indexB
    || (indexA === indexB && (
      childIndexA < childIndexB
      || (childIndexA === childIndexB && Number(pointA?.offset || 0) <= Number(pointB?.offset || 0))
    ));
  const indexStart = Math.min(indexA, indexB);
  const indexEnd = Math.max(indexA, indexB);
  return {
    pointStart: isForward ? pointA : pointB,
    pointEnd: isForward ? pointB : pointA,
    entryStart: rowEntryList[indexStart],
    entryEnd: rowEntryList[indexEnd],
    indexStart,
    indexEnd,
  };
}

function collectDirectRowEntries(store: DocStore, docId: string, listId: string) {
  const listData = store.getCompDataById(docId, listId);
  if (!listData || String(listData.compName || '') !== 'List') return [];
  const entryList: Array<{ rowId: string; entryId: string }> = [];
  const mainCompId = String(listData.mainCompId || '');
  if (isCompName(store, docId, mainCompId, 'Row')) {
    entryList.push({ rowId: mainCompId, entryId: mainCompId });
  }
  for (const childId of getChildIdList(listData)) {
    if (isCompName(store, docId, childId, 'Row')) {
      entryList.push({ rowId: childId, entryId: childId });
    }
  }
  return entryList;
}

function getRowIdByChildId(
  store: DocStore,
  docId: string,
  compIdChild: string,
  rowEntryList: Array<{ rowId: string }>,
) {
  for (const entryInfo of rowEntryList) {
    const rowData = store.getCompDataById(docId, entryInfo.rowId);
    if (getChildIdList(rowData).includes(compIdChild)) {
      return entryInfo.rowId;
    }
  }
  return '';
}

function removeDirectRowEntries(store: DocStore, docId: string, listId: string, entryIdListRemoved: string[]) {
  const listData = store.getCompDataById(docId, listId);
  if (!listData || String(listData.compName || '') !== 'List') {
    return { code: -1, message: 'List not found.' };
  }
  const entryIdSetRemoved = new Set(entryIdListRemoved);
  const listDataNext = {
    ...listData,
    childIdList: getChildIdList(listData).filter((childId) => !entryIdSetRemoved.has(childId)),
  };
  store.replaceCompData(docId, listDataNext);
  entryIdListRemoved.forEach((entryId) => {
    const entryData = store.getCompDataById(docId, entryId);
    if (entryData) {
      store.replaceCompData(docId, { ...entryData, childIdList: [], mainCompId: undefined });
    }
    store.removeCompSubtree(docId, entryId);
  });
  return { code: 0, message: 'Direct row entries removed.' };
}

function getPointCompId(point: any) {
  return String(point?.compId || point?.segId || '');
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

function prepareSplitForMainRow({
  compIdOriginal,
  compDataLeft,
  compDataListRight,
  focus,
}: {
  compIdOriginal: string;
  compDataLeft: CompData;
  compDataListRight: CompData[];
  focus?: CompFocusTarget;
}) {
  const compDataRightFirst = compDataListRight[0];
  if (!compDataRightFirst || compDataLeft.compId !== compIdOriginal) {
    return {
      compDataListNext: [compDataLeft, ...compDataListRight],
      compIdListLeft: [compDataLeft.compId],
      compIdListRight: compDataListRight.map((compData) => compData.compId),
      focus,
    };
  }

  const compIdLeft = compDataRightFirst.compId;
  const compDataLeftNext = cloneCompDataWithId(compDataLeft, compIdLeft);
  const compDataRightFirstNext = cloneCompDataWithId(compDataRightFirst, compIdOriginal);
  const compDataListRightNext = [compDataRightFirstNext, ...compDataListRight.slice(1)];
  return {
    compDataListNext: [compDataLeftNext, ...compDataListRightNext],
    compIdListLeft: [compDataLeftNext.compId],
    compIdListRight: compDataListRightNext.map((compData) => compData.compId),
    focus: focus?.compId === compDataRightFirst.compId
      ? { ...focus, compId: compIdOriginal }
      : focus,
  };
}

function cloneCompDataWithId(compData: CompData, compId: string): CompData {
  return {
    ...compData,
    compId,
    childIdList: getChildIdList(compData),
    data: {
      ...(compData.data || {}),
      sourceId: compData.data?.sourceId === compData.compId ? compId : compData.data?.sourceId,
    },
    config: { ...(compData.config || {}) },
  };
}

function getFirstChildIdInRow(store: DocStore, docId: string, rowId: string) {
  const rowData = store.getCompDataById(docId, rowId);
  return getChildIdList(rowData)[0] || '';
}

function getLastChildIdInRow(store: DocStore, docId: string, rowId: string) {
  const rowData = store.getCompDataById(docId, rowId);
  const childIdList = getChildIdList(rowData);
  return childIdList[childIdList.length - 1] || '';
}

function getChildIdList(compData: any) {
  return Array.isArray(compData?.childIdList) ? compData.childIdList.map((id: any) => String(id || '')).filter(Boolean) : [];
}

function createRowComp(rowId: string, childIdList: string[], rowDataTemplate: CompData): CompData {
  return {
    compId: rowId,
    compName: 'Row',
    childIdList,
    data: { ...(rowDataTemplate.data || {}) },
    config: { ...(rowDataTemplate.config || {}) },
  };
}

function createCompId(store: DocStore, docId: string, prefix: string) {
  let compId = `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  while (store.getCompDataById(docId, compId)) {
    compId = `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }
  return compId;
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
