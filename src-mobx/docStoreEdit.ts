import type { DocStore } from './docStore';
import type {
  CompData,
  CompEditResult,
  CompFocusTarget,
  DocRecord,
  SelectionState,
  SelectionTrackPoint,
} from './docStoreTypes';
import { docStoreCreateCompId } from './docStoreCompData';
import {
  docStoreGetActiveEdit,
  editPutCompData,
  editRemoveComp,
  editRemoveCompSubtree,
  editSetChildIdList,
  type DocEditContext,
} from './docStoreEditContext';
import {
  docStoreCollectSegmentIds,
  docStoreGetOwningRowId,
  docStoreGetSegmentIdListInRow,
  docStoreIsSegment,
} from './docStoreSegment';

type OutlineEntryInfo = {
  entryId: string;
  rowId: string;
  parentListId: string;
};

type StructureEditResult = {
  code: number;
  message: string;
  data?: any;
};

export function docStoreApplyCompEditResult(
  store: DocStore,
  docId: string,
  parentId: string,
  editResult: CompEditResult,
  reason: string,
) {
  const op = String(editResult?.op || '');
  if (op === 'noop') {
    return { code: 0, message: 'No edit applied.' };
  }
  if (op === 'replaceSelf' || op === 'replaceRange') {
    const result = docStoreReplaceChildRange(
      store,
      docId,
      parentId,
      editResult.compIdListOriginal,
      editResult.compListNext,
      { focus: editResult.focus, reason },
    );
    if (result.code !== 0) return result;
    return { code: 0, message: 'Component edit applied.', data: result.data };
  }
  if (op === 'deleteSelf') {
    const result = docStoreReplaceChildRange(
      store,
      docId,
      parentId,
      editResult.compIdListOriginal,
      [],
      { focus: editResult.focus, reason },
    );
    if (result.code !== 0) return result;
    return { code: 0, message: 'Component delete applied.', data: result.data };
  }
  return { code: -1, message: `Unsupported edit op. op=${op}` };
}

export function docStoreReplaceChildRange(
  store: DocStore,
  docId: string,
  parentId: string,
  childIdListOldRaw: string[],
  compDataListNextRaw: CompData[],
  options: { focus?: CompFocusTarget; reason?: string } = {},
) {
  const docRecord = store.ensureDoc(docId);
  const parentData = docRecord.compDataById[String(parentId || '')];
  if (!parentData) {
    return { code: -1, message: `Parent component not found. compId=${parentId}` };
  }
  const childIdList = Array.isArray(parentData.childIdList) ? parentData.childIdList.map((id) => String(id || '')) : [];
  const childIdListOld = (Array.isArray(childIdListOldRaw) ? childIdListOldRaw : []).map((id) => String(id || '')).filter(Boolean);
  const compDataListNext = (Array.isArray(compDataListNextRaw) ? compDataListNextRaw : []).filter((compData) => compData?.compId);
  if (childIdListOld.length === 0) {
    return { code: -1, message: 'Child range is empty.' };
  }
  const indexStart = findChildRangeIndex(childIdList, childIdListOld);
  if (indexStart < 0) {
    return { code: -1, message: `Child range not found. parentId=${parentId}` };
  }

  const contextEdit = docStoreGetActiveEdit(store, docId);
  const childIdSetNext = new Set(compDataListNext.map((compData) => String(compData.compId || '')));
  for (const childIdOld of childIdListOld) {
    if (!childIdSetNext.has(childIdOld)) {
      editRemoveCompSubtree(contextEdit, childIdOld);
    }
  }
  for (const compDataNext of compDataListNext) {
    editPutCompData(contextEdit, compDataNext);
  }
  const childIdListNext = compDataListNext.map((compData) => String(compData.compId || '')).filter(Boolean);
  editSetChildIdList(contextEdit, String(parentId || ''), [
    ...childIdList.slice(0, indexStart),
    ...childIdListNext,
    ...childIdList.slice(indexStart + childIdListOld.length),
  ]);
  store.clearSelectionState(docId);
  if (options.focus) {
    docStoreApplyFocusAfterEdit(store, docId, options.focus, String(options.reason || 'compEdit'));
  }
  return { code: 0, message: 'Child range replaced.', data: { childIdListNext } };
}

export function docStoreInsertChildAfter(
  store: DocStore,
  docId: string,
  parentId: string,
  childIdRef: string,
  compDataNext: CompData,
  options: { focus?: CompFocusTarget; reason?: string } = {},
) {
  const docRecord = store.ensureDoc(docId);
  const parentData = docRecord.compDataById[String(parentId || '')];
  if (!parentData) {
    return { code: -1, message: `Parent component not found. compId=${parentId}` };
  }
  const childIdList = Array.isArray(parentData.childIdList) ? parentData.childIdList.map((id) => String(id || '')) : [];
  const childIndex = childIdList.indexOf(String(childIdRef || ''));
  if (childIndex < 0) {
    return { code: -1, message: `Reference child not found. compId=${childIdRef}` };
  }
  const contextEdit = docStoreGetActiveEdit(store, docId);
  editPutCompData(contextEdit, compDataNext);
  editSetChildIdList(contextEdit, String(parentId || ''), [
    ...childIdList.slice(0, childIndex + 1),
    compDataNext.compId,
    ...childIdList.slice(childIndex + 1).filter((id) => id !== compDataNext.compId),
  ]);
  store.clearSelectionState(docId);
  if (options.focus) {
    docStoreApplyFocusAfterEdit(store, docId, options.focus, String(options.reason || 'compInsert'));
  }
  return { code: 0, message: 'Child inserted.', data: { compIdInserted: compDataNext.compId } };
}

export function docStoreRemoveCompSubtree(store: DocStore, docId: string, compId: string) {
  editRemoveCompSubtree(docStoreGetActiveEdit(store, docId), compId);
  return { code: 0, message: 'Component subtree removed.' };
}

export function docStoreReplaceCompData(store: DocStore, docId: string, compDataNext: CompData) {
  if (!compDataNext?.compId) {
    return { code: -1, message: 'Replacement component id missing.' };
  }
  editPutCompData(docStoreGetActiveEdit(store, docId), compDataNext);
  return { code: 0, message: 'Component data replaced.' };
}

export function docStoreApplyFocusAfterEdit(
  store: DocStore,
  docId: string,
  focusNext: CompFocusTarget,
  reason: string,
) {
  const compId = String(focusNext?.compId || '');
  if (!compId) {
    return { code: -1, message: 'Focus component id missing.' };
  }
  const offsetFocused = Number(focusNext?.point?.offset || 0);
  store.segFocus(docId, compId, offsetFocused, reason);
  compFocusAfterRender(store, docId, compId, offsetFocused);
  return { code: 0, message: 'Focus applied after edit.' };
}

export function docStoreIndentEntryBySegId(store: DocStore, docId: string, segId: string) {
  const docRecord = store.ensureDoc(docId);
  const selectionStateBefore = cloneActiveSelectionState(docRecord);
  const selectedRowIdList = getSelectedRowIdListFromSelection(docRecord);
  const selectionEntries = getSelectedTopLevelEntryInfoList(docRecord);
  if (selectedRowIdList.length > 1 && selectionEntries.length > 0) {
    return indentSelectedEntries(store, docId, selectionEntries, selectionStateBefore);
  }
  const entryInfo = getOutlineEntryInfoBySegId(docRecord, segId);
  if (!entryInfo) {
    return { code: -1, message: `Owning entry not found. segId=${segId}` };
  }
  const result = indentEntryByEntryId(docStoreGetActiveEdit(store, docId), entryInfo.entryId);
  if (result.code !== 0) return result;
  finishStructureEdit(store, docId, segId, 'rowIndent', selectionStateBefore);
  return { code: 0, message: 'Entry indented.' };
}

export function docStoreIndentEntryByRowId(store: DocStore, docId: string, rowId: string, compIdFocus = '') {
  const docRecord = store.ensureDoc(docId);
  const selectionStateBefore = cloneActiveSelectionState(docRecord);
  const selectedRowIdList = getSelectedRowIdListFromSelection(docRecord);
  const selectionEntries = getSelectedTopLevelEntryInfoList(docRecord);
  if (selectedRowIdList.length > 1 && selectionEntries.length > 0) {
    return indentSelectedEntries(store, docId, selectionEntries, selectionStateBefore);
  }
  const entryInfo = getOutlineEntryInfoByRowId(docRecord, rowId);
  if (!entryInfo) {
    return { code: -1, message: `Owning entry not found. rowId=${rowId}` };
  }
  const result = indentEntryByEntryId(docStoreGetActiveEdit(store, docId), entryInfo.entryId);
  if (result.code !== 0) return result;
  finishStructureEdit(store, docId, compIdFocus || getFirstSegIdInRow(docRecord, rowId), 'rowIndent', selectionStateBefore);
  return { code: 0, message: 'Entry indented.' };
}

export function docStoreOutdentEntryBySegId(store: DocStore, docId: string, segId: string) {
  const docRecord = store.ensureDoc(docId);
  const selectionStateBefore = cloneActiveSelectionState(docRecord);
  const selectedRowIdList = getSelectedRowIdListFromSelection(docRecord);
  const selectionEntries = getSelectedTopLevelEntryInfoList(docRecord);
  if (selectedRowIdList.length > 1 && selectionEntries.length > 0) {
    return outdentSelectedEntries(store, docId, selectionEntries, selectionStateBefore);
  }
  const entryInfo = getOutlineEntryInfoBySegId(docRecord, segId);
  if (!entryInfo) {
    return { code: -1, message: `Owning entry not found. segId=${segId}` };
  }
  const result = outdentEntryByEntryId(docStoreGetActiveEdit(store, docId), entryInfo.entryId);
  if (result.code !== 0) return result;
  finishStructureEdit(store, docId, segId, 'rowOutdent', selectionStateBefore);
  return { code: 0, message: 'Entry outdented.' };
}

export function docStoreOutdentEntryByRowId(store: DocStore, docId: string, rowId: string, compIdFocus = '') {
  const docRecord = store.ensureDoc(docId);
  const selectionStateBefore = cloneActiveSelectionState(docRecord);
  const selectedRowIdList = getSelectedRowIdListFromSelection(docRecord);
  const selectionEntries = getSelectedTopLevelEntryInfoList(docRecord);
  if (selectedRowIdList.length > 1 && selectionEntries.length > 0) {
    return outdentSelectedEntries(store, docId, selectionEntries, selectionStateBefore);
  }
  const entryInfo = getOutlineEntryInfoByRowId(docRecord, rowId);
  if (!entryInfo) {
    return { code: -1, message: `Owning entry not found. rowId=${rowId}` };
  }
  const result = outdentEntryByEntryId(docStoreGetActiveEdit(store, docId), entryInfo.entryId);
  if (result.code !== 0) return result;
  finishStructureEdit(store, docId, compIdFocus || getFirstSegIdInRow(docRecord, rowId), 'rowOutdent', selectionStateBefore);
  return { code: 0, message: 'Entry outdented.' };
}

function indentSelectedEntries(
  store: DocStore,
  docId: string,
  entryInfoList: OutlineEntryInfo[],
  selectionStateBefore: SelectionState | null,
) {
  const contextEdit = docStoreGetActiveEdit(store, docId);
  for (const entryInfo of entryInfoList) {
    const result = indentEntryByEntryId(contextEdit, entryInfo.entryId, { isPreserveExistingChildren: true });
    if (result.code !== 0) {
      return result;
    }
  }
  const segIdFocused = pickSegIdForStructureFocus(store.ensureDoc(docId), entryInfoList);
  finishStructureEdit(store, docId, segIdFocused, 'rowIndent', selectionStateBefore);
  return { code: 0, message: 'Selected entries indented.' };
}

function outdentSelectedEntries(
  store: DocStore,
  docId: string,
  entryInfoList: OutlineEntryInfo[],
  selectionStateBefore: SelectionState | null,
) {
  const contextEdit = docStoreGetActiveEdit(store, docId);
  for (let index = entryInfoList.length - 1; index >= 0; index -= 1) {
    const result = outdentEntryByEntryId(contextEdit, entryInfoList[index].entryId);
    if (result.code !== 0) {
      return result;
    }
  }
  const segIdFocused = pickSegIdForStructureFocus(store.ensureDoc(docId), entryInfoList);
  finishStructureEdit(store, docId, segIdFocused, 'rowOutdent', selectionStateBefore);
  return { code: 0, message: 'Selected entries outdented.' };
}

function indentEntryByEntryId(
  contextEdit: DocEditContext,
  entryId: string,
  options: { isPreserveExistingChildren?: boolean } = {},
): StructureEditResult {
  const docRecord = contextEdit.store.ensureDoc(contextEdit.docId);
  const listIdParent = getOwningListIdForChildEntry(docRecord, entryId);
  const listParent = listIdParent ? docRecord.compDataById[listIdParent] : null;
  const childIdList = Array.isArray(listParent?.childIdList) ? listParent.childIdList.map((id) => String(id || '')) : [];
  const entryIndex = childIdList.indexOf(entryId);
  if (!listParent || entryIndex <= 0) {
    return { code: -1, message: 'Cannot indent entry.' };
  }

  const entryIdPrev = childIdList[entryIndex - 1];
  const entryPrev = docRecord.compDataById[entryIdPrev];
  const entryData = docRecord.compDataById[entryId];
  if (!entryPrev || !entryData) {
    return { code: -1, message: 'Cannot indent entry.' };
  }

  const isPreserveExistingChildren = options.isPreserveExistingChildren === true;
  const childIdListFormer = !isPreserveExistingChildren
    && String(entryData.compName || '') === 'List'
    && Array.isArray(entryData.childIdList)
    ? entryData.childIdList.map((id) => String(id || ''))
    : [];

  if (String(entryPrev.compName || '') === 'List') {
    if (!isPreserveExistingChildren && String(entryData.compName || '') === 'List') {
      editSetChildIdList(contextEdit, entryId, []);
    }
    editSetChildIdList(contextEdit, listIdParent, childIdList.filter((id) => id !== entryId));
    editSetChildIdList(contextEdit, entryIdPrev, [
      ...(Array.isArray(entryPrev.childIdList) ? entryPrev.childIdList.map((id) => String(id || '')) : []),
      entryId,
      ...childIdListFormer,
    ]);
    return { code: 0, message: 'Entry indented.' };
  }

  if (String(entryPrev.compName || '') === 'Row') {
    if (!isPreserveExistingChildren && String(entryData.compName || '') === 'List') {
      editSetChildIdList(contextEdit, entryId, []);
    }
    const listIdWrapped = docStoreCreateCompId(docRecord, 'list');
    editPutCompData(contextEdit, {
      compId: listIdWrapped,
      compName: 'List',
      mainCompId: entryIdPrev,
      childIdList: [entryId, ...childIdListFormer],
      data: {},
      config: {},
    });
    editSetChildIdList(contextEdit, listIdParent, childIdList
      .filter((id) => id !== entryId)
      .map((id) => (id === entryIdPrev ? listIdWrapped : id)));
    return { code: 0, message: 'Entry indented.' };
  }

  return { code: -1, message: `Previous entry cannot receive children. compId=${entryIdPrev}` };
}

function outdentEntryByEntryId(contextEdit: DocEditContext, entryId: string): StructureEditResult {
  const docRecord = contextEdit.store.ensureDoc(contextEdit.docId);
  const listIdParent = getOwningListIdForChildEntry(docRecord, entryId);
  const listIdGrandparent = listIdParent ? getOwningListIdForChildEntry(docRecord, listIdParent) : '';
  const listParent = listIdParent ? docRecord.compDataById[listIdParent] : null;
  const listGrandparent = listIdGrandparent ? docRecord.compDataById[listIdGrandparent] : null;
  const childIdList = Array.isArray(listParent?.childIdList) ? listParent.childIdList.map((id) => String(id || '')) : [];
  const entryIndex = childIdList.indexOf(entryId);
  if (!listParent || !listGrandparent || entryIndex === -1) {
    return { code: -1, message: 'Cannot outdent entry.' };
  }

  const childIdListFollowing = childIdList.slice(entryIndex + 1);
  editSetChildIdList(contextEdit, listIdParent, childIdList.slice(0, entryIndex));
  let entryIdMoved = entryId;
  const entryData = docRecord.compDataById[entryId];
  if (String(entryData?.compName || '') === 'List') {
    editSetChildIdList(contextEdit, entryId, [
      ...(Array.isArray(entryData.childIdList) ? entryData.childIdList.map((id) => String(id || '')) : []),
      ...childIdListFollowing,
    ]);
  } else if (childIdListFollowing.length > 0) {
    entryIdMoved = docStoreCreateCompId(docRecord, 'list');
    editPutCompData(contextEdit, {
      compId: entryIdMoved,
      compName: 'List',
      mainCompId: entryId,
      childIdList: childIdListFollowing,
      data: {},
      config: {},
    });
  }
  const mainRowIdParent = String(listParent.mainCompId || '');
  const isParentListEmpty = Array.isArray(listParent.childIdList) && listParent.childIdList.length === 0;
  const isCanUnwrapParent = isParentListEmpty
    && mainRowIdParent
    && String(docRecord.compDataById[mainRowIdParent]?.compName || '') === 'Row';
  if (isCanUnwrapParent) {
    const childIdListGrandparent = Array.isArray(listGrandparent.childIdList)
      ? listGrandparent.childIdList.map((id) => String(id || ''))
      : [];
    editSetChildIdList(contextEdit, listIdGrandparent, childIdListGrandparent.map((childId) => (
      childId === listIdParent ? mainRowIdParent : childId
    )));
    editRemoveComp(contextEdit, listIdParent);
    insertChildAfter(contextEdit, listIdGrandparent, mainRowIdParent, entryIdMoved);
    return { code: 0, message: 'Entry outdented.' };
  }
  insertChildAfter(contextEdit, listIdGrandparent, listIdParent, entryIdMoved);
  return { code: 0, message: 'Entry outdented.' };
}

function getSelectedTopLevelEntryInfoList(docRecord: DocRecord) {
  const selectedRowIdList = getSelectedRowIdListFromSelection(docRecord);
  const entryInfoList: OutlineEntryInfo[] = [];
  const entryIdSet = new Set<string>();
  for (const rowId of selectedRowIdList) {
    const entryInfo = getOutlineEntryInfoByRowId(docRecord, rowId);
    if (!entryInfo || entryIdSet.has(entryInfo.entryId)) continue;
    entryIdSet.add(entryInfo.entryId);
    entryInfoList.push(entryInfo);
  }

  const entryIdSelectedSet = new Set(entryInfoList.map((entryInfo) => entryInfo.entryId));
  return entryInfoList.filter((entryInfo) => (
    !entryInfoList.some((entryInfoMaybeAncestor) => (
      entryInfoMaybeAncestor.entryId !== entryInfo.entryId
      && entryIdSelectedSet.has(entryInfoMaybeAncestor.entryId)
      && isEntryDescendantOfEntry(docRecord, entryInfo.entryId, entryInfoMaybeAncestor.entryId)
    ))
  ));
}

function getSelectedRowIdListFromSelection(docRecord: DocRecord) {
  const selectionState = docRecord.interactionState.selectionState;
  const pointAnchor = selectionState.pointAnchor;
  const pointFocus = selectionState.pointFocus;
  if (selectionState.isSelectionActive !== true || !pointAnchor || !pointFocus) {
    return [];
  }

  const segIdList = docStoreCollectSegmentIds(docRecord);
  const indexAnchor = segIdList.indexOf(pointAnchor.segId);
  const indexFocus = segIdList.indexOf(pointFocus.segId);
  if (indexAnchor === -1 || indexFocus === -1) {
    return [];
  }

  const indexStart = Math.min(indexAnchor, indexFocus);
  const indexEnd = Math.max(indexAnchor, indexFocus);
  const rowIdList: string[] = [];
  const rowIdSet = new Set<string>();
  for (let index = indexStart; index <= indexEnd; index += 1) {
    const rowId = docStoreGetOwningRowId(docRecord, segIdList[index]);
    if (!rowId || rowIdSet.has(rowId)) continue;
    rowIdSet.add(rowId);
    rowIdList.push(rowId);
  }
  return rowIdList;
}

function getSelectionRangeBySegOrder(docRecord: DocRecord) {
  const selectionState = docRecord.interactionState.selectionState;
  const pointAnchor = selectionState.pointAnchor;
  const pointFocus = selectionState.pointFocus;
  if (selectionState.isSelectionActive !== true || !pointAnchor || !pointFocus) {
    return null;
  }

  const segIdList = docStoreCollectSegmentIds(docRecord);
  const indexAnchor = segIdList.indexOf(pointAnchor.segId);
  const indexFocus = segIdList.indexOf(pointFocus.segId);
  if (indexAnchor === -1 || indexFocus === -1) {
    return null;
  }

  const isForward = indexAnchor < indexFocus
    || (indexAnchor === indexFocus && Number(pointAnchor.offset || 0) <= Number(pointFocus.offset || 0));
  return {
    pointStart: isForward ? pointAnchor : pointFocus,
    pointEnd: isForward ? pointFocus : pointAnchor,
    indexStart: Math.min(indexAnchor, indexFocus),
    indexEnd: Math.max(indexAnchor, indexFocus),
  };
}

function collectSelectedRowIdsFromSegRange(docRecord: DocRecord, indexStart: number, indexEnd: number) {
  const segIdList = docStoreCollectSegmentIds(docRecord);
  const rowIdList: string[] = [];
  const rowIdSet = new Set<string>();
  for (let index = indexStart; index <= indexEnd; index += 1) {
    const rowId = docStoreGetOwningRowId(docRecord, segIdList[index]);
    if (!rowId || rowIdSet.has(rowId)) continue;
    rowIdSet.add(rowId);
    rowIdList.push(rowId);
  }
  return rowIdList;
}

function getOutlineEntryInfoBySegId(docRecord: DocRecord, segId: string) {
  const rowId = docStoreGetOwningRowId(docRecord, segId);
  return rowId ? getOutlineEntryInfoByRowId(docRecord, rowId) : null;
}

function getOutlineEntryInfoByRowId(docRecord: DocRecord, rowId: string): OutlineEntryInfo | null {
  if (!isCompName(docRecord, rowId, 'Row')) {
    return null;
  }

  const listIdMain = getListIdByMainRowId(docRecord, rowId);
  if (listIdMain) {
    return {
      entryId: listIdMain,
      rowId,
      parentListId: getOwningListIdForChildEntry(docRecord, listIdMain),
    };
  }

  const parentListId = getOwningListIdForChildEntry(docRecord, rowId);
  if (!parentListId) {
    return null;
  }
  return {
    entryId: rowId,
    rowId,
    parentListId,
  };
}

function isEntryDescendantOfEntry(docRecord: DocRecord, entryIdChild: string, entryIdAncestor: string) {
  const ancestorData = docRecord.compDataById[entryIdAncestor];
  if (String(ancestorData?.compName || '') !== 'List') {
    return false;
  }

  const stack = Array.isArray(ancestorData.childIdList) ? ancestorData.childIdList.map((id) => String(id || '')) : [];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const entryIdCurrent = String(stack.pop() || '');
    if (!entryIdCurrent || visited.has(entryIdCurrent)) continue;
    if (entryIdCurrent === entryIdChild) {
      return true;
    }
    visited.add(entryIdCurrent);
    const entryData = docRecord.compDataById[entryIdCurrent];
    if (String(entryData?.compName || '') === 'List' && Array.isArray(entryData.childIdList)) {
      entryData.childIdList.forEach((childId) => stack.push(String(childId || '')));
    }
  }
  return false;
}

function pickSegIdForStructureFocus(docRecord: DocRecord, entryInfoList: OutlineEntryInfo[]) {
  const segIdFocused = String(docRecord.interactionState.focusState.segIdFocused || '');
  if (docStoreIsSegment(docRecord, segIdFocused)) {
    return segIdFocused;
  }
  for (const entryInfo of entryInfoList) {
    const segId = getFirstSegIdInRow(docRecord, entryInfo.rowId);
    if (segId) return segId;
  }
  return '';
}

function finishStructureEdit(
  store: DocStore,
  docId: string,
  segId: string,
  reason: string,
  selectionStateBefore: SelectionState | null,
) {
  if (selectionStateBefore?.isSelectionActive === true) {
    restoreSelectionStateAfterStructureEdit(store, docId, selectionStateBefore, reason);
    return;
  }
  store.clearSelectionState(docId);
  focusSegAfterStructureEdit(store, docId, segId, reason, true);
}

function cloneActiveSelectionState(docRecord: DocRecord): SelectionState | null {
  const selectionState = docRecord.interactionState.selectionState;
  if (
    selectionState.isSelectionActive !== true
    || !selectionState.pointAnchor
    || !selectionState.pointFocus
  ) {
    return null;
  }
  return {
    isSelectionActive: true,
    mode: 'range',
    pointAnchor: { ...selectionState.pointAnchor },
    pointFocus: { ...selectionState.pointFocus },
  };
}

// Re-apply a recorded range selection: store state, logical focus on the
// selection focus point, and DOM selection after render. Shared by structure
// edits and history undo/redo.
export function docStoreRestoreSelectionState(
  store: DocStore,
  docId: string,
  selectionStateNext: SelectionState,
  reason: string,
) {
  restoreSelectionStateAfterStructureEdit(store, docId, selectionStateNext, reason);
}

function restoreSelectionStateAfterStructureEdit(
  store: DocStore,
  docId: string,
  selectionStateNext: SelectionState,
  reason: string,
) {
  const pointFocus = selectionStateNext.pointFocus;
  store.updateSelectionState(docId, {
    isSelectionActive: true,
    mode: 'range',
    pointAnchor: selectionStateNext.pointAnchor ? { ...selectionStateNext.pointAnchor } : null,
    pointFocus: pointFocus ? { ...pointFocus } : null,
  });
  if (pointFocus?.segId) {
    store.segFocus(docId, pointFocus.segId, pointFocus.offset, reason);
  }
  restoreDomSelectionAfterRender(store, docId, selectionStateNext);
}

function restoreDomSelectionAfterRender(store: DocStore, docId: string, selectionStateNext: SelectionState) {
  const restoreSelection = () => {
    const pointAnchor = selectionStateNext.pointAnchor;
    const pointFocus = selectionStateNext.pointFocus;
    if (!pointAnchor?.segId || !pointFocus?.segId) return;

    const pointDomAnchor = getDomPointBySelectionPoint(store, docId, pointAnchor);
    const pointDomFocus = getDomPointBySelectionPoint(store, docId, pointFocus);
    const selection = typeof window !== 'undefined' ? window.getSelection?.() : null;
    if (!pointDomAnchor || !pointDomFocus || !selection) return;

    const segElFocus = store.getCompElement(docId, pointFocus.segId)
      || (typeof document !== 'undefined'
        ? document.querySelector<HTMLElement>(`[data-mobx-seg-id="${cssEscape(pointFocus.segId)}"]`)
        : null);
    segElFocus?.focus({ preventScroll: true });

    if (typeof selection.setBaseAndExtent === 'function') {
      selection.setBaseAndExtent(
        pointDomAnchor.node,
        pointDomAnchor.offset,
        pointDomFocus.node,
        pointDomFocus.offset,
      );
    } else {
      const range = document.createRange();
      const order = compareDomPoint(pointDomAnchor, pointDomFocus);
      const pointStart = order <= 0 ? pointDomAnchor : pointDomFocus;
      const pointEnd = order <= 0 ? pointDomFocus : pointDomAnchor;
      range.setStart(pointStart.node, pointStart.offset);
      range.setEnd(pointEnd.node, pointEnd.offset);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    store.updateSelectionState(docId, {
      isSelectionActive: true,
      mode: 'range',
      pointAnchor: { ...pointAnchor },
      pointFocus: { ...pointFocus },
    });
  };
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(restoreSelection);
    return;
  }
  setTimeout(restoreSelection, 0);
}

function getDomPointBySelectionPoint(store: DocStore, docId: string, point: SelectionTrackPoint) {
  const segEl = store.getCompElement(docId, point.segId)
    || (typeof document !== 'undefined'
      ? document.querySelector<HTMLElement>(`[data-mobx-seg-id="${cssEscape(point.segId)}"]`)
      : null);
  if (!segEl) return null;
  return getDomPointByOffset(segEl, Number(point.offset || 0));
}

function getDomPointByOffset(segEl: HTMLElement, offsetRaw: number) {
  const offsetTarget = Math.min(
    String(segEl.textContent || '').length,
    Math.max(0, Number(offsetRaw || 0)),
  );
  const walker = document.createTreeWalker(segEl, NodeFilter.SHOW_TEXT);
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
    node: segEl,
    offset: 0,
  };
}

function compareDomPoint(pointA: { node: Node; offset: number }, pointB: { node: Node; offset: number }) {
  if (pointA.node === pointB.node) {
    return pointA.offset - pointB.offset;
  }
  const position = pointA.node.compareDocumentPosition(pointB.node);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
    return -1;
  }
  if (position & Node.DOCUMENT_POSITION_PRECEDING) {
    return 1;
  }
  return 0;
}

function cssEscape(value: string) {
  const cssWithEscape = typeof window !== 'undefined' ? window.CSS : undefined;
  return cssWithEscape?.escape ? cssWithEscape.escape(String(value || '')) : String(value || '').replace(/"/g, '\\"');
}

function focusSegAfterStructureEdit(
  store: DocStore,
  docId: string,
  segId: string,
  reason: string,
  isApplyDomFocus: boolean,
) {
  const docRecord = store.ensureDoc(docId);
  const segIdSafe = String(segId || '');
  const offsetFocused = store.getInteractionState(docId).focusState.offsetFocused;
  if (!docStoreIsSegment(docRecord, segIdSafe)) {
    return;
  }
  store.segFocus(docId, segIdSafe, offsetFocused, reason);
  if (isApplyDomFocus) {
    compFocusAfterRender(store, docId, segIdSafe, offsetFocused);
  }
}

function compFocusAfterRender(store: DocStore, docId: string, segId: string, offset: number) {
  const schedule = typeof window !== 'undefined' ? window.setTimeout : setTimeout;
  schedule(() => {
    const focusApply = () => {
      if (!isFocusRequestCurrent(store, docId, segId, offset)) {
        return;
      }
      const selection = typeof window !== 'undefined' ? window.getSelection?.() : null;
      selection?.removeAllRanges();
      void store.sendEventToComp(docId, segId, {
        type: 'focus',
        sourceId: segId,
        targetId: docId,
        data: {
          segId,
          offset,
        },
      });
    };
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(focusApply);
      return;
    }
    focusApply();
  }, 0);
}

function isFocusRequestCurrent(store: DocStore, docId: string, segId: string, offset: number) {
  const focusState = store.getInteractionState(docId).focusState;
  return focusState.segIdFocused === segId
    && focusState.compIdFocused === segId
    && focusState.offsetFocused === offset;
}

function findChildRangeIndex(childIdList: string[], childIdListOld: string[]) {
  if (childIdListOld.length === 0 || childIdListOld.length > childIdList.length) {
    return -1;
  }
  for (let index = 0; index <= childIdList.length - childIdListOld.length; index += 1) {
    const isMatch = childIdListOld.every((childId, offset) => childIdList[index + offset] === childId);
    if (isMatch) return index;
  }
  return -1;
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

function getOwningRowId(docRecord: DocRecord, segId: string) {
  const compIdList = Object.keys(docRecord.compDataById || {});
  for (const compId of compIdList) {
    const compData = docRecord.compDataById[compId];
    if (String(compData?.compName || '') !== 'Row') continue;
    const childIdList = Array.isArray(compData.childIdList) ? compData.childIdList.map((id) => String(id || '')) : [];
    if (childIdList.includes(segId)) {
      return compId;
    }
  }
  return '';
}

function getFirstSegIdInRow(docRecord: DocRecord, rowId: string) {
  return docStoreGetSegmentIdListInRow(docRecord, rowId)[0] || '';
}

function getListIdByMainRowId(docRecord: DocRecord, rowId: string) {
  const compIdList = Object.keys(docRecord.compDataById || {});
  for (const compId of compIdList) {
    const compData = docRecord.compDataById[compId];
    if (String(compData?.compName || '') !== 'List') continue;
    if (String(compData.mainCompId || '') === rowId) {
      return compId;
    }
  }
  return '';
}

function getOwningListIdForChildEntry(docRecord: DocRecord, entryId: string) {
  const compIdList = Object.keys(docRecord.compDataById || {});
  for (const compId of compIdList) {
    const compData = docRecord.compDataById[compId];
    if (String(compData?.compName || '') !== 'List') continue;
    const childIdList = Array.isArray(compData.childIdList) ? compData.childIdList.map((id) => String(id || '')) : [];
    if (childIdList.includes(entryId)) {
      return compId;
    }
  }
  return '';
}

function getPreviousRowMergeTarget(docRecord: DocRecord, rowId: string) {
  const listIdParent = getOwningListIdForChildEntry(docRecord, rowId);
  if (listIdParent) {
    const listParent = docRecord.compDataById[listIdParent];
    const childIdList = Array.isArray(listParent?.childIdList) ? listParent.childIdList.map((id) => String(id || '')) : [];
    const entryIndex = childIdList.indexOf(rowId);
    const entryIdPrev = entryIndex > 0 ? childIdList[entryIndex - 1] : String(listParent?.mainCompId || '');
    if (entryIdPrev && String(docRecord.compDataById[entryIdPrev]?.compName || '') === 'Row') {
      return { listIdParent, entryId: rowId, rowIdPrev: entryIdPrev };
    }
    return null;
  }
  const listIdMain = getListIdByMainRowId(docRecord, rowId);
  const listIdParentOfList = listIdMain ? getOwningListIdForChildEntry(docRecord, listIdMain) : '';
  if (!listIdMain || !listIdParentOfList) {
    return null;
  }
  const listCurrent = docRecord.compDataById[listIdMain];
  if (Array.isArray(listCurrent?.childIdList) && listCurrent.childIdList.length > 0) {
    return null;
  }
  const listParent = docRecord.compDataById[listIdParentOfList];
  const childIdList = Array.isArray(listParent?.childIdList) ? listParent.childIdList.map((id) => String(id || '')) : [];
  const entryIndex = childIdList.indexOf(listIdMain);
  if (entryIndex <= 0) {
    return null;
  }
  const entryIdPrev = childIdList[entryIndex - 1];
  if (String(docRecord.compDataById[entryIdPrev]?.compName || '') !== 'Row') {
    return null;
  }
  return { listIdParent: listIdParentOfList, entryId: listIdMain, rowIdPrev: entryIdPrev };
}

function insertChildAfter(contextEdit: DocEditContext, listId: string, childIdRef: string, childIdNext: string) {
  const docRecord = contextEdit.store.ensureDoc(contextEdit.docId);
  const listData = docRecord.compDataById[listId];
  if (!listData) return;
  const childIdList = Array.isArray(listData.childIdList) ? listData.childIdList.map((id) => String(id || '')) : [];
  if (childIdList.indexOf(childIdRef) === -1) return;
  const childIdListNext = childIdList.filter((id) => id !== childIdNext);
  childIdListNext.splice(childIdListNext.indexOf(childIdRef) + 1, 0, childIdNext);
  editSetChildIdList(contextEdit, listId, childIdListNext);
}

function isCompName(docRecord: DocRecord, compId: string, compName: string) {
  if (!compId) return false;
  return String(docRecord.compDataById[compId]?.compName || '') === compName;
}
