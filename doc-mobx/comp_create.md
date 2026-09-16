# Comp Create Mode (Slash Creation)

Typing `/` in an editable text segment enters the comp create mode: a dropdown appears under the slash, listing the seg-type components of the unified component registry (see `comp_registry.md`). The user keeps typing to filter the list, picks a component, and the `/query` text is consumed and replaced by a newly created component.

The mode is a fragile state: it only survives one very specific continuous behavior pattern — the caret stays directly after the typed `/query` chars in the same segment, and every keystroke either extends the query, shortens it, or operates the dropdown. Anything else exits the mode, and the `/` and the chars (if still present) simply remain ordinary segment text. This works because the `/query` chars are ordinary segment text the whole time; the mode only tracks the region, so exiting never needs to clean anything up.

## UI behavior

Entering:

- Typing `/` in an editable text segment inserts the slash as normal text and opens the dropdown. It only happens for exactly one inserted `/` at the caret, with no active range selection, in a segment owned by a Row, and only when the feature is enabled (see the config toggle below).

While the mode is active:

- Typing chars extends the query; the dropdown filters the seg-type components by case-insensitive substring match on the component name.
- When no component matches, the dropdown stays visible and shows "No matching component" in light grey text.
- Backspace shortens the query. Deleting the slash itself exits the mode.
- Any query change cancels the current dropdown selection.

Dropdown keyboard control:

- ArrowDown selects the first item; further ArrowDown/ArrowUp moves the selection.
- ArrowUp on the first item deselects (no selected item again).
- Enter with a selected item initiates the create attempt.
- Enter without a selected item dismisses the mode; the `/query` stays as text, and the next Enter splits normally.
- Escape dismisses the mode.
- Clicking a dropdown item creates that component (the dropdown is a document control, so pressing it does not unfocus the segment).

Exiting (the fragile-state rules; the `/query` text stays in place):

- typing a space (`/xxx |` means the user wants plain text; the space inserts normally)
- deleting the slash itself
- moving the caret away from the region end: ArrowLeft/Right, Home/End, clicking anywhere — another segment, elsewhere in the same segment, or outside the document
- starting a range selection, Tab/Shift+Tab, Enter or Escape as above
- undo, or any external change to the segment text, focus, or configuration
- the create attempt itself (successful or rejected)

## Creating the component

The create attempt consumes the `/query` region and runs as one document edit (one history node, undoable):

- Ordinary segment component: like an inline paste, the hosting segment keeps the text before the slash, the new component is inserted after it, and a new segment of the same kind receives the text after the region. The new component starts with empty content and gets focus, so it offers its own editing entry (a math segment opens its source tooltip).
- Row-exclusive component (see `comp_seg_exclusive.md`): it cannot sit next to other segments, so creation is only accepted when the new component would be alone in its row — the `/query` is the entire segment text and the segment is the only child of its row. Otherwise the attempt is rejected, the mode exits, and the text stays.

## Config toggle

The feature is controlled per document by the doc config boolean `isCompCreateEnabled` (default: enabled). In a test yaml:

```yaml
configDocInitial:
  isEditable: true
  isCompCreateEnabled: false
```

Disabling the flag while the mode is active exits the mode.

## Implementation

The mode is decoupled from the text segment:

- `src-mobx/docStoreCompCreate.ts` owns the mode state (`compCreateState` in the doc interaction state) and all logic: entry detection, query updates, dropdown selection movement, the match query against the component registry, and the create edit.
- `src-mobx/comp/comp-create/CompCreateDropdown.tsx` is a pure view of that state, rendered through a body portal anchored below the slash.
- `TextSeg` only routes: its text input goes through `compCreateHandleTextInput` (which declines ordinary edits), its keydown asks `compCreateHandleKey` first, and it mounts the dropdown while the mode is active for it. Another editable segment kind can reuse the same three touch points.

The fragile invariant is enforced by two mechanisms:

1. The mode handlers update the segment text, the store focus offset, and the query inside one store action, so observers never see them disagree.
2. A watchdog MobX reaction, created on enter and disposed on exit, observes the segment text, focus state, selection state, and doc config, and exits the mode the moment the invariant breaks. Explicit exit triggers (space, Escape, caret keys) give clean semantics; the watchdog catches everything else (clicks, undo, external edits), so the mode never needs to trust that every path was instrumented.
