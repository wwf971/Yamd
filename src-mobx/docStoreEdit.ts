import type { DocStore } from './docStore';
import type { CompData, DocRecord, SelectionState, SelectionTrackPoint } from './docStoreTypes';

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

const createEventId = (length = 12) => {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let index = 0; index < length; index += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};

export function docStoreSplitTextSegAtOffset(store: DocStore, docId: string, segId: string, offsetRaw: number) {
  const docRecord = store.ensureDoc(docId);
  const segData = docRecord.compDataById[segId];
  if (!segData || String(segData.compName || '') !== 'TextSeg') {
    return { code: -1, message: `Text segment not found. segId=${segId}` };
  }
  const rowId = getOwningRowId(docRecord, segId);
  const rowData = rowId ? docRecord.compDataById[rowId] : null;
  if (!rowData || String(rowData.compName || '') !== 'Row') {
    return { code: -1, message: `Owning row not found. segId=${segId}` };
  }
  const text = String(segData.data?.text || '');
  const offset = Math.min(text.length, Math.max(0, Number(offsetRaw || 0)));
  if (offset <= 0 || offset >= text.length) {
    return { code: -1, message: 'Only middle segment split is implemented.' };
  }

  const childIdList = Array.isArray(rowData.childIdList) ? rowData.childIdList.map((id) => String(id || '')) : [];
  const segIndex = childIdList.indexOf(segId);
  if (segIndex === -1) {
    return { code: -1, message: `Segment is not in row. segId=${segId}, rowId=${rowId}` };
  }

  const segIdRight = createCompId(docRecord, 'seg');
  const textLeft = text.slice(0, offset);
  const textRight = text.slice(offset);
  docRecord.compDataById[segId] = {
    ...segData,
    data: {
      ...(segData.data || {}),
      text: textLeft,
    },
  };
  docRecord.compDataById[segIdRight] = {
    compId: segIdRight,
    compName: 'TextSeg',
    childIdList: [],
    data: {
      text: textRight,
    },
    config: {
      ...(segData.config || {}),
    },
  };

  const childIdListLeft = childIdList.slice(0, segIndex + 1);
  const childIdListRight = [segIdRight, ...childIdList.slice(segIndex + 1)];
  const listIdMain = getListIdByMainRowId(docRecord, rowId);
  const listIdParent = getOwningListIdForChildEntry(docRecord, rowId);
  if (listIdParent) {
    const rowIdRight = createCompId(docRecord, 'row');
    rowData.childIdList = childIdListLeft;
    docRecord.compDataById[rowIdRight] = createRowComp(rowIdRight, childIdListRight, rowData);
    insertChildAfter(docRecord, listIdParent, rowId, rowIdRight);
  } else if (listIdMain) {
    const listIdParentOfMainList = getOwningListIdForChildEntry(docRecord, listIdMain);
    if (listIdParentOfMainList) {
      const rowIdLeft = createCompId(docRecord, 'row');
      docRecord.compDataById[rowIdLeft] = createRowComp(rowIdLeft, childIdListLeft, rowData);
      rowData.childIdList = childIdListRight;
      insertChildBefore(docRecord, listIdParentOfMainList, listIdMain, rowIdLeft);
    } else {
      const rowIdRight = createCompId(docRecord, 'row');
      rowData.childIdList = childIdListLeft;
      docRecord.compDataById[rowIdRight] = createRowComp(rowIdRight, childIdListRight, rowData);
      insertChildAtStart(docRecord, listIdMain, rowIdRight);
    }
  } else {
    return { code: -1, message: `Row is not inside a list. rowId=${rowId}` };
  }

  store.clearSelectionState(docId);
  store.updateFocusState(docId, {
    compIdFocused: segIdRight,
    segIdFocused: segIdRight,
    offsetFocused: 0,
    reasonLast: 'textSplit',
  });
  focusCompAfterRender(store, docId, segIdRight, 0);
  return { code: 0, message: 'Text segment split.', data: { segIdRight } };
}

export function docStoreDeleteEmptyTextSeg(store: DocStore, docId: string, segId: string) {
  const docRecord = store.ensureDoc(docId);
  const rowId = getOwningRowId(docRecord, segId);
  const rowData = rowId ? docRecord.compDataById[rowId] : null;
  if (!rowData || String(rowData.compName || '') !== 'Row') {
    return { code: -1, message: `Owning row not found. segId=${segId}` };
  }
  const childIdList = Array.isArray(rowData.childIdList) ? rowData.childIdList.map((id) => String(id || '')) : [];
  const segIndex = childIdList.indexOf(segId);
  if (segIndex === -1) {
    return { code: -1, message: `Segment is not in row. segId=${segId}` };
  }
  const segIdPrev = childIdList[segIndex - 1] || '';
  const segIdNext = childIdList[segIndex + 1] || '';
  if (childIdList.length === 1) {
    return docStoreDeleteRowWithOnlySeg(store, docId, rowId, segId);
  }
  rowData.childIdList = childIdList.filter((id) => id !== segId);
  delete docRecord.compDataById[segId];
  docRecord.compOrder = docRecord.compOrder.filter((id) => id !== segId);
  store.clearSelectionState(docId);
  if (segIdPrev) {
    const textPrev = String(docRecord.compDataById[segIdPrev]?.data?.text || '');
    store.updateFocusState(docId, {
      compIdFocused: segIdPrev,
      segIdFocused: segIdPrev,
      offsetFocused: textPrev.length,
      reasonLast: 'textDeleteEmpty',
    });
    focusCompAfterRender(store, docId, segIdPrev, textPrev.length);
    return { code: 0, message: 'Empty text segment deleted.', data: { segIdFocused: segIdPrev } };
  }
  if (segIdNext) {
    store.updateFocusState(docId, {
      compIdFocused: segIdNext,
      segIdFocused: segIdNext,
      offsetFocused: 0,
      reasonLast: 'textDeleteEmpty',
    });
    focusCompAfterRender(store, docId, segIdNext, 0);
    return { code: 0, message: 'Empty text segment deleted.', data: { segIdFocused: segIdNext } };
  }
  store.updateFocusState(docId, {
    compIdFocused: rowId,
    segIdFocused: '',
    offsetFocused: 0,
    reasonLast: 'textDeleteEmpty',
  });
  focusCompAfterRender(store, docId, rowId, 0);
  return { code: 0, message: 'Empty text segment deleted.', data: { rowIdFocused: rowId } };
}

export function docStoreDeleteRowWithOnlySeg(store: DocStore, docId: string, rowId: string, segId: string) {
  const docRecord = store.ensureDoc(docId);
  const rowIdList = collectRowIdsInDocOrder(docRecord);
  const rowIndex = rowIdList.indexOf(rowId);
  const rowIdPrev = rowIndex > 0 ? rowIdList[rowIndex - 1] : '';
  const rowIdNext = rowIndex !== -1 ? rowIdList[rowIndex + 1] || '' : '';
  const listIdParent = getOwningListIdForChildEntry(docRecord, rowId);
  const listIdMain = getListIdByMainRowId(docRecord, rowId);
  if (listIdParent) {
    removeEntryFromParentList(docRecord, listIdParent, rowId);
  } else if (listIdMain) {
    const listData = docRecord.compDataById[listIdMain];
    const childIdList = Array.isArray(listData?.childIdList) ? listData.childIdList.map((id) => String(id || '')) : [];
    const rowIdReplacement = childIdList.find((childId) => String(docRecord.compDataById[childId]?.compName || '') === 'Row') || '';
    if (rowIdReplacement) {
      listData.mainCompId = rowIdReplacement;
      listData.childIdList = childIdList.filter((childId) => childId !== rowIdReplacement);
    } else {
      const listIdParentOfList = getOwningListIdForChildEntry(docRecord, listIdMain);
      if (listIdParentOfList) {
        removeEntryFromParentList(docRecord, listIdParentOfList, listIdMain);
        delete docRecord.compDataById[listIdMain];
        docRecord.compOrder = docRecord.compOrder.filter((id) => id !== listIdMain);
      } else {
        return { code: -1, message: 'Cannot delete the only row of the root list.' };
      }
    }
  } else {
    return { code: -1, message: `Row is not deletable. rowId=${rowId}` };
  }
  delete docRecord.compDataById[segId];
  delete docRecord.compDataById[rowId];
  docRecord.compOrder = docRecord.compOrder.filter((id) => id !== segId && id !== rowId);
  store.clearSelectionState(docId);
  const rowIdFocus = rowIdPrev || rowIdNext;
  if (rowIdFocus) {
    const segIdFocus = getLastSegIdInRow(docRecord, rowIdFocus) || getFirstSegIdInRow(docRecord, rowIdFocus);
    if (segIdFocus) {
      const textFocus = String(docRecord.compDataById[segIdFocus]?.data?.text || '');
      const offsetFocus = rowIdPrev ? textFocus.length : 0;
      store.updateFocusState(docId, {
        compIdFocused: segIdFocus,
        segIdFocused: segIdFocus,
        offsetFocused: offsetFocus,
        reasonLast: 'rowDeleteEmpty',
      });
      focusCompAfterRender(store, docId, segIdFocus, offsetFocus);
      return { code: 0, message: 'Empty row deleted.', data: { segIdFocused: segIdFocus } };
    }
  }
  store.updateFocusState(docId, {
    compIdFocused: '',
    segIdFocused: '',
    offsetFocused: 0,
    reasonLast: 'rowDeleteEmpty',
  });
  return { code: 0, message: 'Empty row deleted.' };
}

export function docStoreGetSelectionText(store: DocStore, docId: string) {
  const docRecord = store.ensureDoc(docId);
  const selectionState = docRecord.interactionState.selectionState;
  const pointA = selectionState.pointAnchor;
  const pointB = selectionState.pointFocus;
  if (!pointA || !pointB) return '';
  const segIdList = collectTextSegIdsInDocOrder(docRecord);
  const indexA = segIdList.indexOf(pointA.segId);
  const indexB = segIdList.indexOf(pointB.segId);
  if (indexA === -1 || indexB === -1) return '';
  const isForward = indexA < indexB || (indexA === indexB && pointA.offset <= pointB.offset);
  const pointStart = isForward ? pointA : pointB;
  const pointEnd = isForward ? pointB : pointA;
  const indexStart = Math.min(indexA, indexB);
  const indexEnd = Math.max(indexA, indexB);
  const textPartList: string[] = [];
  let rowIdLast = '';
  for (let index = indexStart; index <= indexEnd; index += 1) {
    const segIdCurrent = segIdList[index];
    const rowIdCurrent = getOwningRowId(docRecord, segIdCurrent);
    if (rowIdLast && rowIdCurrent && rowIdCurrent !== rowIdLast) {
      textPartList.push('\n');
    }
    const textCurrent = String(docRecord.compDataById[segIdCurrent]?.data?.text || '');
    const offsetStart = segIdCurrent === pointStart.segId ? pointStart.offset : 0;
    const offsetEnd = segIdCurrent === pointEnd.segId ? pointEnd.offset : textCurrent.length;
    textPartList.push(textCurrent.slice(
      Math.max(0, Math.min(textCurrent.length, offsetStart)),
      Math.max(0, Math.min(textCurrent.length, offsetEnd)),
    ));
    rowIdLast = rowIdCurrent;
  }
  return textPartList.join('');
}

export function docStoreMergeRowWithPreviousBySegId(store: DocStore, docId: string, segId: string) {
  const docRecord = store.ensureDoc(docId);
  const rowId = getOwningRowId(docRecord, segId);
  const rowData = rowId ? docRecord.compDataById[rowId] : null;
  if (!rowData || String(rowData.compName || '') !== 'Row') {
    return { code: -1, message: `Owning row not found. segId=${segId}` };
  }
  const childIdList = Array.isArray(rowData.childIdList) ? rowData.childIdList.map((id) => String(id || '')) : [];
  if (childIdList[0] !== segId) {
    return { code: -1, message: 'Only the first segment can merge with previous row.' };
  }
  const mergeTarget = getPreviousRowMergeTarget(docRecord, rowId);
  if (!mergeTarget) {
    return { code: -1, message: 'Previous row merge target not found.' };
  }
  const rowDataPrev = docRecord.compDataById[mergeTarget.rowIdPrev];
  const childIdListPrev = Array.isArray(rowDataPrev?.childIdList) ? rowDataPrev.childIdList.map((id) => String(id || '')) : [];
  const segIdPrevLast = childIdListPrev[childIdListPrev.length - 1] || '';
  if (!segIdPrevLast) {
    return { code: -1, message: 'Previous row has no segment.' };
  }
  const segDataPrevLast = docRecord.compDataById[segIdPrevLast];
  const segDataCurrentFirst = docRecord.compDataById[segId];
  const textPrev = String(segDataPrevLast?.data?.text || '');
  const textCurrent = String(segDataCurrentFirst?.data?.text || '');
  const isTextMergeable = String(segDataPrevLast?.compName || '') === 'TextSeg'
    && String(segDataCurrentFirst?.compName || '') === 'TextSeg';
  const segIdListMoved = isTextMergeable ? childIdList.slice(1) : childIdList;
  const offsetFocused = textPrev.length;
  if (isTextMergeable) {
    segDataPrevLast.data = {
      ...(segDataPrevLast.data || {}),
      text: textPrev + textCurrent,
    };
    delete docRecord.compDataById[segId];
    docRecord.compOrder = docRecord.compOrder.filter((id) => id !== segId);
  }
  rowDataPrev.childIdList = [...childIdListPrev, ...segIdListMoved];
  removeEntryFromParentList(docRecord, mergeTarget.listIdParent, mergeTarget.entryId);
  delete docRecord.compDataById[rowId];
  docRecord.compOrder = docRecord.compOrder.filter((id) => id !== rowId);
  store.clearSelectionState(docId);
  store.updateFocusState(docId, {
    compIdFocused: segIdPrevLast,
    segIdFocused: segIdPrevLast,
    offsetFocused,
    reasonLast: 'textMergePrev',
  });
  focusCompAfterRender(store, docId, segIdPrevLast, offsetFocused);
  return { code: 0, message: 'Row merged with previous row.', data: { segIdFocused: segIdPrevLast } };
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
  const result = indentEntryByEntryId(docRecord, entryInfo.entryId);
  if (result.code !== 0) return result;
  finishStructureEdit(store, docId, segId, 'rowIndent', selectionStateBefore);
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
  const result = outdentEntryByEntryId(docRecord, entryInfo.entryId);
  if (result.code !== 0) return result;
  finishStructureEdit(store, docId, segId, 'rowOutdent', selectionStateBefore);
  return { code: 0, message: 'Entry outdented.' };
}

function indentSelectedEntries(
  store: DocStore,
  docId: string,
  entryInfoList: OutlineEntryInfo[],
  selectionStateBefore: SelectionState | null,
) {
  const docRecord = store.ensureDoc(docId);
  const docRecordNext = cloneDocRecordForStructureEdit(docRecord);
  for (const entryInfo of entryInfoList) {
    const result = indentEntryByEntryId(docRecordNext, entryInfo.entryId, { isPreserveExistingChildren: true });
    if (result.code !== 0) {
      return result;
    }
  }
  docRecord.compDataById = docRecordNext.compDataById;
  const segIdFocused = pickSegIdForStructureFocus(docRecord, entryInfoList);
  finishStructureEdit(store, docId, segIdFocused, 'rowIndent', selectionStateBefore);
  return { code: 0, message: 'Selected entries indented.' };
}

function outdentSelectedEntries(
  store: DocStore,
  docId: string,
  entryInfoList: OutlineEntryInfo[],
  selectionStateBefore: SelectionState | null,
) {
  const docRecord = store.ensureDoc(docId);
  const docRecordNext = cloneDocRecordForStructureEdit(docRecord);
  for (let index = entryInfoList.length - 1; index >= 0; index -= 1) {
    const result = outdentEntryByEntryId(docRecordNext, entryInfoList[index].entryId);
    if (result.code !== 0) {
      return result;
    }
  }
  docRecord.compDataById = docRecordNext.compDataById;
  const segIdFocused = pickSegIdForStructureFocus(docRecord, entryInfoList);
  finishStructureEdit(store, docId, segIdFocused, 'rowOutdent', selectionStateBefore);
  return { code: 0, message: 'Selected entries outdented.' };
}

function indentEntryByEntryId(
  docRecord: DocRecord,
  entryId: string,
  options: { isPreserveExistingChildren?: boolean } = {},
): StructureEditResult {
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
      entryData.childIdList = [];
    }
    listParent.childIdList = childIdList.filter((id) => id !== entryId);
    entryPrev.childIdList = [
      ...(Array.isArray(entryPrev.childIdList) ? entryPrev.childIdList.map((id) => String(id || '')) : []),
      entryId,
      ...childIdListFormer,
    ];
    return { code: 0, message: 'Entry indented.' };
  }

  if (String(entryPrev.compName || '') === 'Row') {
    if (!isPreserveExistingChildren && String(entryData.compName || '') === 'List') {
      entryData.childIdList = [];
    }
    const listIdWrapped = createCompId(docRecord, 'list');
    docRecord.compDataById[listIdWrapped] = {
      compId: listIdWrapped,
      compName: 'List',
      mainCompId: entryIdPrev,
      childIdList: [entryId, ...childIdListFormer],
      data: {},
      config: {},
    };
    listParent.childIdList = childIdList
      .filter((id) => id !== entryId)
      .map((id) => (id === entryIdPrev ? listIdWrapped : id));
    return { code: 0, message: 'Entry indented.' };
  }

  return { code: -1, message: `Previous entry cannot receive children. compId=${entryIdPrev}` };
}

function outdentEntryByEntryId(docRecord: DocRecord, entryId: string): StructureEditResult {
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
  listParent.childIdList = childIdList.slice(0, entryIndex);
  let entryIdMoved = entryId;
  const entryData = docRecord.compDataById[entryId];
  if (String(entryData?.compName || '') === 'List') {
    entryData.childIdList = [
      ...(Array.isArray(entryData.childIdList) ? entryData.childIdList.map((id) => String(id || '')) : []),
      ...childIdListFollowing,
    ];
  } else if (childIdListFollowing.length > 0) {
    entryIdMoved = createCompId(docRecord, 'list');
    docRecord.compDataById[entryIdMoved] = {
      compId: entryIdMoved,
      compName: 'List',
      mainCompId: entryId,
      childIdList: childIdListFollowing,
      data: {},
      config: {},
    };
  }
  insertChildAfter(docRecord, listIdGrandparent, listIdParent, entryIdMoved);
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

  const segIdList = collectTextSegIdsInDocOrder(docRecord);
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
    const rowId = getOwningRowId(docRecord, segIdList[index]);
    if (!rowId || rowIdSet.has(rowId)) continue;
    rowIdSet.add(rowId);
    rowIdList.push(rowId);
  }
  return rowIdList;
}

function getOutlineEntryInfoBySegId(docRecord: DocRecord, segId: string) {
  const rowId = getOwningRowId(docRecord, segId);
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

function cloneDocRecordForStructureEdit(docRecord: DocRecord): DocRecord {
  return {
    ...docRecord,
    compDataById: Object.fromEntries(Object.entries(docRecord.compDataById || {}).map(([compId, compData]) => ([
      compId,
      {
        ...compData,
        childIdList: Array.isArray(compData.childIdList) ? compData.childIdList.map((id) => String(id || '')) : [],
        mainCompId: compData.mainCompId ? String(compData.mainCompId) : undefined,
        data: { ...(compData.data || {}) },
        config: { ...(compData.config || {}) },
      },
    ]))),
  };
}

function pickSegIdForStructureFocus(docRecord: DocRecord, entryInfoList: OutlineEntryInfo[]) {
  const segIdFocused = String(docRecord.interactionState.focusState.segIdFocused || '');
  if (isCompName(docRecord, segIdFocused, 'TextSeg')) {
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
    store.updateFocusState(docId, {
      compIdFocused: pointFocus.compId,
      segIdFocused: pointFocus.segId,
      offsetFocused: pointFocus.offset,
      reasonLast: reason,
    });
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
  if (!isCompName(docRecord, segIdSafe, 'TextSeg')) {
    return;
  }
  store.updateFocusState(docId, {
    compIdFocused: segIdSafe,
    segIdFocused: segIdSafe,
    offsetFocused,
    reasonLast: reason,
  });
  if (isApplyDomFocus) {
    focusCompAfterRender(store, docId, segIdSafe, offsetFocused);
  }
}

function focusCompAfterRender(store: DocStore, docId: string, segId: string, offset: number) {
  const schedule = typeof window !== 'undefined' ? window.setTimeout : setTimeout;
  schedule(() => {
    void store.sendEventToComp(docId, segId, {
      type: 'focus',
      sourceId: segId,
      targetId: docId,
      data: {
        segId,
        offset,
      },
    });
  }, 0);
}

function createCompId(docRecord: DocRecord, prefix: string) {
  let compId = `${prefix}-${createEventId(8)}`;
  while (docRecord.compDataById[compId]) {
    compId = `${prefix}-${createEventId(8)}`;
  }
  return compId;
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
  const rowData = docRecord.compDataById[rowId];
  const childIdList = Array.isArray(rowData?.childIdList) ? rowData.childIdList.map((id) => String(id || '')) : [];
  return childIdList.find((childId) => String(docRecord.compDataById[childId]?.compName || '') === 'TextSeg') || '';
}

function getLastSegIdInRow(docRecord: DocRecord, rowId: string) {
  const rowData = docRecord.compDataById[rowId];
  const childIdList = Array.isArray(rowData?.childIdList) ? rowData.childIdList.map((id) => String(id || '')) : [];
  for (let index = childIdList.length - 1; index >= 0; index -= 1) {
    const childId = childIdList[index];
    if (String(docRecord.compDataById[childId]?.compName || '') === 'TextSeg') {
      return childId;
    }
  }
  return '';
}

function collectRowIdsInDocOrder(docRecord: DocRecord) {
  const compIdRoot = String(docRecord.compIdRoot || '');
  const rowIdList: string[] = [];
  collectRowIdsFromComp(docRecord, compIdRoot, rowIdList);
  return rowIdList;
}

function collectRowIdsFromComp(docRecord: DocRecord, compId: string, rowIdList: string[]) {
  const compData = docRecord.compDataById[compId];
  if (!compData) return;
  if (String(compData.compName || '') === 'Row') {
    rowIdList.push(compId);
    return;
  }
  const mainCompId = String(compData.mainCompId || '');
  if (mainCompId) {
    collectRowIdsFromComp(docRecord, mainCompId, rowIdList);
  }
  const childIdList = Array.isArray(compData.childIdList) ? compData.childIdList.map((id) => String(id || '')) : [];
  for (const childId of childIdList) {
    collectRowIdsFromComp(docRecord, childId, rowIdList);
  }
}

function collectTextSegIdsInDocOrder(docRecord: DocRecord) {
  const compIdRoot = String(docRecord.compIdRoot || '');
  const segIdList: string[] = [];
  collectTextSegIdsFromComp(docRecord, compIdRoot, segIdList);
  return segIdList;
}

function collectTextSegIdsFromComp(docRecord: DocRecord, compId: string, segIdList: string[]) {
  const compData = docRecord.compDataById[compId];
  if (!compData) return;
  if (String(compData.compName || '') === 'TextSeg') {
    segIdList.push(compId);
    return;
  }
  const mainCompId = String(compData.mainCompId || '');
  if (mainCompId) {
    collectTextSegIdsFromComp(docRecord, mainCompId, segIdList);
  }
  const childIdList = Array.isArray(compData.childIdList) ? compData.childIdList.map((id) => String(id || '')) : [];
  for (const childId of childIdList) {
    collectTextSegIdsFromComp(docRecord, childId, segIdList);
  }
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

function removeEntryFromParentList(docRecord: DocRecord, listIdParent: string, entryId: string) {
  const listParent = docRecord.compDataById[listIdParent];
  if (!listParent) return;
  const childIdList = Array.isArray(listParent.childIdList) ? listParent.childIdList.map((id) => String(id || '')) : [];
  listParent.childIdList = childIdList.filter((id) => id !== entryId);
}

function insertChildAfter(docRecord: DocRecord, listId: string, childIdRef: string, childIdNext: string) {
  const listData = docRecord.compDataById[listId];
  if (!listData) return;
  const childIdList = Array.isArray(listData.childIdList) ? listData.childIdList.map((id) => String(id || '')) : [];
  const childIndex = childIdList.indexOf(childIdRef);
  if (childIndex === -1) return;
  if (childIdList.includes(childIdNext)) {
    listData.childIdList = childIdList.filter((id) => id !== childIdNext);
  }
  const childIdListCurrent = Array.isArray(listData.childIdList) ? listData.childIdList.map((id) => String(id || '')) : [];
  const childIndexCurrent = childIdListCurrent.indexOf(childIdRef);
  childIdListCurrent.splice(childIndexCurrent + 1, 0, childIdNext);
  listData.childIdList = childIdListCurrent;
}

function insertChildBefore(docRecord: DocRecord, listId: string, childIdRef: string, childIdNext: string) {
  const listData = docRecord.compDataById[listId];
  if (!listData) return;
  const childIdList = Array.isArray(listData.childIdList) ? listData.childIdList.map((id) => String(id || '')) : [];
  const childIndex = childIdList.indexOf(childIdRef);
  if (childIndex === -1) return;
  const childIdListNext = childIdList.filter((id) => id !== childIdNext);
  const childIndexNext = childIdListNext.indexOf(childIdRef);
  childIdListNext.splice(childIndexNext, 0, childIdNext);
  listData.childIdList = childIdListNext;
}

function insertChildAtStart(docRecord: DocRecord, listId: string, childIdNext: string) {
  const listData = docRecord.compDataById[listId];
  if (!listData) return;
  const childIdList = Array.isArray(listData.childIdList) ? listData.childIdList.map((id) => String(id || '')) : [];
  listData.childIdList = [childIdNext, ...childIdList.filter((id) => id !== childIdNext)];
}

function isCompName(docRecord: DocRecord, compId: string, compName: string) {
  if (!compId) return false;
  return String(docRecord.compDataById[compId]?.compName || '') === compName;
}
