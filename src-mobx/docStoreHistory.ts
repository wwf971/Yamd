import type { DocStore } from './docStore';
import { idCreateRandom } from './docStoreCompData';
import { docStoreIsSegment } from './docStoreSegment';
import {
  compVersionCheckpoint,
  compVersionMaterialize,
  createCompVersionStore,
  versionStoreSweep,
} from './docStoreVersion';
import type { DocEditCommitResult } from './docStoreEditContext';
import type {
  CompData,
  CompFocusTarget,
  DocEditChangeSet,
  DocEditOptions,
  DocHistoryNode,
  DocHistoryState,
  DocRecord,
  FocusState,
} from './docStoreTypes';

export function createDocHistoryState(limitNode = 200): DocHistoryState {
  const nodeIdRoot = idCreateRandom(8);
  return {
    nodeById: {
      [nodeIdRoot]: createRootNode(nodeIdRoot),
    },
    nodeIdRoot,
    nodeIdCurrent: nodeIdRoot,
    nodeIdRedoPreferredByNodeId: {},
    versionStore: createCompVersionStore(),
    isApplying: false,
    isUndoAvailable: false,
    isRedoAvailable: false,
    versionHistory: 0,
    limitNode: Math.max(10, Number(limitNode || 200)),
  };
}

export function docStoreResetHistory(store: DocStore, docId: string) {
  const docRecord = store.ensureDoc(docId);
  docRecord.historyState = createDocHistoryState(docRecord.historyState?.limitNode);
  return { code: 0, message: 'Document history reset.' };
}

// Store one accepted edit as one history node. The change set holds version
// refs only; version content already lives in the version store.
export function docStoreRecordHistory(
  store: DocStore,
  docId: string,
  commitResult: DocEditCommitResult,
  options: DocEditOptions,
  focusBefore?: CompFocusTarget,
  focusAfter?: CompFocusTarget,
) {
  const docRecord = store.ensureDoc(docId);
  const historyState = docRecord.historyState;
  if (historyState.isApplying) {
    return { code: 0, message: 'History apply is not recorded.' };
  }

  const nodeCurrent = historyState.nodeById[historyState.nodeIdCurrent];
  const timeCreated = Date.now();
  const timeGroupMs = Math.max(0, Number(options.timeGroupMs || 0));
  const isGroupAllowed = Boolean(
    options.groupKey
    && nodeCurrent?.groupKey === options.groupKey
    && nodeCurrent.nodeIdParent
    && nodeCurrent.nodeIdChildList.length === 0
    && timeGroupMs > 0
    && timeCreated - nodeCurrent.timeCreated <= timeGroupMs
    && nodeCurrent.kindEdit === 'compData'
    && commitResult.kindEdit === 'compData',
  );
  if (isGroupAllowed && nodeCurrent) {
    composeChangeSetInto(nodeCurrent.changeSet, commitResult.changeSet);
    nodeCurrent.focusAfter = cloneFocusTarget(focusAfter);
    nodeCurrent.timeCreated = timeCreated;
    historyState.versionHistory += 1;
    syncHistoryAvailability(historyState);
    return { code: 0, message: 'Document history edit grouped.', data: { nodeId: nodeCurrent.nodeId } };
  }

  const nodeId = createHistoryNodeId(historyState);
  const nodeNext: DocHistoryNode = {
    nodeId,
    nodeIdParent: nodeCurrent?.nodeId || historyState.nodeIdRoot,
    nodeIdChildList: [],
    typeEdit: String(options.typeEdit || 'docEdit'),
    kindEdit: commitResult.kindEdit,
    timeCreated,
    changeSet: commitResult.changeSet,
    focusBefore: cloneFocusTarget(focusBefore),
    focusAfter: cloneFocusTarget(focusAfter),
    groupKey: options.groupKey ? String(options.groupKey) : undefined,
  };
  historyState.nodeById[nodeId] = nodeNext;
  if (nodeCurrent) {
    nodeCurrent.nodeIdChildList.push(nodeId);
    historyState.nodeIdRedoPreferredByNodeId[nodeCurrent.nodeId] = nodeId;
  }
  historyState.nodeIdCurrent = nodeId;
  historyState.versionHistory += 1;
  pruneHistoryNodes(historyState, historyState.limitNode);
  sweepHistoryVersions(historyState);
  syncHistoryAvailability(historyState);
  return { code: 0, message: 'Document history edit recorded.', data: { nodeId } };
}

export function docStoreUndoEdit(store: DocStore, docId: string) {
  const docRecord = store.ensureDoc(docId);
  const historyState = docRecord.historyState;
  const nodeCurrent = historyState.nodeById[historyState.nodeIdCurrent];
  const nodeIdParent = String(nodeCurrent?.nodeIdParent || '');
  if (!nodeCurrent || !nodeIdParent || !historyState.nodeById[nodeIdParent]) {
    return { code: -1, message: 'No document edit to undo.' };
  }
  historyState.isApplying = true;
  try {
    const resultApply = applyChangeSet(docRecord, nodeCurrent.changeSet, 'backward');
    if (resultApply.code !== 0) {
      return resultApply;
    }
    historyState.nodeIdCurrent = nodeIdParent;
    historyState.nodeIdRedoPreferredByNodeId[nodeIdParent] = nodeCurrent.nodeId;
    historyState.versionHistory += 1;
    store.clearSelectionState(docId);
    restoreFocus(store, docId, nodeCurrent.focusBefore, 'historyUndo');
    syncHistoryAvailability(historyState);
  } finally {
    historyState.isApplying = false;
  }
  return {
    code: 0,
    message: 'Document edit undone.',
    data: {
      nodeIdBefore: nodeCurrent.nodeId,
      nodeIdAfter: nodeIdParent,
    },
  };
}

export function docStoreRedoEdit(store: DocStore, docId: string, nodeIdChild = '') {
  const docRecord = store.ensureDoc(docId);
  const historyState = docRecord.historyState;
  const nodeCurrent = historyState.nodeById[historyState.nodeIdCurrent];
  const nodeIdPreferred = String(historyState.nodeIdRedoPreferredByNodeId[nodeCurrent?.nodeId || ''] || '');
  const nodeIdNext = String(nodeIdChild || nodeIdPreferred || nodeCurrent?.nodeIdChildList[0] || '');
  const nodeNext = historyState.nodeById[nodeIdNext];
  if (!nodeCurrent || !nodeNext || nodeNext.nodeIdParent !== nodeCurrent.nodeId) {
    return { code: -1, message: 'No document edit to redo.' };
  }
  historyState.isApplying = true;
  try {
    const resultApply = applyChangeSet(docRecord, nodeNext.changeSet, 'forward');
    if (resultApply.code !== 0) {
      return resultApply;
    }
    historyState.nodeIdCurrent = nodeNext.nodeId;
    historyState.nodeIdRedoPreferredByNodeId[nodeCurrent.nodeId] = nodeNext.nodeId;
    historyState.versionHistory += 1;
    store.clearSelectionState(docId);
    restoreFocus(store, docId, nodeNext.focusAfter, 'historyRedo');
    syncHistoryAvailability(historyState);
  } finally {
    historyState.isApplying = false;
  }
  return {
    code: 0,
    message: 'Document edit redone.',
    data: {
      nodeIdBefore: nodeCurrent.nodeId,
      nodeIdAfter: nodeNext.nodeId,
    },
  };
}

export function docStoreSetRedoBranch(store: DocStore, docId: string, nodeIdChild: string) {
  const historyState = store.ensureDoc(docId).historyState;
  const nodeCurrent = historyState.nodeById[historyState.nodeIdCurrent];
  const nodeIdChildSafe = String(nodeIdChild || '');
  if (!nodeCurrent?.nodeIdChildList.includes(nodeIdChildSafe)) {
    return { code: -1, message: 'Redo branch is not a child of the current history node.' };
  }
  historyState.nodeIdRedoPreferredByNodeId[nodeCurrent.nodeId] = nodeIdChildSafe;
  historyState.versionHistory += 1;
  syncHistoryAvailability(historyState);
  return { code: 0, message: 'Redo branch selected.' };
}

export function docStoreGetHistoryBranchList(store: DocStore, docId: string) {
  const historyState = store.ensureDoc(docId).historyState;
  const nodeCurrent = historyState.nodeById[historyState.nodeIdCurrent];
  return (nodeCurrent?.nodeIdChildList || [])
    .map((nodeId) => historyState.nodeById[nodeId])
    .filter(Boolean);
}

// Prune history nodes to a target count, then reclaim version records that no
// surviving node can reach.
export function docStorePruneHistory(store: DocStore, docId: string, limitNodeKeep = 0) {
  const historyState = store.ensureDoc(docId).historyState;
  const limitNode = Number.isFinite(limitNodeKeep) && limitNodeKeep > 0
    ? Math.max(1, Math.trunc(limitNodeKeep))
    : historyState.limitNode;
  const countNodeBefore = Object.keys(historyState.nodeById).length;
  pruneHistoryNodes(historyState, limitNode);
  const countVersionRemoved = sweepHistoryVersions(historyState);
  historyState.versionHistory += 1;
  syncHistoryAvailability(historyState);
  return {
    code: 0,
    message: 'Document history pruned.',
    data: {
      countNodeRemoved: countNodeBefore - Object.keys(historyState.nodeById).length,
      countVersionRemoved,
    },
  };
}

export function docStoreCheckpointCompVersion(store: DocStore, docId: string, versionId: string) {
  const historyState = store.ensureDoc(docId).historyState;
  const result = compVersionCheckpoint(historyState.versionStore, versionId);
  if (result.code === 0) {
    historyState.versionHistory += 1;
  }
  return result;
}

export function focusTargetFromState(focusState: FocusState): CompFocusTarget | undefined {
  const compId = String(focusState.compIdFocused || focusState.segIdFocused || '');
  if (!compId) return undefined;
  return {
    compId,
    point: focusState.segIdFocused
      ? { offset: Number(focusState.offsetFocused || 0) }
      : undefined,
  };
}

// Apply one change set in either direction. Two phases: validate every entry
// against live version ids and materialize targets first, then write. A
// failed validation applies nothing.
function applyChangeSet(
  docRecord: DocRecord,
  changeSet: DocEditChangeSet,
  direction: 'forward' | 'backward',
) {
  const versionStore = docRecord.historyState.versionStore;
  const compDataNextByCompId: Record<string, CompData | null> = {};

  for (const change of changeSet.compChangeList) {
    const versionExpected = direction === 'backward' ? change.versionAfter : change.versionBefore;
    const versionTarget = direction === 'backward' ? change.versionBefore : change.versionAfter;
    const compDataLive = docRecord.compDataById[change.compId];
    if (versionExpected) {
      if (!compDataLive || String(compDataLive.versionId || '') !== versionExpected) {
        return {
          code: -1,
          message: `History and document desynced. compId=${change.compId} versionExpected=${versionExpected}`,
        };
      }
    } else if (compDataLive) {
      return {
        code: -1,
        message: `History and document desynced, component should be absent. compId=${change.compId}`,
      };
    }
    if (versionTarget) {
      const compDataTarget = compVersionMaterialize(versionStore, versionTarget);
      if (!compDataTarget) {
        return {
          code: -1,
          message: `History version cannot be materialized. compId=${change.compId} versionId=${versionTarget}`,
        };
      }
      compDataNextByCompId[change.compId] = compDataTarget;
    } else {
      compDataNextByCompId[change.compId] = null;
    }
  }

  for (const compId of Object.keys(compDataNextByCompId)) {
    const compDataNext = compDataNextByCompId[compId];
    if (compDataNext) {
      docRecord.compDataById[compId] = compDataNext;
    } else {
      delete docRecord.compDataById[compId];
    }
  }

  const docChange = changeSet.docChange;
  if (docChange) {
    if (direction === 'backward') {
      if (docChange.compIdRootBefore !== undefined) {
        docRecord.compIdRoot = docChange.compIdRootBefore;
      }
      if (docChange.textDocBefore !== undefined) {
        docRecord.data.text = docChange.textDocBefore;
      }
    } else {
      if (docChange.compIdRootAfter !== undefined) {
        docRecord.compIdRoot = docChange.compIdRootAfter;
      }
      if (docChange.textDocAfter !== undefined) {
        docRecord.data.text = docChange.textDocAfter;
      }
    }
  }
  return { code: 0, message: 'Change set applied.' };
}

// Grouping composition: per comp keep the oldest versionBefore and the newest
// versionAfter. Version records stay untouched; skipped intermediate versions
// remain reachable as diff bases until pruning reclaims them.
function composeChangeSetInto(changeSetTarget: DocEditChangeSet, changeSetNext: DocEditChangeSet) {
  for (const changeNext of changeSetNext.compChangeList) {
    const changeCurrent = changeSetTarget.compChangeList
      .find((change) => change.compId === changeNext.compId);
    if (changeCurrent) {
      changeCurrent.versionAfter = changeNext.versionAfter;
    } else {
      changeSetTarget.compChangeList.push({ ...changeNext });
    }
  }
  const docChangeNext = changeSetNext.docChange;
  if (!docChangeNext) return;
  if (!changeSetTarget.docChange) {
    changeSetTarget.docChange = { ...docChangeNext };
    return;
  }
  const docChangeTarget = changeSetTarget.docChange;
  if (docChangeNext.textDocAfter !== undefined) {
    if (docChangeTarget.textDocBefore === undefined) {
      docChangeTarget.textDocBefore = docChangeNext.textDocBefore;
    }
    docChangeTarget.textDocAfter = docChangeNext.textDocAfter;
  }
  if (docChangeNext.compIdRootAfter !== undefined) {
    if (docChangeTarget.compIdRootBefore === undefined) {
      docChangeTarget.compIdRootBefore = docChangeNext.compIdRootBefore;
    }
    docChangeTarget.compIdRootAfter = docChangeNext.compIdRootAfter;
  }
}

function restoreFocus(
  store: DocStore,
  docId: string,
  focusTarget: CompFocusTarget | undefined,
  reason: string,
) {
  const compId = String(focusTarget?.compId || '');
  if (!compId) {
    store.unfocusDoc(docId, reason);
    return;
  }
  const docRecord = store.ensureDoc(docId);
  if (!docRecord.compDataById[compId]) {
    store.unfocusDoc(docId, reason);
    return;
  }
  if (docStoreIsSegment(docRecord, compId)) {
    store.applyFocusAfterEdit(docId, focusTarget as CompFocusTarget, reason);
    return;
  }
  store.compIdFocus(docId, compId, reason);
}

function syncHistoryAvailability(historyState: DocHistoryState) {
  const nodeCurrent = historyState.nodeById[historyState.nodeIdCurrent];
  historyState.isUndoAvailable = Boolean(nodeCurrent?.nodeIdParent);
  historyState.isRedoAvailable = Boolean(nodeCurrent?.nodeIdChildList.length);
}

function createRootNode(nodeId: string): DocHistoryNode {
  return {
    nodeId,
    nodeIdParent: null,
    nodeIdChildList: [],
    typeEdit: 'root',
    kindEdit: 'compData',
    timeCreated: Date.now(),
    changeSet: { compChangeList: [], docChange: null },
  };
}

function createHistoryNodeId(historyState: DocHistoryState) {
  let nodeId = idCreateRandom(8);
  while (historyState.nodeById[nodeId]) {
    nodeId = idCreateRandom(8);
  }
  return nodeId;
}

function pruneHistoryNodes(historyState: DocHistoryState, limitNode: number) {
  while (Object.keys(historyState.nodeById).length > limitNode) {
    const nodeIdAncestorSet = createAncestorSet(historyState);
    const nodeDelete = Object.values(historyState.nodeById)
      .filter((node) => (
        node.nodeIdChildList.length === 0
        && !nodeIdAncestorSet.has(node.nodeId)
      ))
      .sort((nodeA, nodeB) => nodeA.timeCreated - nodeB.timeCreated)[0];
    if (nodeDelete) {
      deleteHistoryLeaf(historyState, nodeDelete);
      continue;
    }
    if (!moveHistoryRootForward(historyState, nodeIdAncestorSet)) {
      break;
    }
  }
}

// Mark every version referenced by surviving nodes, then sweep the rest.
// Base-chain expansion happens inside versionStoreSweep().
function sweepHistoryVersions(historyState: DocHistoryState) {
  const versionIdMarkedSet = new Set<string>();
  for (const node of Object.values(historyState.nodeById)) {
    for (const change of node.changeSet.compChangeList) {
      if (change.versionBefore) versionIdMarkedSet.add(change.versionBefore);
      if (change.versionAfter) versionIdMarkedSet.add(change.versionAfter);
    }
  }
  return versionStoreSweep(historyState.versionStore, versionIdMarkedSet);
}

function deleteHistoryLeaf(historyState: DocHistoryState, nodeDelete: DocHistoryNode) {
  const nodeParent = nodeDelete.nodeIdParent
    ? historyState.nodeById[nodeDelete.nodeIdParent]
    : null;
  if (nodeParent) {
    nodeParent.nodeIdChildList = nodeParent.nodeIdChildList.filter((nodeId) => nodeId !== nodeDelete.nodeId);
    if (historyState.nodeIdRedoPreferredByNodeId[nodeParent.nodeId] === nodeDelete.nodeId) {
      delete historyState.nodeIdRedoPreferredByNodeId[nodeParent.nodeId];
    }
  }
  delete historyState.nodeById[nodeDelete.nodeId];
}

// Nodes hold version refs only, so re-rooting is bookkeeping. The promoted
// root keeps no change set; undo can never go below the root.
function moveHistoryRootForward(historyState: DocHistoryState, nodeIdAncestorSet: Set<string>) {
  const nodeRoot = historyState.nodeById[historyState.nodeIdRoot];
  const nodeIdRootNext = nodeRoot?.nodeIdChildList.find((nodeId) => nodeIdAncestorSet.has(nodeId)) || '';
  const nodeRootNext = historyState.nodeById[nodeIdRootNext];
  if (!nodeRoot || !nodeRootNext) {
    return false;
  }
  for (const nodeIdChild of nodeRoot.nodeIdChildList) {
    if (nodeIdChild !== nodeRootNext.nodeId) {
      deleteHistorySubtree(historyState, nodeIdChild);
    }
  }
  delete historyState.nodeIdRedoPreferredByNodeId[nodeRoot.nodeId];
  delete historyState.nodeById[nodeRoot.nodeId];
  nodeRootNext.nodeIdParent = null;
  nodeRootNext.typeEdit = 'root';
  nodeRootNext.changeSet = { compChangeList: [], docChange: null };
  nodeRootNext.focusBefore = undefined;
  nodeRootNext.groupKey = undefined;
  historyState.nodeIdRoot = nodeRootNext.nodeId;
  return true;
}

function deleteHistorySubtree(historyState: DocHistoryState, nodeId: string) {
  const node = historyState.nodeById[nodeId];
  if (!node) return;
  for (const nodeIdChild of node.nodeIdChildList) {
    deleteHistorySubtree(historyState, nodeIdChild);
  }
  delete historyState.nodeIdRedoPreferredByNodeId[nodeId];
  delete historyState.nodeById[nodeId];
}

function createAncestorSet(historyState: DocHistoryState) {
  const nodeIdSet = new Set<string>();
  let nodeIdCurrent = historyState.nodeIdCurrent;
  while (nodeIdCurrent && !nodeIdSet.has(nodeIdCurrent)) {
    nodeIdSet.add(nodeIdCurrent);
    nodeIdCurrent = String(historyState.nodeById[nodeIdCurrent]?.nodeIdParent || '');
  }
  return nodeIdSet;
}

function cloneFocusTarget(focusTarget: CompFocusTarget | undefined) {
  return focusTarget ? JSON.parse(JSON.stringify(focusTarget)) : undefined;
}
