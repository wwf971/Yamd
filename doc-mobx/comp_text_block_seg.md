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
- Paste inserts the clipboard text literally at the caret, keeping newlines, like a code block. It does not go through the doc paste pipeline.
- Arrow keys move the native caret inside the block. At the block boundary (offset 0 / end, first / last visual line) they emit `segNavigate`, so navigation to sibling rows works, including Shift-selection extension across the boundary.
- Tab / Shift+Tab emit `rowIndentAttempt` / `rowOutdentAttempt` as usual.
- Cross-segment selection offsets, selection delete, edge delete, and clipboard queries treat the content as one linear text (newlines count as one character), so the shared selection framework works unchanged.

## Rendering notes

- The root is one `contentEditable` div (switched by `isEditable`), rendering exactly one plain text child, as required by the custom component rules.
- The rendered text is `data.text` plus one trailing phantom newline, so a real trailing newline shows as a visible empty last line. All logical offsets are clamped to `data.text.length`; the phantom is never part of the content or of any offset sent to the store.
- The native caret is used (no logical caret overlay). The store focus offset stays in sync through the document-level `selectionchange` tracking plus explicit `segFocus` updates on focus, click, and text edits.
- Bullet position is measured from the first text line, so a list bullet aligns with the block's first line.
