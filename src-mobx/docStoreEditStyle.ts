import type { DocStore } from './docStore';
import type { CompData, DocRecord, SelectionState, SelectionTrackPoint } from './docStoreTypes';
import { docStoreCreateCompId } from './docStoreCompData';
import { docStoreReplaceChildRange, docStoreRestoreSelectionState } from './docStoreEdit';
import {
  docStoreCollectSegmentIds,
  docStoreGetOwningRowId,
  docStoreGetSegmentText,
  docStoreGetSegmentTextFieldName,
} from './docStoreSegment';
import { docStoreIsSegTextStyleSupported } from './docStoreSegTrait';
import {
  type SegTextStyle,
  segStyleApplyPatch,
  segStyleIsSame,
  segStyleNormalize,
} from './docStoreSegStyle';

// Centralized processing of the set-style-on-selection action.
// See doc-mobx/comp_text_style.md.
//
// The action walks every segment covered by the selection, skips segments
// that do not support text style, splits partially covered segments so the
// covered text becomes its own segment with the patched style, and merges
// adjacent segments that end with the same style. Uncovered text segments of
// the same row take part in the merging as neighbors, so styling text back
// to the style of the segments around it heals earlier splits. Everything
// runs in one edit transaction ('styleSet'), so undo restores the whole
// action.

// One covered segment of the selection: the segment, its owning row, and the
// covered text range inside the segment.
type StyleCover = {
  segId: string;
  rowId: string;
  offsetStart: number;
  offsetEnd: number;
};

// One replacement segment under construction inside a row. coverStart and
// coverEnd track where covered (styled) text lies inside the piece text; they
// are -1 when the piece holds no covered text. They are used to restore the
// selection over the styled text after the edit.
//
// compDataOriginal is set on a piece built from an uncovered neighbor
// segment. As long as it survives (the piece merged with nothing), the
// original segment is emitted untouched instead of being rebuilt.
type StylePieceEntry = {
  kind: 'piece';
  compName: string;
  dataTemplate: any;
  configTemplate: any;
  configKey: string;
  style: SegTextStyle | null;
  text: string;
  compIdSourceList: string[];
  coverStart: number;
  coverEnd: number;
  compDataOriginal: CompData | null;
};

type StyleKeepEntry = {
  kind: 'keep';
  compId: string;
};

type StyleRowEntry = StylePieceEntry | StyleKeepEntry;

export function docStoreSetStyleOnSelection(
  store: DocStore,
  docId: string,
  stylePatch: Record<string, any>,
  selectionOverride?: SelectionState | null,
) {
  const docRecord = store.ensureDoc(docId);
  const selectionState = selectionOverride || docRecord.interactionState.selectionState;
  const { coverList, pointStart, pointEnd } = collectStyleCoverList(docRecord, selectionState);
  if (coverList.length === 0) {
    return { code: -1, message: 'Selection covers no styleable text.' };
  }
  return store.runDocEdit(docId, 'styleSet', () => (
    applyStylePatchOnCoverList(store, docId, coverList, stylePatch || {}, pointStart, pointEnd)
  ));
}

// Summary of the current selection for style toolbars. styleCommon contains
// the style entries that every covered segment shares, so a toggle button can
// show its active state and decide the patch direction.
export function docStoreGetStyleOfSelection(
  store: DocStore,
  docId: string,
  selectionOverride?: SelectionState | null,
) {
  const docRecord = store.ensureDoc(docId);
  const selectionState = selectionOverride || docRecord.interactionState.selectionState;
  const { coverList } = collectStyleCoverList(docRecord, selectionState);
  if (coverList.length === 0) {
    return {
      code: 0,
      message: 'Selection covers no styleable text.',
      data: { countSegCovered: 0, styleCommon: {} },
    };
  }
  const styleList = coverList.map((cover) => (
    segStyleNormalize(docRecord.compDataById[cover.segId]?.data?.style) || {}
  ));
  const styleFirst: Record<string, any> = styleList[0];
  const styleCommon: Record<string, any> = {};
  for (const fieldName of Object.keys(styleFirst)) {
    const value = styleFirst[fieldName];
    const isValueShared = styleList.every((style) => (style as Record<string, any>)[fieldName] === value);
    if (isValueShared) {
      styleCommon[fieldName] = value;
    }
  }
  return {
    code: 0,
    message: 'Selection style collected.',
    data: { countSegCovered: coverList.length, styleCommon },
  };
}

// A segment takes part in style actions when its kind supports text style
// and the segment is editable. The same rule decides selection coverage and
// merge-neighbor participation.
function isSegConsideredForStyle(compData: CompData | null | undefined) {
  return docStoreIsSegTextStyleSupported(compData) && compData?.config?.isEditable === true;
}

// Collect the covered segments of an active range selection in document
// order. A segment participates when it supports text style, is editable,
// and the selection covers at least one of its characters. Other components
// inside the selection are not affected by style actions.
//
// pointStart and pointEnd are the original selection endpoints in document
// order. They are returned so the whole selection range can be restored
// after the edit, including endpoints inside segments the action skips.
function collectStyleCoverList(
  docRecord: DocRecord,
  selectionState: SelectionState,
): { coverList: StyleCover[]; pointStart: SelectionTrackPoint | null; pointEnd: SelectionTrackPoint | null } {
  const pointAnchor = selectionState?.pointAnchor;
  const pointFocus = selectionState?.pointFocus;
  if (selectionState?.isSelectionActive !== true || !pointAnchor || !pointFocus) {
    return { coverList: [], pointStart: null, pointEnd: null };
  }
  const segIdList = docStoreCollectSegmentIds(docRecord);
  const indexAnchor = segIdList.indexOf(String(pointAnchor.segId || ''));
  const indexFocus = segIdList.indexOf(String(pointFocus.segId || ''));
  if (indexAnchor === -1 || indexFocus === -1) {
    return { coverList: [], pointStart: null, pointEnd: null };
  }
  const isForward = indexAnchor < indexFocus
    || (indexAnchor === indexFocus && Number(pointAnchor.offset || 0) <= Number(pointFocus.offset || 0));
  const pointStart = isForward ? pointAnchor : pointFocus;
  const pointEnd = isForward ? pointFocus : pointAnchor;
  const indexStart = Math.min(indexAnchor, indexFocus);
  const indexEnd = Math.max(indexAnchor, indexFocus);

  const coverList: StyleCover[] = [];
  for (let index = indexStart; index <= indexEnd; index += 1) {
    const segId = segIdList[index];
    const compData = docRecord.compDataById[segId];
    if (!isSegConsideredForStyle(compData)) continue;
    const text = docStoreGetSegmentText(compData);
    const offsetStart = index === indexStart
      ? Math.min(text.length, Math.max(0, Number(pointStart.offset || 0)))
      : 0;
    const offsetEnd = index === indexEnd
      ? Math.min(text.length, Math.max(0, Number(pointEnd.offset || 0)))
      : text.length;
    if (offsetStart >= offsetEnd) continue;
    const rowId = docStoreGetOwningRowId(docRecord, segId);
    if (!rowId) continue;
    coverList.push({ segId, rowId, offsetStart, offsetEnd });
  }
  return { coverList, pointStart, pointEnd };
}

function applyStylePatchOnCoverList(
  store: DocStore,
  docId: string,
  coverList: StyleCover[],
  stylePatch: Record<string, any>,
  pointStart: SelectionTrackPoint | null,
  pointEnd: SelectionTrackPoint | null,
) {
  const docRecord = store.ensureDoc(docId);
  const coverBySegId = new Map(coverList.map((cover) => [cover.segId, cover]));
  const rowIdList: string[] = [];
  for (const cover of coverList) {
    if (!rowIdList.includes(cover.rowId)) {
      rowIdList.push(cover.rowId);
    }
  }

  const compIdSetUsed = new Set<string>();
  const compIdSetReserved = new Set<string>();
  const compIdSetRebuilt = new Set<string>();
  let pointAnchorNext: { compId: string; offset: number } | null = null;
  let pointFocusNext: { compId: string; offset: number } | null = null;

  // Rows are processed independently and in document order. Styling never
  // merges segments across rows.
  for (const rowId of rowIdList) {
    const rowData = docRecord.compDataById[rowId];
    const childIdList = getChildIdList(rowData);
    if (!rowData || childIdList.length === 0) {
      return { code: -1, message: `Style target row is invalid. rowId=${rowId}` };
    }

    const entryList: StyleRowEntry[] = [];
    for (const childId of childIdList) {
      const cover = coverBySegId.get(childId);
      const compData = docRecord.compDataById[childId];
      if (!compData) {
        entryList.push({ kind: 'keep', compId: childId });
        continue;
      }
      if (cover) {
        for (const piece of createStylePieceList(compData, cover, stylePatch)) {
          appendPieceWithMerge(entryList, piece);
        }
        continue;
      }
      if (isSegConsideredForStyle(compData)) {
        // An uncovered text segment joins as a merge neighbor: a covered
        // piece next to it that ends up with the same style merges into it.
        appendPieceWithMerge(entryList, createStyleNeighborPiece(compData));
        continue;
      }
      entryList.push({ kind: 'keep', compId: childId });
    }

    const compDataListNext: CompData[] = [];
    for (const entry of entryList) {
      if (entry.kind === 'keep') {
        const compDataKeep = docRecord.compDataById[entry.compId];
        if (!compDataKeep) {
          return { code: -1, message: `Row child not found. compId=${entry.compId}` };
        }
        compDataListNext.push(compDataKeep);
        continue;
      }
      if (entry.compDataOriginal) {
        // An uncovered neighbor that merged with nothing stays untouched.
        compDataListNext.push(entry.compDataOriginal);
        continue;
      }
      // The first result segment of each original segment keeps its comp id;
      // extra pieces get new ids, and unused original ids are removed with
      // the child range replacement.
      for (const compIdSource of entry.compIdSourceList) {
        compIdSetRebuilt.add(compIdSource);
      }
      const compIdReused = entry.compIdSourceList.find((compId) => !compIdSetUsed.has(compId));
      const compIdNext = compIdReused || docStoreCreateCompId(docRecord, 'seg', compIdSetReserved);
      compIdSetUsed.add(compIdNext);
      compDataListNext.push(createStyleSegCompData(entry, compIdNext));
      if (entry.coverStart >= 0) {
        if (!pointAnchorNext) {
          pointAnchorNext = { compId: compIdNext, offset: entry.coverStart };
        }
        pointFocusNext = { compId: compIdNext, offset: entry.coverEnd };
      }
    }

    const resultReplace = docStoreReplaceChildRange(store, docId, rowId, childIdList, compDataListNext, {});
    if (resultReplace.code !== 0) {
      return resultReplace;
    }
  }

  // Restore the whole selection range, so repeated style actions work on the
  // same range without re-selecting. An endpoint inside a rebuilt segment is
  // mapped onto the styled pieces; an endpoint inside an untouched segment
  // (for example a text block the action skips) keeps its original position.
  const pointAnchorRestore = createSelectionRestorePoint(pointStart, compIdSetRebuilt, pointAnchorNext);
  const pointFocusRestore = createSelectionRestorePoint(pointEnd, compIdSetRebuilt, pointFocusNext);
  if (pointAnchorRestore && pointFocusRestore) {
    docStoreRestoreSelectionState(store, docId, {
      isSelectionActive: true,
      mode: 'range',
      pointAnchor: pointAnchorRestore,
      pointFocus: pointFocusRestore,
    }, 'styleSet');
  }
  return {
    code: 0,
    message: 'Style set on selection.',
    data: { countSegStyled: coverList.length },
  };
}

// Split one covered segment into up to three pieces: text before the cover
// keeps the current style, the covered text gets the patched style, text
// after the cover keeps the current style. When the patch does not change
// the style, the segment stays one piece (still a merge candidate for its
// neighbors).
function createStylePieceList(
  compData: CompData,
  cover: StyleCover,
  stylePatch: Record<string, any>,
): StylePieceEntry[] {
  const text = docStoreGetSegmentText(compData);
  const styleCurrent = segStyleNormalize(compData.data?.style);
  const styleNext = segStyleApplyPatch(styleCurrent, stylePatch);
  const pieceBase = {
    kind: 'piece' as const,
    compName: String(compData.compName || ''),
    dataTemplate: compData.data || {},
    configTemplate: compData.config || {},
    configKey: JSON.stringify(compData.config || {}),
    compIdSourceList: [String(compData.compId || '')],
    compDataOriginal: null,
  };
  if (segStyleIsSame(styleCurrent, styleNext)) {
    return [{
      ...pieceBase,
      style: styleCurrent,
      text,
      coverStart: cover.offsetStart,
      coverEnd: cover.offsetEnd,
    }];
  }
  const pieceList: StylePieceEntry[] = [];
  if (cover.offsetStart > 0) {
    pieceList.push({
      ...pieceBase,
      style: styleCurrent,
      text: text.slice(0, cover.offsetStart),
      compIdSourceList: [...pieceBase.compIdSourceList],
      coverStart: -1,
      coverEnd: -1,
    });
  }
  pieceList.push({
    ...pieceBase,
    style: styleNext,
    text: text.slice(cover.offsetStart, cover.offsetEnd),
    compIdSourceList: [...pieceBase.compIdSourceList],
    coverStart: 0,
    coverEnd: cover.offsetEnd - cover.offsetStart,
  });
  if (cover.offsetEnd < text.length) {
    pieceList.push({
      ...pieceBase,
      style: styleCurrent,
      text: text.slice(cover.offsetEnd),
      compIdSourceList: [...pieceBase.compIdSourceList],
      coverStart: -1,
      coverEnd: -1,
    });
  }
  return pieceList;
}

// A piece built from an uncovered neighbor segment: same style as the
// segment carries now, no covered text. It merges only with a covered piece,
// never with another untouched neighbor.
function createStyleNeighborPiece(compData: CompData): StylePieceEntry {
  return {
    kind: 'piece',
    compName: String(compData.compName || ''),
    dataTemplate: compData.data || {},
    configTemplate: compData.config || {},
    configKey: JSON.stringify(compData.config || {}),
    style: segStyleNormalize(compData.data?.style),
    text: docStoreGetSegmentText(compData),
    compIdSourceList: [String(compData.compId || '')],
    coverStart: -1,
    coverEnd: -1,
    compDataOriginal: compData,
  };
}

// Two adjacent pieces merge into one segment when they are the same
// component kind with the same config and end with the same style, and at
// least one of the two holds covered text. The covered-text condition keeps
// the action from merging segments unrelated to the selection: two
// neighboring segments that already share a style stay as they are. This
// merging joins the covered parts of neighboring segments that received the
// same style, and heals text styled back to the style of its neighbors
// (including neighbors outside the selection).
function appendPieceWithMerge(entryList: StyleRowEntry[], piece: StylePieceEntry) {
  const entryLast = entryList[entryList.length - 1];
  if (
    entryLast
    && entryLast.kind === 'piece'
    && entryLast.compName === piece.compName
    && entryLast.configKey === piece.configKey
    && segStyleIsSame(entryLast.style, piece.style)
    && (entryLast.coverStart >= 0 || piece.coverStart >= 0)
  ) {
    const lengthBefore = entryLast.text.length;
    entryLast.text += piece.text;
    entryLast.compIdSourceList.push(...piece.compIdSourceList);
    entryLast.compDataOriginal = null;
    if (piece.coverStart >= 0) {
      if (entryLast.coverStart < 0) {
        entryLast.coverStart = lengthBefore + piece.coverStart;
      }
      entryLast.coverEnd = lengthBefore + piece.coverEnd;
    }
    return;
  }
  entryList.push({ ...piece, compIdSourceList: [...piece.compIdSourceList] });
}

function createStyleSegCompData(entry: StylePieceEntry, compId: string): CompData {
  const fieldNameText = docStoreGetSegmentTextFieldName({ config: entry.configTemplate } as CompData);
  const dataNext: Record<string, any> = {
    ...(entry.dataTemplate || {}),
    sourceId: compId,
    [fieldNameText]: entry.text,
  };
  if (entry.style) {
    dataNext.style = { ...entry.style };
  } else {
    delete dataNext.style;
  }
  return {
    compId,
    compName: entry.compName,
    childIdList: [],
    data: dataNext,
    config: { ...(entry.configTemplate || {}) },
  };
}

// The restore point for one original selection endpoint. When the endpoint's
// segment was rebuilt by the style action, the endpoint maps onto the tracked
// covered-text position; otherwise the endpoint is kept as it was.
function createSelectionRestorePoint(
  pointOriginal: SelectionTrackPoint | null,
  compIdSetRebuilt: Set<string>,
  pointMapped: { compId: string; offset: number } | null,
): SelectionTrackPoint | null {
  const segIdOriginal = String(pointOriginal?.segId || '');
  if (segIdOriginal && !compIdSetRebuilt.has(segIdOriginal)) {
    return {
      compId: String(pointOriginal?.compId || segIdOriginal),
      segId: segIdOriginal,
      offset: Math.max(0, Number(pointOriginal?.offset || 0)),
    };
  }
  if (!pointMapped) return null;
  return {
    compId: pointMapped.compId,
    segId: pointMapped.compId,
    offset: pointMapped.offset,
  };
}

function getChildIdList(compData: CompData | null | undefined) {
  return Array.isArray(compData?.childIdList)
    ? compData.childIdList.map((compId) => String(compId || '')).filter(Boolean)
    : [];
}
