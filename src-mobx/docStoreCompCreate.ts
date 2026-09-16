import { reaction, runInAction } from 'mobx';
import type { DocStore } from './docStore';
import type { CompCreateState, CompData } from './docStoreTypes';
import { compRegistrySearchByType, type CompRegistryEntry } from './compRegistry';
import { docStoreCreateCompId } from './docStoreCompData';
import {
  docStoreGetActiveEdit,
  editPutCompData,
  editRemoveCompSubtree,
  editSetChildIdList,
  editUpdateCompData,
} from './docStoreEditContext';
import {
  docStoreCloneSegmentWithText,
  docStoreGetOwningRowId,
  docStoreGetSegmentText,
  docStoreGetSegmentTextFieldName,
} from './docStoreSegment';
import { docStoreGetSegTrait } from './docStoreSegTrait';

// Comp create mode: typing '/' in an editable text segment enters a fragile
// mode that shows a dropdown of seg-type components from the unified
// component registry. The '/query' chars are ordinary segment text the whole
// time; the mode only tracks the region. Exiting for any reason therefore
// simply leaves the text in place. See doc-mobx/comp_create.md.
//
// The mode is kept alive by two mechanisms:
// 1. Explicit handling: the hosting segment routes its text input and a few
//    keys through the handlers below, which update the mode atomically with
//    the text edit (one store action, so observers never see the region and
//    the query disagree).
// 2. A watchdog reaction created on enter: it observes the segment text, the
//    focus state, the selection state, and the doc config, and exits the mode
//    the moment the fragile invariant breaks (click elsewhere, caret moved,
//    selection started, undo changed the text, feature disabled, segment
//    removed). Anything not explicitly handled is therefore still safe.

export type CompCreateKeyAction = 'idle' | 'consume' | 'pass';

export function createCompCreateState(): CompCreateState {
  return {
    isActive: false,
    segId: '',
    offsetSlash: 0,
    textQuery: '',
    indexSelected: -1,
  };
}

export function docStoreCompCreateGetState(store: DocStore, docId: string) {
  return store.ensureDoc(docId).interactionState.compCreateState;
}

// The components the mode can create: seg-type entries from the unified
// component registry whose compName contains the query (case-insensitive).
export function docStoreCompCreateGetMatchList(store: DocStore, docId: string): CompRegistryEntry[] {
  const state = docStoreCompCreateGetState(store, docId);
  if (!state.isActive) return [];
  const queryLower = state.textQuery.toLowerCase();
  return compRegistrySearchByType('seg')
    .filter((entry) => entry.compName.toLowerCase().includes(queryLower));
}

// Handle one text change of a segment. Returns true when the change was
// applied here (mode entered, updated, or exited together with the text
// patch); false lets the caller apply its generic text patch.
export function docStoreCompCreateHandleTextInput(
  store: DocStore,
  docId: string,
  segId: string,
  textPrev: string,
  textNext: string,
  offsetCaret: number,
): boolean {
  const state = docStoreCompCreateGetState(store, docId);

  if (state.isActive && state.segId !== segId) {
    // Input landed in another segment while the mode was active: the fragile
    // mode exits and the input goes through the generic path.
    docStoreCompCreateExit(store, docId, 'inputInOtherSeg');
    return false;
  }

  if (state.isActive) {
    const resultPatch = applySegTextPatch(store, docId, segId, textNext);
    if (resultPatch.code !== 0) {
      docStoreCompCreateExit(store, docId, 'textPatchRejected');
      return true;
    }
    // Keep the store focus offset in the same action as the text patch, so
    // the watchdog never observes a half-updated state.
    store.segFocus(docId, segId, offsetCaret, 'compCreateInput');
    const offsetSlash = state.offsetSlash;
    const isRegionValid = offsetCaret > offsetSlash
      && offsetCaret <= textNext.length
      && textNext.charAt(offsetSlash) === '/';
    const queryNext = isRegionValid ? textNext.slice(offsetSlash + 1, offsetCaret) : '';
    if (!isRegionValid || /\s/.test(queryNext)) {
      // The slash was deleted, the caret left the region, or a whitespace
      // entered the query ('/xxx ' means the user wants plain text).
      docStoreCompCreateExit(store, docId, 'regionBroken');
      return true;
    }
    // Any query change cancels the dropdown selection.
    state.textQuery = queryNext;
    state.indexSelected = -1;
    return true;
  }

  // Mode entry: exactly one '/' inserted at the caret, nothing else changed.
  if (!getIsCompCreateEnabled(store, docId)) return false;
  const isSlashInserted = textNext.length === textPrev.length + 1
    && offsetCaret > 0
    && offsetCaret <= textNext.length
    && textNext.charAt(offsetCaret - 1) === '/'
    && textNext.slice(0, offsetCaret - 1) === textPrev.slice(0, offsetCaret - 1)
    && textNext.slice(offsetCaret) === textPrev.slice(offsetCaret - 1);
  if (!isSlashInserted) return false;
  const docRecord = store.ensureDoc(docId);
  if (!docStoreGetOwningRowId(docRecord, segId)) return false;
  if (docRecord.interactionState.selectionState.isSelectionActive === true) return false;

  const resultPatch = applySegTextPatch(store, docId, segId, textNext);
  if (resultPatch.code !== 0) return true;
  store.segFocus(docId, segId, offsetCaret, 'compCreateInput');
  state.isActive = true;
  state.segId = segId;
  state.offsetSlash = offsetCaret - 1;
  state.textQuery = '';
  state.indexSelected = -1;
  watchdogStart(store, docId);
  return true;
}

// Handle one keydown of the hosting segment while the mode may be active.
// 'idle': mode is not active for this segment, normal handling.
// 'consume': handled here, caller prevents default and stops.
// 'pass': the mode reacted (possibly exited), the key then proceeds normally.
export function docStoreCompCreateHandleKey(
  store: DocStore,
  docId: string,
  segId: string,
  key: string,
  isModifierDown: boolean,
): CompCreateKeyAction {
  const state = docStoreCompCreateGetState(store, docId);
  if (!state.isActive || state.segId !== segId) return 'idle';
  if (isModifierDown) {
    // Shift/alt combinations (selection extension etc.) are not mode keys.
    // If they end up breaking the invariant, the watchdog exits the mode.
    return 'pass';
  }
  if (key === 'ArrowDown') {
    moveDropdownSelection(store, docId, 1);
    return 'consume';
  }
  if (key === 'ArrowUp') {
    moveDropdownSelection(store, docId, -1);
    return 'consume';
  }
  if (key === 'Enter') {
    if (state.indexSelected >= 0) {
      docStoreCompCreateApply(store, docId, state.indexSelected);
      return 'consume';
    }
    // Enter without a dropdown selection dismisses the mode; the '/query'
    // text stays. The next Enter splits normally.
    docStoreCompCreateExit(store, docId, 'enterWithoutSelection');
    return 'consume';
  }
  if (key === 'Escape') {
    docStoreCompCreateExit(store, docId, 'escape');
    return 'consume';
  }
  if (key === ' ') {
    // Exit first; the space then inserts normally, leaving '/xxx ' as text.
    docStoreCompCreateExit(store, docId, 'space');
    return 'pass';
  }
  if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Home' || key === 'End' || key === 'Tab') {
    // Any caret movement away from the region end breaks the fragile mode.
    docStoreCompCreateExit(store, docId, 'caretMove');
    return 'pass';
  }
  // Printable chars, Backspace, and Delete flow through the text input
  // handler, which updates the query or exits.
  return 'pass';
}

// The reason parameter documents each exit trigger at its call site; the
// exit behavior itself is the same for every reason.
export function docStoreCompCreateExit(store: DocStore, docId: string, reason = '') {
  watchdogDispose(store, docId);
  const state = docStoreCompCreateGetState(store, docId);
  if (!state.isActive) return;
  state.isActive = false;
  state.segId = '';
  state.offsetSlash = 0;
  state.textQuery = '';
  state.indexSelected = -1;
}

// Create the chosen component: consume the '/query' region and insert the new
// component at its position. Like an inline paste, the hosting segment keeps
// the text before the slash and a new segment of the same kind receives the
// text after the region, so the row structure stays uniform. The new
// component gets focus, which for example opens the source editor of an
// inline math segment.
export function docStoreCompCreateApply(store: DocStore, docId: string, indexApply: number) {
  const state = docStoreCompCreateGetState(store, docId);
  if (!state.isActive) {
    return { code: -1, message: 'Comp create mode is not active.' };
  }
  const matchList = docStoreCompCreateGetMatchList(store, docId);
  const entry = matchList[Number(indexApply)];
  if (!entry) {
    return { code: -1, message: 'No component chosen.' };
  }
  const segId = state.segId;
  const offsetSlash = state.offsetSlash;
  const textQuery = state.textQuery;
  // Exit before the edit: the edit changes the segment text, and the mode
  // must not react to its own creation edit.
  docStoreCompCreateExit(store, docId, 'apply');
  return store.runDocEdit(docId, 'compCreate', () => (
    applyCreateEdit(store, docId, segId, offsetSlash, textQuery, entry.compName)
  ));
}

function applyCreateEdit(
  store: DocStore,
  docId: string,
  segId: string,
  offsetSlash: number,
  textQuery: string,
  compNameCreate: string,
) {
  const docRecord = store.ensureDoc(docId);
  if (docRecord.config.isEditable !== true) {
    return { code: -1, message: 'Editing is disabled.' };
  }
  const segData = docRecord.compDataById[segId];
  if (!segData || segData.config?.isEditable !== true) {
    return { code: -1, message: `Segment not found or not editable. segId=${segId}` };
  }
  const rowId = docStoreGetOwningRowId(docRecord, segId);
  const rowData = docRecord.compDataById[rowId];
  if (String(rowData?.compName || '') !== 'Row') {
    return { code: -1, message: 'Owning row not found.' };
  }
  const text = docStoreGetSegmentText(segData);
  const offsetEnd = offsetSlash + 1 + textQuery.length;
  if (text.slice(offsetSlash, offsetEnd) !== `/${textQuery}`) {
    return { code: -1, message: 'Segment text no longer matches the create region.' };
  }
  const textLeft = text.slice(0, offsetSlash);
  const textRight = text.slice(offsetEnd);
  const contextEdit = docStoreGetActiveEdit(store, docId);
  const childIdListRow = Array.isArray(rowData.childIdList)
    ? rowData.childIdList.map((id) => String(id || ''))
    : [];

  if (docStoreGetSegTrait(compNameCreate).isRowExclusive === true) {
    // A row-exclusive component cannot sit next to other segments. Creation
    // is only accepted when the new component would be alone in its row:
    // the '/query' is the whole segment text and the segment is the only
    // child of its row. The segment is then replaced by the component.
    if (textLeft !== '' || textRight !== '' || childIdListRow.length !== 1) {
      return { code: -1, message: `${compNameCreate} is row-exclusive and needs an otherwise empty row.` };
    }
    const compIdNew = docStoreCreateCompId(docRecord, 'seg');
    editPutCompData(contextEdit, createCompDataNew(compIdNew, compNameCreate, segData));
    editSetChildIdList(contextEdit, rowId, [compIdNew]);
    editRemoveCompSubtree(contextEdit, segId);
    store.clearSelectionState(docId);
    store.applyFocusAfterEdit(docId, { compId: compIdNew, point: { offset: 0 } }, 'compCreate');
    return { code: 0, message: 'Component created.', data: { compIdCreated: compIdNew } };
  }

  // Ordinary segment: split the hosting segment around the consumed region.
  // The right half always exists so there is a text position directly after
  // the new component, mirroring the inline paste behavior.
  const compIdSetReserved = new Set<string>();
  const compIdNew = docStoreCreateCompId(docRecord, 'seg', compIdSetReserved);
  const segIdRight = docStoreCreateCompId(docRecord, 'seg', compIdSetReserved);
  editUpdateCompData(contextEdit, segId, {
    [docStoreGetSegmentTextFieldName(segData)]: textLeft,
  });
  editPutCompData(contextEdit, createCompDataNew(compIdNew, compNameCreate, segData));
  editPutCompData(contextEdit, docStoreCloneSegmentWithText(segData, segIdRight, textRight));
  const childIndexSeg = childIdListRow.indexOf(segId);
  editSetChildIdList(contextEdit, rowId, [
    ...childIdListRow.slice(0, childIndexSeg + 1),
    compIdNew,
    segIdRight,
    ...childIdListRow.slice(childIndexSeg + 1),
  ]);
  store.clearSelectionState(docId);
  store.applyFocusAfterEdit(docId, { compId: compIdNew, point: { offset: 0 } }, 'compCreate');
  return { code: 0, message: 'Component created.', data: { compIdCreated: compIdNew } };
}

// The new component starts with empty content, like createInlinePartSegCompData
// of the paste path. The component receives focus after the edit and offers
// its own editing entry (a math segment opens its source tooltip).
function createCompDataNew(compIdNew: string, compName: string, segDataTemplate: CompData): CompData {
  return {
    compId: compIdNew,
    compName,
    childIdList: [],
    data: { sourceId: compIdNew, text: '' },
    config: { isEditable: segDataTemplate?.config?.isEditable === true },
  };
}

function moveDropdownSelection(store: DocStore, docId: string, delta: number) {
  const state = docStoreCompCreateGetState(store, docId);
  const countMatch = docStoreCompCreateGetMatchList(store, docId).length;
  if (countMatch === 0) {
    state.indexSelected = -1;
    return;
  }
  if (delta > 0) {
    state.indexSelected = state.indexSelected < 0 ? 0 : Math.min(countMatch - 1, state.indexSelected + 1);
    return;
  }
  // ArrowUp on the first item deselects (back to -1); -1 stays -1.
  state.indexSelected = state.indexSelected <= 0 ? -1 : state.indexSelected - 1;
}

function applySegTextPatch(store: DocStore, docId: string, segId: string, textNext: string) {
  const segData = store.ensureDoc(docId).compDataById[segId];
  return store.updateCompDataByPatch(docId, segId, {
    [docStoreGetSegmentTextFieldName(segData)]: textNext,
  });
}

function getIsCompCreateEnabled(store: DocStore, docId: string) {
  const config = store.ensureDoc(docId).config;
  return config.isEditable === true && config.isCompCreateEnabled !== false;
}

// ---------------------------------------------------------------------------
// Watchdog: while the mode is active, one reaction observes everything the
// fragile invariant depends on and exits the mode when it breaks. The mode's
// own handlers update text, focus, and query inside one store action, so the
// watchdog only ever fires on genuinely external changes.

const watchdogDisposerByStore = new WeakMap<DocStore, Record<string, () => void>>();

function watchdogStart(store: DocStore, docId: string) {
  watchdogDispose(store, docId);
  const disposerByDocId = watchdogDisposerByStore.get(store) || {};
  watchdogDisposerByStore.set(store, disposerByDocId);
  disposerByDocId[docId] = reaction(
    () => {
      const docRecord = store.ensureDoc(docId);
      const state = docRecord.interactionState.compCreateState;
      const segData = docRecord.compDataById[state.segId];
      const focusState = docRecord.interactionState.focusState;
      return {
        isActive: state.isActive,
        segId: state.segId,
        offsetSlash: state.offsetSlash,
        textQuery: state.textQuery,
        textSeg: segData ? docStoreGetSegmentText(segData) : null,
        segIdFocused: focusState.segIdFocused,
        offsetFocused: focusState.offsetFocused,
        isSelectionActive: docRecord.interactionState.selectionState.isSelectionActive,
        isEnabled: getIsCompCreateEnabled(store, docId),
      };
    },
    (observed) => {
      if (!observed.isActive) return;
      const offsetEnd = observed.offsetSlash + 1 + observed.textQuery.length;
      const isValid = observed.isEnabled
        && observed.textSeg !== null
        && observed.segIdFocused === observed.segId
        && Number(observed.offsetFocused) === offsetEnd
        && observed.isSelectionActive !== true
        && String(observed.textSeg).slice(observed.offsetSlash, offsetEnd) === `/${observed.textQuery}`;
      if (isValid) return;
      runInAction(() => {
        docStoreCompCreateExit(store, docId, 'invariantBroken');
      });
    },
  );
}

function watchdogDispose(store: DocStore, docId: string) {
  const disposerByDocId = watchdogDisposerByStore.get(store);
  const disposer = disposerByDocId?.[docId];
  if (!disposer) return;
  disposer();
  delete disposerByDocId[docId];
}
