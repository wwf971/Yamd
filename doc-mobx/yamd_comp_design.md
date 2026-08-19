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

## Segment component contract

A component is a segment when its id appears directly in `Row.childIdList`. Row, List, selection, and history logic recognize that structural position; they do not require `compName: 'TextSeg'`.

### Registration and imports

The component renderer maps `CompData.compName` to a React component. Standard components, `compByNameDefault`, and `getCompByName` are exported through the stable `src-mobx/CompCommon.ts` entry point. Consumers should import from that module instead of depending on component implementation paths.

The current test shell only extends the standard map with test-only components:

```ts
const compByName = {
  ...compByNameDefault,
  ExampleSeg,
};
```

The shell registers each mounted component with `DocStore.registerComp()`. A segment should use `forwardRef` and expose `dispatchEvent(event)` so store-to-component focus commands and edit queries can reach it.

### Segment traits

A segment component can declare static structural capabilities for its `compName` through `registerSegTrait` in `src-mobx/docStoreSegTrait.ts`, registered at module load like a diff handler. Doc-level logic reads traits through `docStoreGetSegTrait` / `docStoreIsSegRowExclusive` instead of checking component names. The first trait is `isRowExclusive`: the segment must be the only segment of its Row, and structure operations refuse to place other segments next to it. See `comp_seg_exclusive.md` for the full mechanism; `TextBlockSeg` is the reference implementation.

Until there is a public MobX entry point, an in-repository segment imports the pieces it needs directly:

```ts
import { observer } from 'mobx-react-lite';
import { useDocStoreContext } from '../DocStoreContext';
import type { CompData, CompEvent, SelectionTrackPoint } from '../docStoreTypes';
import { registerCompDataDiffHandler } from '../docStoreVersion'; // optional
import { useDocDragInteraction } from '../util/useDocDragInteraction'; // optional
```

The renderer passes `{ compId }` to the component. Resolve the live record from context instead of treating the initial prop as a persistent copy:

```ts
const contextDocStore = useDocStoreContext();
const compData = contextDocStore?.store.getCompDataById(contextDocStore.docId, compId);
const dataComp = compData?.data || data || {};
const configComp = compData?.config || config || {};
```

### DOM identity, focus, and selection

The segment root exposes these attributes:

```tsx
<span
  data-mobx-comp-id={compId}
  data-mobx-comp-name="ExampleSeg"
  data-mobx-seg-id={compId}
>
  {content}
</span>
```

- `data-mobx-comp-id` maps DOM activity to component runtime state.
- `data-mobx-seg-id` is used by Row navigation, DOM selection reading, selection restoration, and segment drag lookup.
- `data-mobx-comp-name` should match `compName` for inspection.

On browser focus, call `updateElActiveState()` and `segFocus()`. Handle inbound `focus` and `clickSingle` events by focusing the element and applying the supplied offset or direction. When arrow movement crosses the component boundary, emit `segNavigate` and let Row or List choose the next segment.

Selection offsets are calculated from the segment root's `textContent`. A text-selectable segment must keep visible text and its logical linear offset model aligned. A compound widget that cannot expose one linear text offset needs a component-specific selection adapter; the current implementation does not provide one.

### Events emitted by an editable segment

Use `onEvent` for operations that cross the segment boundary:

```text
segNavigate                    arrow movement leaves the segment
childSplitAttempt              Enter splits the segment or row
childMergePrevAttempt          Backspace/Delete at the left boundary
childDeleteAttempt             content editing makes the segment removable
childSelectionDeleteAttempt    Backspace/Delete acts on an active range
childPasteAttempt              native paste supplies text and a point
rowIndentAttempt               Tab
rowOutdentAttempt              Shift+Tab
```

Include `compIdChild` and the current `{ offset }` point for structure attempts. Selection deletion and paste also include the tracked anchor and focus points. Ordinary content input calls `updateCompDataByPatch()`; it does not need to emit a separate structure event.

### Queries handled by an editable segment

Queries arrive through `dispatchEvent()`. They are read-only preparations: the segment returns a result, then Row, List, or the store applies it in one edit transaction.

```text
selfSplitQuery                 return replacement components and focus target
selfMergeQuery                 merge compatible segment data or reject
selfDeleteQuery                return deleteSelf or reject
selfIsEmptyQuery               return { isEmpty }
selfSelectionDeleteQuery       remove a range inside one segment
selfSelectionEdgeDeleteQuery   keep content before or after one endpoint
selfClipboardTextQuery         return text for optional start/end offsets
```

Structure-changing queries return the common `CompEditResult` shape:

```ts
{
  op: 'replaceSelf' | 'replaceRange' | 'deleteSelf' | 'noop',
  compIdListOriginal: string[],
  compListNext: CompData[],
  focus?: { compId: string, point?: { offset: number } },
}
```

Reject incompatible merge pairs rather than assuming every segment contains text. Return `noop` for an accepted operation with no data range to change.

### Copy and paste text contract

The generic synchronous copy and paste paths use `config.fieldNameText || 'text'`. Set `fieldNameText` when the segment stores its plain-text representation under another data field:

```ts
config: {
  isEditable: true,
  fieldNameText: 'value',
}
```

The asynchronous markdown copy path first asks `selfClipboardTextQuery` and falls back to the configured text field. Plain-text paste writes that field. Markdown-list paste clones the target segment type and Row configuration, then supplies each item through the same field.

An opaque component without a meaningful plain-text representation can still render and participate in structural operations, but the current clipboard system needs an adapter before copy and paste are complete for that component.

### Optional drag and bullet behavior

For segment dragging, use `useDocDragInteraction()` and expose `data-mobx-drag-item-id="segment:<compId>"`.

List bullet measurement delegates through Row to a segment provider. A custom first segment should report a compatible bullet position through the store APIs or accept fallback positioning. This behavior is not yet extracted into a reusable segment hook.

### Current integration boundary

Custom segments are practical inside this repository, but the integration surface is not yet a stable external component SDK:

- event names and result data are string-based instead of discriminated TypeScript unions
- the complete registry and document shell are assembled in `src-mobx/test/TestItems.jsx`
- List and Row consume `DocCompRenderContext` from the test folder
- there is no public barrel export for MobX component-development APIs
- compound selection and non-text clipboard adapters are not defined

Before publishing third-party segment packages, move the render context and shell out of the test folder, define typed event/query contracts, and expose a supported MobX entry point.

### Verification

Add an in-repository segment to `compByNameForTest`, place it directly under a Row in an existing or temporary test document, and verify:

- click, focus commands, and arrow navigation
- same-segment and cross-segment selection offsets
- split, merge, empty deletion, and range deletion
- Tab and Shift+Tab with preserved focus or selection
- synchronous and asynchronous copy and both paste forms
- undo and redo of content, structure, focus, and selection
- read-only rejection without partial mutation
- drag and bullet alignment when those optional features are supported

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
