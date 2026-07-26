# Custom Component Design

How to implement a custom document component that works correctly with the doc store and its history system. `TextSeg` is the reference implementation, but nothing in the doc-level logic is specific to it; every rule here applies to any segment or block component.

## Data contract

A component owns one flat record in `compDataById`:

```ts
type CompData = {
  compId: string;
  compName: string;
  versionId?: string;      // store-owned session state, never touch
  childIdList: string[];   // structure, owned by doc-level logic
  mainCompId?: string;     // structure, owned by doc-level logic
  data: any;               // component content
  config: any;             // component configuration
};
```

Rules:

- Everything the component wants to persist, undo, copy, or serialize lives in `data` and `config`, and must be plain serializable values.
- `versionId` identifies the current state of the record for history. The store assigns and bumps it. Components never read or write it.
- `childIdList` and `mainCompId` are structure fields. Doc-level operations (indent, outdent, drag move, split, merge, paste) change them through the edit context. Components do not edit structure fields directly.
- Operational state is not document data: focus, DOM element references, selection, drag preview, measurement results. These live in store runtime state and never enter history.

## Mutation rules

All persistent changes go through store APIs inside an edit transaction:

```text
user gesture in component
  -> component calls a store API
     (updateCompDataByPatch, or an event that ends in runDocEdit)
  -> edit context records the before state of each touched comp
  -> commit diffs touched comps, writes version records, appends history
```

- Never assign into `compData.data` or `compData.config` directly. Semantic mutation outside an active edit throws.
- A rejected edit (`code !== 0`) rolls back every touched comp. Return non-zero instead of mutating defensively.
- Use `groupKey` and `timeGroupMs` edit options to combine bursts (continuous typing, continuous strokes) into one history node.

## History participation levels

### Level 0: nothing to implement

The default. When a component's `data` changes, the commit records a generic field-level diff. Undo and redo replace the whole `data` object. This is correct for any component that renders purely from `data`. Small components should stay at this level.

### Level 1: custom diff handler

When `data` is large and edits are small (long text, drawing documents), register a diff handler for the `compName`:

```ts
registerCompDataDiffHandler(compName, {
  createDataDiff: (dataBefore, dataAfter) => any | null,
  applyDataDiff: (dataBase, dataDiff) => dataNext,
});
```

- `createDataDiff` returns a component-defined description of the change, or `null` to decline (the generic field diff then takes over). Decline anything you cannot describe compactly.
- `applyDataDiff` rebuilds the next `data` from a base `data` plus one diff. It runs during undo, redo, and checkpointing.
- Both functions must be pure and deterministic: no DOM access, no component instance state, no randomness. The store may replay a chain of diffs long after the component unmounted.
- The diff value must be serializable and self-contained. Doc-level logic never interprets it.
- Diffs are forward-only. Undo never reverses a diff; the store materializes the older version from a full record plus forward diffs.

`TextSeg` is the example: a text-only change becomes `{ offset, countDelete, textInsert }`; any other data change declines to the generic fallback.

## Rendering rules

- Render purely from `data`, `config`, and store runtime state. With MobX, read them in the observer component; undo and redo then update the view automatically.
- Tolerate whole-record replacement at any time. Undo, redo, and version materialization write a new `data` object into the record. Do not cache persistent content in `useState`, refs, or module state; a component that caches will show stale content after undo.
- Do not let the browser own DOM that React manages. If the component uses `contentEditable`, the browser mutates children directly; React must render exactly one plain text child there, and any decoration (caret, badge) must be a pseudo-element or live outside the edited element. Violating this crashes React on unmount (`removeChild` NotFoundError).
- Never use browser-native undo. Document changes go through the store; the shell routes Ctrl or Command with Z to `undoDocEdit`.

## Components with internal history

Some wrapped components (an Excalidraw canvas, a code editor, a spreadsheet) ship their own comprehensive edit log and internal undo/redo. Two histories over the same content cannot both be authoritative.

### Operation classes

Classify every operation on such a component:

```text
doc structural operation
  indent, outdent, drag move, delete, copy, paste of the component
  -> treats the component as opaque, does not touch data content
  -> handled entirely by doc-level logic, nothing to implement
  -> internal engine state survives, because data is not replaced

internal content operation
  strokes, shape edits, cell edits inside the component
  -> must end as a doc store edit on the component's data
  -> becomes a within-node history entry like any other data change
```

Structural operations need no special handling precisely because they never touch `data`. The component's only obligations are for internal content operations and for reacting to external `data` replacement.

### Single history authority

The doc history is the single authority for committed state. The internal log is an editing aid, not a second source of truth. Two workable policies:

- Bridged (recommended): disable or ignore the internal undo stack. Commit every internal operation (debounced or gesture-scoped) to the store via `updateCompDataByPatch`, with a `groupKey` such as `draw:<compId>` so one gesture is one history node. Route the component's undo gesture to the doc store. Undo granularity is then controlled by grouping, and one Ctrl+Z stream works across the whole document.
- Scoped: the internal log covers only uncommitted transient state (mid-gesture, tool previews). On gesture end, commit the consolidated result to the store and clear the internal log. Internal undo can only cancel the uncommitted tail; everything committed is undone through doc history.

What does not work: letting internal undo rewrite committed `data` outside a transaction (throws, and desyncs history), or keeping an internal log that claims to undo states the doc history also tracks (the two logs diverge on the first doc-level undo).

### Reacting to external replacement

Doc undo, redo, and checkpoint materialization replace the component's `data` wholesale. The wrapper must:

- observe `data` and rebuild the internal engine state from it whenever it changes for a reason other than its own commit (compare against the last value it committed);
- invalidate its internal log at that moment, since the log no longer matches the content.

### Diff handler for op-based components

An op-based component fits Level 1 naturally: `createDataDiff` returns the operation list of the committed gesture, and `applyDataDiff` replays those operations on a base document. Replay must be deterministic (ids generated during the original gesture are recorded inside the ops, not regenerated). If the operation format cannot be replayed reliably, decline and let the generic diff store field snapshots; correctness beats compactness.
