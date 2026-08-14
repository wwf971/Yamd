# Selection Model

This document describes DOM text selection in the MobX document renderer.

For logical focus behavior, see `./comp_focus.md`.

For event routing, see `./event_comp.md`.

For range delete, copy, and cut behavior, see `./comp_delete_copy_cut.md`.

## Core Idea

Browser DOM selection is the primary selection mechanism. Mouse drag, word selection, caret placement, browser range painting, and native copy all start from `window.getSelection()`.

`DocStore` does not replace browser selection. It keeps a document-level selection track so row, list, copy, delete, indent, and outdent logic can understand which document components the current DOM range touches.

There is no separate logical selection concept. The system has:

- logical focus: store-managed component target for navigation and event routing
- `doc.ElActive`: the browser active element mapped to a component id
- DOM selection: the browser caret or range
- selection track: store snapshot of DOM selection endpoints in component coordinates

Selection and focus are related, but they are independent. A text range can remain active while logical focus moves from a leaf segment to a parent `Row` or `List`. Shift-click focus expansion should not create or change a DOM text range.

## Store State

There is one `selectionState` per document under `DocRecord.interactionState`.

```ts
type SelectionTrackPoint = {
  compId: string;
  segId: string;
  offset: number;
};

type SelectionState = {
  isSelectionActive: boolean;
  mode: 'caret' | 'range';
  pointAnchor: SelectionTrackPoint | null;
  pointFocus: SelectionTrackPoint | null;
};
```

`pointAnchor` and `pointFocus` mirror the browser selection endpoints. Each point records the segment id and offset inside that segment.

`mode='caret'` means the DOM selection is collapsed. `mode='range'` means the DOM selection has a visible range.

## Component Runtime Flags

Components do not own local range selection state. Store derives visual flags from document-level `selectionState`.

```ts
type CompRuntimeState = {
  isSelectionWithin: boolean;
};
```

`isSelectionWithin` is true for endpoint components and their ancestors. It is used for visual state and debug display, not as another selection source of truth.

## Reading DOM Selection

The document shell listens to browser `selectionchange` and converts DOM endpoints into selection track points.

Current code locations:

- `TestItems.jsx`: installs `document.addEventListener('selectionchange', ...)`
- `eventLogicRow.ts`: `selectionStateReadFromDom`
- `eventLogicRow.ts`: `selectionPointRead`
- `eventLogicRow.ts`: `selectionOffsetRead`
- `docStore.ts`: `updateSelectionState`

Collapsed caret updates can also update focus offset. Range updates should update `selectionState` without making each component own a local selected range.

## Writing DOM Selection

Most user selection should stay browser-owned. Store-to-DOM selection restore is only needed after operations that re-render or move selected components.

Current code locations:

- `TestItems.jsx`: `applyRangeSelectionToDom`
- `docStoreEdit.ts`: `restoreDomSelectionAfterRender`
- `docStoreEdit.ts`: `getDomPointBySelectionPoint`

Structure edits such as indent and outdent may preserve an active range by restoring the previous selection track after render.

## Cross-Component Range

Cross-component DOM selection is tracked with two endpoints:

- `pointAnchor`
- `pointFocus`

The covered component range can be derived from document order:

1. Convert endpoints to comparable document positions.
2. Normalize start and end positions.
3. Mark intersected segment-level components.
4. Derive `isSelectionWithin` for parent `Row` and `List` components.

This keeps selection generic. Document-level code should work with component ids, segment ids, offsets, and event/query contracts. It should not assume `TextSeg` is the only possible segment component.

## Same-Segment Range

One segment supports selection start and end offsets naturally.

```ts
selectionState = {
  isSelectionActive: true,
  mode: 'range',
  pointAnchor: { compId: 'segA', segId: 'segA', offset: 5 },
  pointFocus: { compId: 'segA', segId: 'segA', offset: 21 },
};
```

Collapsed caret in one segment:

```ts
selectionState = {
  isSelectionActive: false,
  mode: 'caret',
  pointAnchor: { compId: 'segA', segId: 'segA', offset: 12 },
  pointFocus: { compId: 'segA', segId: 'segA', offset: 12 },
};
```

## Focus Interaction

Normal click inside a segment collapses an active range and moves the caret to the clicked offset.

Shift-click is different. It is a logical focus operation. It expands focus upward through `TextSeg`, `Row`, and `List` levels and should not change DOM text selection. When focus reaches the root `List`, shift-click cycles back to the clicked leaf while preserving the stored caret offset.

For the focus cycle, see `./comp_focus.md`.

## Copy And Delete

Range delete and copy use `selectionState`.

Delete starts from the focused segment receiving Backspace or Delete, then row/list logic uses the tracked endpoints to decide whether the range is inside one segment, one row, or multiple rows.

Copy reads the tracked range and formats selected rows as markdown text.

For details, see `./comp_delete_copy_cut.md`.
