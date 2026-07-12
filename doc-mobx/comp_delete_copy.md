# Delete And Copy

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
