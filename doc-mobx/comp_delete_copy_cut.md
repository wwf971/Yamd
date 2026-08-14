# Delete, Copy, And Cut

This document describes range delete and range copy behavior for `List`, `Row`, and segment-level components.

For the selection state model, see `./comp_selection.md`.

## Range Delete

Range delete starts from the segment that receives Backspace or Delete while `selectionState.isSelectionActive` is true.

Current flow:

1. `TextSeg` emits `childSelectionDeleteAttempt` with the tracked anchor and focus points.
2. `Row` handles same-row selections.
3. `List` handles cross-row selections.
4. Segment-level components answer edit queries for their own selected text.
5. Row or list logic combines the component edit results and restores focus at the original selection start.

Selection kinds:

- same segment: ask that segment for `selfSelectionDeleteQuery`
- same row across segments: trim the start and end segment with `selfSelectionEdgeDeleteQuery`, delete middle segments, then merge the two edges
- cross row: trim edge rows, remove fully selected rows or segments, then merge the two boundary rows

`TextSeg` is only one segment implementation. Row and list logic should not assume text-specific internals beyond the query contracts.

## Range Copy

Range copy should produce markdown unordered list text.

Current flow:

1. the document shell handles the native `copy` event
2. the store reads `selectionState`
3. store walks selected rows in document order
4. row/list logic computes relative list depth
5. segment-level components answer `selfClipboardTextQuery`
6. store formats each selected row as markdown

Formatting:

```md
- first row text
  - nested row text
```

Indent text comes from `src-mobx/config.ts`. The current markdown indent unit is two spaces per list level.

The synchronous copy path reads current component data so the native copy event can be filled immediately. The async path asks components through `selfClipboardTextQuery`, so future segment types can decide their own clipboard text.

## Range Cut

The document shell handles the native `cut` event when a tracked range selection is active:

1. synchronously write the same markdown text used by copy to the native clipboard
2. call the store-level `cutSelection()` operation
3. route `childSelectionDeleteAttempt` from the selection focus segment through Row and List
4. record the accepted deletion as one normal history node

Cut does not contain `TextSeg` logic. It composes the generic clipboard-text and selection-delete contracts described above.

The store remembers the resulting history node, caret target, and clipboard text as short-lived runtime state. If the next paste has the same text at that exact unchanged caret and history node, paste restores the cut history node backward instead of rebuilding the range from markdown. Therefore both sequences have the same final document content and structure:

```text
range selection -> Ctrl+X -> Ctrl+V
range selection -> Ctrl+X -> Ctrl+Z
```

The exact-history restoration matters for cross-segment and cross-row ranges because markdown clipboard text cannot preserve arbitrary segment identities and boundaries. A paste after another document edit, at another caret, or with different clipboard text uses the normal paste behavior.
