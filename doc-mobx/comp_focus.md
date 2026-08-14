# Focus Model

This document defines logical focus behavior for `List`, `Row`, and segment-level components.

The source of truth is `DocStore`. Render components observe store state and submit change requests. Components do not keep independent logical focus state.

Focus state is updated through the component event system. For DOM text selection tracking, see `./comp_selection.md`. For event details, see `./event_comp.md`.

## Scope

- logical focus state representation
- component-level focus-related states across hierarchy
- relation between focus and selection
- Shift-click logical focus expansion across the document hierarchy

## Terms

- logical focus: store-managed target used for navigation, event routing, and selection logic
- physical focus: browser focus state; in this document we name it `doc.ElActive`
- `doc.ElActive`: browser active element
- DOM selection: browser selection state from `window.getSelection()`, described in `./comp_selection.md`
- selection track: store snapshot of current DOM selection endpoints, described in `./comp_selection.md`

There are four related concepts:

1. logical focus: our document-level focus state in store
2. physical focus / `doc.ElActive`: browser active element
3. physical selection / DOM selection: browser selection range
4. selection track: store snapshot of physical selection endpoints in component coordinates

These concepts are related but not the same thing.

- logical focus answers: where the next keyboard/navigation event should go in the component tree
- physical focus / `doc.ElActive` answers: which DOM element currently receives native browser key events
- physical selection / DOM selection answers: what range the browser currently marks in the DOM tree
- selection track answers: which document components contain the physical selection start/end

DOM selection should be used for native mouse drag, caret, range selection, and copy behavior. The store should not replace browser selection. This document only describes how logical focus stays independent from that browser-owned selection.

There is no separate logical selection concept. We have logical focus, physical focus, physical selection, and a tracked snapshot of physical selection.

`docUnfocus` is the document-level blur behavior. It clears logical focus, `doc.ElActive`, and selection track, and removes any DOM caret/range inside the document. It should run only when both mouse press and mouse release happen outside the document root. If the press starts inside and release happens outside, keep the document focused because that usually means drag selection ended outside the document.

Components that embed a document-like child area can use the same rule with a smaller focus boundary. For example, `EventTester` treats its rendered child components as the focus area and its control panel as outside that area. Clicking controls with both mouse press and release outside the child area runs `docUnfocus`; dragging from the child area to outside does not.

## Data Shape In Store

All states below are per document under `docById[docId]`.

```ts
type FocusState = {
  compIdFocused: string;          // current logical focus target component
  segIdFocused: string;           // focused segment id, empty when focus is not inside a segment
  offsetFocused: number;          // caret/selection focus offset inside the focused segment
  reasonLast: string;             // clickGap/keyNav/childBubble/parentEntry...
};

type ElActiveState = {
  compIdElActive: string;         // component matching doc.ElActive when known
  versionElActive: number;        // increments when store requests doc.ElActive sync
};

type CompRuntimeState = {
  isFocusedLogical: boolean;
  isElActive: boolean;
  isFocusWithin: boolean;         // subtree contains focused comp
};

type DocInteractionState = {
  focusState: FocusState;
  elActiveState: ElActiveState;
  runtimeStateByCompId: Record<string, CompRuntimeState>;
};
```

Suggested location in `DocRecord`:

```ts
type DocRecord = {
  // existing fields...
  interactionState: DocInteractionState;
};
```

Naming follows project rule: noun first, adjective after noun, boolean starts with `is`.

Selection state also lives under `interactionState`, but it has a separate model. For that shape, see `./comp_selection.md`.

## Which Components Have Focus-Related State

Yes, each hierarchy level has focus-related meaning, but ownership differs.

- `List`: owns navigation context for vertical structure and child ordering
- `Row`: owns segment lane and gap-click mapping in one row
- segment-level component: owns its own inline focus details, such as caret offset when applicable

All levels may read `isFocusedLogical`, `isElActive`, and `isFocusWithin`, but only store mutates them.

`compIdFocused` can point to any document component in the hierarchy, such as a `List`, `Row`, or segment. `segIdFocused` is only set when logical focus is inside a segment. This keeps the focus model aligned with the document hierarchy instead of making a specific segment implementation part of the document-level semantics.

Store helper direction:

- `compIdFocus(docId, compId, reason)`: focus a document component id.
- `segFocus(docId, segId, offset, reason)`: focus a segment and record the offset used by that segment.
- `focusExpandToParent(docId, compIdFallback, reason)`: expand logical focus from the current target to its parent.

## Focus And Selection Independence

There are two focus concepts:

- logical focus is the document/component position controlled by the store
- `doc.ElActive` is the actual browser active element

There are also two selection concepts, described in `./comp_selection.md`:

- DOM selection is the browser selection range
- selection track is the store snapshot of that browser range in component coordinates

The important focus rule is:

- logical focus can exist without range selection
- `doc.ElActive` may point to a wrapper element, a segment element, or nothing inside the document
- DOM selection can exist even if logical focus is on a parent `Row` or `List`
- shift-click changes logical focus but should not change DOM text selection
- focus expansion preserves the last segment offset so cycling back to the leaf restores the caret position

## Logical Focus Expansion

Shift-click expands logical focus upward through the document hierarchy. Normal click keeps the usual caret and segment behavior.

Current expansion direction:

```text
segment -> Row -> List -> parent List
```

The root boundary for this cycle is the component marked with `config.isRoot === true`, usually the root `List` inside a document-like area. This matters for wrappers such as `EventTester`: focus expansion should stop at the child document root and then cycle back to the clicked leaf, instead of moving focus to the tester wrapper.

When focus reaches that root boundary, the next shift-click on a leaf cycles focus back to that leaf. The stored `offsetFocused` is preserved while focus is on parent components, so the caret can return to the previous text offset.

This behavior prepares logical focus to act as the future drag subject. It does not use `selectionState`, because `selectionState` is reserved for DOM text range tracking.

## Event Handling Model

Use a uniform event contract:

```ts
{ type, sourceId, targetId, data }
```

For the complete event envelope, routing categories, and row/list event responsibilities, see `./event_comp.md`.

Recommended event flow:

- input event enters store dispatcher
- store validates/normalizes request
- store updates `focusState`
- store updates selection state from DOM selection when selection changes, as described in `./comp_selection.md`
- store emits `doc.ElActive` sync via `elActiveState.versionElActive`
- components re-render by observing state

Routing examples:

- `clickGap` in `Row`: map click position to nearest segment/offset, update caret
- `unfocus up/down` in `Row`: route to parent `List`
- `focus from sibling` in `List`: choose first/last focusable descendant

## Segment Visual States And Debug

Segment visual behavior should be driven by:

- `interactionState` logical focus and `doc.ElActive`
- `config.isDebug` (component config, not data)

Segment data should carry content only. Debug switches should stay in component config.

Suggested config shape:

```ts
config: {
  isDebug?: boolean;
  isEditable?: boolean;
}
```

Suggested class mapping:

- `isFocusedLogical` -> segment focused logical class
- `isElActive` -> segment active element class
- `config.isDebug` -> segment debug class

This keeps ui component states in store and keeps debug behavior explicit and controllable.

## Minimal Acceptance Checklist

- `List`, `Row`, and segment-level components observe and react without hidden local logical states
- shift-click cycles focus from leaf to root boundary and back to the clicked leaf
- focus expansion preserves the last segment offset for caret restoration
- focus expansion does not change DOM text selection
- segment debug style is controlled only by `config.isDebug`
