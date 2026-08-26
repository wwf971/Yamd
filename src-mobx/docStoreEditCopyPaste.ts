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
import {
  docStoreGetCompNameCopyFenced,
  docStoreIsSegCopyFenced,
} from './docStoreSegTrait';

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
  kind: 'text' | 'block';
  text: string;
  childList: PasteListItem[];
};

type PasteChunk =
  | { kind: 'line'; text: string }
  | { kind: 'fence'; text: string; indentMetric: number };

type PasteParseResult = {
  // 'list': markdown list items, pasted as child entries of the caret row.
  // 'chunk': plain lines mixed with fenced blocks, pasted by splitting the
  //          caret row into sibling rows.
  mode: 'list' | 'chunk';
  itemList: PasteListItem[];
};

type PasteCompBuildResult = {
  compDataList: CompData[];
  entryIdList: string[];
  segIdLast: string;
  textLast: string;
};

export type DocCutState = {
  textClipboard: string;
  nodeIdAfter: string;
  segIdFocusAfter: string;
  offsetFocusAfter: number;
  timeCreated: number;
};

export async function docStoreCutSelection(
  store: DocStore,
  docId: string,
  textClipboard: string,
) {
  const docRecord = store.ensureDoc(docId);
  const selectionState = docRecord.interactionState.selectionState;
  const pointAnchor = selectionState.pointAnchor;
  const pointFocus = selectionState.pointFocus;
  if (selectionState.isSelectionActive !== true || !pointAnchor || !pointFocus) {
    return { code: -1, message: 'No active selection to cut.' };
  }
  const segIdFocus = String(pointFocus.segId || pointFocus.compId || '');
  if (!segIdFocus || !docRecord.compDataById[segIdFocus]) {
    return { code: -1, message: 'Cut selection focus segment not found.' };
  }
  const nodeIdBefore = docRecord.historyState.nodeIdCurrent;

  const result = await store.sendEventToParent(docId, segIdFocus, {
    type: 'childSelectionDeleteAttempt',
    sourceId: segIdFocus,
    targetId: docId,
    data: {
      compIdChild: segIdFocus,
      pointAnchor: { ...pointAnchor },
      pointFocus: { ...pointFocus },
    },
  });
  if (result.code !== 0) return result;
  if (docRecord.historyState.nodeIdCurrent === nodeIdBefore) {
    return { code: -1, message: 'Cut made no document change.' };
  }

  const focusState = docRecord.interactionState.focusState;
  store.stateCutByDocId[docId] = {
    textClipboard: normalizeClipboardText(textClipboard),
    nodeIdAfter: docRecord.historyState.nodeIdCurrent,
    segIdFocusAfter: String(focusState.segIdFocused || focusState.compIdFocused || ''),
    offsetFocusAfter: Number(focusState.offsetFocused || 0),
    timeCreated: Date.now(),
  };
  return { code: 0, message: 'Selection cut.' };
}

export function docStoreTryRestoreCutByPaste(
  store: DocStore,
  docId: string,
  segId: string,
  textPaste: string,
  pointRaw: any,
) {
  const cutState = store.stateCutByDocId[docId];
  if (!cutState) return null;
  const docRecord = store.ensureDoc(docId);
  const offsetPaste = Math.max(0, Number(pointRaw?.offset || 0));
  const isMatchingCut = Date.now() - cutState.timeCreated <= 30000
    && cutState.textClipboard === normalizeClipboardText(textPaste)
    && cutState.nodeIdAfter === docRecord.historyState.nodeIdCurrent
    && cutState.segIdFocusAfter === String(segId || '')
    && cutState.offsetFocusAfter === offsetPaste
    && docRecord.interactionState.selectionState.isSelectionActive !== true;
  if (!isMatchingCut) return null;

  delete store.stateCutByDocId[docId];
  const result = store.undoDocEdit(docId);
  return result.code === 0
    ? { ...result, message: 'Cut content restored at its original position.' }
    : result;
}

function normalizeClipboardText(text: unknown) {
  return String(text || '').replace(/\r\n|\r/g, '\n');
}

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
    lineList.push(...formatRowClipboardLines(docRecord, rowInfo, textRow, depthRelative));
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
    lineList.push(...formatRowClipboardLines(docRecord, rowInfo, textRow, depthRelative));
  }
  return lineList.join('\n');
}

// A row whose single segment declares isCopyAsFencedBlock serializes as an
// empty list item followed by the block lines, each indented one extra list
// level and wrapped in ``` fences:
//
//   - text row
//     -
//       ```
//       block line one
//       block line two
//       ```
//
// Markdown renderers treat the fenced lines as a code block belonging to the
// empty list item, and paste in this document rebuilds a block row from it.
function formatRowClipboardLines(
  docRecord: DocRecord,
  rowInfo: RowClipboardInfo,
  textRow: string,
  depthRelative: number,
) {
  const indentRow = ConfigIndentTextWhenCopyAsMarkdown.repeat(depthRelative);
  const segDataFirst = docRecord.compDataById[rowInfo.segIdList[0] || ''];
  const isRowFenced = rowInfo.segIdList.length === 1 && docStoreIsSegCopyFenced(segDataFirst);
  if (!isRowFenced) {
    return [`${indentRow}- ${textRow}`];
  }
  const indentBlock = `${indentRow}${ConfigIndentTextWhenCopyAsMarkdown}`;
  return [
    `${indentRow}-`,
    `${indentBlock}\`\`\``,
    ...textRow.split('\n').map((textLine) => `${indentBlock}${textLine}`),
    `${indentBlock}\`\`\``,
  ];
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
  const parseResult = parsePasteContent(String(textPasteRaw ?? ''));
  if (!parseResult) {
    return pastePlainTextAtSeg(store, docId, segIdSafe, String(textPasteRaw ?? ''), offsetPaste);
  }

  const entryInfo = getOutlineEntryInfoByRowId(docRecord, rowIdSafe);
  if (!entryInfo) {
    return pastePlainTextAtSeg(store, docId, segIdSafe, String(textPasteRaw ?? ''), offsetPaste);
  }

  const textLeft = textCurrent.slice(0, offsetPaste);
  const textRight = textCurrent.slice(offsetPaste);
  if (parseResult.mode === 'chunk') {
    return pasteChunkItemsSplittingRow(
      store,
      docId,
      entryInfo,
      segData,
      rowData,
      parseResult.itemList,
      textLeft,
      textRight,
    );
  }

  const buildResult = createPasteCompBuildResult(docRecord, parseResult.itemList, segData, rowData);
  if (buildResult.entryIdList.length === 0 || !buildResult.segIdLast) {
    return pastePlainTextAtSeg(store, docId, segIdSafe, String(textPasteRaw ?? ''), offsetPaste);
  }

  let compDataListPaste = buildResult.compDataList;
  let entryIdListPaste = buildResult.entryIdList;
  let focusNext: CompFocusTarget = {
    compId: buildResult.segIdLast,
    point: { offset: buildResult.textLast.length },
  };
  const segDataLast = compDataListPaste.find((compData) => compData.compId === buildResult.segIdLast);
  if (segDataLast && !docStoreIsSegCopyFenced(segDataLast)) {
    docStoreSetSegmentText(segDataLast, `${docStoreGetSegmentText(segDataLast)}${textRight}`);
  } else if (segDataLast && textRight.length > 0) {
    // A fenced block never absorbs the right part of the split segment; the
    // right part becomes one extra text row after the pasted entries.
    const compIdSetReserved = new Set(compDataListPaste.map((compData) => compData.compId));
    const segIdRight = docStoreCreateCompId(docRecord, 'seg', compIdSetReserved);
    const rowIdRight = docStoreCreateCompId(docRecord, 'row', compIdSetReserved);
    compDataListPaste = [
      ...compDataListPaste,
      docStoreCloneSegmentWithText(segData, segIdRight, textRight),
      createRowComp(rowIdRight, [segIdRight], rowData),
    ];
    entryIdListPaste = [...entryIdListPaste, rowIdRight];
    focusNext = { compId: segIdRight, point: { offset: 0 } };
  }

  const isRowEmptySingleSeg = childIdListRow.length === 1 && textCurrent.length === 0;
  if (isRowEmptySingleSeg) {
    return replaceEntryWithPasteEntries(store, docId, entryInfo, {
      ...buildResult,
      compDataList: compDataListPaste,
      entryIdList: entryIdListPaste,
    }, focusNext);
  }

  const contextEdit = docStoreGetActiveEdit(store, docId);
  editUpdateCompData(contextEdit, segIdSafe, {
    [docStoreGetSegmentTextFieldName(segData)]: textLeft,
  });
  addCompDataListToRecord(contextEdit, compDataListPaste);
  const entryData = docRecord.compDataById[entryInfo.entryId];
  if (String(entryData?.compName || '') === 'List') {
    editSetChildIdList(contextEdit, entryInfo.entryId, [
      ...entryIdListPaste,
      ...getChildIdList(entryData),
    ]);
  } else if (String(entryData?.compName || '') === 'Row') {
    const listIdWrapped = docStoreCreateCompId(docRecord, 'list');
    editPutCompData(contextEdit, {
      compId: listIdWrapped,
      compName: 'List',
      mainCompId: rowIdSafe,
      childIdList: [...entryIdListPaste],
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

const REGEX_PASTE_LIST_ITEM = /^([ \t]*)([-*+])(?:[ \t]+(.*)|[ \t]*)$/;

// Recognize the paste text structure:
// - no fence pair: markdown list text ('list' mode), or null for plain text
// - fenced blocks between markdown list items: 'list' mode with block items
// - fenced blocks between plain lines: 'chunk' mode, a flat item sequence
// - fenced blocks between mixed plain and list lines: not recognized (null)
function parsePasteContent(textRaw: string): PasteParseResult | null {
  const chunkList = parseFenceChunkList(textRaw);
  if (!chunkList) {
    const itemList = parsePasteListText(textRaw);
    return itemList ? { mode: 'list', itemList } : null;
  }
  const lineListPlain = chunkList
    .filter((chunk) => chunk.kind === 'line')
    .map((chunk) => chunk.text)
    .filter((lineRaw) => lineRaw.trim().length > 0);
  const countLineListItem = lineListPlain.filter((lineRaw) => REGEX_PASTE_LIST_ITEM.test(lineRaw)).length;
  if (countLineListItem === 0) {
    const itemList: PasteListItem[] = [];
    for (const chunk of chunkList) {
      if (chunk.kind === 'fence') {
        itemList.push({ kind: 'block', text: chunk.text, childList: [] });
      } else if (chunk.text.trim().length > 0) {
        itemList.push({ kind: 'text', text: chunk.text.trim(), childList: [] });
      }
    }
    return itemList.length > 0 ? { mode: 'chunk', itemList } : null;
  }
  if (countLineListItem < lineListPlain.length) {
    return null;
  }
  const itemList = parsePasteListItemsFromChunks(chunkList);
  return itemList ? { mode: 'list', itemList } : null;
}

// Split the paste text into plain lines and fenced blocks. A fence opens at a
// line whose content starts with ``` and closes at a line that is exactly ```.
// The opening line's indentation is stripped from each content line. Returns
// null when there is no complete fence pair.
function parseFenceChunkList(textRaw: string): PasteChunk[] | null {
  const lineList = String(textRaw || '').split(/\r\n|\n|\r/);
  const chunkList: PasteChunk[] = [];
  let isAnyFence = false;
  let index = 0;
  while (index < lineList.length) {
    const lineCurrent = lineList[index];
    const matchFenceOpen = /^([ \t]*)```/.exec(lineCurrent);
    if (!matchFenceOpen) {
      chunkList.push({ kind: 'line', text: lineCurrent });
      index += 1;
      continue;
    }
    const indentOpen = matchFenceOpen[1];
    let indexClose = -1;
    for (let indexSearch = index + 1; indexSearch < lineList.length; indexSearch += 1) {
      if (lineList[indexSearch].trim() === '```') {
        indexClose = indexSearch;
        break;
      }
    }
    if (indexClose === -1) {
      return null;
    }
    const textFence = lineList.slice(index + 1, indexClose)
      .map((lineContent) => (lineContent.startsWith(indentOpen) ? lineContent.slice(indentOpen.length) : lineContent))
      .join('\n');
    chunkList.push({ kind: 'fence', text: textFence, indentMetric: getIndentMetric(indentOpen) });
    isAnyFence = true;
    index = indexClose + 1;
  }
  return isAnyFence ? chunkList : null;
}

function parsePasteListText(textRaw: string): PasteListItem[] | null {
  const chunkList: PasteChunk[] = String(textRaw || '')
    .split(/\r\n|\n|\r/)
    .map((lineRaw) => ({ kind: 'line', text: lineRaw }));
  const lineListPlain = chunkList
    .map((chunk) => chunk.text)
    .filter((lineRaw) => lineRaw.trim().length > 0);
  if (lineListPlain.length === 0 || !lineListPlain.every((lineRaw) => REGEX_PASTE_LIST_ITEM.test(lineRaw))) {
    return null;
  }
  return parsePasteListItemsFromChunks(chunkList);
}

// Build the nested item tree from list-item lines and fenced blocks.
// Fence placement rules:
// - a fence indented deeper than an empty list item right above it turns that
//   item into one block item (the serialized form of one block row)
// - a fence indented deeper than a non-empty list item above it becomes a
//   block child item of that list item
// - any other fence becomes a sibling block item of the last item
function parsePasteListItemsFromChunks(chunkList: PasteChunk[]): PasteListItem[] | null {
  type PasteParseEntry = { kind: 'item' | 'fence'; indentMetric: number; text: string };
  const entryList: PasteParseEntry[] = [];
  for (const chunk of chunkList) {
    if (chunk.kind === 'fence') {
      entryList.push({ kind: 'fence', indentMetric: chunk.indentMetric, text: chunk.text });
      continue;
    }
    if (chunk.text.trim().length === 0) continue;
    const match = REGEX_PASTE_LIST_ITEM.exec(chunk.text);
    if (!match) return null;
    entryList.push({
      kind: 'item',
      indentMetric: getIndentMetric(match[1]),
      text: String(match[3] || '').trim(),
    });
  }
  const entryItemFirst = entryList.find((entry) => entry.kind === 'item');
  if (!entryItemFirst) return null;
  const indentMetricBase = entryItemFirst.indentMetric;

  const itemListRoot: PasteListItem[] = [];
  const itemStack: PasteListItem[] = [];
  const indentMetricStack = [0];
  let depthItemLast = -1;
  let indentMetricItemLast = -1;
  for (const entry of entryList) {
    const indentMetric = Math.max(0, entry.indentMetric - indentMetricBase);
    if (entry.kind === 'fence') {
      const itemLast = depthItemLast >= 0 ? itemStack[depthItemLast] : null;
      if (itemLast && indentMetric > indentMetricItemLast) {
        if (itemLast.kind === 'text' && itemLast.text === '' && itemLast.childList.length === 0) {
          itemLast.kind = 'block';
          itemLast.text = entry.text;
        } else {
          itemLast.childList.push({ kind: 'block', text: entry.text, childList: [] });
        }
        continue;
      }
      const itemBlock: PasteListItem = { kind: 'block', text: entry.text, childList: [] };
      const depthBlock = Math.max(0, depthItemLast);
      if (depthBlock === 0 || !itemStack[depthBlock - 1]) {
        itemListRoot.push(itemBlock);
        itemStack[0] = itemBlock;
        itemStack.length = 1;
        depthItemLast = 0;
      } else {
        itemStack[depthBlock - 1].childList.push(itemBlock);
        itemStack[depthBlock] = itemBlock;
        itemStack.length = depthBlock + 1;
        depthItemLast = depthBlock;
      }
      continue;
    }

    let depth = 0;
    const indentMetricStackLast = indentMetricStack[indentMetricStack.length - 1];
    if (indentMetric > indentMetricStackLast) {
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
      kind: 'text',
      text: entry.text,
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
    depthItemLast = depth;
    indentMetricItemLast = indentMetric;
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
  const segDataNext = item.kind === 'block'
    ? createFencedBlockSegCompData(segId, textItem, segDataTemplate)
    : docStoreCloneSegmentWithText(segDataTemplate, segId, textItem);
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

// Build the segment CompData for one pasted fenced block. The compName comes
// from the fenced-copy trait registry; when no component registered it, the
// block degrades to a plain text segment with newlines flattened.
function createFencedBlockSegCompData(
  segId: string,
  text: string,
  segDataTemplate: CompData,
): CompData {
  const compNameBlock = docStoreGetCompNameCopyFenced();
  if (!compNameBlock) {
    return docStoreCloneSegmentWithText(segDataTemplate, segId, text.replace(/\n+/g, ' '));
  }
  return {
    compId: segId,
    compName: compNameBlock,
    childIdList: [],
    data: { sourceId: segId, text },
    config: { isEditable: segDataTemplate?.config?.isEditable === true },
  };
}

// Paste a flat sequence of text items and fenced block items ('chunk' mode).
// A block is row-exclusive, so the caret row splits like a row split: the
// left part keeps the caret segment, the items become sibling rows after it,
// and the right part (plus the caret row's child entries) ends in a last row.
// The first and last text items join the split segment halves:
//
//   - bb|b            paste "111\n```\nblock\n```\n222"
//     - cc
//
//   - bb111
//   - block row
//   - 222b
//     - cc
function pasteChunkItemsSplittingRow(
  store: DocStore,
  docId: string,
  entryInfo: OutlineEntryInfo,
  segData: CompData,
  rowData: CompData,
  itemList: PasteListItem[],
  textLeft: string,
  textRight: string,
) {
  const docRecord = store.ensureDoc(docId);
  if (itemList.length === 0) {
    return { code: -1, message: 'Paste content is empty.' };
  }
  const entryData = docRecord.compDataById[entryInfo.entryId];
  const isEntryList = String(entryData?.compName || '') === 'List';
  const listDataParent = docRecord.compDataById[entryInfo.parentListId];
  if (String(listDataParent?.compName || '') !== 'List') {
    return { code: -1, message: 'Parent list not found.' };
  }
  const childIdListParent = getChildIdList(listDataParent);
  const entryIndex = childIdListParent.indexOf(entryInfo.entryId);
  if (entryIndex < 0) {
    return { code: -1, message: 'Entry not found in parent list.' };
  }

  const itemFirst = itemList[0];
  const isFirstItemText = itemFirst.kind === 'text';
  const textSegLeft = `${textLeft}${isFirstItemText ? itemFirst.text : ''}`;
  const itemListRemain = isFirstItemText ? itemList.slice(1) : itemList;
  const itemLast = itemListRemain[itemListRemain.length - 1] || null;
  const isLastItemText = itemLast !== null && itemLast.kind === 'text';
  const textItemLast = isLastItemText ? itemLast.text : '';
  const itemListMiddle = isLastItemText ? itemListRemain.slice(0, -1) : itemListRemain;

  const childIdListRow = getChildIdList(rowData);
  const childIndexSeg = childIdListRow.indexOf(segData.compId);
  const childIdListRowAfter = childIdListRow.slice(childIndexSeg + 1);
  const isRowLastNeeded = isLastItemText
    || textRight.length > 0
    || childIdListRowAfter.length > 0
    || isEntryList;

  const contextEdit = docStoreGetActiveEdit(store, docId);
  const compIdSetReserved = new Set<string>();
  const compDataListNew: CompData[] = [];
  const entryIdListMiddle: string[] = [];
  let segIdMiddleLast = '';
  let textMiddleLast = '';
  for (const item of itemListMiddle) {
    const segId = docStoreCreateCompId(docRecord, 'seg', compIdSetReserved);
    const rowIdNew = docStoreCreateCompId(docRecord, 'row', compIdSetReserved);
    const segDataNext = item.kind === 'block'
      ? createFencedBlockSegCompData(segId, item.text, segData)
      : docStoreCloneSegmentWithText(segData, segId, item.text);
    compDataListNew.push(segDataNext, createRowComp(rowIdNew, [segId], rowData));
    entryIdListMiddle.push(rowIdNew);
    segIdMiddleLast = segId;
    textMiddleLast = docStoreGetSegmentText(segDataNext);
  }

  let segIdLastRow = '';
  let rowIdLastRow = '';
  if (isRowLastNeeded) {
    segIdLastRow = docStoreCreateCompId(docRecord, 'seg', compIdSetReserved);
    rowIdLastRow = docStoreCreateCompId(docRecord, 'row', compIdSetReserved);
    compDataListNew.push(
      docStoreCloneSegmentWithText(segData, segIdLastRow, `${textItemLast}${textRight}`),
      createRowComp(rowIdLastRow, [segIdLastRow, ...childIdListRowAfter], rowData),
    );
  }

  addCompDataListToRecord(contextEdit, compDataListNew);
  editUpdateCompData(contextEdit, segData.compId, {
    [docStoreGetSegmentTextFieldName(segData)]: textSegLeft,
  });
  if (childIdListRowAfter.length > 0) {
    editSetChildIdList(contextEdit, rowData.compId, childIdListRow.slice(0, childIndexSeg + 1));
  }

  if (isEntryList) {
    // The caret row leaves its List entry and becomes a direct row entry
    // before it. The List keeps the child entries and gets the last row as
    // its new main row, so the children stay below the pasted content.
    if (!rowIdLastRow) {
      return { code: -1, message: 'Last row missing for list entry split.' };
    }
    editPutCompData(contextEdit, {
      ...entryData,
      childIdList: getChildIdList(entryData),
      mainCompId: rowIdLastRow,
    });
    editSetChildIdList(contextEdit, entryInfo.parentListId, [
      ...childIdListParent.slice(0, entryIndex),
      rowData.compId,
      ...entryIdListMiddle,
      entryInfo.entryId,
      ...childIdListParent.slice(entryIndex + 1),
    ]);
  } else {
    editSetChildIdList(contextEdit, entryInfo.parentListId, [
      ...childIdListParent.slice(0, entryIndex + 1),
      ...entryIdListMiddle,
      ...(rowIdLastRow ? [rowIdLastRow] : []),
      ...childIdListParent.slice(entryIndex + 1),
    ]);
  }

  const focusNext: CompFocusTarget = isLastItemText
    ? { compId: segIdLastRow, point: { offset: textItemLast.length } }
    : segIdMiddleLast
      ? { compId: segIdMiddleLast, point: { offset: textMiddleLast.length } }
      : { compId: segData.compId, point: { offset: textSegLeft.length } };
  store.clearSelectionState(docId);
  store.applyFocusAfterEdit(docId, focusNext, 'childPasteAttempt');
  return { code: 0, message: 'Text with fenced blocks pasted.' };
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
