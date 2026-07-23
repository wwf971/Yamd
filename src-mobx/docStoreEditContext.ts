import type { DocStore } from './docStore';
import {
  cloneCompData,
  createCompVersionDiff,
  getIsCompVersionDiffStructural,
  versionIdCreate,
  versionStoreAddNext,
  versionStoreEnsureFull,
} from './docStoreVersion';
import { idCreateRandom } from './docStoreCompData';
import type {
  CompChange,
  CompData,
  DocChange,
  DocEditChangeSet,
  DocEditKind,
} from './docStoreTypes';

// One edit transaction owns one context. All semantic document mutation goes
// through the helpers below; the context records the before state of each
// touched comp exactly once, so commit and rollback cost O(comps touched).
export type DocEditContext = {
  store: DocStore;
  docId: string;
  depth: number;
  typeEdit: string;
  compDataBeforeByCompId: Record<string, CompData | null>;
  isRootTouched: boolean;
  compIdRootBefore: string | null;
  isTextDocTouched: boolean;
  textDocBefore: string;
};

export type DocEditCommitResult = {
  changeSet: DocEditChangeSet;
  kindEdit: DocEditKind;
};

export function createDocEditContext(store: DocStore, docId: string, typeEdit: string): DocEditContext {
  return {
    store,
    docId: String(docId || ''),
    depth: 1,
    typeEdit: String(typeEdit || 'docEdit'),
    compDataBeforeByCompId: {},
    isRootTouched: false,
    compIdRootBefore: null,
    isTextDocTouched: false,
    textDocBefore: '',
  };
}

export function docStoreGetActiveEdit(store: DocStore, docId: string): DocEditContext {
  const context = store.editTransactionByDocId[String(docId || '')] as DocEditContext | undefined;
  if (!context) {
    throw new Error(`Semantic document mutation outside an active edit. docId=${docId}`);
  }
  return context;
}

export function docStoreGetActiveEditOrNull(store: DocStore, docId: string): DocEditContext | null {
  return (store.editTransactionByDocId[String(docId || '')] as DocEditContext | undefined) || null;
}

export function editUpdateCompData(context: DocEditContext, compId: string, dataPatch: Record<string, any>) {
  const compData = getLiveCompData(context, compId);
  if (!compData) {
    return { code: -1, message: `Component data not found. compId=${compId}` };
  }
  touchComp(context, compId);
  compData.data = {
    ...(compData.data || {}),
    ...(dataPatch || {}),
  };
  return { code: 0, message: 'Component data updated.' };
}

export function editUpdateCompConfig(context: DocEditContext, compId: string, configPatch: Record<string, any>) {
  const compData = getLiveCompData(context, compId);
  if (!compData) {
    return { code: -1, message: `Component data not found. compId=${compId}` };
  }
  touchComp(context, compId);
  compData.config = {
    ...(compData.config || {}),
    ...(configPatch || {}),
  };
  return { code: 0, message: 'Component config updated.' };
}

// Create a comp or replace a whole record. The version transition is still
// derived at commit time by diffing against the touched before state.
export function editPutCompData(context: DocEditContext, compDataNext: CompData) {
  const compId = String(compDataNext?.compId || '');
  if (!compId) {
    return { code: -1, message: 'Component id missing.' };
  }
  touchComp(context, compId);
  const docRecord = context.store.ensureDoc(context.docId);
  const compDataWrite = cloneCompData(compDataNext);
  compDataWrite.versionId = docRecord.compDataById[compId]?.versionId;
  docRecord.compDataById[compId] = compDataWrite;
  return { code: 0, message: 'Component data written.' };
}

export function editRemoveComp(context: DocEditContext, compId: string) {
  const compIdSafe = String(compId || '');
  const docRecord = context.store.ensureDoc(context.docId);
  if (!docRecord.compDataById[compIdSafe]) {
    return { code: 0, message: 'Component already absent.' };
  }
  touchComp(context, compIdSafe);
  delete docRecord.compDataById[compIdSafe];
  return { code: 0, message: 'Component removed.' };
}

export function editRemoveCompSubtree(context: DocEditContext, compId: string) {
  const compIdSafe = String(compId || '');
  if (!compIdSafe) return { code: 0, message: 'Component id empty.' };
  const docRecord = context.store.ensureDoc(context.docId);
  const compData = docRecord.compDataById[compIdSafe];
  if (!compData) return { code: 0, message: 'Component already absent.' };
  const childIdList = Array.isArray(compData.childIdList)
    ? compData.childIdList.map((id) => String(id || ''))
    : [];
  for (const childId of childIdList) {
    editRemoveCompSubtree(context, childId);
  }
  if (compData.mainCompId) {
    editRemoveCompSubtree(context, String(compData.mainCompId));
  }
  editRemoveComp(context, compIdSafe);
  return { code: 0, message: 'Component subtree removed.' };
}

export function editSetChildIdList(context: DocEditContext, compId: string, childIdListNext: string[]) {
  const compData = getLiveCompData(context, compId);
  if (!compData) {
    return { code: -1, message: `Component data not found. compId=${compId}` };
  }
  touchComp(context, compId);
  compData.childIdList = (Array.isArray(childIdListNext) ? childIdListNext : [])
    .map((id) => String(id || ''))
    .filter(Boolean);
  return { code: 0, message: 'Child id list updated.' };
}

export function editSetMainCompId(context: DocEditContext, compId: string, mainCompIdNext: string) {
  const compData = getLiveCompData(context, compId);
  if (!compData) {
    return { code: -1, message: `Component data not found. compId=${compId}` };
  }
  touchComp(context, compId);
  compData.mainCompId = mainCompIdNext ? String(mainCompIdNext) : undefined;
  return { code: 0, message: 'Main comp id updated.' };
}

export function editSetCompIdRoot(context: DocEditContext, compIdRootNext: string | null) {
  const docRecord = context.store.ensureDoc(context.docId);
  if (!context.isRootTouched) {
    context.isRootTouched = true;
    context.compIdRootBefore = docRecord.compIdRoot;
  }
  docRecord.compIdRoot = compIdRootNext ? String(compIdRootNext) : null;
  return { code: 0, message: 'Root comp id updated.' };
}

export function editUpdateDocText(context: DocEditContext, textNext: string) {
  const docRecord = context.store.ensureDoc(context.docId);
  if (!context.isTextDocTouched) {
    context.isTextDocTouched = true;
    context.textDocBefore = String(docRecord.data.text || '');
  }
  docRecord.data.text = String(textNext ?? '');
  return { code: 0, message: 'Document text updated.' };
}

// Diff every touched comp against its before state, write version records for
// real changes, and bump live version ids. Returns null when nothing changed.
export function docStoreCommitEdit(context: DocEditContext): DocEditCommitResult | null {
  const docRecord = context.store.ensureDoc(context.docId);
  const versionStore = docRecord.historyState.versionStore;
  const compChangeList: CompChange[] = [];
  let isStructural = false;

  for (const compId of Object.keys(context.compDataBeforeByCompId)) {
    const compDataBefore = context.compDataBeforeByCompId[compId];
    const compDataCurrent = docRecord.compDataById[compId];
    if (!compDataBefore && !compDataCurrent) continue;

    if (!compDataBefore && compDataCurrent) {
      isStructural = true;
      const versionAfter = versionIdCreate(versionStore);
      compDataCurrent.versionId = versionAfter;
      versionStoreEnsureFull(versionStore, compDataCurrent);
      compChangeList.push({ compId, versionBefore: '', versionAfter });
      continue;
    }
    if (compDataBefore && !compDataCurrent) {
      isStructural = true;
      if (!compDataBefore.versionId) {
        compDataBefore.versionId = idCreateRandom(8);
      }
      versionStoreEnsureFull(versionStore, compDataBefore);
      compChangeList.push({ compId, versionBefore: String(compDataBefore.versionId), versionAfter: '' });
      continue;
    }
    if (!compDataBefore || !compDataCurrent) continue;

    const diff = createCompVersionDiff(compDataBefore, compDataCurrent);
    if (!diff) continue;
    if (getIsCompVersionDiffStructural(diff)) {
      isStructural = true;
    }
    if (!compDataBefore.versionId) {
      compDataBefore.versionId = idCreateRandom(8);
    }
    const versionBefore = String(compDataBefore.versionId);
    versionStoreEnsureFull(versionStore, compDataBefore);
    const versionAfter = versionIdCreate(versionStore);
    compDataCurrent.versionId = versionAfter;
    versionStoreAddNext(versionStore, compDataCurrent, versionBefore, diff);
    compChangeList.push({ compId, versionBefore, versionAfter });
  }

  let docChange: DocChange | null = null;
  if (context.isRootTouched && context.compIdRootBefore !== docRecord.compIdRoot) {
    isStructural = true;
    docChange = {
      ...(docChange || {}),
      compIdRootBefore: context.compIdRootBefore,
      compIdRootAfter: docRecord.compIdRoot,
    };
  }
  if (context.isTextDocTouched && context.textDocBefore !== String(docRecord.data.text || '')) {
    docChange = {
      ...(docChange || {}),
      textDocBefore: context.textDocBefore,
      textDocAfter: String(docRecord.data.text || ''),
    };
  }

  if (compChangeList.length === 0 && !docChange) {
    return null;
  }
  return {
    changeSet: { compChangeList, docChange },
    kindEdit: isStructural ? 'structure' : 'compData',
  };
}

// Restore only what the edit touched. Created comps are deleted, removed
// comps restored, changed comps rewritten from their before clones.
export function docStoreRollbackEdit(context: DocEditContext) {
  const docRecord = context.store.ensureDoc(context.docId);
  for (const compId of Object.keys(context.compDataBeforeByCompId)) {
    const compDataBefore = context.compDataBeforeByCompId[compId];
    if (compDataBefore) {
      docRecord.compDataById[compId] = cloneCompData(compDataBefore);
    } else {
      delete docRecord.compDataById[compId];
    }
  }
  if (context.isRootTouched) {
    docRecord.compIdRoot = context.compIdRootBefore;
  }
  if (context.isTextDocTouched) {
    docRecord.data.text = context.textDocBefore;
  }
}

function touchComp(context: DocEditContext, compIdRaw: string) {
  const compId = String(compIdRaw || '');
  if (!compId) return;
  if (Object.prototype.hasOwnProperty.call(context.compDataBeforeByCompId, compId)) return;
  const compData = context.store.ensureDoc(context.docId).compDataById[compId];
  context.compDataBeforeByCompId[compId] = compData ? cloneCompData(compData) : null;
}

function getLiveCompData(context: DocEditContext, compId: string) {
  return context.store.ensureDoc(context.docId).compDataById[String(compId || '')] || null;
}
