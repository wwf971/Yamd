import type { DocStore } from './docStore';
import { ConfigIndentTextWhenCopyAsMarkdown } from './config';
import type {
  CompData,
  CompFocusTarget,
  DocRecord,
  SelectionState,
  SelectionTrackPoint,
} from './docStoreTypes';
import { docStoreCreateCompId } from './docStoreCompData';
import {
  docStoreGetActiveEdit,
  editPutCompData,
  editRemoveCompSubtree,
  editSetChildIdList,
  editUpdateCompData,
  type DocEditContext,
} from './docStoreEditContext';
import {
  docStoreCloneSegmentWithText,
  docStoreCollectSegmentIds,
  docStoreGetOwningRowId,
  docStoreGetSegmentIdListInRow,
  docStoreGetSegmentText,
  docStoreGetSegmentTextFieldName,
  docStoreSetSegmentText,
} from './docStoreSegment';

type OutlineEntryInfo = {
  entryId: string;
  rowId: string;
  parentListId: string;
};

type RowClipboardInfo = {
  rowId: string;
  depth: number;
  segIdList: string[];
};

type PasteListItem = {
  text: string;
  childList: PasteListItem[];
};

type PasteCompBuildResult = {
  compDataList: CompData[];
  entryIdList: string[];
  segIdLast: string;
  textLast: string;
};

export function docStoreGetSelectionText(store: DocStore, docId: string) {
  const docRecord = store.ensureDoc(docId);
  const selectionState = docRecord.interactionState.selectionState;
  const pointA = selectionState.pointAnchor;
  const pointB = selectionState.pointFocus;
  if (!pointA || !pointB) return '';
  const segIdList = docStoreCollectSegmentIds(docRecord);
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
    const rowIdCurrent = docStoreGetOwningRowId(docRecord, segIdCurrent);
    if (rowIdLast && rowIdCurrent && rowIdCurrent !== rowIdLast) {
      textPartList.push('\n');
    }
    const textCurrent = docStoreGetSegmentText(docRecord.compDataById[segIdCurrent]);
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

export async function docStoreGetSelectionMarkdownText(store: DocStore, docId: string) {
  const docRecord = store.ensureDoc(docId);
  const selectionRange = getSelectionRangeBySegOrder(docRecord);
  if (!selectionRange) return '';

  const rowInfoListAll = collectRowClipboardInfoList(docRecord);
  const rowInfoById = Object.fromEntries(rowInfoListAll.map((rowInfo) => [rowInfo.rowId, rowInfo]));
  const rowIdListSelected = collectSelectedRowIdsFromSegRange(docRecord, selectionRange.indexStart, selectionRange.indexEnd);
  const rowInfoListSelected = rowIdListSelected
    .map((rowId) => rowInfoById[rowId])
    .filter((rowInfo): rowInfo is RowClipboardInfo => Boolean(rowInfo));
  if (rowInfoListSelected.length === 0) return '';

  const depthBase = Math.min(...rowInfoListSelected.map((rowInfo) => rowInfo.depth));
  const lineList: string[] = [];
  for (const rowInfo of rowInfoListSelected) {
    const textRow = await getRowClipboardText(store, docId, rowInfo, selectionRange.pointStart, selectionRange.pointEnd);
    const depthRelative = Math.max(0, rowInfo.depth - depthBase);
    lineList.push(`${ConfigIndentTextWhenCopyAsMarkdown.repeat(depthRelative)}- ${textRow}`);
  }
  return lineList.join('\n');
}

export function docStoreGetSelectionMarkdownTextSync(store: DocStore, docId: string) {
  const docRecord = store.ensureDoc(docId);
  const selectionRange = getSelectionRangeBySegOrder(docRecord);
  if (!selectionRange) return '';

  const rowInfoListAll = collectRowClipboardInfoList(docRecord);
  const rowInfoById = Object.fromEntries(rowInfoListAll.map((rowInfo) => [rowInfo.rowId, rowInfo]));
  const rowIdListSelected = collectSelectedRowIdsFromSegRange(docRecord, selectionRange.indexStart, selectionRange.indexEnd);
  const rowInfoListSelected = rowIdListSelected
    .map((rowId) => rowInfoById[rowId])
    .filter((rowInfo): rowInfo is RowClipboardInfo => Boolean(rowInfo));
  if (rowInfoListSelected.length === 0) return '';

  const depthBase = Math.min(...rowInfoListSelected.map((rowInfo) => rowInfo.depth));
  const lineList: string[] = [];
  for (const rowInfo of rowInfoListSelected) {
    const textRow = getRowClipboardTextSync(store, docId, rowInfo, selectionRange.pointStart, selectionRange.pointEnd);
    const depthRelative = Math.max(0, rowInfo.depth - depthBase);
    lineList.push(`${ConfigIndentTextWhenCopyAsMarkdown.repeat(depthRelative)}- ${textRow}`);
  }
  return lineList.join('\n');
}

export function docStorePasteText(
  store: DocStore,
  docId: string,
  rowId: string,
  segId: string,
  textPasteRaw: string,
  pointRaw: any,
) {
  const docRecord = store.ensureDoc(docId);
  const rowIdSafe = String(rowId || '');
  const segIdSafe = String(segId || '');
  const rowData = docRecord.compDataById[rowIdSafe];
  const segData = docRecord.compDataById[segIdSafe];
  if (
    String(rowData?.compName || '') !== 'Row'
    || !docStoreGetSegmentIdListInRow(docRecord, rowIdSafe).includes(segIdSafe)
  ) {
    return { code: -1, message: 'Paste target is invalid.' };
  }
  if (segData.config?.isEditable !== true) {
    return { code: -1, message: 'Segment is not editable.' };
  }
  const childIdListRow = getChildIdList(rowData);
  if (!childIdListRow.includes(segIdSafe)) {
    return { code: -1, message: `Segment is not in row. segId=${segIdSafe}` };
  }

  const textCurrent = docStoreGetSegmentText(segData);
  const offsetPaste = Math.min(textCurrent.length, Math.max(0, Number(pointRaw?.offset || 0)));
  const itemListPaste = parsePasteListText(String(textPasteRaw ?? ''));
  if (!itemListPaste) {
    return pastePlainTextAtSeg(store, docId, segIdSafe, String(textPasteRaw ?? ''), offsetPaste);
  }

  const entryInfo = getOutlineEntryInfoByRowId(docRecord, rowIdSafe);
  if (!entryInfo) {
    return pastePlainTextAtSeg(store, docId, segIdSafe, String(textPasteRaw ?? ''), offsetPaste);
  }

  const textLeft = textCurrent.slice(0, offsetPaste);
  const textRight = textCurrent.slice(offsetPaste);
  const buildResult = createPasteCompBuildResult(docRecord, itemListPaste, segData, rowData);
  if (buildResult.entryIdList.length === 0 || !buildResult.segIdLast) {
    return pastePlainTextAtSeg(store, docId, segIdSafe, String(textPasteRaw ?? ''), offsetPaste);
  }

  const segDataLast = buildResult.compDataList.find((compData) => compData.compId === buildResult.segIdLast);
  if (segDataLast) {
    docStoreSetSegmentText(segDataLast, `${docStoreGetSegmentText(segDataLast)}${textRight}`);
  }

  const focusNext = {
    compId: buildResult.segIdLast,
    point: { offset: buildResult.textLast.length },
  };
  const isRowEmptySingleSeg = childIdListRow.length === 1 && textCurrent.length === 0;
  if (isRowEmptySingleSeg) {
    return replaceEntryWithPasteEntries(store, docId, entryInfo, buildResult, focusNext);
  }

  const contextEdit = docStoreGetActiveEdit(store, docId);
  editUpdateCompData(contextEdit, segIdSafe, {
    [docStoreGetSegmentTextFieldName(segData)]: textLeft,
  });
  addCompDataListToRecord(contextEdit, buildResult.compDataList);
  const entryData = docRecord.compDataById[entryInfo.entryId];
  if (String(entryData?.compName || '') === 'List') {
    editSetChildIdList(contextEdit, entryInfo.entryId, [
      ...buildResult.entryIdList,
      ...getChildIdList(entryData),
    ]);
  } else if (String(entryData?.compName || '') === 'Row') {
    const listIdWrapped = docStoreCreateCompId(docRecord, 'list');
    editPutCompData(contextEdit, {
      compId: listIdWrapped,
      compName: 'List',
      mainCompId: rowIdSafe,
      childIdList: [...buildResult.entryIdList],
      data: {},
      config: {},
    });
    const listDataParent = docRecord.compDataById[entryInfo.parentListId];
    if (String(listDataParent?.compName || '') !== 'List') {
      return { code: -1, message: 'Parent list not found.' };
    }
    editSetChildIdList(contextEdit, entryInfo.parentListId, getChildIdList(listDataParent)
      .map((childId) => (childId === entryInfo.entryId ? listIdWrapped : childId)));
  } else {
    return { code: -1, message: 'Paste target entry is invalid.' };
  }
  store.clearSelectionState(docId);
  store.applyFocusAfterEdit(docId, focusNext, 'childPasteAttempt');
  return { code: 0, message: 'Text pasted.' };
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

async function getRowClipboardText(
  store: DocStore,
  docId: string,
  rowInfo: RowClipboardInfo,
  pointStart: SelectionTrackPoint,
  pointEnd: SelectionTrackPoint,
) {
  const childIdList = rowInfo.segIdList;
  const indexStartRaw = childIdList.indexOf(pointStart.segId);
  const indexEndRaw = childIdList.indexOf(pointEnd.segId);
  const indexStart = indexStartRaw === -1 ? 0 : indexStartRaw;
  const indexEnd = indexEndRaw === -1 ? childIdList.length - 1 : indexEndRaw;
  const indexMin = Math.min(indexStart, indexEnd);
  const indexMax = Math.max(indexStart, indexEnd);
  const textPartList: string[] = [];
  for (let index = indexMin; index <= indexMax; index += 1) {
    const compId = childIdList[index];
    const compData = store.getCompDataById(docId, compId);
    if (!compData) continue;
    const offsetStart = compId === pointStart.segId ? Number(pointStart.offset || 0) : undefined;
    const offsetEnd = compId === pointEnd.segId ? Number(pointEnd.offset || 0) : undefined;
    textPartList.push(await getCompClipboardText(store, docId, compData, offsetStart, offsetEnd));
  }
  return textPartList.join('');
}

function getRowClipboardTextSync(
  store: DocStore,
  docId: string,
  rowInfo: RowClipboardInfo,
  pointStart: SelectionTrackPoint,
  pointEnd: SelectionTrackPoint,
) {
  const childIdList = rowInfo.segIdList;
  const indexStartRaw = childIdList.indexOf(pointStart.segId);
  const indexEndRaw = childIdList.indexOf(pointEnd.segId);
  const indexStart = indexStartRaw === -1 ? 0 : indexStartRaw;
  const indexEnd = indexEndRaw === -1 ? childIdList.length - 1 : indexEndRaw;
  const indexMin = Math.min(indexStart, indexEnd);
  const indexMax = Math.max(indexStart, indexEnd);
  const textPartList: string[] = [];
  for (let index = indexMin; index <= indexMax; index += 1) {
    const compId = childIdList[index];
    const compData = store.getCompDataById(docId, compId);
    if (!compData) continue;
    const offsetStart = compId === pointStart.segId ? Number(pointStart.offset || 0) : undefined;
    const offsetEnd = compId === pointEnd.segId ? Number(pointEnd.offset || 0) : undefined;
    textPartList.push(getCompClipboardTextFallback(compData, offsetStart, offsetEnd));
  }
  return textPartList.join('');
}

async function getCompClipboardText(
  store: DocStore,
  docId: string,
  compData: CompData,
  offsetStart: number | undefined,
  offsetEnd: number | undefined,
) {
  const result = await store.sendEventToCompDirect(docId, compData.compId, {
    type: 'selfClipboardTextQuery',
    sourceId: compData.compId,
    targetId: docId,
    data: {
      offsetStart,
      offsetEnd,
    },
  });
  if (result.code === 0 && typeof result.data?.text === 'string') {
    return result.data.text;
  }
  return getCompClipboardTextFallback(compData, offsetStart, offsetEnd);
}

function getCompClipboardTextFallback(compData: CompData, offsetStartRaw: number | undefined, offsetEndRaw: number | undefined) {
  const text = docStoreGetSegmentText(compData);
  const offsetStart = Number.isFinite(Number(offsetStartRaw))
    ? Math.min(text.length, Math.max(0, Number(offsetStartRaw)))
    : 0;
  const offsetEnd = Number.isFinite(Number(offsetEndRaw))
    ? Math.min(text.length, Math.max(0, Number(offsetEndRaw)))
    : text.length;
  return text.slice(Math.min(offsetStart, offsetEnd), Math.max(offsetStart, offsetEnd));
}

function parsePasteListText(textRaw: string): PasteListItem[] | null {
  const lineInfoList = String(textRaw || '')
    .split(/\r\n|\n|\r/)
    .filter((lineRaw) => lineRaw.trim().length > 0)
    .map((lineRaw) => {
      const match = /^([ \t]*)([-*+])(?:[ \t]+(.*)|[ \t]*)$/.exec(lineRaw);
      if (!match) return null;
      return {
        indentMetric: getIndentMetric(match[1]),
        text: String(match[3] || '').trim(),
      };
    });
  if (lineInfoList.length === 0 || lineInfoList.some((lineInfo) => !lineInfo)) {
    return null;
  }

  const lineInfoListSafe = lineInfoList as Array<{ indentMetric: number; text: string }>;
  const indentMetricBase = lineInfoListSafe[0].indentMetric;
  const itemListRoot: PasteListItem[] = [];
  const itemStack: PasteListItem[] = [];
  const indentMetricStack = [0];
  for (const lineInfo of lineInfoListSafe) {
    const indentMetric = Math.max(0, lineInfo.indentMetric - indentMetricBase);
    let depth = 0;
    const indentMetricLast = indentMetricStack[indentMetricStack.length - 1];
    if (indentMetric > indentMetricLast) {
      depth = indentMetricStack.length;
      indentMetricStack.push(indentMetric);
    } else {
      while (indentMetricStack.length > 1 && indentMetric < indentMetricStack[indentMetricStack.length - 1]) {
        indentMetricStack.pop();
      }
      if (indentMetric === indentMetricStack[indentMetricStack.length - 1]) {
        depth = indentMetricStack.length - 1;
      } else if (indentMetric > indentMetricStack[indentMetricStack.length - 1]) {
        depth = indentMetricStack.length;
        indentMetricStack.push(indentMetric);
      }
    }

    const itemNext: PasteListItem = {
      text: lineInfo.text,
      childList: [],
    };
    if (depth === 0) {
      itemListRoot.push(itemNext);
    } else {
      const itemParent = itemStack[depth - 1];
      if (!itemParent) return null;
      itemParent.childList.push(itemNext);
    }
    itemStack[depth] = itemNext;
    itemStack.length = depth + 1;
  }
  return itemListRoot;
}

function getIndentMetric(indentText: string) {
  let indentMetric = 0;
  for (const charCurrent of String(indentText || '')) {
    indentMetric += charCurrent === '\t' ? 4 : 1;
  }
  return indentMetric;
}

function pastePlainTextAtSeg(
  store: DocStore,
  docId: string,
  segId: string,
  textPasteRaw: string,
  offsetPaste: number,
) {
  const docRecord = store.ensureDoc(docId);
  const segData = docRecord.compDataById[segId];
  if (!segData || !docStoreGetOwningRowId(docRecord, segId)) {
    return { code: -1, message: 'Segment not found.' };
  }
  if (segData.config?.isEditable !== true) {
    return { code: -1, message: 'Segment is not editable.' };
  }
  const textCurrent = docStoreGetSegmentText(segData);
  const textInserted = String(textPasteRaw || '').replace(/[\r\n]+/g, '');
  const offsetSafe = Math.min(textCurrent.length, Math.max(0, Number(offsetPaste || 0)));
  const textNext = `${textCurrent.slice(0, offsetSafe)}${textInserted}${textCurrent.slice(offsetSafe)}`;
  editUpdateCompData(docStoreGetActiveEdit(store, docId), segId, {
    [docStoreGetSegmentTextFieldName(segData)]: textNext,
  });
  store.clearSelectionState(docId);
  store.applyFocusAfterEdit(docId, {
    compId: segId,
    point: { offset: offsetSafe + textInserted.length },
  }, 'childPasteAttempt');
  return { code: 0, message: 'Plain text pasted.' };
}

function createPasteCompBuildResult(
  docRecord: DocRecord,
  itemList: PasteListItem[],
  segDataTemplate: CompData,
  rowDataTemplate: CompData,
  compIdSetReserved = new Set<string>(),
): PasteCompBuildResult {
  const compDataList: CompData[] = [];
  const entryIdList: string[] = [];
  let segIdLast = '';
  let textLast = '';
  for (const item of itemList) {
    const resultItem = createPasteEntryCompData(docRecord, item, segDataTemplate, rowDataTemplate, compIdSetReserved);
    compDataList.push(...resultItem.compDataList);
    entryIdList.push(resultItem.entryIdList[0]);
    segIdLast = resultItem.segIdLast || segIdLast;
    textLast = resultItem.textLast;
  }
  return {
    compDataList,
    entryIdList: entryIdList.filter(Boolean),
    segIdLast,
    textLast,
  };
}

function createPasteEntryCompData(
  docRecord: DocRecord,
  item: PasteListItem,
  segDataTemplate: CompData,
  rowDataTemplate: CompData,
  compIdSetReserved: Set<string>,
): PasteCompBuildResult {
  const segId = docStoreCreateCompId(docRecord, 'seg', compIdSetReserved);
  const rowId = docStoreCreateCompId(docRecord, 'row', compIdSetReserved);
  const textItem = String(item.text || '');
  const segDataNext = docStoreCloneSegmentWithText(segDataTemplate, segId, textItem);
  const rowDataNext = createRowComp(rowId, [segId], rowDataTemplate);
  const compDataList: CompData[] = [segDataNext, rowDataNext];
  let entryId = rowId;
  let segIdLast = segId;
  let textLast = textItem;
  if (item.childList.length > 0) {
    const childResult = createPasteCompBuildResult(docRecord, item.childList, segDataTemplate, rowDataTemplate, compIdSetReserved);
    const listId = docStoreCreateCompId(docRecord, 'list', compIdSetReserved);
    compDataList.push(...childResult.compDataList, {
      compId: listId,
      compName: 'List',
      mainCompId: rowId,
      childIdList: childResult.entryIdList,
      data: {},
      config: {},
    });
    entryId = listId;
    segIdLast = childResult.segIdLast || segId;
    textLast = childResult.textLast || textItem;
  }
  return {
    compDataList,
    entryIdList: [entryId],
    segIdLast,
    textLast,
  };
}

function replaceEntryWithPasteEntries(
  store: DocStore,
  docId: string,
  entryInfo: OutlineEntryInfo,
  buildResult: PasteCompBuildResult,
  focusNext: CompFocusTarget,
) {
  const docRecord = store.ensureDoc(docId);
  const listDataParent = docRecord.compDataById[entryInfo.parentListId];
  if (String(listDataParent?.compName || '') !== 'List') {
    return { code: -1, message: 'Parent list not found.' };
  }
  const childIdListParent = getChildIdList(listDataParent);
  const entryIndex = childIdListParent.indexOf(entryInfo.entryId);
  if (entryIndex < 0) {
    return { code: -1, message: 'Entry not found in parent list.' };
  }
  const contextEdit = docStoreGetActiveEdit(store, docId);
  editRemoveCompSubtree(contextEdit, entryInfo.entryId);
  addCompDataListToRecord(contextEdit, buildResult.compDataList);
  editSetChildIdList(contextEdit, entryInfo.parentListId, [
    ...childIdListParent.slice(0, entryIndex),
    ...buildResult.entryIdList,
    ...childIdListParent.slice(entryIndex + 1),
  ]);
  store.clearSelectionState(docId);
  store.applyFocusAfterEdit(docId, focusNext, 'childPasteAttempt');
  return { code: 0, message: 'Text pasted.' };
}

function collectRowClipboardInfoList(docRecord: DocRecord) {
  const compIdRoot = String(docRecord.compIdRoot || '');
  const rowInfoList: RowClipboardInfo[] = [];
  collectRowClipboardInfoFromComp(docRecord, compIdRoot, 0, rowInfoList, new Set<string>());
  return rowInfoList;
}

function collectRowClipboardInfoFromComp(
  docRecord: DocRecord,
  compId: string,
  depth: number,
  rowInfoList: RowClipboardInfo[],
  compIdSetVisited: Set<string>,
) {
  const compIdSafe = String(compId || '');
  if (!compIdSafe || compIdSetVisited.has(compIdSafe)) return;
  compIdSetVisited.add(compIdSafe);
  const compData = docRecord.compDataById[compIdSafe];
  if (!compData) return;

  const compName = String(compData.compName || '');
  if (compName === 'Row') {
    rowInfoList.push({
      rowId: compIdSafe,
      depth,
    segIdList: docStoreGetSegmentIdListInRow(docRecord, compIdSafe),
    });
    return;
  }

  if (compName === 'List') {
    const mainCompId = String(compData.mainCompId || '');
    if (mainCompId) {
      collectRowClipboardInfoFromComp(docRecord, mainCompId, depth, rowInfoList, compIdSetVisited);
    }
    const childIdList = getChildIdList(compData);
    for (const childId of childIdList) {
      collectRowClipboardInfoFromComp(docRecord, childId, depth + 1, rowInfoList, compIdSetVisited);
    }
    return;
  }

  const mainCompId = String(compData.mainCompId || '');
  if (mainCompId) {
    collectRowClipboardInfoFromComp(docRecord, mainCompId, depth, rowInfoList, compIdSetVisited);
  }
  const childIdList = getChildIdList(compData);
  for (const childId of childIdList) {
    collectRowClipboardInfoFromComp(docRecord, childId, depth, rowInfoList, compIdSetVisited);
  }
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
    const childIdList = getChildIdList(compData);
    if (childIdList.includes(entryId)) {
      return compId;
    }
  }
  return '';
}

function addCompDataListToRecord(contextEdit: DocEditContext, compDataList: CompData[]) {
  for (const compData of compDataList) {
    editPutCompData(contextEdit, compData);
  }
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

function getChildIdList(compData: any) {
  return Array.isArray(compData?.childIdList)
    ? compData.childIdList.map((id: any) => String(id || '')).filter(Boolean)
    : [];
}

function isCompName(docRecord: DocRecord, compId: string, compName: string) {
  if (!compId) return false;
  return String(docRecord.compDataById[compId]?.compName || '') === compName;
}
