# TextSeg Component

`TextSeg` is the smallest text-bearing document component.

It represents one inline segment inside a `Row`. It renders text, reports focus/click events, participates in DOM selection tracking, and can optionally edit its own text.

For row-level routing and event categories, see `./event_comp.md`.

For logical focus and `doc.ElActive`, see `./comp_focus.md`.

For DOM selection tracking state, see `./comp_selection.md`.

## Component Role

`TextSeg` should stay focused on segment-level concerns:

- render one text segment
- expose a DOM element that browser selection can start/end inside
- report focus/click events to the document system
- update its own text data when editable
- expose visual state based on store-derived runtime state

It should not own row-level navigation, list-level navigation, or cross-component selection state.

## Data And Config

`TextSeg.data` contains business data.

```ts
data: {
  text: string;
  sourceId?: string;
  targetId?: string;
}
```

`TextSeg.config` controls behavior and debug display.

```ts
config: {
  isActive?: boolean;
  isDebug?: boolean;
  isEditable?: boolean;
}
```

Rules:

- `data.text` is the rendered text.
- `config.isEditable` enables direct text editing.
- `config.isDebug` enables debug visual style.
- debug flags should not be placed in `data`.

## Rendering

`TextSeg` renders as an inline span-like text component.

Important DOM attributes:

```ts
data-mobx-comp-id={compId}
data-mobx-comp-name="TextSeg"
data-mobx-seg-id={compId}
```

These attributes allow browser DOM selection to be mapped back to document component coordinates.

## Focus State

`TextSeg` participates in three focus-related concepts:

- logical focus: store-managed focus target
- `doc.ElActive`: browser active element
- focus-within state of parent `Row`/`List`

On focus:

1. `TextSeg` updates `elActiveState` in store.
2. `TextSeg` updates logical focus in `focusState`.
3. Visual classes are derived from runtime state.

Relevant visual classes:

- `mobx-seg-focused-logical`
- `mobx-seg-el-active`
- `mobx-seg-selection-within`
- `mobx-seg-debug`

## Selection Tracking

Browser DOM selection is the real range-selection mechanism.

`TextSeg` does not implement mouse drag selection itself. Instead:

1. browser updates DOM selection
2. document shell listens to `selectionchange`
3. row-level helper maps DOM endpoints to `TextSeg` ids and offsets
4. store updates document-level `selectionState`
5. `TextSeg` receives derived visual state

Range selection is tracked for editable and readonly segments.

Collapsed caret selection has different rules:

- editable `TextSeg`: collapsed DOM selection can update `focusState.offsetFocused`
- readonly `TextSeg`: collapsed DOM selection is ignored by selection tracking

Reason:

- editable text uses the browser caret as the source of truth
- readonly text uses `focusState.offsetFocused` as the source of truth and renders a logical caret

This avoids a browser `selectionchange` from overwriting a readonly logical caret after keyboard navigation.

## Editing

When `config.isEditable` is true and the segment has logical focus, `TextSeg` can enter DOM-caret mode using `contentEditable`.

Current update path:

```ts
onInput -> store.updateCompDataByPatch(docId, compId, { text })
```

The update is immediate. The store object data is updated as soon as the DOM text changes.

Before the update, `TextSeg` reads the current DOM caret offset. After the controlled text re-renders, it restores the DOM caret when the same segment is still active.

## Empty Segment Delete

When editable `TextSeg` changes from non-empty text to empty text because the last character was deleted, it should emit a delete event instead of only storing an empty segment.

Recommended event:

```ts
{
  type: 'textDeleteEmpty',
  sourceId: segId,
  targetId: docId,
  data: {
    segId,
    direction: 'left'
  }
}
```

`TextSeg` owns detection of the text transition:

1. remember the previous text before applying an input update
2. read the next DOM text
3. if previous text length was greater than `0` and next text length is `0`, emit `textDeleteEmpty`
4. skip normal caret restore for that segment after the store accepts deletion

`TextSeg` should not remove itself from the row. The store and row/list event logic own structural removal and follow-up focus.

## Caret Behavior

There are two caret modes.

### DOM Caret Mode

DOM caret mode is used for editable text when:

- `config.isEditable === true`
- the segment has logical focus
- there is no active range selection
- pointer drag is not in progress

In DOM caret mode:

- the browser caret is visible
- collapsed DOM selection updates `focusState.offsetFocused`
- text input updates `data.text`
- caret offset is restored after controlled re-render

Firefox does not reliably extend native selection outside the `contentEditable` editing host where a drag begins. When pointer drag starts in a focused editable segment, `TextSeg` prevents the native drag and constructs the DOM range from pointer coordinates. This manual path is limited to the active editing segment; clicks and drags that start from ordinary text keep their native behavior. The resulting DOM range still flows through the normal `selectionchange` listener and document selection state.

### Logical Caret Mode

Logical caret mode is used for readonly text and for focused non-editing display.

In logical caret mode:

- `focusState.offsetFocused` is the source of truth
- `TextSeg` renders a caret marker at that offset
- left/right key movement updates `focusState.offsetFocused`
- up/down key movement either moves within the segment or emits navigation to `Row`/`List`
- collapsed DOM selection is not allowed to overwrite `focusState.offsetFocused`

After navigation crosses a segment or row boundary, some browsers can keep
delivering held-arrow `keydown` events to the previous editing host even though
the store focus and visible caret have moved. The stale-event guard restores
DOM focus and forwards arrow events to the store-focused segment. It must not
forward text-editing keys, because synthetic keyboard events cannot reproduce
native editing safely.

Firefox can also move logical focus between segments without leaving a usable
native caret in the destination editing host. Plain left- and right-arrow
movement therefore reads the current store offset and moves the DOM caret
explicitly. Reading the store directly is required because another keydown can
arrive before the newly focused `TextSeg` has rerendered.

Each horizontal caret move resets the CSS caret animation to time zero, whose
initial frame is visible. This keeps the caret continuously visible while an
arrow key is held and restarts normal blinking after movement stops. Focus
transitions reset the animation as well because crossing a segment boundary
creates the same user-visible caret movement.

The browser DOM selection is still used for range selection and copy behavior.

### Cross-Component Movement

`TextSeg` handles movement that is local to one segment.

When movement leaves a segment:

1. `TextSeg` emits `segNavigate` with direction, offset, and optional x-coordinate
2. `Row` routes to the previous or next segment in the same row
3. if the row boundary is crossed, `Row` emits `rowNavigate`
4. `List` chooses the target row and segment
5. the target `TextSeg` receives `focus` with direction and, when available, an explicit offset

## Planned Segment-Level Events

Segment-level behavior should be coordinated with `eventLogicRow.ts`.

Planned events:

- `textInput`
- `textDeleteBackward`
- `textDeleteForward`
- `textDeleteEmpty`
- `textSplit`
- `textMergePrev`
- `textMergeNext`
- `segNavigate`

`TextSeg` should detect local browser/input events, but row logic should decide what happens when an operation crosses segment boundaries.

## Acceptance Criteria

- non-editable segment renders as inline text
- editable segment updates `data.text` immediately
- debug style is controlled by `config.isDebug`
- logical focus style follows store runtime state
- `doc.ElActive` style follows browser active element tracking
- DOM selection can be mapped to this segment through `data-mobx-seg-id`
- range selection can start inside an already focused editable segment and extend within or across segments
- editable caret offset survives store re-render during editing
- readonly caret offset is driven by `focusState.offsetFocused`
- collapsed readonly DOM selection does not overwrite logical caret state
- deleting the last character emits `textDeleteEmpty` and does not leave an empty segment behind
