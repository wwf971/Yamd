# Row-Exclusive Segments

Some segment components must own their entire Row: if such a segment exists in a Row, it is the only segment in that Row. `TextBlockSeg` is the first component using this feature. This document describes the general mechanism.

## Invariant

A row-exclusive segment is always the sole entry of its Row's `childIdList`. The invariant is established at authoring time (document data must not place other segments next to it) and preserved by every doc-level structure operation afterwards.

## Declaration: segment traits

Exclusivity is declared through the segment trait registry in `src-mobx/docStoreSegTrait.ts`, following the same pattern as `registerCompDataDiffHandler`: the component module registers its traits once at load time, keyed by `compName`.

```ts
import { registerSegTrait } from '../../docStoreSegTrait';

registerSegTrait('TextBlockSeg', { isRowExclusive: true });
```

Doc-level logic never checks component names. It reads traits through helpers:

```ts
docStoreGetSegTrait(compName)         // full trait record
docStoreIsSegRowExclusive(compData)   // isRowExclusive by compData.compName
```

A trait is a static capability of the component type, not per-instance data. It is derived from `compName` deterministically, so it needs no serialization, no history participation, and cannot drift out of sync with document data.

## Enforcement points

Structure operations that could put another segment next to an exclusive segment (or move an exclusive segment next to others) check the trait and refuse:

- Row merge (`eventListRowMergePrevAttempt` in `src-mobx/event/eventLogicList.ts`). This is the single path where Backspace at the start of a row joins rows, so it covers both directions:
  - The current row contains an exclusive segment: the merge is rejected. An exclusive segment's content never flows into another row.
  - The previous row contains an exclusive segment (incoming merge): the merge is rejected. One natural fallback is kept: if the merging row holds a single empty segment, the row deletes itself instead (via `eventListRowDeleteAttempt`) and focus lands at the end of the exclusive row. This mirrors what merging an empty row into a normal row achieves, so pressing Backspace on an empty row below a text block still cleans it up.
- Cross-row selection delete (`eventListRowSelectionDeleteAttempt`). Normally the start row and end row merge into one row after the range is removed. If either edge row contains an exclusive segment, the rows are not merged: each edge row keeps its own trimmed edge segment, rows fully inside the selection are removed, and focus stays at the selection start.
- Segment drag (`getIsSegmentDropAllowed` in `src-mobx/docStoreDragMove.ts`). A drop is denied when the dragged segment is exclusive and the target row has other segments, or when the target row already contains an exclusive segment.

Operations that are safe by construction and therefore have no explicit check:

- Row split: the split result's first component stays in the left row with the segments before it, the rest go to a new row. An exclusive segment is the sole child, so both result rows hold exactly one segment.
- Within-row segment merge/delete: an exclusive segment has no row siblings, so these paths cannot involve it.
- Indent, outdent, row drag, list drag: they move whole rows or entries and never edit a row's segment list.
- Paste: markdown-list paste creates new one-segment rows; it never inserts sibling segments into the target row.

## Component-side obligations

The exclusive component itself must also behave consistently:

- Reject `selfMergeQuery` in both directions (as merge source and as merge target). The doc-level trait checks make this redundant for row joins, but selection edge merging also asks `selfMergeQuery`, and a rejection there keeps the two edge components separate.
- Keep `selfSplitQuery` returning components of its own kind (or other exclusive-compatible results), since each result component ends up alone in a row.

## UI behavior summary

With a text block row between two text rows:

- Backspace at the start of the text row below the block: rejected, the caret stays. If that row is a single empty segment, the row deletes itself and the caret moves to the end of the block.
- Backspace at offset 0 inside a non-empty block: nothing happens (the block does not merge out).
- Backspace or Delete inside an empty block: the block deletes itself (its row is removed).
- Selecting from a text row into the block and deleting: both rows survive with their remaining content; they are not joined.
- Dragging another segment onto the block row: drop denied (shown with the drop-denied style). Dragging the block next to other segments: drop denied.
