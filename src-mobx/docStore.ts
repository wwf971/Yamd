import { makeAutoObservable } from 'mobx';
import yaml from 'js-yaml';
import {
  docStoreOnEvent,
  docStoreReceiveEvent,
  docStoreSendEventToComp,
  docStoreSendEventToCompDirect,
  docStoreSendEventToDoc,
  docStoreSendEventToParent,
} from './event/eventLogicDoc';
import {
  docStoreGetCompBulletPosState,
  docStorePickCompBulletProviderId,
  docStoreRequestCompBulletPos,
  docStoreUpdateCompBulletPosResult,
} from './docStoreBulletPos';
import {
  docStoreApplyCompEditResult,
  docStoreApplyFocusAfterEdit,
  docStoreIndentEntryByRowId,
  docStoreIndentEntryBySegId,
  docStoreInsertChildAfter,
  docStoreOutdentEntryBySegId,
  docStoreOutdentEntryByRowId,
  docStoreRemoveCompSubtree,
  docStoreReplaceChildRange,
  docStoreReplaceCompData,
} from './docStoreEdit';
import {
  docStoreGetSelectionMarkdownText,
  docStoreGetSelectionMarkdownTextSync,
  docStoreGetSelectionText,
  docStorePasteText,
} from './docStoreEditCopyPaste';
import type {
  CompBulletPosState,
  CompData,
  CompEditResult,
  CompEvent,
  CompEventResult,
  CompFocusTarget,
  CompRuntimeState,
  DocInteractionState,
  DocRecord,
  FocusState,
  SelectionState,
  TextDocConfig,
  TextDocData,
} from './docStoreTypes';
export type {
  CompBulletPosState,
  CompData,
  CompEditResult,
  CompEvent,
  CompEventResult,
  CompFocusTarget,
  CompRegistryEntry,
  CompRuntimeState,
  DocInteractionState,
  DocRecord,
  ElActiveState,
  FocusState,
  SelectionState,
  SelectionTrackPoint,
  TextDocConfig,
  TextDocData,
} from './docStoreTypes';

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
  bulletPosStateByCompId: {},
});

export class DocStore {
  docById: Record<string, DocRecord> = {};

  compElementByDocId: Record<string, Record<string, HTMLElement>> = {};

  constructor() {
    makeAutoObservable(this, {
      compElementByDocId: false,
    }, { autoBind: true });
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

  getCompBulletPosState(docId: string, compId: string) {
    return docStoreGetCompBulletPosState(this, docId, compId);
  }

  registerCompElement(docId: string, compId: string, element: HTMLElement | null) {
    const docIdSafe = String(docId || '');
    const compIdSafe = String(compId || '');
    if (!docIdSafe || !compIdSafe || !element) return;
    if (!this.compElementByDocId[docIdSafe]) {
      this.compElementByDocId[docIdSafe] = {};
    }
    this.compElementByDocId[docIdSafe][compIdSafe] = element;
  }

  unregisterCompElement(docId: string, compId: string, element?: HTMLElement | null) {
    const docIdSafe = String(docId || '');
    const compIdSafe = String(compId || '');
    const elementCurrent = this.compElementByDocId[docIdSafe]?.[compIdSafe];
    if (!elementCurrent) return;
    if (element && elementCurrent !== element) return;
    delete this.compElementByDocId[docIdSafe][compIdSafe];
  }

  getCompElement(docId: string, compId: string) {
    return this.compElementByDocId[String(docId || '')]?.[String(compId || '')] || null;
  }

  requestCompBulletPos(
    docId: string,
    compIdTarget: string,
    request: Partial<CompBulletPosState> = {},
  ) {
    return docStoreRequestCompBulletPos(this, docId, compIdTarget, request);
  }

  updateCompBulletPosResult(
    docId: string,
    compIdTarget: string,
    result: Partial<CompBulletPosState> = {},
  ) {
    return docStoreUpdateCompBulletPosResult(this, docId, compIdTarget, result);
  }

  pickCompBulletProviderId(docId: string, compId: string) {
    return docStorePickCompBulletProviderId(this, docId, compId);
  }

  updateFocusState(
    docId: string,
    focusStatePatch: Partial<FocusState>,
  ) {
    const docRecord = this.ensureDoc(docId);
    const focusStateCurrent = docRecord.interactionState.focusState;
    const focusStateNext = normalizeFocusState(focusStateCurrent, focusStatePatch);
    if (isFocusStateSame(focusStateCurrent, focusStateNext)) {
      return { code: 0 };
    }
    const isRuntimeSyncNeeded = focusStateCurrent.compIdFocused !== focusStateNext.compIdFocused
      || focusStateCurrent.segIdFocused !== focusStateNext.segIdFocused;
    applyFocusStateNext(focusStateCurrent, focusStateNext);
    if (isRuntimeSyncNeeded) {
      this.syncRuntimeState(docId);
    }
    return { code: 0 };
  }

  compIdFocus(docId: string, compId: string, reason = 'compIdFocus', offsetFocused?: number) {
    const docRecord = this.ensureDoc(docId);
    const offsetFocusedNext = Number.isFinite(offsetFocused)
      ? Number(offsetFocused)
      : Number(docRecord.interactionState.focusState.offsetFocused || 0);
    return this.updateFocusState(docId, {
      compIdFocused: String(compId || ''),
      segIdFocused: '',
      offsetFocused: offsetFocusedNext,
      reasonLast: reason,
    });
  }

  segFocus(docId: string, segId: string, offsetFocused = 0, reason = 'segFocus') {
    const segIdSafe = String(segId || '');
    return this.updateFocusState(docId, {
      compIdFocused: segIdSafe,
      segIdFocused: segIdSafe,
      offsetFocused: Number(offsetFocused || 0),
      reasonLast: reason,
    });
  }

  focusExpandToParent(docId: string, compIdFallback = '', reason = 'shiftClickExpand') {
    const docRecord = this.ensureDoc(docId);
    const focusState = docRecord.interactionState.focusState;
    const compIdBase = String(focusState.compIdFocused || focusState.segIdFocused || compIdFallback || '');
    const compIdFallbackSafe = String(compIdFallback || '');
    if (!compIdBase) {
      return { code: -1, message: 'No logical focus to expand.' };
    }
    const compDataBase = docRecord.compDataById[compIdBase];
    if (!compDataBase) {
      return { code: -1, message: `Focused component not found. compId=${compIdBase}` };
    }
    if (compDataBase.config?.isRoot === true) {
      const compDataFallback = docRecord.compDataById[compIdFallbackSafe];
      if (compDataFallback && compIdFallbackSafe && compIdFallbackSafe !== compIdBase) {
        if (String(compDataFallback.compName || '') === 'TextSeg') {
          return this.segFocus(docId, compIdFallbackSafe, focusState.offsetFocused, reason);
        }
        return this.compIdFocus(docId, compIdFallbackSafe, reason);
      }
      return { code: 0, message: 'Focus already at root component.' };
    }
    const compIdParent = this.getParentCompId(docId, compIdBase);
    if (!compIdParent) {
      const compDataFallback = docRecord.compDataById[compIdFallbackSafe];
      if (compDataFallback && compIdFallbackSafe && compIdFallbackSafe !== compIdBase) {
        if (String(compDataFallback.compName || '') === 'TextSeg') {
          return this.segFocus(docId, compIdFallbackSafe, focusState.offsetFocused, reason);
        }
        return this.compIdFocus(docId, compIdFallbackSafe, reason);
      }
      return { code: -1, message: `No parent component. compId=${compIdBase}` };
    }
    return this.compIdFocus(docId, compIdParent, reason);
  }

  rowIdFocusedForOutlineOp(docId: string) {
    const docRecord = this.ensureDoc(docId);
    const focusState = docRecord.interactionState.focusState;
    const compIdFocused = String(focusState.compIdFocused || '');
    const segIdFocused = String(focusState.segIdFocused || '');
    if (this.isCompName(docRecord, compIdFocused, 'Row')) {
      return compIdFocused;
    }
    if (this.isCompName(docRecord, compIdFocused, 'List')) {
      const mainCompId = String(docRecord.compDataById[compIdFocused]?.mainCompId || '');
      return this.isCompName(docRecord, mainCompId, 'Row') ? mainCompId : '';
    }
    if (segIdFocused) {
      return getOwningRowId(docRecord, segIdFocused);
    }
    if (compIdFocused) {
      return getOwningRowId(docRecord, compIdFocused);
    }
    return '';
  }

  updateElActiveState(docId: string, compIdElActive: string) {
    const docRecord = this.ensureDoc(docId);
    const compIdNext = String(compIdElActive || '');
    const elActiveState = docRecord.interactionState.elActiveState;
    if (elActiveState.compIdElActive === compIdNext) {
      return { code: 0 };
    }
    elActiveState.compIdElActive = compIdNext;
    elActiveState.versionElActive += 1;
    this.syncRuntimeState(docId);
    return { code: 0 };
  }

  updateSelectionState(docId: string, selectionStateNext: Partial<SelectionState>) {
    const docRecord = this.ensureDoc(docId);
    const selectionStateCurrent = docRecord.interactionState.selectionState;
    const selectionStateMerged = normalizeSelectionState(selectionStateCurrent, selectionStateNext);
    if (isSelectionStateSame(selectionStateCurrent, selectionStateMerged)) {
      return { code: 0 };
    }
    const isRuntimeSyncNeeded = !isSelectionRuntimeTargetSame(selectionStateCurrent, selectionStateMerged);
    applySelectionStateNext(selectionStateCurrent, selectionStateMerged);
    if (isRuntimeSyncNeeded) {
      this.syncRuntimeState(docId);
    }
    return { code: 0 };
  }

  updateSelectionAndFocusState(
    docId: string,
    selectionStateNext: Partial<SelectionState>,
    focusStatePatch: Partial<FocusState>,
  ) {
    const docRecord = this.ensureDoc(docId);
    const selectionStateCurrent = docRecord.interactionState.selectionState;
    const focusStateCurrent = docRecord.interactionState.focusState;
    const selectionStateMerged = normalizeSelectionState(selectionStateCurrent, selectionStateNext);
    const focusStateNext = normalizeFocusState(focusStateCurrent, focusStatePatch);
    const isSelectionSame = isSelectionStateSame(selectionStateCurrent, selectionStateMerged);
    const isFocusSame = isFocusStateSame(focusStateCurrent, focusStateNext);
    if (isSelectionSame && isFocusSame) {
      return { code: 0 };
    }
    const isRuntimeSyncNeeded = !isSelectionRuntimeTargetSame(selectionStateCurrent, selectionStateMerged)
      || focusStateCurrent.compIdFocused !== focusStateNext.compIdFocused
      || focusStateCurrent.segIdFocused !== focusStateNext.segIdFocused;
    if (!isSelectionSame) {
      applySelectionStateNext(selectionStateCurrent, selectionStateMerged);
    }
    if (!isFocusSame) {
      applyFocusStateNext(focusStateCurrent, focusStateNext);
    }
    if (isRuntimeSyncNeeded) {
      this.syncRuntimeState(docId);
    }
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

  unfocusDoc(docId: string, reason = 'docUnfocus') {
    return this.updateSelectionAndFocusState(
      docId,
      {
        isSelectionActive: false,
        mode: 'caret',
        pointAnchor: null,
        pointFocus: null,
      },
      {
        compIdFocused: '',
        segIdFocused: '',
        offsetFocused: 0,
        reasonLast: reason,
      },
    );
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

  getSelectionText(docId: string) {
    return docStoreGetSelectionText(this, docId);
  }

  getSelectionMarkdownText(docId: string) {
    return docStoreGetSelectionMarkdownText(this, docId);
  }

  getSelectionMarkdownTextSync(docId: string) {
    return docStoreGetSelectionMarkdownTextSync(this, docId);
  }

  applyCompEditResult(docId: string, parentId: string, editResult: CompEditResult, reason: string) {
    return docStoreApplyCompEditResult(this, docId, parentId, editResult, reason);
  }

  replaceChildRange(
    docId: string,
    parentId: string,
    childIdListOld: string[],
    compDataListNext: CompData[],
    options: { focus?: CompFocusTarget; reason?: string } = {},
  ) {
    return docStoreReplaceChildRange(this, docId, parentId, childIdListOld, compDataListNext, options);
  }

  insertChildAfter(
    docId: string,
    parentId: string,
    childIdRef: string,
    compDataNext: CompData,
    options: { focus?: CompFocusTarget; reason?: string } = {},
  ) {
    return docStoreInsertChildAfter(this, docId, parentId, childIdRef, compDataNext, options);
  }

  removeCompSubtree(docId: string, compId: string) {
    return docStoreRemoveCompSubtree(this, docId, compId);
  }

  replaceCompData(docId: string, compDataNext: CompData) {
    return docStoreReplaceCompData(this, docId, compDataNext);
  }

  applyFocusAfterEdit(docId: string, focusNext: CompFocusTarget, reason: string) {
    return docStoreApplyFocusAfterEdit(this, docId, focusNext, reason);
  }

  indentEntryBySegId(docId: string, segId: string) {
    return docStoreIndentEntryBySegId(this, docId, segId);
  }

  indentEntryByRowId(docId: string, rowId: string, compIdFocus = '') {
    return docStoreIndentEntryByRowId(this, docId, rowId, compIdFocus);
  }

  outdentEntryBySegId(docId: string, segId: string) {
    return docStoreOutdentEntryBySegId(this, docId, segId);
  }

  outdentEntryByRowId(docId: string, rowId: string, compIdFocus = '') {
    return docStoreOutdentEntryByRowId(this, docId, rowId, compIdFocus);
  }

  pasteText(
    docId: string,
    rowId: string,
    segId: string,
    textPaste: string,
    point: any,
  ) {
    return docStorePasteText(this, docId, rowId, segId, textPaste, point);
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
    return docStoreSendEventToComp(this, docId, compId, event);
  }

  async sendEventToCompDirect(docId: string, compId: string, event: CompEvent): Promise<CompEventResult> {
    return docStoreSendEventToCompDirect(this, docId, compId, event);
  }

  async sendEventToParent(docId: string, compId: string, event: CompEvent): Promise<CompEventResult> {
    return docStoreSendEventToParent(this, docId, compId, event);
  }

  async sendEventToDoc(docId: string, event: CompEvent): Promise<CompEventResult> {
    return docStoreSendEventToDoc(this, docId, event);
  }

  async receiveEvent(docId: string, event: CompEvent): Promise<CompEventResult> {
    return docStoreReceiveEvent(this, docId, event);
  }

  async onEvent(docId: string, event: CompEvent): Promise<CompEventResult> {
    return docStoreOnEvent(this, docId, event);
  }

  private isCompName(docRecord: DocRecord, compId: string, compName: string) {
    if (!compId) return false;
    return String(docRecord.compDataById[compId]?.compName || '') === compName;
  }

  private syncRuntimeState(docId: string) {
    const docRecord = this.ensureDoc(docId);
    const compIdList = Object.keys(docRecord.compDataById || {});
    const focusState = docRecord.interactionState.focusState;
    const elActiveState = docRecord.interactionState.elActiveState;
    const selectionState = docRecord.interactionState.selectionState;
    const parentIdByCompId = createParentIdByCompId(docRecord);
    const compIdFocusSet = createAncestorIdSet(parentIdByCompId, [
      focusState.compIdFocused,
      focusState.segIdFocused,
    ]);
    const compIdSelectionList = [
      selectionState.pointAnchor?.compId || '',
      selectionState.pointFocus?.compId || '',
    ].filter(Boolean);
    const compIdSelectionSet = createAncestorIdSet(parentIdByCompId, compIdSelectionList);
    const runtimeStateByCompId = docRecord.interactionState.runtimeStateByCompId;
    const compIdSet = new Set(compIdList);
    for (const compIdExisting of Object.keys(runtimeStateByCompId)) {
      if (!compIdSet.has(compIdExisting)) {
        delete runtimeStateByCompId[compIdExisting];
      }
    }
    for (const compId of compIdList) {
      const runtimeStateNext: CompRuntimeState = {
        isFocusedLogical: focusState.compIdFocused === compId || focusState.segIdFocused === compId,
        isElActive: elActiveState.compIdElActive === compId,
        isFocusWithin: compIdFocusSet.has(compId),
        isSelectionWithin: compIdSelectionSet.has(compId),
      };
      const runtimeStateCurrent = runtimeStateByCompId[compId];
      if (!runtimeStateCurrent) {
        runtimeStateByCompId[compId] = runtimeStateNext;
      } else {
        applyRuntimeStateNext(runtimeStateCurrent, runtimeStateNext);
      }
    }
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

function normalizeFocusState(focusStateCurrent: FocusState, focusStatePatch: Partial<FocusState>): FocusState {
  const compIdFocused = focusStatePatch.compIdFocused !== undefined
    ? String(focusStatePatch.compIdFocused || '')
    : focusStateCurrent.compIdFocused;
  const segIdFocused = focusStatePatch.segIdFocused !== undefined
    ? String(focusStatePatch.segIdFocused || '')
    : focusStateCurrent.segIdFocused;
  return {
    compIdFocused,
    segIdFocused,
    offsetFocused: focusStatePatch.offsetFocused !== undefined
      ? Number(focusStatePatch.offsetFocused || 0)
      : focusStateCurrent.offsetFocused,
    reasonLast: focusStatePatch.reasonLast !== undefined
      ? String(focusStatePatch.reasonLast || '')
      : focusStateCurrent.reasonLast,
  };
}

function isFocusStateSame(focusStateA: FocusState, focusStateB: FocusState) {
  return focusStateA.compIdFocused === focusStateB.compIdFocused
    && focusStateA.segIdFocused === focusStateB.segIdFocused
    && focusStateA.offsetFocused === focusStateB.offsetFocused
    && focusStateA.reasonLast === focusStateB.reasonLast;
}

function applyFocusStateNext(focusStateCurrent: FocusState, focusStateNext: FocusState) {
  if (focusStateCurrent.compIdFocused !== focusStateNext.compIdFocused) {
    focusStateCurrent.compIdFocused = focusStateNext.compIdFocused;
  }
  if (focusStateCurrent.segIdFocused !== focusStateNext.segIdFocused) {
    focusStateCurrent.segIdFocused = focusStateNext.segIdFocused;
  }
  if (focusStateCurrent.offsetFocused !== focusStateNext.offsetFocused) {
    focusStateCurrent.offsetFocused = focusStateNext.offsetFocused;
  }
  if (focusStateCurrent.reasonLast !== focusStateNext.reasonLast) {
    focusStateCurrent.reasonLast = focusStateNext.reasonLast;
  }
}

function normalizeSelectionState(
  selectionStateCurrent: SelectionState,
  selectionStatePatch: Partial<SelectionState>,
): SelectionState {
  return {
    isSelectionActive: selectionStatePatch.isSelectionActive !== undefined
      ? selectionStatePatch.isSelectionActive === true
      : selectionStateCurrent.isSelectionActive,
    mode: selectionStatePatch.mode !== undefined
      ? selectionStatePatch.mode
      : selectionStateCurrent.mode,
    pointAnchor: selectionStatePatch.pointAnchor !== undefined
      ? normalizeSelectionPoint(selectionStatePatch.pointAnchor)
      : selectionStateCurrent.pointAnchor,
    pointFocus: selectionStatePatch.pointFocus !== undefined
      ? normalizeSelectionPoint(selectionStatePatch.pointFocus)
      : selectionStateCurrent.pointFocus,
  };
}

function normalizeSelectionPoint(point: SelectionState['pointAnchor']) {
  if (!point) return null;
  return {
    compId: String(point.compId || ''),
    segId: String(point.segId || ''),
    offset: Number(point.offset || 0),
  };
}

function isSelectionStateSame(selectionStateA: SelectionState, selectionStateB: SelectionState) {
  return selectionStateA.isSelectionActive === selectionStateB.isSelectionActive
    && selectionStateA.mode === selectionStateB.mode
    && isSelectionPointSame(selectionStateA.pointAnchor, selectionStateB.pointAnchor)
    && isSelectionPointSame(selectionStateA.pointFocus, selectionStateB.pointFocus);
}

function applySelectionStateNext(selectionStateCurrent: SelectionState, selectionStateNext: SelectionState) {
  if (selectionStateCurrent.isSelectionActive !== selectionStateNext.isSelectionActive) {
    selectionStateCurrent.isSelectionActive = selectionStateNext.isSelectionActive;
  }
  if (selectionStateCurrent.mode !== selectionStateNext.mode) {
    selectionStateCurrent.mode = selectionStateNext.mode;
  }
  if (!isSelectionPointSame(selectionStateCurrent.pointAnchor, selectionStateNext.pointAnchor)) {
    selectionStateCurrent.pointAnchor = selectionStateNext.pointAnchor;
  }
  if (!isSelectionPointSame(selectionStateCurrent.pointFocus, selectionStateNext.pointFocus)) {
    selectionStateCurrent.pointFocus = selectionStateNext.pointFocus;
  }
}

function isSelectionRuntimeTargetSame(selectionStateA: SelectionState, selectionStateB: SelectionState) {
  return getSelectionRuntimeTargetKey(selectionStateA) === getSelectionRuntimeTargetKey(selectionStateB);
}

function getSelectionRuntimeTargetKey(selectionState: SelectionState) {
  return [
    selectionState.pointAnchor?.compId || '',
    selectionState.pointFocus?.compId || '',
  ].join('|');
}

function isSelectionPointSame(pointA: SelectionState['pointAnchor'], pointB: SelectionState['pointAnchor']) {
  if (!pointA || !pointB) return pointA === pointB;
  return pointA.compId === pointB.compId
    && pointA.segId === pointB.segId
    && pointA.offset === pointB.offset;
}

function createParentIdByCompId(docRecord: DocRecord) {
  const parentIdByCompId: Record<string, string> = {};
  const compIdList = Object.keys(docRecord.compDataById || {});
  for (const compId of compIdList) {
    const compData = docRecord.compDataById[compId];
    const childIdList = Array.isArray(compData?.childIdList) ? compData.childIdList : [];
    for (const childIdRaw of childIdList) {
      const childId = String(childIdRaw || '');
      if (childId) {
        parentIdByCompId[childId] = compId;
      }
    }
    const mainCompId = String(compData?.mainCompId || '').trim();
    if (mainCompId) {
      parentIdByCompId[mainCompId] = compId;
    }
  }
  return parentIdByCompId;
}

function createAncestorIdSet(parentIdByCompId: Record<string, string>, compIdList: string[]) {
  const ancestorIdSet = new Set<string>();
  for (const compIdRaw of compIdList) {
    let compIdCurrent = String(compIdRaw || '');
    const visitedIdSet = new Set<string>();
    while (compIdCurrent && !visitedIdSet.has(compIdCurrent)) {
      visitedIdSet.add(compIdCurrent);
      ancestorIdSet.add(compIdCurrent);
      compIdCurrent = parentIdByCompId[compIdCurrent] || '';
    }
  }
  return ancestorIdSet;
}

function getOwningRowId(docRecord: DocRecord, compIdChild: string) {
  const compIdList = Object.keys(docRecord.compDataById || {});
  for (const compId of compIdList) {
    const compData = docRecord.compDataById[compId];
    if (String(compData?.compName || '') !== 'Row') continue;
    const childIdList = Array.isArray(compData.childIdList) ? compData.childIdList.map((id) => String(id || '')) : [];
    if (childIdList.includes(compIdChild)) {
      return compId;
    }
  }
  return '';
}

function applyRuntimeStateNext(runtimeStateCurrent: CompRuntimeState, runtimeStateNext: CompRuntimeState) {
  if (runtimeStateCurrent.isFocusedLogical !== runtimeStateNext.isFocusedLogical) {
    runtimeStateCurrent.isFocusedLogical = runtimeStateNext.isFocusedLogical;
  }
  if (runtimeStateCurrent.isElActive !== runtimeStateNext.isElActive) {
    runtimeStateCurrent.isElActive = runtimeStateNext.isElActive;
  }
  if (runtimeStateCurrent.isFocusWithin !== runtimeStateNext.isFocusWithin) {
    runtimeStateCurrent.isFocusWithin = runtimeStateNext.isFocusWithin;
  }
  if (runtimeStateCurrent.isSelectionWithin !== runtimeStateNext.isSelectionWithin) {
    runtimeStateCurrent.isSelectionWithin = runtimeStateNext.isSelectionWithin;
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
