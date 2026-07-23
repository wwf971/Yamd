import type { DocStore } from './docStore';
import { docStoreRecordHistory, focusTargetFromState } from './docStoreHistory';
import {
  createDocEditContext,
  docStoreCommitEdit,
  docStoreRollbackEdit,
  type DocEditContext,
} from './docStoreEditContext';
import type { DocEditOptions } from './docStoreTypes';

type EditResult = {
  code: number;
  message?: string;
  data?: any;
};

// The single edit transaction boundary. Creates the edit context, lets domain
// logic mutate through it, then commits an exact change set to history.
// No document snapshot and no whole-document compare.
export function docStoreRunEdit<T extends EditResult>(
  store: DocStore,
  docId: string,
  optionsInput: string | DocEditOptions,
  applyEdit: () => T,
): T {
  const docRecord = store.ensureDoc(docId);
  const options = normalizeEditOptions(optionsInput);
  const contextCurrent = store.editTransactionByDocId[docId] as DocEditContext | undefined;
  if (contextCurrent) {
    contextCurrent.depth += 1;
    try {
      return applyEdit();
    } finally {
      contextCurrent.depth -= 1;
    }
  }

  const context = createDocEditContext(store, docId, options.typeEdit);
  const focusBefore = focusTargetFromState(docRecord.interactionState.focusState);
  store.editTransactionByDocId[docId] = context;
  docRecord.editState.isApplying = true;
  try {
    const result = applyEdit();
    if (!result || result.code !== 0) {
      docStoreRollbackEdit(context);
      return result;
    }
    const commitResult = docStoreCommitEdit(context);
    if (commitResult) {
      docRecord.editState.versionEdit += 1;
      docRecord.editState.typeEditLast = context.typeEdit;
      const focusAfter = focusTargetFromState(docRecord.interactionState.focusState);
      docStoreRecordHistory(store, docId, commitResult, options, focusBefore, focusAfter);
    }
    return result;
  } catch (error) {
    docStoreRollbackEdit(context);
    throw error;
  } finally {
    docRecord.editState.isApplying = false;
    delete store.editTransactionByDocId[docId];
  }
}

function normalizeEditOptions(optionsInput: string | DocEditOptions): DocEditOptions {
  if (typeof optionsInput === 'string') {
    return { typeEdit: String(optionsInput || 'docEdit') };
  }
  return {
    ...optionsInput,
    typeEdit: String(optionsInput?.typeEdit || 'docEdit'),
    groupKey: optionsInput?.groupKey ? String(optionsInput.groupKey) : undefined,
    timeGroupMs: Number(optionsInput?.timeGroupMs || 0),
  };
}
