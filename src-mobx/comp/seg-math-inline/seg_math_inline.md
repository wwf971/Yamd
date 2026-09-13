# MathInlineSeg: Inline LaTeX Math Segment

`MathInlineSeg` renders one inline latex formula as svg inside a Row. It is also the demonstration of how a custom, non-text segment integrates with the doc store, the history system, selection, clipboard, and bullet positioning. Everything specific to the component lives in this folder.

Files:

- `MathInlineSeg.tsx`: the segment component and its trait registration
- `MathInlineSeg.editResults.ts`: edit query results, clipboard serialization, `$...$` paste parser
- `mathJaxSvg.ts`: MathJax loading, no-scan initialization, tex-to-svg conversion with a shared observable cache
- `MathInlineSeg.css`

## Data contract

```yaml
seg-example:
  compName: MathInlineSeg
  data:
    text: 'a \leqslant b'   # latex source, without $ delimiters
  config:
    isEditable: true
```

`data.text` is the only persistent content. The rendered svg is derived state and never enters the doc store or history. Source edits go through `updateCompDataByPatch`, so continuous typing groups into one history node exactly like `TextSeg` typing, and undo/redo re-render the formula from the restored source.

## MathJax rendering

The svg pipeline is fully contained in `mathJaxSvg.ts`. Two requirements carried over from the jotai version:

- Load the full build `tex-svg-full.js` from CDN. The plain `tex-svg.js` build lacks the TeX extension glyphs, and commands such as `\leqslant` and `\geqslant` render as errors instead of slanted comparison signs. The config also loads the `ams`, `boldsymbol`, `bm`, `mathtools`, and `physics` packages.
- Initialize without a document scan. The MathJax default startup scans the whole page and rewrites latex text in place, which corrupts React-owned DOM. The loader sets `startup.typeset: false` and additionally blocks `document.render` / `document.updateDocument` while `defaultReady()` runs, so conversion is only available through the `tex2svgPromise` API.

Conversion results are cached in a module-level observable map keyed by the latex source, shared by all instances. The `mjx-container` outerHTML is kept whole because it carries the `vertical-align` style that aligns the math baseline with surrounding text. Assistive MathML is disabled so no hidden text nodes enter the segment DOM. An unknown command does not throw; MathJax renders the error inside the svg, and the segment adds a dotted red outline plus the message as a title.

While a formula has not been converted yet, the segment shows the raw `$source$` in grey. An empty source renders as a light grey `$$` placeholder.

## UI behavior stipulation

### Whole-segment selection (atomic model)

The segment is atomic: it is selected as a whole or not at all. Its logical text length is 1; offset 0 means before the segment and offset 1 means after it. Consequences:

- The rendered math is `user-select: none`, so native DOM selection endpoints do not land inside it. A cross-segment selection covers it as a whole. Because the native selection highlight skips `user-select: none` content (and `isSelectionWithin` only marks range endpoints), the segment computes its covered state from the logical selection range and paints it with the `mobx-math-inline-range-selected` class, matching the native highlight color.
- Selection edge delete (`selfSelectionEdgeDeleteQuery`) keeps the whole segment when the edge point is outside the covered side, and otherwise clears the source (the segment survives as the `$$` placeholder; the next Backspace removes it). A segment strictly inside a deleted range accepts `selfDeleteQuery` and is removed.
- Selection inside the source tooltip is component-internal state. The tooltip subtree is marked `data-mobx-seg-selection-internal`, and the document selection tracking (`selectionPointRead` in `eventLogicRow.ts`) ignores DOM selection inside such a subtree.

### Focus and edit mode

Focusing the segment from any direction (click, arrow navigation from left/right/above/below, focus restore after an edit) selects it as a whole. When `config.isEditable` is true, the source tooltip opens above the rendered math. The tooltip visibility is pure store-derived state: focused, editable, and no active range selection. There is no local edit-mode state, so focus changes, undo, and redo all keep the view consistent.

The initial caret state in the editor depends on how focus arrived:

- from above/below with a horizontal position (ArrowUp/Down from another row, which carries the caret x): the caret is placed on the first/last source line at that x, like a text segment
- any other way in (click, ArrowLeft/Right navigation, focus restore): the source text is fully selected

Backspace at the start of the following segment cannot merge through the math (`selfMergeQuery` is rejected), so the row focuses the math segment from the right instead: the segment gets selected as a whole, and the following Backspace presses clear the source and then delete the segment.

Mouse gesture containment:

- mouseup on the segment root and on the tooltip does not bubble to the document. Selection-translate extensions (Google Translate) place their inline icon at the pointer position of a mouseup that happens while text is selected — which is exactly the state after a click focused the segment and select-all ran in the source editor.
- a press inside the selected source clears the selection first, so the press starts a fresh selection instead of a native drag of the selected text (see `comp_selection.md`; `TextSeg` does the same).

The source appears only in the tooltip, so toggling between rendered and edit state never reflows the row (no visual jittering). The tooltip is a plain bordered box in sans-serif; the rendered math stays visible in place under it.

### Keyboard behavior inside the source editor

The source may span multiple lines. The editor renders the source with a trailing phantom newline (like `TextBlockSeg`), so a real trailing newline shows as a visible empty last line; the phantom is stripped when the source syncs back to the store.

- typing, native selection, and IME composition edit the source; every change syncs to the store immediately and re-renders the formula
- Shift+Enter: insert a line break into the source
- ArrowLeft at source start / ArrowRight at source end: inter-segment navigation (`segNavigate` left/right); elsewhere the caret moves normally
- ArrowUp on the first source line / ArrowDown on the last source line: leave to the row above/below, carrying the current caret x so the target row places its caret nearby; on other lines the caret moves between source lines natively
- shift+arrows: extend the internal source selection only; they never escape the editor
- Enter: end editing, move to the next segment (the source is already committed)
- Backspace / Delete when the source is already empty: attempt deletion of the whole math segment (`childDeleteAttempt`)
- Tab / shift+Tab: row indent / outdent
- Ctrl/Cmd+A: select the whole source inside the editor
- Ctrl/Cmd+Z / Y: document undo/redo (handled by the document shell)
- paste inside the editor inserts plain text into the source (newlines kept); it does not go through document paste parsing

### Keyboard behavior when the root is focused

This applies when the segment is not editable, or focus arrived through keyboard selection extension:

- arrows: inter-segment navigation in all four directions
- shift+ArrowLeft/Right: extend the document selection across the segment as a whole
- Backspace / Delete (editable): delete the whole segment

### Structure queries

- `selfSplitQuery`: rejected; Enter never splits an atomic segment
- `selfMergeQuery`: rejected in both directions; Backspace at the start of the following text segment does not merge through the math
- `selfDeleteQuery`: accepted when editable (`deleteSelf`)
- `selfIsEmptyQuery`: empty when the source is empty

### Copy and paste

- Copy: the whole segment serializes as `$source$`. The async clipboard path answers `selfClipboardTextQuery`; the synchronous copy path uses the `createClipboardText` trait so both produce the same text. An empty segment copies as `$$`, which does not parse back into a math segment.
- Paste: pasted plain text is scanned by the `parsePasteInline` trait parser. Each unescaped `$...$` pair whose content is non-empty, contains no `$`, and does not start or end with whitespace becomes one `MathInlineSeg`; the text between pairs stays with the paste target segment kind. A plain paste splits the caret segment at the paste point, absorbing the leading and trailing text parts into its two halves; the math source keeps its newlines while plain text parts flatten theirs. Markdown list paste and fenced chunk paste also run the inline parser on each pasted row text, so a pasted list item like `- en $x$ af` becomes a row of text and math segments (the row always ends in a text segment, so the caret and any joined remainder land in text). The two texts merged into the caret segment halves by a fenced chunk paste are not inline-parsed; that is a known limitation.

### Bullet position

The segment acts as a bullet position provider like any first segment of a row. It reports the vertical center of the rendered math box relative to the requested basis, and re-measures when the svg arrives or the rendered size changes (ResizeObserver), so list bullets stay aligned when a tall formula is the first segment of its row.

### Drag

The segment root carries `data-mobx-drag-item-id="segment:<compId>"` and uses the shared drag interaction hook, so segment drag behaves like other segments.

## Generic integration points added for this component

Two segment traits were added to `docStoreSegTrait.ts` (registered by this component at module load, usable by any future component):

- `createClipboardText(compData, offsetStart?, offsetEnd?)`: clipboard text from data alone, for segments whose clipboard form differs from their raw text field
- `parsePasteInline(textPaste)`: recognize inline widget markup in pasted plain text and split it into parts

And one generic DOM marker: a subtree with `data-mobx-seg-selection-internal` is invisible to document selection tracking, for segments with an internal editor.
