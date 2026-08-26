# TextBlockSeg

`TextBlockSeg` (`src-mobx/comp/seg-text-block/`) is a multi-line plain-text block segment, similar to a code block without highlighting. It is the second segment implementation next to `TextSeg` and exists to prove the edit framework is component-agnostic.

It is a row-exclusive segment: it is always the only segment of its Row. See `./comp_seg_exclusive.md` for the mechanism.

## Data format

```yaml
seg-block-example:
  compName: TextBlockSeg
  childIdList: []
  data:
    text: |-
      first line
      second line
  config:
    isEditable: true
    style:
      colorBackground: '#1e293b'
      colorText: '#e2e8f0'
      fontSize: 13
      fontFamily: 'ui-monospace, Menlo, monospace'
```

- `data.text` is the full multi-line content, with `\n` line separators. It is the only content field; the generic copy/paste text contract uses the default `text` field name.
- `config.isEditable` gates all content and structure edits, like `TextSeg`.
- `config.style` holds appearance configuration; every field is optional:
  - `colorBackground` — block background, default grey `#f2f2f2`
  - `colorText` — font color, default `#1f2937`
  - `fontSize` — px number, default 13
  - `fontFamily` — default sans-serif

Defaults live in `TextBlockSeg.css`; `config.style` values are applied as inline styles on top.

## Edit behavior

- Typing, IME composition, and paste edit `data.text` through `updateCompDataByPatch`; continuous typing groups into one history node. A custom diff handler (`TextBlockSeg.history.ts`) records text changes as one splice, same policy as `TextSeg`.
- Enter inserts a newline inside the block. It never splits the row.
- Ctrl/Cmd+Enter splits the block at the caret into two blocks, which the List places in two separate rows.
- Backspace/Delete are handled as store edits. On an empty block they emit `childDeleteAttempt`, so the block deletes itself (and its row). Backspace at offset 0 of a non-empty block does nothing.
- The block rejects `selfMergeQuery` in both directions: content never merges into or out of the block.
- Paste first asks the store whether it matches the directly preceding cut at this exact caret (`tryRestoreCutByPaste`); on a match the pre-cut document is restored. Otherwise the clipboard text is inserted literally at the caret, keeping newlines, like a code block. It does not go through the doc paste pipeline.
- Arrow keys move the native caret inside the block. At the block boundary (offset 0 / end, first / last visual line) they emit `segNavigate`, so navigation to sibling rows works, including Shift-selection extension across the boundary.
- Tab / Shift+Tab emit `rowIndentAttempt` / `rowOutdentAttempt` as usual.
- Cross-segment selection offsets, selection delete, edge delete, and clipboard queries treat the content as one linear text (newlines count as one character), so the shared selection framework works unchanged.

## Selection across the block boundary

The block is a permanent `contentEditable` editing host, so the browser confines native mouse drags to it and refuses to extend an outside drag into it. The two directions need different handling, because a native drag that starts inside an editing host cannot be released from the confinement mid-drag — it overrides programmatic ranges for the rest of the gesture:

- a single-click drag starting inside the editable block is prevented at `mousedown` and runs fully programmatic from the start (`startSelectionDragFromTextSeg`): the caret is placed from the pointer position, and every mouse move builds the DOM range with `setBaseAndExtent`, so the selection can leave the block. Double and triple clicks keep native behavior; their word/line selection lives inside the block anyway
- a drag starting in a plain text segment (or a non-editable block) stays native and is monitored (`startSelectionDragAcrossEditableBoundary`); it switches to programmatic ranges when the pointer enters a `contentEditable` segment

The document-level `selectionchange` tracking then reads the DOM range into `selectionState` as usual. Keyboard extension across the boundary goes through `segNavigate` with `isSelectionExtend`, unchanged.

## Copy as fenced block

The trait `isCopyAsFencedBlock` (declared with `registerSegTrait`) tells the markdown copy serializer to format a block row as an empty list item followed by fenced lines, all indented one extra list level. With this selection (`|xxx|` marks selected content):

```text
- aa|a
  - {text\n-block\n-con|tent}
```

copy produces:

```md
- aa
  -
    ```
    text
    -block
    -con
    ```
```

A partially selected block contributes only the selected slice of its text; the fences are always included. Markdown renderers treat this as a code block belonging to the empty list item, and paste in this document rebuilds a block row from it.

## Pasting fenced blocks

`docStorePasteText` recognizes ```` ``` ```` fence pairs in pasted text (opening line may be indented; its indentation is stripped from the content lines; an unclosed fence falls back to plain-text paste).

Because the block is row-exclusive, pasting into a text segment splits the caret row. Flat text mixed with fences ("chunk" mode) becomes alternating sibling rows; with the caret at `bb|b`:

```text
- aaa
  - bb|b
    - ccc
```

pasting `111\n```\nblock\n```\n222` produces:

```text
- aaa
  - bb111
  - {block}
  - 222b
    - ccc
```

The first text part joins the left half of the split segment, the last text part joins the right half, and the caret row's child entries stay below the last row.

When the pasted text is a markdown list ("list" mode), fenced blocks integrate into the list structure:

- a fence indented deeper than an empty list item right above it becomes that item's block row (the serialized copy form round-trips)
- a fence indented deeper than a non-empty list item becomes a block child row of that item
- any other fence becomes a sibling block row

Cut and paste use the same serialization, so select → cut → paste restores the exact pre-cut state through the cut-restore path (see `./comp_delete_copy_cut.md`).

## Copy button

A copy button sits at the top-right corner of the block, outside the `contentEditable` element. Clicking it writes the full raw `data.text` to the clipboard (no fences), so a block can hold paste test data that is copied and pasted as-is. Its mousedown is swallowed, so pressing it never moves the caret or clears a selection.

## Rendering notes

- The root is one `contentEditable` div (switched by `isEditable`), rendering exactly one plain text child, as required by the custom component rules.
- The rendered text is `data.text` plus one trailing phantom newline, so a real trailing newline shows as a visible empty last line. All logical offsets are clamped to `data.text.length`; the phantom is never part of the content or of any offset sent to the store.
- The native caret is used (no logical caret overlay). The store focus offset stays in sync through the document-level `selectionchange` tracking plus explicit `segFocus` updates on focus, click, and text edits.
- Bullet position is measured from the first text line, so a list bullet aligns with the block's first line.
