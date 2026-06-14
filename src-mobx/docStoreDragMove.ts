import type { DocStore } from './docStore';
import type { CompData, DocRecord, DragDropInfo } from './docStoreTypes';

type DragSubject = {
  itemKindDragged: 'segment' | 'row' | 'list' | '';
  compIdDragged: string;
};

export function docStoreGetDragSubjectFromFocus(
  store: DocStore,
  docId: string,
  compIdFallback = '',
): DragSubject {
  const docRecord = store.ensureDoc(docId);
  const focusState = docRecord.interactionState.focusState;
  const compIdFocused = String(focusState.compIdFocused || focusState.segIdFocused || compIdFallback || '');
  const compDataFocused = docRecord.compDataById[compIdFocused];
  const compName = String(compDataFocused?.compName || '');
  if (compName === 'TextSeg') {
    return { itemKindDragged: 'segment', compIdDragged: compIdFocused };
  }
  if (compName === 'Row') {
    return { itemKindDragged: 'row', compIdDragged: compIdFocused };
  }
  if (compName === 'List' && compDataFocused?.config?.isRoot !== true && docRecord.compIdRoot !== compIdFocused) {
    return { itemKindDragged: 'list', compIdDragged: compIdFocused };
  }
  return { itemKindDragged: '', compIdDragged: '' };
}

export function docStoreGetDropInfoFromPoint(
  store: DocStore,
  docId: string,
  clientX: number,
  clientY: number,
): DragDropInfo | null {
  const docRecord = store.ensureDoc(docId);
  const dragState = docRecord.interactionState.dragState;
  const itemKindDragged = dragState.itemKindDragged;
  const elTarget = document.elementFromPoint(clientX, clientY);
  if (!elTarget) return null;

  if (itemKindDragged === 'segment') {
    return getSegmentDropInfoFromPoint(docRecord, elTarget, clientX);
  }

  if (itemKindDragged === 'row' || itemKindDragged === 'list') {
    const dropInfoMain = getMainRowDropInfoFromPoint(docRecord, elTarget, clientX, clientY);
    if (dropInfoMain) return dropInfoMain;
    return getOutlineDropInfoFromPoint(docRecord, elTarget, clientY);
  }

  return null;
}

export function docStoreGetIsDropAllowed(store: DocStore, docId: string, dropInfo: DragDropInfo | null) {
  const docRecord = store.ensureDoc(docId);
  const dragState = docRecord.interactionState.dragState;
  if (!dragState.isDragging || !dragState.compIdDragged || !dragState.itemKindDragged || !dropInfo?.drop) {
    return false;
  }
  if (dragState.itemKindDragged === 'segment') {
    return getIsSegmentDropAllowed(docRecord, dragState.compIdDragged, dropInfo);
  }
  if (dragState.itemKindDragged === 'row') {
    return getIsRowDropAllowed(docRecord, dragState.compIdDragged, dropInfo);
  }
  if (dragState.itemKindDragged === 'list') {
    return getIsListDropAllowed(docRecord, dragState.compIdDragged, dropInfo);
  }
  return false;
}

export function docStoreCompleteDragMove(store: DocStore, docId: string) {
  const docRecord = store.ensureDoc(docId);
  const dragState = docRecord.interactionState.dragState;
  const itemKindDragged = dragState.itemKindDragged;
  const compIdDragged = dragState.compIdDragged;
  const dropInfo = dragState.dropInfoActive;
  const isDropAllowed = docStoreGetIsDropAllowed(store, docId, dropInfo);
  if (!isDropAllowed || !dropInfo?.drop) {
    return { code: -1, message: 'Drop target is not valid.' };
  }

  if (itemKindDragged === 'segment') {
    return moveSegmentByDrop(store, docId, compIdDragged, dropInfo);
  }
  if (itemKindDragged === 'row') {
    return moveRowByDrop(store, docId, compIdDragged, dropInfo);
  }
  if (itemKindDragged === 'list') {
    return moveListByDrop(store, docId, compIdDragged, dropInfo);
  }
  return { code: -1, message: 'Dragged item is not movable.' };
}

function getSegmentDropInfoFromPoint(docRecord: DocRecord, elTarget: Element, clientX: number): DragDropInfo | null {
  const elRowSegList = elTarget.closest?.('[data-mobx-row-seg-list-id]') as HTMLElement | null;
  const rowId = String(elRowSegList?.dataset.mobxRowSegListId || '');
  const rowData = docRecord.compDataById[rowId];
  if (!elRowSegList || String(rowData?.compName || '') !== 'Row') return null;

  const segIdList = getTextSegIdList(rowData, docRecord);
  let indexTarget = segIdList.length;
  let segIdTarget = '';
  let side = 'after';
  for (let index = 0; index < segIdList.length; index += 1) {
    const segId = segIdList[index];
    const elSeg = elRowSegList.querySelector<HTMLElement>(`[data-mobx-seg-id="${cssEscape(segId)}"]`);
    if (!elSeg) continue;
    const rect = elSeg.getBoundingClientRect();
    if (clientX <= rect.left + rect.width / 2) {
      indexTarget = index;
      segIdTarget = segId;
      side = 'before';
      break;
    }
    indexTarget = index + 1;
    segIdTarget = segId;
    side = 'after';
  }

  return {
    kind: 'segment',
    targetId: segIdTarget ? `segment:${segIdTarget}` : `rowSegList:${rowId}`,
    drop: { rowId, indexTarget, side },
  };
}

function getMainRowDropInfoFromPoint(docRecord: DocRecord, elTarget: Element, clientX: number, clientY: number): DragDropInfo | null {
  const elList = elTarget.closest?.('[data-mobx-comp-name="List"]') as HTMLElement | null;
  const listId = String(elList?.dataset.mobxCompId || '');
  const listData = docRecord.compDataById[listId];
  if (!elList || String(listData?.compName || '') !== 'List') return null;

  const rect = elList.getBoundingClientRect();
  if (clientY < rect.top || clientY > rect.top + 8) return null;
  const isLeftPart = clientX <= rect.left + rect.width / 2;
  if (isLeftPart) {
    return {
      kind: 'mainRow',
      targetId: `list:${listId}`,
      drop: { listId },
    };
  }

  const entryInfo = getOutlineEntryInfoByListId(docRecord, listId);
  if (!entryInfo?.parentListId) {
    if (listData.config?.isRoot === true || docRecord.compIdRoot === listId) {
      return {
        kind: 'outline',
        targetId: `list:${listId}`,
        drop: {
          listId,
          indexTarget: 0,
          side: 'beforeSibling',
        },
      };
    }
    return null;
  }
  const indexTarget = getChildIndex(docRecord, entryInfo.parentListId, entryInfo.entryId);
  return {
    kind: 'outline',
    targetId: `list:${entryInfo.entryId}`,
    drop: {
      listId: entryInfo.parentListId,
      indexTarget: Math.max(0, indexTarget),
      side: 'beforeSibling',
    },
  };
}

function getOutlineDropInfoFromPoint(docRecord: DocRecord, elTarget: Element, clientY: number): DragDropInfo | null {
  const elOutline = elTarget.closest?.('[data-mobx-outline-item-id]') as HTMLElement | null;
  const itemId = String(elOutline?.dataset.mobxOutlineItemId || '');
  const compId = itemId.split(':')[1] || '';
  const compData = docRecord.compDataById[compId];
  if (!elOutline || !compData) return null;

  const entryInfo = String(compData.compName || '') === 'List'
    ? getOutlineEntryInfoByListId(docRecord, compId)
    : getOutlineEntryInfoByRowId(docRecord, compId);

  const rect = elOutline.getBoundingClientRect();
  const yInItem = clientY - rect.top;
  const heightItem = rect.height || 1;
  const isInsideZone = String(compData.compName || '') === 'List'
    && yInItem > heightItem * 0.28
    && yInItem < heightItem * 0.72;
  if (!entryInfo?.parentListId && String(compData.compName || '') === 'List') {
    const isRootList = compData.config?.isRoot === true || docRecord.compIdRoot === compId;
    if (!isRootList) return null;
    return {
      kind: 'outline',
      targetId: itemId,
      drop: {
        listId: compId,
        indexTarget: 0,
        side: isInsideZone ? 'inside' : 'before',
      },
    };
  }
  if (!entryInfo?.parentListId) return null;
  if (isInsideZone) {
    return {
      kind: 'outline',
      targetId: itemId,
      drop: {
        listId: entryInfo.entryId,
        indexTarget: 0,
        side: 'inside',
      },
    };
  }

  const indexEntry = getChildIndex(docRecord, entryInfo.parentListId, entryInfo.entryId);
  const isBefore = yInItem < heightItem / 2;
  return {
    kind: 'outline',
    targetId: itemId,
    drop: {
      listId: entryInfo.parentListId,
      indexTarget: isBefore ? indexEntry : indexEntry + 1,
      side: isBefore ? 'before' : 'after',
    },
  };
}

function getIsSegmentDropAllowed(docRecord: DocRecord, segId: string, dropInfo: DragDropInfo) {
  if (dropInfo.kind !== 'segment') return false;
  if (!isCompName(docRecord, segId, 'TextSeg')) return false;
  const rowIdTarget = String(dropInfo.drop?.rowId || '');
  const rowTarget = docRecord.compDataById[rowIdTarget];
  if (String(rowTarget?.compName || '') !== 'Row') return false;
  const rowIdSource = getOwningRowId(docRecord, segId);
  if (!rowIdSource) return false;
  const segIdListTarget = getTextSegIdList(rowTarget, docRecord);
  const indexTarget = clampIndex(Number(dropInfo.drop?.indexTarget || 0), segIdListTarget.length);
  const indexSource = rowIdSource === rowIdTarget ? segIdListTarget.indexOf(segId) : -1;
  return !(rowIdSource === rowIdTarget && (indexTarget === indexSource || indexTarget === indexSource + 1));
}

function getIsRowDropAllowed(docRecord: DocRecord, rowId: string, dropInfo: DragDropInfo) {
  if (!isCompName(docRecord, rowId, 'Row')) return false;
  if (dropInfo.kind === 'mainRow') {
    const listIdTarget = String(dropInfo.drop?.listId || '');
    const listTarget = docRecord.compDataById[listIdTarget];
    return String(listTarget?.compName || '') === 'List' && String(listTarget.mainCompId || '') !== rowId;
  }
  if (dropInfo.kind !== 'outline') return false;
  const listIdTarget = String(dropInfo.drop?.listId || '');
  const listTarget = docRecord.compDataById[listIdTarget];
  if (String(listTarget?.compName || '') !== 'List') return false;
  const parentCurrent = getOwningListIdForChildEntry(docRecord, rowId);
  const indexCurrent = parentCurrent ? getChildIndex(docRecord, parentCurrent, rowId) : -1;
  const indexTarget = Number(dropInfo.drop?.indexTarget || 0);
  return !(parentCurrent === listIdTarget && (indexTarget === indexCurrent || indexTarget === indexCurrent + 1));
}

function getIsListDropAllowed(docRecord: DocRecord, listId: string, dropInfo: DragDropInfo) {
  if (dropInfo.kind !== 'outline') return false;
  const listData = docRecord.compDataById[listId];
  if (String(listData?.compName || '') !== 'List') return false;
  if (listData.config?.isRoot === true || docRecord.compIdRoot === listId) return false;
  const listIdTarget = String(dropInfo.drop?.listId || '');
  const listTarget = docRecord.compDataById[listIdTarget];
  if (String(listTarget?.compName || '') !== 'List') return false;
  if (listIdTarget === listId || isCompDescendantOrSelf(docRecord, listId, listIdTarget)) return false;
  const parentCurrent = getOwningListIdForChildEntry(docRecord, listId);
  const indexCurrent = parentCurrent ? getChildIndex(docRecord, parentCurrent, listId) : -1;
  const indexTarget = Number(dropInfo.drop?.indexTarget || 0);
  return !(parentCurrent === listIdTarget && (indexTarget === indexCurrent || indexTarget === indexCurrent + 1));
}

function moveSegmentByDrop(store: DocStore, docId: string, segId: string, dropInfo: DragDropInfo) {
  const docRecord = store.ensureDoc(docId);
  const rowIdSource = getOwningRowId(docRecord, segId);
  const rowIdTarget = String(dropInfo.drop?.rowId || '');
  const rowSource = docRecord.compDataById[rowIdSource];
  const rowTarget = docRecord.compDataById[rowIdTarget];
  if (!rowSource || !rowTarget) return { code: -1, message: 'Segment move row missing.' };

  const childIdListSource = getChildIdList(rowSource);
  const childIdListTarget = rowSource === rowTarget ? childIdListSource : getChildIdList(rowTarget);
  const indexSource = childIdListSource.indexOf(segId);
  if (indexSource < 0) return { code: -1, message: 'Segment not found in source row.' };
  let indexTarget = clampIndex(Number(dropInfo.drop?.indexTarget || 0), childIdListTarget.length);
  childIdListSource.splice(indexSource, 1);
  if (rowSource === rowTarget && indexSource < indexTarget) {
    indexTarget -= 1;
  }
  childIdListTarget.splice(indexTarget, 0, segId);
  rowSource.childIdList = childIdListSource;
  rowTarget.childIdList = childIdListTarget;
  store.clearSelectionState(docId);
  store.segFocus(docId, segId, store.getInteractionState(docId).focusState.offsetFocused, 'dragMove');
  return { code: 0, message: 'Segment moved.' };
}

function moveRowByDrop(store: DocStore, docId: string, rowId: string, dropInfo: DragDropInfo) {
  const docRecord = store.ensureDoc(docId);
  const listIdSource = getOwningListIdForChildEntry(docRecord, rowId);
  const indexSource = listIdSource ? getChildIndex(docRecord, listIdSource, rowId) : -1;
  if (!removeRowFromCurrentPlace(docRecord, rowId)) {
    return { code: -1, message: 'Row source not found.' };
  }
  if (dropInfo.kind === 'mainRow') {
    const listIdTarget = String(dropInfo.drop?.listId || '');
    const listTarget = docRecord.compDataById[listIdTarget];
    if (String(listTarget?.compName || '') !== 'List') return { code: -1, message: 'Target list missing.' };
    const rowIdMainPrevious = String(listTarget.mainCompId || '');
    listTarget.mainCompId = rowId;
    if (rowIdMainPrevious && rowIdMainPrevious !== rowId) {
      const childIdList = getChildIdList(listTarget).filter((childId) => childId !== rowIdMainPrevious);
      listTarget.childIdList = [rowIdMainPrevious, ...childIdList];
    }
  } else {
    const listIdTarget = String(dropInfo.drop?.listId || '');
    let indexTarget = Number(dropInfo.drop?.indexTarget || 0);
    if (listIdSource === listIdTarget && indexSource >= 0 && indexSource < indexTarget) {
      indexTarget -= 1;
    }
    if (!moveRowAfterListWithChildren(docRecord, rowId, dropInfo, listIdTarget, indexTarget)) {
      insertEntryIntoList(docRecord, rowId, listIdTarget, indexTarget);
    }
  }
  store.clearSelectionState(docId);
  store.compIdFocus(docId, rowId, 'dragMove');
  return { code: 0, message: 'Row moved.' };
}

function moveListByDrop(store: DocStore, docId: string, listId: string, dropInfo: DragDropInfo) {
  const docRecord = store.ensureDoc(docId);
  const parentIdSource = getOwningListIdForChildEntry(docRecord, listId);
  if (!parentIdSource) return { code: -1, message: 'List source not found.' };
  const indexSource = getChildIndex(docRecord, parentIdSource, listId);
  const listIdTarget = String(dropInfo.drop?.listId || '');
  let indexTarget = Number(dropInfo.drop?.indexTarget || 0);
  if (parentIdSource === listIdTarget && indexSource >= 0 && indexSource < indexTarget) {
    indexTarget -= 1;
  }
  removeEntryFromList(docRecord, parentIdSource, listId);
  insertEntryIntoList(docRecord, listId, listIdTarget, indexTarget);
  store.clearSelectionState(docId);
  store.compIdFocus(docId, listId, 'dragMove');
  return { code: 0, message: 'List moved.' };
}

function removeRowFromCurrentPlace(docRecord: DocRecord, rowId: string) {
  let isRemoved = false;
  for (const compData of Object.values(docRecord.compDataById)) {
    if (String(compData.compName || '') !== 'List') continue;
    if (String(compData.mainCompId || '') === rowId) {
      compData.mainCompId = '';
      isRemoved = true;
    }
    const childIdList = getChildIdList(compData);
    if (childIdList.includes(rowId)) {
      compData.childIdList = childIdList.filter((childId) => childId !== rowId);
      isRemoved = true;
    }
  }
  return isRemoved;
}

function insertEntryIntoList(docRecord: DocRecord, entryId: string, listId: string, indexTargetRaw: number) {
  const listData = docRecord.compDataById[listId];
  if (String(listData?.compName || '') !== 'List') return false;
  const childIdList = getChildIdList(listData).filter((childId) => childId !== entryId);
  const indexTarget = clampIndex(indexTargetRaw, childIdList.length);
  childIdList.splice(indexTarget, 0, entryId);
  listData.childIdList = childIdList;
  return true;
}

function moveRowAfterListWithChildren(
  docRecord: DocRecord,
  rowId: string,
  dropInfo: DragDropInfo,
  listIdTarget: string,
  indexTarget: number,
) {
  if (dropInfo.kind !== 'outline' || dropInfo.drop?.side !== 'after') return false;
  const listIdTargetEntry = getListIdFromDragTargetId(dropInfo.targetId);
  const listDataTargetEntry = docRecord.compDataById[listIdTargetEntry];
  if (String(listDataTargetEntry?.compName || '') !== 'List') return false;
  if (String(listDataTargetEntry.mainCompId || '') === rowId) return false;

  const childIdListMoved = getChildIdList(listDataTargetEntry).filter((childId) => childId !== rowId);
  if (childIdListMoved.length === 0) return false;

  const listIdWrapped = createCompId(docRecord, 'list');
  docRecord.compDataById[listIdWrapped] = {
    compId: listIdWrapped,
    compName: 'List',
    mainCompId: rowId,
    childIdList: childIdListMoved,
    data: {},
    config: {},
  };
  listDataTargetEntry.childIdList = [];
  return insertEntryIntoList(docRecord, listIdWrapped, listIdTarget, indexTarget);
}

function removeEntryFromList(docRecord: DocRecord, listId: string, entryId: string) {
  const listData = docRecord.compDataById[listId];
  if (!listData) return;
  listData.childIdList = getChildIdList(listData).filter((childId) => childId !== entryId);
}

function getOutlineEntryInfoByRowId(docRecord: DocRecord, rowId: string) {
  const listIdMain = getListIdByMainRowId(docRecord, rowId);
  if (listIdMain) {
    return {
      entryId: listIdMain,
      rowId,
      parentListId: getOwningListIdForChildEntry(docRecord, listIdMain),
    };
  }
  const parentListId = getOwningListIdForChildEntry(docRecord, rowId);
  return parentListId ? { entryId: rowId, rowId, parentListId } : null;
}

function getOutlineEntryInfoByListId(docRecord: DocRecord, listId: string) {
  const rowId = String(docRecord.compDataById[listId]?.mainCompId || '');
  const parentListId = getOwningListIdForChildEntry(docRecord, listId);
  return parentListId ? { entryId: listId, rowId, parentListId } : null;
}

function getOwningRowId(docRecord: DocRecord, compIdChild: string) {
  for (const compData of Object.values(docRecord.compDataById)) {
    if (String(compData.compName || '') !== 'Row') continue;
    if (getChildIdList(compData).includes(compIdChild)) {
      return compData.compId;
    }
  }
  return '';
}

function getOwningListIdForChildEntry(docRecord: DocRecord, entryId: string) {
  for (const compData of Object.values(docRecord.compDataById)) {
    if (String(compData.compName || '') !== 'List') continue;
    if (getChildIdList(compData).includes(entryId)) {
      return compData.compId;
    }
  }
  return '';
}

function getListIdByMainRowId(docRecord: DocRecord, rowId: string) {
  for (const compData of Object.values(docRecord.compDataById)) {
    if (String(compData.compName || '') === 'List' && String(compData.mainCompId || '') === rowId) {
      return compData.compId;
    }
  }
  return '';
}

function getChildIndex(docRecord: DocRecord, listId: string, entryId: string) {
  return getChildIdList(docRecord.compDataById[listId]).indexOf(entryId);
}

function getTextSegIdList(rowData: CompData, docRecord: DocRecord) {
  return getChildIdList(rowData).filter((childId) => isCompName(docRecord, childId, 'TextSeg'));
}

function getChildIdList(compData: CompData | null | undefined) {
  return Array.isArray(compData?.childIdList) ? compData.childIdList.map((id) => String(id || '')).filter(Boolean) : [];
}

function getListIdFromDragTargetId(targetId: string) {
  const [itemKind, compId] = String(targetId || '').split(':');
  return itemKind === 'list' ? String(compId || '') : '';
}

function isCompName(docRecord: DocRecord, compId: string, compName: string) {
  return String(docRecord.compDataById[String(compId || '')]?.compName || '') === compName;
}

function isCompDescendantOrSelf(docRecord: DocRecord, compIdAncestor: string, compIdTarget: string) {
  const ancestorId = String(compIdAncestor || '');
  const targetId = String(compIdTarget || '');
  if (!ancestorId || !targetId) return false;
  if (ancestorId === targetId) return true;
  const ancestorData = docRecord.compDataById[ancestorId];
  if (!ancestorData) return false;
  const stack = [
    ...getChildIdList(ancestorData),
    String(ancestorData.mainCompId || ''),
  ].filter(Boolean);
  const idVisitedSet = new Set<string>();
  while (stack.length > 0) {
    const compIdCurrent = String(stack.pop() || '');
    if (!compIdCurrent || idVisitedSet.has(compIdCurrent)) continue;
    if (compIdCurrent === targetId) return true;
    idVisitedSet.add(compIdCurrent);
    const compDataCurrent = docRecord.compDataById[compIdCurrent];
    stack.push(...getChildIdList(compDataCurrent));
    if (compDataCurrent?.mainCompId) {
      stack.push(String(compDataCurrent.mainCompId));
    }
  }
  return false;
}

function clampIndex(indexRaw: number, length: number) {
  return Math.min(length, Math.max(0, Number.isFinite(indexRaw) ? Math.trunc(indexRaw) : 0));
}

function createCompId(docRecord: DocRecord, prefix: string) {
  let compId = '';
  do {
    compId = `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  } while (docRecord.compDataById[compId]);
  return compId;
}

function cssEscape(value: string) {
  const cssWithEscape = window.CSS as { escape?: (value: string) => string } | undefined;
  return cssWithEscape?.escape ? cssWithEscape.escape(value) : value.replace(/"/g, '\\"');
}
