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

### Cross-row delete details

The List that contains both selection endpoints in its subtree handles the delete; a List where one endpoint is outside bubbles the event to its parent. Rows are walked in document order across nesting depths, so the endpoints may sit at different depths.

All checks run as queries before one edit transaction, so a rejection leaves the document untouched — no rollback is needed. The delete behaves as if each part were deleted on its own, and one rejected part rejects the whole delete:

- the start row keeps its text before the selection
- rows fully inside the selection are removed together with their entries; every fully deleted segment must accept `selfDeleteQuery`
- the end row keeps its text after the selection and normally merges into the start row

Rejections keep the structure valid. A fully selected row whose entry still contains surviving rows cannot be removed, and merging removes the end row, so an end row with child rows below it is rejected the same way:

```text
- a|aa
  - b|bb
    - ccc
```

This delete is rejected: merging `bb` into `a` removes the `bbb` row, and `ccc` would lose its parent row.

When an edge row holds a row-exclusive segment (a text block), the two edge rows are not merged. Each keeps its own trimmed edge, so nested rows below the end row survive and nothing is rejected for structure:

```text
- a|aa
  - {text\n-block\n-con|tent}
```

deletes to:

```text
- a
  - {tent}
```

An exclusive-edge row trimmed to empty whose entry has no surviving rows below it is removed entirely instead of remaining as an empty row.

Edge merging also respects segment style: when the two trimmed edge segments carry different text styles, the merge query is rejected and the edges stay side by side as two segments (see `comp_text_style.md`).

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

A row whose single segment declares the `isCopyAsFencedBlock` trait (a text block row) serializes as an empty list item followed by fenced lines, indented one extra list level:

```md
- first row text
  -
    ```
    block line one
    block line two
    ```
```

Pasting this form back rebuilds the block row; see `./comp_text_block_seg.md` for the paste rules.

The synchronous copy path reads current component data so the native copy event can be filled immediately. The async path asks components through `selfClipboardTextQuery`, so future segment types can decide their own clipboard text. A segment whose clipboard form differs from its raw text field can register the `createClipboardText` trait (see `docStoreSegTrait.ts`); both copy paths then use it (an inline math segment serializes as `$source$`). Symmetrically, the `parsePasteInline` trait lets a segment recognize inline markup in pasted plain text and split the paste into text and widget segments; see `src-mobx/comp/seg-math-inline/seg_math_inline.md`.

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
