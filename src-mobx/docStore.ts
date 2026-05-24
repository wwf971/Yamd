import { makeAutoObservable } from 'mobx';
import yaml from 'js-yaml';

export type CompEvent = {
  id?: string;
  type: string;
  sourceId: string;
  targetId: string;
  data: any;
};

export type CompEventResult = {
  code: number;
  message: string;
  data?: any;
};

export type TextDocData = {
  docId: string;
  docName: string;
  text: string;
  lastEventType: string;
};

export type TextDocConfig = {
  isEditable: boolean;
};

export type CompData = {
  compId: string;
  compName: string;
  childIdList: string[];
  mainCompId?: string; // only for List.tsx
  data: any;
  config: any;
};

export type FocusState = {
  compIdFocused: string;
  segIdFocused: string;
  offsetFocused: number;
  reasonLast: string;
};

export type ElActiveState = {
  compIdElActive: string;
  versionElActive: number;
};

export type SelectionTrackPoint = {
  compId: string;
  segId: string;
  offset: number;
};

export type SelectionState = {
  isSelectionActive: boolean;
  mode: 'caret' | 'range';
  pointAnchor: SelectionTrackPoint | null;
  pointFocus: SelectionTrackPoint | null;
};

export type CompRuntimeState = {
  isFocusedLogical: boolean;
  isElActive: boolean;
  isFocusWithin: boolean;
  isSelectionWithin: boolean;
};

export type DocInteractionState = {
  focusState: FocusState;
  elActiveState: ElActiveState;
  selectionState: SelectionState;
  runtimeStateByCompId: Record<string, CompRuntimeState>;
};

type CompRegistryEntry = {
  compId: string;
  parentId: string | null;
  eventHandler: (event: CompEvent) => Promise<CompEventResult> | CompEventResult;
};

type DocRecord = {
  data: TextDocData;
  config: TextDocConfig;
  compDataById: Record<string, CompData>;
  compIdRoot: string | null;
  compById: Record<string, CompRegistryEntry>;
  compOrder: string[];
  interactionState: DocInteractionState;
};

const createEventId = (length = 12) => {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};

const createCompRuntimeState = (): CompRuntimeState => ({
  isFocusedLogical: false,
  isElActive: false,
  isFocusWithin: false,
  isSelectionWithin: false,
});

const createInteractionState = (): DocInteractionState => ({
  focusState: {
    compIdFocused: '',
    segIdFocused: '',
    offsetFocused: 0,
    reasonLast: '',
  },
  elActiveState: {
    compIdElActive: '',
    versionElActive: 0,
  },
  selectionState: {
    isSelectionActive: false,
    mode: 'caret',
    pointAnchor: null,
    pointFocus: null,
  },
  runtimeStateByCompId: {},
});

export class DocStore {
  docById: Record<string, DocRecord> = {};

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  ensureDoc(
    docId: string,
    dataInitial: Partial<TextDocData> = {},
    configInitial: Partial<TextDocConfig> = {},
  ) {
    if (this.docById[docId]) {
      return this.docById[docId];
    }

    this.docById[docId] = {
      data: {
        docName: 'text-basic',
        text: '',
        lastEventType: '',
        ...dataInitial,
        docId,
      },
      config: {
        isEditable: true,
        ...configInitial,
      },
      compDataById: {},
      compIdRoot: null,
      compById: {},
      compOrder: [],
      interactionState: createInteractionState(),
    };

    this.syncTextBasicCompData(docId);
    return this.docById[docId];
  }

  getDocData(docId: string) {
    return this.ensureDoc(docId).data;
  }

  getDocConfig(docId: string) {
    return this.ensureDoc(docId).config;
  }

  getInteractionState(docId: string) {
    return this.ensureDoc(docId).interactionState;
  }

  getCompRuntimeState(docId: string, compId: string) {
    const docRecord = this.ensureDoc(docId);
    return docRecord.interactionState.runtimeStateByCompId[compId] || createCompRuntimeState();
  }

  updateFocusState(
    docId: string,
    focusStatePatch: Partial<FocusState>,
  ) {
    const docRecord = this.ensureDoc(docId);
    docRecord.interactionState.focusState = {
      ...docRecord.interactionState.focusState,
      ...focusStatePatch,
    };
    this.syncRuntimeState(docId);
    return { code: 0 };
  }

  updateElActiveState(docId: string, compIdElActive: string) {
    const docRecord = this.ensureDoc(docId);
    const compIdNext = String(compIdElActive || '');
    const elActiveState = docRecord.interactionState.elActiveState;
    docRecord.interactionState.elActiveState = {
      compIdElActive: compIdNext,
      versionElActive: elActiveState.versionElActive + 1,
    };
    this.syncRuntimeState(docId);
    return { code: 0 };
  }

  updateSelectionState(docId: string, selectionStateNext: Partial<SelectionState>) {
    const docRecord = this.ensureDoc(docId);
    docRecord.interactionState.selectionState = {
      ...docRecord.interactionState.selectionState,
      ...selectionStateNext,
    };
    this.syncRuntimeState(docId);
    return { code: 0 };
  }

  clearSelectionState(docId: string) {
    return this.updateSelectionState(docId, {
      isSelectionActive: false,
      mode: 'caret',
      pointAnchor: null,
      pointFocus: null,
    });
  }

  getDocIds() {
    return Object.keys(this.docById);
  }

  isDocDirty(docId: string) {
    this.ensureDoc(docId);
    return false;
  }

  initDoc(docId: string, dataNext: Partial<TextDocData>) {
    const docRecord = this.ensureDoc(docId);
    docRecord.data = {
      ...docRecord.data,
      ...dataNext,
      docId,
      text: dataNext.text ?? docRecord.data.text,
    };
    this.syncTextBasicCompData(docId);
  }

  updateConfig(docId: string, configNext: Partial<TextDocConfig>) {
    const docRecord = this.ensureDoc(docId);
    docRecord.config = { ...docRecord.config, ...configNext };
    this.syncTextBasicCompData(docId);
  }

  updateText(docId: string, textNext: string) {
    const docRecord = this.ensureDoc(docId);
    if (!docRecord.config.isEditable) {
      return { code: -1, message: 'Editing is disabled.' };
    }
    docRecord.data.text = String(textNext ?? '');
    this.syncTextBasicCompData(docId);
    return { code: 0, message: 'Text updated.' };
  }

  updateCompDataByPatch(docId: string, compId: string, dataPatch: Record<string, any>) {
    const docRecord = this.ensureDoc(docId);
    const compData = docRecord.compDataById[compId];
    if (!compData) {
      return { code: -1, message: `Component data not found. compId=${compId}` };
    }
    compData.data = {
      ...compData.data,
      ...(dataPatch || {}),
    };
    if (String(compData.compName || '') === 'TextBasic' && Object.prototype.hasOwnProperty.call(dataPatch || {}, 'text')) {
      return this.updateText(docId, String(dataPatch?.text ?? ''));
    }
    this.syncTextBasicCompData(docId);
    return { code: 0, message: 'Component data updated.' };
  }

  initCompData(
    docId: string,
    compDataByIdInitial: Record<string, CompData>,
    compIdRoot: string,
  ) {
    const docRecord = this.ensureDoc(docId);
    docRecord.compDataById = Object.fromEntries(Object.entries(compDataByIdInitial || {}).map(([compId, compData]) => ([
      compId,
      {
        ...compData,
        childIdList: Array.isArray(compData.childIdList) ? [...compData.childIdList] : [],
        data: { ...(compData.data || {}) },
        config: { ...(compData.config || {}) },
      },
    ])));
    docRecord.compIdRoot = compIdRoot;
    this.syncTextBasicCompData(docId);
    this.syncRuntimeState(docId);
  }

  getCompData(docId: string, compId: string) {
    const docRecord = this.ensureDoc(docId);
    return docRecord.compDataById[compId] || null;
  }

  getCompDataById(docId: string, compId: string) {
    return this.getCompData(docId, compId);
  }

  getCompDataByIdMap(docId: string) {
    return this.ensureDoc(docId).compDataById;
  }

  getParentCompId(docId: string, compId: string) {
    const docRecord = this.ensureDoc(docId);
    const compIdTarget = String(compId || '');
    const compIdList = Object.keys(docRecord.compDataById || {});
    for (const compIdCurrent of compIdList) {
      const compData = docRecord.compDataById[compIdCurrent];
      const childIdList = Array.isArray(compData?.childIdList) ? compData.childIdList.map((id) => String(id || '')) : [];
      if (childIdList.includes(compIdTarget) || String(compData?.mainCompId || '') === compIdTarget) {
        return compIdCurrent;
      }
    }
    return null;
  }

  splitTextSegAtOffset(docId: string, segId: string, offsetRaw: number) {
    const docRecord = this.ensureDoc(docId);
    const segData = docRecord.compDataById[segId];
    if (!segData || String(segData.compName || '') !== 'TextSeg') {
      return { code: -1, message: `Text segment not found. segId=${segId}` };
    }
    const rowId = this.getOwningRowId(docRecord, segId);
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

    const segIdRight = this.createCompId(docRecord, 'seg');
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
    const listIdMain = this.getListIdByMainRowId(docRecord, rowId);
    const listIdParent = this.getOwningListIdForChildEntry(docRecord, rowId);
    if (listIdParent) {
      const rowIdRight = this.createCompId(docRecord, 'row');
      rowData.childIdList = childIdListLeft;
      docRecord.compDataById[rowIdRight] = this.createRowComp(rowIdRight, childIdListRight, rowData);
      this.insertChildAfter(docRecord, listIdParent, rowId, rowIdRight);
    } else if (listIdMain) {
      const listIdParentOfMainList = this.getOwningListIdForChildEntry(docRecord, listIdMain);
      if (listIdParentOfMainList) {
        const rowIdLeft = this.createCompId(docRecord, 'row');
        docRecord.compDataById[rowIdLeft] = this.createRowComp(rowIdLeft, childIdListLeft, rowData);
        rowData.childIdList = childIdListRight;
        this.insertChildBefore(docRecord, listIdParentOfMainList, listIdMain, rowIdLeft);
      } else {
        const rowIdRight = this.createCompId(docRecord, 'row');
        rowData.childIdList = childIdListLeft;
        docRecord.compDataById[rowIdRight] = this.createRowComp(rowIdRight, childIdListRight, rowData);
        this.insertChildAtStart(docRecord, listIdMain, rowIdRight);
      }
    } else {
      return { code: -1, message: `Row is not inside a list. rowId=${rowId}` };
    }

    this.clearSelectionState(docId);
    this.updateFocusState(docId, {
      compIdFocused: segIdRight,
      segIdFocused: segIdRight,
      offsetFocused: 0,
      reasonLast: 'textSplit',
    });
    this.focusCompAfterRender(docId, segIdRight, 0);
    return { code: 0, message: 'Text segment split.', data: { segIdRight } };
  }

  deleteEmptyTextSeg(docId: string, segId: string) {
    const docRecord = this.ensureDoc(docId);
    const rowId = this.getOwningRowId(docRecord, segId);
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
      return this.deleteRowWithOnlySeg(docId, rowId, segId);
    }
    rowData.childIdList = childIdList.filter((id) => id !== segId);
    delete docRecord.compDataById[segId];
    docRecord.compOrder = docRecord.compOrder.filter((id) => id !== segId);
    this.clearSelectionState(docId);
    if (segIdPrev) {
      const textPrev = String(docRecord.compDataById[segIdPrev]?.data?.text || '');
      this.updateFocusState(docId, {
        compIdFocused: segIdPrev,
        segIdFocused: segIdPrev,
        offsetFocused: textPrev.length,
        reasonLast: 'textDeleteEmpty',
      });
      this.focusCompAfterRender(docId, segIdPrev, textPrev.length);
      return { code: 0, message: 'Empty text segment deleted.', data: { segIdFocused: segIdPrev } };
    }
    if (segIdNext) {
      this.updateFocusState(docId, {
        compIdFocused: segIdNext,
        segIdFocused: segIdNext,
        offsetFocused: 0,
        reasonLast: 'textDeleteEmpty',
      });
      this.focusCompAfterRender(docId, segIdNext, 0);
      return { code: 0, message: 'Empty text segment deleted.', data: { segIdFocused: segIdNext } };
    }
    this.updateFocusState(docId, {
      compIdFocused: rowId,
      segIdFocused: '',
      offsetFocused: 0,
      reasonLast: 'textDeleteEmpty',
    });
    this.focusCompAfterRender(docId, rowId, 0);
    return { code: 0, message: 'Empty text segment deleted.', data: { rowIdFocused: rowId } };
  }

  deleteRowWithOnlySeg(docId: string, rowId: string, segId: string) {
    const docRecord = this.ensureDoc(docId);
    const rowIdList = this.collectRowIdsInDocOrder(docRecord);
    const rowIndex = rowIdList.indexOf(rowId);
    const rowIdPrev = rowIndex > 0 ? rowIdList[rowIndex - 1] : '';
    const rowIdNext = rowIndex !== -1 ? rowIdList[rowIndex + 1] || '' : '';
    const listIdParent = this.getOwningListIdForChildEntry(docRecord, rowId);
    const listIdMain = this.getListIdByMainRowId(docRecord, rowId);
    if (listIdParent) {
      this.removeEntryFromParentList(docRecord, listIdParent, rowId);
    } else if (listIdMain) {
      const listData = docRecord.compDataById[listIdMain];
      const childIdList = Array.isArray(listData?.childIdList) ? listData.childIdList.map((id) => String(id || '')) : [];
      const rowIdReplacement = childIdList.find((childId) => String(docRecord.compDataById[childId]?.compName || '') === 'Row') || '';
      if (rowIdReplacement) {
        listData.mainCompId = rowIdReplacement;
        listData.childIdList = childIdList.filter((childId) => childId !== rowIdReplacement);
      } else {
        const listIdParentOfList = this.getOwningListIdForChildEntry(docRecord, listIdMain);
        if (listIdParentOfList) {
          this.removeEntryFromParentList(docRecord, listIdParentOfList, listIdMain);
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
    this.clearSelectionState(docId);
    const rowIdFocus = rowIdPrev || rowIdNext;
    if (rowIdFocus) {
      const segIdFocus = this.getLastSegIdInRow(docRecord, rowIdFocus) || this.getFirstSegIdInRow(docRecord, rowIdFocus);
      if (segIdFocus) {
        const textFocus = String(docRecord.compDataById[segIdFocus]?.data?.text || '');
        const offsetFocus = rowIdPrev ? textFocus.length : 0;
        this.updateFocusState(docId, {
          compIdFocused: segIdFocus,
          segIdFocused: segIdFocus,
          offsetFocused: offsetFocus,
          reasonLast: 'rowDeleteEmpty',
        });
        this.focusCompAfterRender(docId, segIdFocus, offsetFocus);
        return { code: 0, message: 'Empty row deleted.', data: { segIdFocused: segIdFocus } };
      }
    }
    this.updateFocusState(docId, {
      compIdFocused: '',
      segIdFocused: '',
      offsetFocused: 0,
      reasonLast: 'rowDeleteEmpty',
    });
    return { code: 0, message: 'Empty row deleted.' };
  }

  getSelectionText(docId: string) {
    const docRecord = this.ensureDoc(docId);
    const selectionState = docRecord.interactionState.selectionState;
    const pointA = selectionState.pointAnchor;
    const pointB = selectionState.pointFocus;
    if (!pointA || !pointB) return '';
    const segIdList = this.collectTextSegIdsInDocOrder(docRecord);
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
      const rowIdCurrent = this.getOwningRowId(docRecord, segIdCurrent);
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

  mergeRowWithPreviousBySegId(docId: string, segId: string) {
    const docRecord = this.ensureDoc(docId);
    const rowId = this.getOwningRowId(docRecord, segId);
    const rowData = rowId ? docRecord.compDataById[rowId] : null;
    if (!rowData || String(rowData.compName || '') !== 'Row') {
      return { code: -1, message: `Owning row not found. segId=${segId}` };
    }
    const childIdList = Array.isArray(rowData.childIdList) ? rowData.childIdList.map((id) => String(id || '')) : [];
    if (childIdList[0] !== segId) {
      return { code: -1, message: 'Only the first segment can merge with previous row.' };
    }
    const mergeTarget = this.getPreviousRowMergeTarget(docRecord, rowId);
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
    this.removeEntryFromParentList(docRecord, mergeTarget.listIdParent, mergeTarget.entryId);
    delete docRecord.compDataById[rowId];
    docRecord.compOrder = docRecord.compOrder.filter((id) => id !== rowId);
    this.clearSelectionState(docId);
    this.updateFocusState(docId, {
      compIdFocused: segIdPrevLast,
      segIdFocused: segIdPrevLast,
      offsetFocused,
      reasonLast: 'textMergePrev',
    });
    this.focusCompAfterRender(docId, segIdPrevLast, offsetFocused);
    return { code: 0, message: 'Row merged with previous row.', data: { segIdFocused: segIdPrevLast } };
  }

  indentEntryBySegId(docId: string, segId: string) {
    const docRecord = this.ensureDoc(docId);
    const rowId = this.getOwningRowId(docRecord, segId);
    if (!rowId) {
      return { code: -1, message: `Owning row not found. segId=${segId}` };
    }
    const listIdMain = this.getListIdByMainRowId(docRecord, rowId);
    const entryId = listIdMain && this.getOwningListIdForChildEntry(docRecord, listIdMain) ? listIdMain : rowId;
    const listIdParent = this.getOwningListIdForChildEntry(docRecord, entryId);
    const listParent = listIdParent ? docRecord.compDataById[listIdParent] : null;
    const childIdList = Array.isArray(listParent?.childIdList) ? listParent.childIdList.map((id) => String(id || '')) : [];
    const entryIndex = childIdList.indexOf(entryId);
    if (!listParent || entryIndex <= 0) {
      return { code: -1, message: 'Cannot indent entry.' };
    }
    const entryIdPrev = childIdList[entryIndex - 1];
    const entryPrev = docRecord.compDataById[entryIdPrev];
    if (!entryPrev) {
      return { code: -1, message: `Previous entry not found. compId=${entryIdPrev}` };
    }
    const entryData = docRecord.compDataById[entryId];
    const childIdListFormer = String(entryData?.compName || '') === 'List' && Array.isArray(entryData.childIdList)
      ? entryData.childIdList.map((id) => String(id || ''))
      : [];
    if (String(entryData?.compName || '') === 'List') {
      entryData.childIdList = [];
    }
    if (String(entryPrev.compName || '') === 'List') {
      listParent.childIdList = childIdList.filter((id) => id !== entryId);
      entryPrev.childIdList = [
        ...(Array.isArray(entryPrev.childIdList) ? entryPrev.childIdList : []),
        entryId,
        ...childIdListFormer,
      ];
    } else if (String(entryPrev.compName || '') === 'Row') {
      const listIdWrapped = this.createCompId(docRecord, 'list');
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
    } else {
      return { code: -1, message: `Previous entry cannot receive children. compId=${entryIdPrev}` };
    }
    this.clearSelectionState(docId);
    this.updateFocusState(docId, {
      compIdFocused: segId,
      segIdFocused: segId,
      offsetFocused: this.getInteractionState(docId).focusState.offsetFocused,
      reasonLast: 'rowIndent',
    });
    this.focusCompAfterRender(docId, segId, this.getInteractionState(docId).focusState.offsetFocused);
    return { code: 0, message: 'Entry indented.' };
  }

  outdentEntryBySegId(docId: string, segId: string) {
    const docRecord = this.ensureDoc(docId);
    const rowId = this.getOwningRowId(docRecord, segId);
    if (!rowId) {
      return { code: -1, message: `Owning row not found. segId=${segId}` };
    }
    const listIdMain = this.getListIdByMainRowId(docRecord, rowId);
    const entryId = listIdMain && this.getOwningListIdForChildEntry(docRecord, listIdMain) ? listIdMain : rowId;
    const listIdParent = this.getOwningListIdForChildEntry(docRecord, entryId);
    const listIdGrandparent = listIdParent ? this.getOwningListIdForChildEntry(docRecord, listIdParent) : '';
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
      entryData.childIdList = [...(Array.isArray(entryData.childIdList) ? entryData.childIdList : []), ...childIdListFollowing];
    } else if (childIdListFollowing.length > 0) {
      entryIdMoved = this.createCompId(docRecord, 'list');
      docRecord.compDataById[entryIdMoved] = {
        compId: entryIdMoved,
        compName: 'List',
        mainCompId: entryId,
        childIdList: childIdListFollowing,
        data: {},
        config: {},
      };
    }
    this.insertChildAfter(docRecord, listIdGrandparent, listIdParent, entryIdMoved);
    this.clearSelectionState(docId);
    this.updateFocusState(docId, {
      compIdFocused: segId,
      segIdFocused: segId,
      offsetFocused: this.getInteractionState(docId).focusState.offsetFocused,
      reasonLast: 'rowOutdent',
    });
    this.focusCompAfterRender(docId, segId, this.getInteractionState(docId).focusState.offsetFocused);
    return { code: 0, message: 'Entry outdented.' };
  }

  getDocYamlRaw(docId: string) {
    const docRecord = this.ensureDoc(docId);
    const compDataByIdCurrent = docRecord.compDataById || {};
    const compDataByIdExtracted: Record<string, CompData> = {};
    const compIdRoot = String(docRecord.compIdRoot || '').trim();
    const stack = compIdRoot ? [compIdRoot] : [];
    const visited = new Set<string>();
    while (stack.length > 0) {
      const compId = String(stack.pop() || '');
      if (!compId || visited.has(compId)) continue;
      visited.add(compId);
      const compData = compDataByIdCurrent[compId];
      if (!compData) continue;
      compDataByIdExtracted[compId] = {
        compId: compData.compId,
        compName: compData.compName,
        childIdList: Array.isArray(compData.childIdList) ? [...compData.childIdList] : [],
        mainCompId: compData.mainCompId ? String(compData.mainCompId) : undefined,
        data: { ...(compData.data || {}) },
        config: { ...(compData.config || {}) },
      };
      const childIdList = Array.isArray(compData.childIdList) ? compData.childIdList : [];
      for (let i = childIdList.length - 1; i >= 0; i -= 1) {
        stack.push(String(childIdList[i]));
      }
      const mainCompId = String(compData.mainCompId || '').trim();
      if (mainCompId) {
        stack.push(mainCompId);
      }
    }
    const dataYaml = {
      docName: docRecord.data.docName,
      dataDocInitial: {
        text: docRecord.data.text,
      },
      configDocInitial: {
        isEditable: docRecord.config.isEditable,
      },
      compIdRoot: compIdRoot || null,
      compById: compDataByIdExtracted,
    };
    return yaml.dump(dataYaml, { lineWidth: 120, noRefs: true });
  }

  getCompDataRoot(docId: string) {
    const docRecord = this.ensureDoc(docId);
    if (!docRecord.compIdRoot) return null;
    return this.getCompData(docId, docRecord.compIdRoot);
  }

  registerComp(
    docId: string,
    compId: string,
    eventHandler: (event: CompEvent) => Promise<CompEventResult> | CompEventResult,
    options: { parentId?: string | null } = {},
  ) {
    const docRecord = this.ensureDoc(docId);
    if (!docRecord.compOrder.includes(compId)) {
      docRecord.compOrder.push(compId);
    }
    docRecord.compById[compId] = {
      compId,
      parentId: options.parentId ?? null,
      eventHandler,
    };
  }

  unregisterComp(docId: string, compId: string) {
    const docRecord = this.ensureDoc(docId);
    delete docRecord.compById[compId];
    docRecord.compOrder = docRecord.compOrder.filter((id) => id !== compId);
  }

  async sendEventToComp(docId: string, compId: string, event: CompEvent): Promise<CompEventResult> {
    const docRecord = this.ensureDoc(docId);
    const compEntry = docRecord.compById[compId];
    if (!compEntry) {
      return { code: -1, message: `Component not found. compId=${compId}` };
    }

    const targetId = String(event?.targetId || '').trim();
    if (targetId && targetId !== docId) {
      return { code: -1, message: `Target mismatch. targetId=${targetId}, docId=${docId}` };
    }

    const eventNormalized = this.normalizeEvent(docId, event);

    const result = await compEntry.eventHandler(eventNormalized);
    const isHandled = result?.code === 0;
    if (isHandled) {
      return result;
    }

    return this.routeEventDefault(docId, compId, eventNormalized);
  }

  async sendEventToCompDirect(docId: string, compId: string, event: CompEvent): Promise<CompEventResult> {
    const docRecord = this.ensureDoc(docId);
    const compEntry = docRecord.compById[compId];
    if (!compEntry) {
      return { code: -1, message: `Component not found. compId=${compId}` };
    }

    const targetId = String(event?.targetId || '').trim();
    if (targetId && targetId !== docId) {
      return { code: -1, message: `Target mismatch. targetId=${targetId}, docId=${docId}` };
    }

    const eventNormalized = this.normalizeEvent(docId, event);
    return compEntry.eventHandler(eventNormalized);
  }

  async sendEventToParent(docId: string, compId: string, event: CompEvent): Promise<CompEventResult> {
    const docRecord = this.ensureDoc(docId);
    const compEntry = docRecord.compById[compId];
    if (!compEntry) {
      return { code: -1, message: `Component not found. compId=${compId}` };
    }
    const parentId = compEntry.parentId;
    if (!parentId) {
      return { code: -1, message: `No parent component. compId=${compId}` };
    }
    return this.sendEventToComp(docId, parentId, event);
  }

  async sendEventToDoc(docId: string, event: CompEvent): Promise<CompEventResult> {
    const docRecord = this.ensureDoc(docId);
    const dataDoc = docRecord.data;
    const eventNormalized = this.normalizeEvent(docId, event);
    dataDoc.lastEventType = eventNormalized.type;

    const compIdTarget = this.pickDocEventTarget(docRecord, eventNormalized);
    if (!compIdTarget) {
      return { code: -1, message: `No document event target. type=${eventNormalized.type}` };
    }

    const eventForwarded = this.rewriteDocEventForTarget(docRecord, eventNormalized, compIdTarget);
    if (this.isStoreOwnedEvent(eventForwarded.type)) {
      return this.receiveEvent(docId, eventForwarded);
    }
    return this.sendEventToComp(docId, compIdTarget, eventForwarded);
  }

  async receiveEvent(docId: string, event: CompEvent): Promise<CompEventResult> {
    const docRecord = this.ensureDoc(docId);
    const dataDoc = docRecord.data;
    const eventNormalized = this.normalizeEvent(docId, event);
    dataDoc.lastEventType = eventNormalized.type;

    if (eventNormalized.type === 'sendEventToTarget') {
      const compIdTarget = String(eventNormalized?.data?.compIdTarget || '').trim();
      const eventTarget = eventNormalized?.data?.event;
      if (!compIdTarget || !eventTarget) {
        return { code: -1, message: 'sendEventToTarget requires compIdTarget and event.' };
      }
      return this.sendEventToCompDirect(docId, compIdTarget, eventTarget);
    }

    if (eventNormalized.type === 'sendEventToDoc') {
      const eventTarget = eventNormalized?.data?.event;
      if (!eventTarget) {
        return { code: -1, message: 'sendEventToDoc requires event.' };
      }
      return this.sendEventToDoc(docId, eventTarget);
    }

    if (eventNormalized.type === 'focus') {
      this.updateFocusState(docId, {
        compIdFocused: eventNormalized.sourceId,
        segIdFocused: String(eventNormalized?.data?.segId || ''),
        offsetFocused: Number(eventNormalized?.data?.offset || 0),
        reasonLast: String(eventNormalized?.data?.reason || eventNormalized.type),
      });
      return { code: 0, message: 'Focus event received.' };
    }

    if (eventNormalized.type === 'unfocus') {
      const resultParent = await this.sendEventToParent(docId, eventNormalized.sourceId, eventNormalized);
      if (resultParent.code === 0) {
        return resultParent;
      }
      return this.routeEventDefault(docId, eventNormalized.sourceId, eventNormalized);
    }

    if (eventNormalized.type === 'clickSingle') {
      this.updateFocusState(docId, {
        compIdFocused: eventNormalized.sourceId,
        segIdFocused: String(eventNormalized?.data?.segId || ''),
        offsetFocused: Number(eventNormalized?.data?.offset || 0),
        reasonLast: String(eventNormalized?.data?.reason || eventNormalized.type),
      });
      return { code: 0, message: 'Click event received.' };
    }

    if (eventNormalized.type === 'keyDown') {
      return { code: 0, message: 'Key down event received.' };
    }

    if (eventNormalized.type === 'textSplit') {
      const segId = String(eventNormalized?.data?.segId || eventNormalized.sourceId || '');
      return this.splitTextSegAtOffset(docId, segId, Number(eventNormalized?.data?.offset || 0));
    }

    if (eventNormalized.type === 'textDeleteEmpty') {
      const segId = String(eventNormalized?.data?.segId || eventNormalized.sourceId || '');
      return this.deleteEmptyTextSeg(docId, segId);
    }

    if (eventNormalized.type === 'segDelete') {
      const segId = String(eventNormalized?.data?.segId || eventNormalized.sourceId || '');
      return this.deleteEmptyTextSeg(docId, segId);
    }

    if (eventNormalized.type === 'textMergePrev') {
      const segId = String(eventNormalized?.data?.segId || eventNormalized.sourceId || '');
      return this.mergeRowWithPreviousBySegId(docId, segId);
    }

    if (eventNormalized.type === 'rowIndent') {
      const segId = String(eventNormalized?.data?.segId || eventNormalized.sourceId || '');
      return this.indentEntryBySegId(docId, segId);
    }

    if (eventNormalized.type === 'rowOutdent') {
      const segId = String(eventNormalized?.data?.segId || eventNormalized.sourceId || '');
      return this.outdentEntryBySegId(docId, segId);
    }

    if (eventNormalized.type === 'segNavigate' || eventNormalized.type === 'rowNavigate') {
      return this.sendEventToParent(docId, eventNormalized.sourceId, eventNormalized);
    }

    return { code: -1, message: `Unsupported event: ${eventNormalized.type}` };
  }

  async onEvent(docId: string, event: CompEvent): Promise<CompEventResult> {
    return this.receiveEvent(docId, event);
  }

  private async routeEventDefault(docId: string, compId: string, event: CompEvent): Promise<CompEventResult> {
    const docRecord = this.ensureDoc(docId);
    if (event.type !== 'unfocus') {
      return { code: -1, message: `Unhandled event. type=${event.type}` };
    }

    const direction = String(event?.data?.direction || '');
    const compIndex = docRecord.compOrder.indexOf(compId);
    if (compIndex === -1) {
      return { code: -1, message: `Component not in order list. compId=${compId}` };
    }

    if (direction === 'left' && compIndex > 0) {
      const compIdPrev = docRecord.compOrder[compIndex - 1];
      return this.sendEventToComp(docId, compIdPrev, {
        type: 'focus',
        sourceId: event.sourceId,
        targetId: docId,
        data: { direction: 'fromRight' },
      });
    }

    if (direction === 'right' && compIndex < docRecord.compOrder.length - 1) {
      const compIdNext = docRecord.compOrder[compIndex + 1];
      return this.sendEventToComp(docId, compIdNext, {
        type: 'focus',
        sourceId: event.sourceId,
        targetId: docId,
        data: { direction: 'fromLeft' },
      });
    }

    if (direction === 'up' || direction === 'down') {
      return this.sendEventToParent(docId, compId, event);
    }

    return { code: -1, message: `No default route for direction=${direction}` };
  }

  private normalizeEvent(docId: string, event: CompEvent): CompEvent {
    return {
      id: String(event?.id || createEventId()),
      type: String(event?.type || ''),
      sourceId: String(event?.sourceId || 'unknown'),
      targetId: docId,
      data: event?.data ?? {},
    };
  }

  private pickDocEventTarget(docRecord: DocRecord, event: CompEvent) {
    const compIdExplicit = String(event?.data?.compIdTarget || '').trim();
    if (compIdExplicit && docRecord.compDataById[compIdExplicit]) {
      return compIdExplicit;
    }

    const focusState = docRecord.interactionState.focusState;
    if (this.shouldDocEventPreferFocusedSeg(event.type)) {
      const segIdFocused = String(focusState.segIdFocused || '');
      if (this.isCompName(docRecord, segIdFocused, 'TextSeg')) {
        return segIdFocused;
      }
      const compIdFocused = String(focusState.compIdFocused || '');
      if (this.isCompName(docRecord, compIdFocused, 'TextSeg')) {
        return compIdFocused;
      }
    }

    const compIdRoot = String(docRecord.compIdRoot || '');
    const compIdMain = this.findFirstDocEventTargetFromComp(docRecord, compIdRoot);
    if (compIdMain) {
      return compIdMain;
    }

    return this.collectTextSegIdsInDocOrder(docRecord)[0] || String(focusState.compIdFocused || '');
  }

  private rewriteDocEventForTarget(docRecord: DocRecord, event: CompEvent, compIdTarget: string): CompEvent {
    const compIdSource = this.getSourceCompIdForDocEvent(docRecord, event, compIdTarget);
    return {
      ...event,
      sourceId: compIdSource,
      data: {
        ...(event.data || {}),
        ...(this.isCompName(docRecord, compIdSource, 'TextSeg') ? { segId: compIdSource } : {}),
      },
    };
  }

  private getSourceCompIdForDocEvent(docRecord: DocRecord, event: CompEvent, compIdTarget: string) {
    if (!this.isStoreOwnedEvent(event.type)) {
      return compIdTarget;
    }
    const focusState = docRecord.interactionState.focusState;
    const segIdFocused = String(focusState.segIdFocused || '');
    if (this.isCompName(docRecord, segIdFocused, 'TextSeg')) {
      return segIdFocused;
    }
    if (this.isCompName(docRecord, compIdTarget, 'TextSeg')) {
      return compIdTarget;
    }
    return this.collectTextSegIdsInDocOrder(docRecord)[0] || compIdTarget;
  }

  private shouldDocEventPreferFocusedSeg(type: string) {
    return [
      'textSplit',
      'textDeleteEmpty',
      'segDelete',
      'textMergePrev',
      'rowIndent',
      'rowOutdent',
      'segNavigate',
      'rowNavigate',
    ].includes(type);
  }

  private isStoreOwnedEvent(type: string) {
    return [
      'textSplit',
      'textDeleteEmpty',
      'segDelete',
      'textMergePrev',
      'rowIndent',
      'rowOutdent',
    ].includes(type);
  }

  private findFirstDocEventTargetFromComp(docRecord: DocRecord, compId: string): string {
    const compData = docRecord.compDataById[compId];
    if (!compData) return '';
    const compName = String(compData.compName || '');
    if (['TextBasic', 'List', 'Row', 'TextSeg'].includes(compName)) {
      return compId;
    }
    const childIdList = [
      String(compData.mainCompId || ''),
      ...(Array.isArray(compData.childIdList) ? compData.childIdList.map((id) => String(id || '')) : []),
    ].filter(Boolean);
    for (const childId of childIdList) {
      const compIdFound = this.findFirstDocEventTargetFromComp(docRecord, childId);
      if (compIdFound) {
        return compIdFound;
      }
    }
    return '';
  }

  private isCompName(docRecord: DocRecord, compId: string, compName: string) {
    if (!compId) return false;
    return String(docRecord.compDataById[compId]?.compName || '') === compName;
  }

  private createCompId(docRecord: DocRecord, prefix: string) {
    let compId = `${prefix}-${createEventId(8)}`;
    while (docRecord.compDataById[compId]) {
      compId = `${prefix}-${createEventId(8)}`;
    }
    return compId;
  }

  private createRowComp(rowId: string, childIdList: string[], rowDataTemplate: CompData): CompData {
    return {
      compId: rowId,
      compName: 'Row',
      childIdList,
      data: { ...(rowDataTemplate.data || {}) },
      config: { ...(rowDataTemplate.config || {}) },
    };
  }

  private getOwningRowId(docRecord: DocRecord, segId: string) {
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

  private getFirstSegIdInRow(docRecord: DocRecord, rowId: string) {
    const rowData = docRecord.compDataById[rowId];
    const childIdList = Array.isArray(rowData?.childIdList) ? rowData.childIdList.map((id) => String(id || '')) : [];
    return childIdList.find((childId) => String(docRecord.compDataById[childId]?.compName || '') === 'TextSeg') || '';
  }

  private getLastSegIdInRow(docRecord: DocRecord, rowId: string) {
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

  private collectRowIdsInDocOrder(docRecord: DocRecord) {
    const compIdRoot = String(docRecord.compIdRoot || '');
    const rowIdList: string[] = [];
    this.collectRowIdsFromComp(docRecord, compIdRoot, rowIdList);
    return rowIdList;
  }

  private collectRowIdsFromComp(docRecord: DocRecord, compId: string, rowIdList: string[]) {
    const compData = docRecord.compDataById[compId];
    if (!compData) return;
    if (String(compData.compName || '') === 'Row') {
      rowIdList.push(compId);
      return;
    }
    const mainCompId = String(compData.mainCompId || '');
    if (mainCompId) {
      this.collectRowIdsFromComp(docRecord, mainCompId, rowIdList);
    }
    const childIdList = Array.isArray(compData.childIdList) ? compData.childIdList.map((id) => String(id || '')) : [];
    for (const childId of childIdList) {
      this.collectRowIdsFromComp(docRecord, childId, rowIdList);
    }
  }

  private collectTextSegIdsInDocOrder(docRecord: DocRecord) {
    const compIdRoot = String(docRecord.compIdRoot || '');
    const segIdList: string[] = [];
    this.collectTextSegIdsFromComp(docRecord, compIdRoot, segIdList);
    return segIdList;
  }

  private collectTextSegIdsFromComp(docRecord: DocRecord, compId: string, segIdList: string[]) {
    const compData = docRecord.compDataById[compId];
    if (!compData) return;
    if (String(compData.compName || '') === 'TextSeg') {
      segIdList.push(compId);
      return;
    }
    const mainCompId = String(compData.mainCompId || '');
    if (mainCompId) {
      this.collectTextSegIdsFromComp(docRecord, mainCompId, segIdList);
    }
    const childIdList = Array.isArray(compData.childIdList) ? compData.childIdList.map((id) => String(id || '')) : [];
    for (const childId of childIdList) {
      this.collectTextSegIdsFromComp(docRecord, childId, segIdList);
    }
  }

  private getListIdByMainRowId(docRecord: DocRecord, rowId: string) {
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

  private getOwningListIdForChildEntry(docRecord: DocRecord, entryId: string) {
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

  private getPreviousRowMergeTarget(docRecord: DocRecord, rowId: string) {
    const listIdParent = this.getOwningListIdForChildEntry(docRecord, rowId);
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
    const listIdMain = this.getListIdByMainRowId(docRecord, rowId);
    const listIdParentOfList = listIdMain ? this.getOwningListIdForChildEntry(docRecord, listIdMain) : '';
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

  private removeEntryFromParentList(docRecord: DocRecord, listIdParent: string, entryId: string) {
    const listParent = docRecord.compDataById[listIdParent];
    if (!listParent) return;
    const childIdList = Array.isArray(listParent.childIdList) ? listParent.childIdList.map((id) => String(id || '')) : [];
    listParent.childIdList = childIdList.filter((id) => id !== entryId);
  }

  private insertChildAfter(docRecord: DocRecord, listId: string, childIdRef: string, childIdNext: string) {
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

  private insertChildBefore(docRecord: DocRecord, listId: string, childIdRef: string, childIdNext: string) {
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

  private insertChildAtStart(docRecord: DocRecord, listId: string, childIdNext: string) {
    const listData = docRecord.compDataById[listId];
    if (!listData) return;
    const childIdList = Array.isArray(listData.childIdList) ? listData.childIdList.map((id) => String(id || '')) : [];
    listData.childIdList = [childIdNext, ...childIdList.filter((id) => id !== childIdNext)];
  }

  private focusCompAfterRender(docId: string, segId: string, offset: number) {
    const schedule = typeof window !== 'undefined' ? window.setTimeout : setTimeout;
    schedule(() => {
      void this.sendEventToComp(docId, segId, {
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

  private syncRuntimeState(docId: string) {
    const docRecord = this.ensureDoc(docId);
    const compIdList = Object.keys(docRecord.compDataById || {});
    const focusState = docRecord.interactionState.focusState;
    const elActiveState = docRecord.interactionState.elActiveState;
    const selectionState = docRecord.interactionState.selectionState;
    const compIdSelectionList = [
      selectionState.pointAnchor?.compId || '',
      selectionState.pointFocus?.compId || '',
    ].filter(Boolean);
    const runtimeStateByCompId: Record<string, CompRuntimeState> = {};
    for (const compId of compIdList) {
      runtimeStateByCompId[compId] = {
        isFocusedLogical: focusState.compIdFocused === compId || focusState.segIdFocused === compId,
        isElActive: elActiveState.compIdElActive === compId,
        isFocusWithin: this.isCompDescendantOrSelf(docRecord, compId, focusState.compIdFocused)
          || this.isCompDescendantOrSelf(docRecord, compId, focusState.segIdFocused),
        isSelectionWithin: compIdSelectionList.some((compIdSelection) => (
          this.isCompDescendantOrSelf(docRecord, compId, compIdSelection)
        )),
      };
    }
    docRecord.interactionState.runtimeStateByCompId = runtimeStateByCompId;
  }

  private isCompDescendantOrSelf(docRecord: DocRecord, compIdAncestor: string, compIdTarget: string) {
    const ancestorId = String(compIdAncestor || '');
    const targetId = String(compIdTarget || '');
    if (!ancestorId || !targetId) return false;
    if (ancestorId === targetId) return true;
    const compDataAncestor = docRecord.compDataById[ancestorId];
    if (!compDataAncestor) return false;
    const stack = [
      ...(Array.isArray(compDataAncestor.childIdList) ? compDataAncestor.childIdList : []),
      String(compDataAncestor.mainCompId || ''),
    ].filter(Boolean);
    const visited = new Set<string>();
    while (stack.length > 0) {
      const compIdNext = String(stack.pop() || '');
      if (!compIdNext || visited.has(compIdNext)) continue;
      if (compIdNext === targetId) return true;
      visited.add(compIdNext);
      const compDataNext = docRecord.compDataById[compIdNext];
      if (!compDataNext) continue;
      const childIdList = Array.isArray(compDataNext.childIdList) ? compDataNext.childIdList : [];
      for (const childId of childIdList) {
        stack.push(String(childId || ''));
      }
      if (compDataNext.mainCompId) {
        stack.push(String(compDataNext.mainCompId));
      }
    }
    return false;
  }

  private syncTextBasicCompData(docId: string) {
    const docRecord = this.ensureDoc(docId);
    const dataDoc = docRecord.data;
    const configDoc = docRecord.config;
    const compIdList = Object.keys(docRecord.compDataById || {});
    for (const compId of compIdList) {
      const compData = docRecord.compDataById[compId];
      if (String(compData?.compName || '') !== 'TextBasic') {
        continue;
      }
      compData.data = {
        ...compData.data,
        text: dataDoc.text,
        sourceId: compData.compId,
        targetId: docId,
      };
      compData.config = {
        ...compData.config,
        isEditable: configDoc.isEditable,
      };
    }
  }
}

export const createDocStore = (
  dataInitial: Partial<TextDocData> = {},
  configInitial: Partial<TextDocConfig> = {},
) => {
  const store = new DocStore();
  const docId = String(dataInitial.docId || 'mobx-doc');
  store.ensureDoc(docId, dataInitial, configInitial);
  store.initDoc(docId, dataInitial);
  store.updateConfig(docId, configInitial);
  return store;
};
