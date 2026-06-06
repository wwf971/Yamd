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
  docStoreGetSelectionText,
  docStoreGetSelectionMarkdownText,
  docStoreGetSelectionMarkdownTextSync,
  docStoreIndentEntryByRowId,
  docStoreIndentEntryBySegId,
  docStoreInsertChildAfter,
  docStoreOutdentEntryBySegId,
  docStoreOutdentEntryByRowId,
  docStoreRemoveCompSubtree,
  docStoreReplaceChildRange,
  docStoreReplaceCompData,
} from './docStoreEdit';
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
