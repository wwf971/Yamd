import { idCreateRandom } from './docStoreCompData';
import type {
  CompData,
  CompDataDiffHandler,
  CompFieldChange,
  CompVersion,
  CompVersionDiff,
  CompVersionStore,
} from './docStoreTypes';

// A diff chain longer than this is cut by storing a full record instead.
export const ConfigVersionChainLengthMax = 16;

// Component data diff handlers, keyed by compName. Doc-level logic never
// interprets dataDiff content; it only routes it through the handler.
const compDataDiffHandlerByCompName: Record<string, CompDataDiffHandler> = {};

export function registerCompDataDiffHandler(compName: string, handler: CompDataDiffHandler) {
  const compNameSafe = String(compName || '');
  if (!compNameSafe || !handler) return;
  compDataDiffHandlerByCompName[compNameSafe] = handler;
}

export function getCompDataDiffHandler(compName: string): CompDataDiffHandler | null {
  return compDataDiffHandlerByCompName[String(compName || '')] || null;
}

export function createCompVersionStore(): CompVersionStore {
  return {
    versionById: {},
    versionIdListByCompId: {},
  };
}

export function versionIdCreate(versionStore: CompVersionStore) {
  let versionId = idCreateRandom(8);
  while (versionStore.versionById[versionId]) {
    versionId = idCreateRandom(8);
  }
  return versionId;
}

// Ensure the current state of a live comp exists as a full version record.
// Lazy: only comps that history actually references enter the version store.
export function versionStoreEnsureFull(versionStore: CompVersionStore, compData: CompData) {
  const versionId = String(compData.versionId || '');
  if (!versionId) return;
  if (versionStore.versionById[versionId]) return;
  versionStoreAdd(versionStore, {
    versionId,
    compId: String(compData.compId || ''),
    compName: String(compData.compName || ''),
    kind: 'full',
    timeCreated: Date.now(),
    lengthChain: 0,
    compData: cloneCompData(compData),
  });
}

// Record the after state of a changed comp. compDataAfter must already carry
// the new versionId. Stores a diff based on versionIdBase when the chain
// allows it, otherwise a full record.
export function versionStoreAddNext(
  versionStore: CompVersionStore,
  compDataAfter: CompData,
  versionIdBase: string,
  diff: CompVersionDiff,
) {
  const versionBase = versionStore.versionById[String(versionIdBase || '')];
  const isDiffUsable = Boolean(versionBase)
    && versionBase.lengthChain + 1 < ConfigVersionChainLengthMax;
  if (!isDiffUsable) {
    versionStoreAdd(versionStore, {
      versionId: String(compDataAfter.versionId || ''),
      compId: String(compDataAfter.compId || ''),
      compName: String(compDataAfter.compName || ''),
      kind: 'full',
      timeCreated: Date.now(),
      lengthChain: 0,
      compData: cloneCompData(compDataAfter),
    });
    return;
  }
  versionStoreAdd(versionStore, {
    versionId: String(compDataAfter.versionId || ''),
    compId: String(compDataAfter.compId || ''),
    compName: String(compDataAfter.compName || ''),
    kind: 'diff',
    timeCreated: Date.now(),
    lengthChain: versionBase.lengthChain + 1,
    versionIdBase: String(versionIdBase),
    diff,
  });
}

export function versionStoreAdd(versionStore: CompVersionStore, version: CompVersion) {
  const versionId = String(version.versionId || '');
  const compId = String(version.compId || '');
  if (!versionId || !compId) return;
  versionStore.versionById[versionId] = version;
  if (!versionStore.versionIdListByCompId[compId]) {
    versionStore.versionIdListByCompId[compId] = [];
  }
  if (!versionStore.versionIdListByCompId[compId].includes(versionId)) {
    versionStore.versionIdListByCompId[compId].push(versionId);
  }
}

// Rebuild full comp data for a version: walk the base chain back to the
// nearest full record, then apply diffs forward. Returns null when the chain
// is broken or a required diff handler is missing.
export function compVersionMaterialize(
  versionStore: CompVersionStore,
  versionId: string,
): CompData | null {
  const versionChain: CompVersion[] = [];
  let versionCurrent = versionStore.versionById[String(versionId || '')];
  while (versionCurrent) {
    versionChain.push(versionCurrent);
    if (versionCurrent.kind === 'full') break;
    versionCurrent = versionStore.versionById[String(versionCurrent.versionIdBase || '')];
  }
  const versionFull = versionChain[versionChain.length - 1];
  if (!versionFull || versionFull.kind !== 'full' || !versionFull.compData) {
    return null;
  }
  let compData = cloneCompData(versionFull.compData);
  for (let index = versionChain.length - 2; index >= 0; index -= 1) {
    const compDataNext = applyCompVersionDiff(compData, versionChain[index]);
    if (!compDataNext) return null;
    compData = compDataNext;
  }
  return compData;
}

// Convert a diff version into a self-contained full record. Cuts the base
// chain so pruning can reclaim older versions.
export function compVersionCheckpoint(versionStore: CompVersionStore, versionId: string) {
  const version = versionStore.versionById[String(versionId || '')];
  if (!version) {
    return { code: -1, message: `Version not found. versionId=${versionId}` };
  }
  if (version.kind === 'full') {
    return { code: 0, message: 'Version is already full.' };
  }
  const compData = compVersionMaterialize(versionStore, version.versionId);
  if (!compData) {
    return { code: -1, message: `Version cannot be materialized. versionId=${versionId}` };
  }
  version.kind = 'full';
  version.lengthChain = 0;
  version.compData = compData;
  version.versionIdBase = undefined;
  version.diff = undefined;
  return { code: 0, message: 'Version checkpoint created.' };
}

// Mark-and-sweep. versionIdMarkedSet holds versions referenced by surviving
// history nodes; bases of marked diff versions are marked too, because they
// are needed for materialization.
export function versionStoreSweep(versionStore: CompVersionStore, versionIdMarkedSet: Set<string>) {
  const versionIdKeepSet = new Set<string>();
  for (const versionIdMarked of versionIdMarkedSet) {
    let versionCurrent = versionStore.versionById[versionIdMarked];
    while (versionCurrent && !versionIdKeepSet.has(versionCurrent.versionId)) {
      versionIdKeepSet.add(versionCurrent.versionId);
      if (versionCurrent.kind === 'full') break;
      versionCurrent = versionStore.versionById[String(versionCurrent.versionIdBase || '')];
    }
  }
  let countRemoved = 0;
  for (const versionId of Object.keys(versionStore.versionById)) {
    if (versionIdKeepSet.has(versionId)) continue;
    const compId = String(versionStore.versionById[versionId].compId || '');
    delete versionStore.versionById[versionId];
    countRemoved += 1;
    const versionIdList = versionStore.versionIdListByCompId[compId];
    if (versionIdList) {
      const versionIdListNext = versionIdList.filter((id) => id !== versionId);
      if (versionIdListNext.length === 0) {
        delete versionStore.versionIdListByCompId[compId];
      } else {
        versionStore.versionIdListByCompId[compId] = versionIdListNext;
      }
    }
  }
  return countRemoved;
}

// Diff two comp states. data delegates to the component handler when one is
// registered and accepts; structure fields are always diffed centrally.
// Returns null when nothing changed.
export function createCompVersionDiff(
  compDataBefore: CompData,
  compDataAfter: CompData,
): CompVersionDiff | null {
  const diff: CompVersionDiff = {};
  let isChanged = false;

  if (!isValueSame(compDataBefore.data || {}, compDataAfter.data || {})) {
    isChanged = true;
    const handler = getCompDataDiffHandler(String(compDataAfter.compName || ''));
    const dataDiff = handler
      ? handler.createDataDiff(compDataBefore.data || {}, compDataAfter.data || {})
      : null;
    if (dataDiff !== null && dataDiff !== undefined) {
      diff.dataDiff = dataDiff;
    } else {
      diff.fieldChangeListData = createFieldChangeList(compDataBefore.data || {}, compDataAfter.data || {});
    }
  }
  if (!isValueSame(compDataBefore.config || {}, compDataAfter.config || {})) {
    isChanged = true;
    diff.fieldChangeListConfig = createFieldChangeList(compDataBefore.config || {}, compDataAfter.config || {});
  }
  if (!isIdListSame(compDataBefore.childIdList, compDataAfter.childIdList)) {
    isChanged = true;
    diff.childIdList = (compDataAfter.childIdList || []).map((id) => String(id || ''));
  }
  if (String(compDataBefore.mainCompId || '') !== String(compDataAfter.mainCompId || '')) {
    isChanged = true;
    diff.mainCompId = String(compDataAfter.mainCompId || '');
  }
  return isChanged ? diff : null;
}

export function getIsCompVersionDiffStructural(diff: CompVersionDiff | null) {
  return Boolean(diff && (diff.childIdList !== undefined || diff.mainCompId !== undefined));
}

function applyCompVersionDiff(compDataBase: CompData, version: CompVersion): CompData | null {
  const diff = version.diff || {};
  let dataNext = compDataBase.data;
  if (diff.dataDiff !== undefined) {
    const handler = getCompDataDiffHandler(String(version.compName || ''));
    if (!handler) return null;
    dataNext = handler.applyDataDiff(compDataBase.data || {}, diff.dataDiff);
  } else if (diff.fieldChangeListData) {
    dataNext = applyFieldChangeList(compDataBase.data || {}, diff.fieldChangeListData);
  }
  const configNext = diff.fieldChangeListConfig
    ? applyFieldChangeList(compDataBase.config || {}, diff.fieldChangeListConfig)
    : compDataBase.config;
  const mainCompIdNext = diff.mainCompId !== undefined
    ? (diff.mainCompId ? String(diff.mainCompId) : undefined)
    : compDataBase.mainCompId;
  return {
    compId: String(version.compId || ''),
    compName: String(version.compName || ''),
    versionId: String(version.versionId || ''),
    childIdList: diff.childIdList !== undefined
      ? diff.childIdList.map((id) => String(id || ''))
      : (compDataBase.childIdList || []).map((id) => String(id || '')),
    mainCompId: mainCompIdNext,
    data: dataNext,
    config: configNext,
  };
}

function createFieldChangeList(objBefore: any, objAfter: any): CompFieldChange[] {
  const fieldChangeList: CompFieldChange[] = [];
  const fieldNameSetAfter = new Set(Object.keys(objAfter || {}));
  for (const fieldName of Object.keys(objBefore || {})) {
    if (!fieldNameSetAfter.has(fieldName)) {
      fieldChangeList.push({ fieldName, isFieldRemoved: true });
    }
  }
  for (const fieldName of fieldNameSetAfter) {
    if (!isValueSame(objBefore?.[fieldName], objAfter?.[fieldName])) {
      fieldChangeList.push({ fieldName, value: cloneValue(objAfter[fieldName]) });
    }
  }
  return fieldChangeList;
}

function applyFieldChangeList(objBase: any, fieldChangeList: CompFieldChange[]) {
  const objNext = { ...(objBase || {}) };
  for (const fieldChange of fieldChangeList) {
    if (fieldChange.isFieldRemoved === true) {
      delete objNext[fieldChange.fieldName];
    } else {
      objNext[fieldChange.fieldName] = cloneValue(fieldChange.value);
    }
  }
  return objNext;
}

export function cloneCompData(compData: CompData): CompData {
  return {
    compId: String(compData.compId || ''),
    compName: String(compData.compName || ''),
    versionId: compData.versionId ? String(compData.versionId) : undefined,
    childIdList: Array.isArray(compData.childIdList)
      ? compData.childIdList.map((id) => String(id || ''))
      : [],
    mainCompId: compData.mainCompId ? String(compData.mainCompId) : undefined,
    data: cloneValue(compData.data || {}),
    config: cloneValue(compData.config || {}),
  };
}

function isIdListSame(idListA: string[] | undefined, idListB: string[] | undefined) {
  const listA = Array.isArray(idListA) ? idListA : [];
  const listB = Array.isArray(idListB) ? idListB : [];
  if (listA.length !== listB.length) return false;
  for (let index = 0; index < listA.length; index += 1) {
    if (String(listA[index] || '') !== String(listB[index] || '')) return false;
  }
  return true;
}

function isValueSame(valueA: any, valueB: any) {
  if (valueA === valueB) return true;
  return JSON.stringify(valueA) === JSON.stringify(valueB);
}

function cloneValue<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}
