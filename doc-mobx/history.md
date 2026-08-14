# Edit history

Edit history records accepted document changes and supports undo, redo, and branch selection.

## History boundary

`DocStore` is the only owner of document history. Render components do not keep local undo stacks and do not call browser undo for document changes.

One user edit creates at most one history node:

```text
prepare queries
  -> runDocEdit()
      -> create edit context
      -> apply synchronous changes through context helpers
         (before state of each touched comp captured on first touch)
      -> reject: restore touched comps only
      -> accept with no real change: create no node
      -> accept with changes: write version records, append or combine one node
```

Queries such as `selfSplitQuery`, `selfMergeQuery`, and `selfDeleteQuery` are read-only. Async work finishes before `runDocEdit()` starts. The transaction callback stays synchronous so unrelated edits cannot enter the same transaction.

## Recorded state

History records per-comp version transitions instead of document snapshots. Every live comp record carries a `versionId` (random `0-9 a-z` string). A comp state is identified by `compId + versionId`. Version content lives in a per-doc version store; history nodes hold references only:

```ts
type CompChange = {
  compId: string;
  versionBefore: string;   // '' when the edit created the comp
  versionAfter: string;    // '' when the edit removed the comp
};

type DocEditChangeSet = {
  compChangeList: CompChange[];
  docChange: DocChange | null;   // root comp id and doc text transitions
};
```

`versionId` is session state. It is excluded from `getDocYamlRaw()` output, and loading a document assigns fresh ids.

History does not record these ui states as document changes:

- logical focus
- DOM active element
- DOM selection track
- drag preview
- bullet measurement
- component registry and DOM element references

A history node can carry focus and range selection restore hints for the state before and after an edit. These hints control the caret and selection after undo or redo, but changing focus or selection alone never creates a history node. Undo restores `selectionBefore` and redo restores `selectionAfter` when the referenced segments still exist; otherwise they clear the selection and fall back to the focus hint.

## Tree model

Redo history is a tree instead of one forward stack.

```text
root
  -> A
      -> B
          -> C
          -> D
```

If the current node is `B`, undo moves to `A`. A new edit from `A` creates another child instead of deleting `B`. Redo without a child id follows the preferred child. Redo with a child id selects a branch explicitly.

Store state:

```ts
type DocHistoryNode = {
  nodeId: string;
  nodeIdParent: string | null;
  nodeIdChildList: string[];
  typeEdit: string;
  kindEdit: 'compData' | 'structure';
  timeCreated: number;
  changeSet: DocEditChangeSet;
  focusBefore?: CompFocusTarget;
  focusAfter?: CompFocusTarget;
  groupKey?: string;
};

type DocHistoryState = {
  nodeById: Record<string, DocHistoryNode>;
  nodeIdRoot: string;
  nodeIdCurrent: string;
  nodeIdRedoPreferredByNodeId: Record<string, string>;
  versionStore: CompVersionStore;
  isApplying: boolean;
  isUndoAvailable: boolean;
  isRedoAvailable: boolean;
  versionHistory: number;
  limitNode: number;
};
```

`kindEdit` is derived at commit: `structure` when any comp was created or removed, any `childIdList` or `mainCompId` changed, or the root changed; otherwise `compData`.

`DocHistoryState` belongs to each `DocRecord`. Components observe it through store APIs.

## Change storage

Version content is stored in `docStoreVersion.ts` as `CompVersion` records, either `full` (self-contained comp data) or `diff` (based on `versionIdBase`, forward-only). Undo never reverts a diff; it materializes the older version by walking the base chain to the nearest full record and applying diffs forward. Chains are cut automatically: after 16 diffs a commit stores a full record instead, and `checkpointCompVersion()` converts any diff version to full explicitly.

How a `data` diff is described and applied is component-defined. A component registers a handler for its `compName`:

```ts
registerCompDataDiffHandler(compName, {
  createDataDiff: (dataBefore, dataAfter) => any | null,  // null declines
  applyDataDiff: (dataBase, dataDiff) => dataNext,
});
```

`TextSeg` registers a splice diff: `{ offset, countDelete, textInsert }` against the base version. Doc-level logic never interprets diff content; without a handler (or on decline) it falls back to generic field-level changes. Structure fields (`childIdList`, `mainCompId`, `config`) are always diffed centrally.

Version records are created lazily: the first edit that touches a comp writes one full record for the before state. Unedited comps never enter the version store. Generated component ids are normal recorded data, so redo restores the same ids. All component creation uses the shared `docStoreCreateCompId()` allocator.

History pruning removes old leaf branches first. It must not remove the current node, its ancestor chain, or the preferred redo path. Because nodes hold refs only, moving the root forward is plain re-rooting. After node pruning, a mark-and-sweep reclaims version records: mark every version referenced by surviving nodes, expand marks along diff base chains, delete the rest.

## Edit grouping

Continuous text input should not create one node for every browser input event.

`runDocEdit()` accepts edit metadata:

```ts
type DocEditOptions = {
  typeEdit: string;
  groupKey?: string;
  timeGroupMs?: number;
};
```

The transaction captures `focusBefore` and `focusAfter` from store state.

Two accepted edits can combine when:

- both have the same non-empty `groupKey`
- both are on the current branch
- elapsed time is within `timeGroupMs`
- both are `kindEdit: 'compData'` (structural edits always create separate nodes)
- no undo, redo, paste, composition end, selection replacement, or focus target change separates them

Text input can use `groupKey: text:<compId>`. Combining is reference composition: per comp id, keep the oldest `versionBefore` and the newest `versionAfter`. Skipped intermediate versions stay reachable as diff bases until pruning reclaims them.

## Store API

Document editing:

```ts
store.runDocEdit(docId, options, applyEdit)
store.getEditState(docId)
```

History navigation:

```ts
store.undoDocEdit(docId)
store.redoDocEdit(docId, nodeIdChild?)
store.setRedoBranch(docId, nodeIdChild)
store.clearDocHistory(docId)
store.getDocHistoryState(docId)
store.getDocHistoryBranchList(docId)
```

Version store:

```ts
store.registerCompDataDiffHandler(compName, handler)
store.getCompVersion(docId, versionId)
store.getCompVersionIdList(docId, compId)
store.getCompDataAtVersion(docId, versionId)   // materialized clone
store.checkpointCompVersion(docId, versionId)  // diff -> full
store.pruneDocHistory(docId, limitNodeKeep?)   // node prune + version sweep
```

Result shape:

```ts
type DocHistoryResult = {
  code: number;
  message: string;
  data?: {
    nodeIdBefore: string;
    nodeIdAfter: string;
  };
};
```

Observable availability belongs to history state or store getters:

```ts
store.getIsUndoAvailable(docId)
store.getIsRedoAvailable(docId)
```

## Undo and redo flow

Undo:

```text
check current node has parent
  -> set history isApplying
  -> validate: every entry's live comp versionId === versionAfter,
     every versionBefore materializable (fail applies nothing)
  -> write materialized versionBefore states, delete created comps
  -> move nodeIdCurrent to parent
  -> restore selectionBefore when valid,
     else clear selection and restore focusBefore after render
  -> clear history isApplying
```

Redo:

```text
choose explicit child or preferred child
  -> set history isApplying
  -> validate against versionBefore, materialize versionAfter
  -> apply, move nodeIdCurrent to child
  -> remember preferred child
  -> restore selectionAfter when valid,
     else clear selection and restore focusAfter after render
  -> clear history isApplying
```

The version check verifies undo and redo stand on the exact expected document state in O(entries) time. A failure means history and document desynced; the operation returns a non-zero code and `clearDocHistory()` recovers. Applying history must bypass history recording. `isApplying` prevents undo and redo from creating new nodes.

## Keyboard API

The document shell handles shortcuts and calls store APIs:

- Ctrl or Command with Z calls `undoDocEdit`
- Ctrl or Command with Shift and Z calls `redoDocEdit`
- Ctrl or Command with Y calls `redoDocEdit`

The shell prevents native browser handling only when the event belongs to the document and the store accepts the operation. Segment components do not implement separate undo logic.

## Segment contract

Document-level logic treats every direct `Row.childIdList` entry as a segment. Content-specific behavior stays behind component queries:

```text
selfSplitQuery
selfMergeQuery
selfDeleteQuery
selfIsEmptyQuery
selfSelectionDeleteQuery
selfSelectionEdgeDeleteQuery
selfClipboardTextQuery
```

`CompEditResult` is the common edit description returned by segment components. Row and List logic combines these results, then the store commits them through one edit transaction.

For synchronous clipboard formatting and plain-text paste, a segment can set `config.fieldNameText`. The default field is `text`. This is a segment interoperability contract, not a `TextSeg` document rule.

## Initialization and external replacement

`initCompData()` and loading a different document establish a new history root. They do not create an undoable edit.

Replacing data from a remote source must declare one policy:

- reset history to the received document
- rebase local history onto the received document
- record the received change as an explicit edit

The default policy is reset. Silent document replacement while keeping old patches is invalid.

## Edit context

`runDocEdit()` creates one `DocEditContext` per transaction. All semantic document mutation goes through context helpers in `docStoreEditContext.ts` (`editUpdateCompData`, `editPutCompData`, `editRemoveCompSubtree`, `editSetChildIdList`, `editSetMainCompId`, `editSetCompIdRoot`, `editUpdateDocText`, and so on). On first touch of a comp id, the helper clones that one comp record; helpers then mutate the live MobX record in place. Domain logic reaches the context through `docStoreGetActiveEdit()`, which throws outside a transaction. Nested `runDocEdit()` calls join the existing context.

Commit diffs only touched comps, writes version records for real changes, and hands the change set to history. Rejected edits and thrown errors restore only the touched comps from their before clones.

Cost is O(comps touched) per edit for commit and rollback, and O(entries in one node) materializations for undo and redo, each bounded by the diff chain checkpoint interval. History memory is O(changed data). See `history_update.md` for the full design.
