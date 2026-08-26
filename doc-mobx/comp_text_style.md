# Text Segment Style

A text segment can carry one style. The style is stored in segment `data` under the fixed entry name `style` and describes the whole segment. Styling part of a segment never produces partially styled text: the segment is split so every result segment again carries exactly one style.

`TextSeg` supports style. `TextBlockSeg` and other segments do not, and style actions skip them.

## Style Data Format

```ts
data: {
  text: string;
  style?: {
    isBold?: boolean;
    isItalic?: boolean;
    isUnderline?: boolean;
    isDeleteline?: boolean;
    colorText?: string;       // '#RRGGBB' or '#RRGGBBAA'
    colorBackground?: string; // '#RRGGBB' or '#RRGGBBAA'
    fontFamily?: string;      // css font-family value
    fontSize?: number;        // px
  };
}
```

All entries are optional. Colors support an alpha channel through the `#RRGGBBAA` form.

`segStyleNormalize` in `src-mobx/docStoreSegStyle.ts` defines which entries are meaningful: booleans only when `true`, strings only when non-empty, `fontSize` only when a positive number. Normalization returns `null` when nothing remains, so a missing `style` entry and an emptied style object are the same default style. All style comparison (`segStyleIsSame`) works on normalized styles.

## Style Support Declaration

Whether a segment kind supports text style is a segment trait (see `yamd_comp_design.md`). `TextSeg` registers it at module load:

```ts
registerSegTrait('TextSeg', { isTextStyleSupported: true });
```

Doc-level style logic checks `docStoreIsSegTextStyleSupported(compData)` and never checks component names. A segment without the trait, or one inside the selection that is not editable, is left untouched by style actions.

## Default Rendering

`segStyleToCssProps` is the default interpretation of a style as inline css properties:

- `isBold` → `fontWeight: bold`
- `isItalic` → `fontStyle: italic`
- `isUnderline` / `isDeleteline` → combined `textDecorationLine`
- `colorText` → `color`
- `colorBackground` → `backgroundColor`
- `fontFamily` → `fontFamily`
- `fontSize` → `fontSize` in px

`TextSeg` passes the result to the `style` prop of its root span. The default style renders with no inline style at all.

## Centralized processing logic for setting style action

The set-style action is centralized in `src-mobx/docStoreEditStyle.ts` and exposed as `store.setStyleOnSelection(docId, stylePatch, selectionOverride?)`. No component implements its own style edit.

The patch is a partial style object set above the current style of every covered segment. A falsy patch value (`false`, `null`, `''`, `0`) removes that entry. Example patches: `{ isBold: true }`, `{ colorBackground: '#FEF3C780' }`, `{ colorBackground: null }`.

`selectionOverride` lets a toolbar act on a selection snapshot when its own UI (for example a color picker popup) has to take focus and collapses the live DOM selection.

### Cover collection

The action works on an active range selection. Segments between the two endpoints are walked in document order, and a segment becomes a cover when all of the following hold:

- its trait declares `isTextStyleSupported`
- its `config.isEditable` is `true`
- the selection covers at least one of its characters

Each cover records the covered text range inside the segment. Endpoint segments are covered partially; segments between them are covered fully. Everything else inside the selection — non-text components, readonly segments, `TextBlockSeg` — is not affected. When no cover exists the action is rejected with `{ code: -1 }` before any edit starts.

### Split

Each covered segment is cut into up to three pieces:

- text before the cover, keeping the current style
- the covered text, with `segStyleApplyPatch(styleCurrent, stylePatch)` as its style
- text after the cover, keeping the current style

Pieces at the segment boundary are omitted when empty, so a cover touching the segment start or end yields two pieces, and a fully covered segment yields one. When the patch does not change the segment's style, the segment stays one piece.

Example: `aaabbbccc` with `bbb` selected and `{ isBold: true }` applied becomes three segments `aaa` / `bbb` (bold) / `ccc`.

### Merge

Pieces are rebuilt row by row. Uncovered text segments of the row join as merge neighbors carrying their current style; other uncovered children pass through unchanged. Two adjacent pieces merge into one segment when they have the same `compName`, the same `config`, the same normalized style, and at least one of the two holds covered text. The covered-text condition keeps the action from touching segments unrelated to the selection: two neighboring segments that already share a style are left as they are. Merging never crosses a non-participating child and never crosses a row, and an uncovered neighbor that merges with nothing stays untouched.

This is what merges the covered parts of neighboring segments. For two neighboring segments (`|` marks the selection):

```text
aa|a bb|n
```

If `a` and `bb` end up with the same style — they had the same style before, so the patched style is also the same — the covered pieces `a` and `bb` merge into one segment `abb` carrying the new style. The row becomes `aa` / `abb` (new style) / `n`.

Merging with uncovered neighbors is what heals earlier splits. Continuing the split example `aaa` / `bbb` (bold) / `ccc`: selecting `bbb` and toggling bold off gives all three segments the same style again, and the row merges back into one `aaabbbccc` segment (when the segments share `compName` and `config`) — the neighbors merge even though the selection only covers `bbb`. The same applies when a covered segment is styled to match its neighbor, for example bolding a full segment next to an already bold segment.

### Ids and row replacement

For every original segment, the first result piece built from it reuses the original `compId`; further pieces get fresh ids from `docStoreCreateCompId`. The full child list of each affected row is replaced through `docStoreReplaceChildRange`; originals absent from the result are removed by the replacement. Children passed through unchanged produce no version diff.

### Selection and transaction

After the replacement the whole original selection range is re-selected through `docStoreRestoreSelectionState`, so repeated style actions work on the same range without re-selecting. An endpoint inside a rebuilt segment is mapped onto the covered text of the result pieces; an endpoint inside an untouched segment — for example a text block the action skips — keeps its original position, so a selection reaching into unstyleable content stays intact.

The whole action runs in one `runDocEdit(docId, 'styleSet', ...)` transaction: one history node, one undo step, and rejection anywhere rolls back everything. The result follows the `{ code, data, message }` format; success reports `data.countSegStyled`.

### Selection style summary

`store.getStyleOfSelection(docId, selectionOverride?)` reports on the current selection without editing:

```ts
{ code: 0, data: { countSegCovered, styleCommon } }
```

`styleCommon` holds the style entries shared by every covered segment. A toolbar toggle shows as active when `styleCommon.isBold === true` and patches the opposite value; buttons disable when `countSegCovered` is `0`.

## Other actions whose logic is influenced by style in targets

Style participates in the segment merge contract. `TextSeg` answers `selfMergeQuery` and now rejects when the two segments carry different normalized styles, in addition to the existing same-`compName` check. Every merge flow routes through this single query, so the rule applies everywhere:

- **Row merge** (Backspace at row start): when the end segment of the first row and the begin segment of the second row have different styles — for example one plain and one bold italic — the merge query is rejected and the row merge does not happen.
- **In-row segment merge** (Backspace at a segment boundary inside one row): rejected the same way; the two segments stay separate.
- **Cross-segment selection delete**: after trimming the two edge segments, the edges are merged only when the merge query accepts. With different styles the delete still proceeds, but the two trimmed edges stay side by side as two segments (the same fallback used for other merge rejections; see `comp_delete_copy_cut.md`).

Actions that carry style along without checking it:

- **Segment split** (Enter inside a segment): both halves keep the segment's `data`, so both keep the style.
- **Text input / paste into a segment**: text becomes part of the segment and takes the segment's style.
- **Undo / redo**: `styleSet` is one history node. Style changes in `data.style` are recorded by the generic field diff; `TextSeg`'s text diff handler only handles pure text changes and declines the rest.

Limitation: range copy produces markdown/plain text and drops style. Pasting styled text does not restore the style.

## Style Tester

The test item `Text style` (`src-mobx/test/StyleTester.tsx`, `test-text-style.yaml`) places a toolbar above a test document: toggle buttons for bold / italic / underline / deleteline, text color and background color buttons opening the `ColorPicker` from `@wwf971/react-comp-misc` (alpha supported), and font family / size dropdowns. Button state is driven by `getStyleOfSelection`.

Keeping the selection alive through a toolbar click needs two things: the buttons `preventDefault` on `mousedown` so the browser does not move focus and collapse the DOM selection, and the toolbar is marked `data-mobx-doc-control` so the doc unfocus boundary does not treat the click as a click outside the document (see `comp_focus.md`). The color picker popup additionally takes a selection snapshot when it opens and passes it as `selectionOverride`, because interacting with the picker itself collapses the live selection.
