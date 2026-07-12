# Component Event System

This document defines the event model for document components such as `List`, `Row`, and `TextSeg`.

The store is the source of truth for component data and operational state. Components render from store state and submit event/change requests to store. Store receives requests, decides whether they are accepted, updates document state, and may generate follow-up events to other components.

## Design Goals

- use one event shape for component-to-store and store-to-component communication
- keep event routing centralized enough that components do not need hidden global knowledge
- keep row-level and list-level interaction logic separated
- support native browser DOM selection while tracking its component coordinates in store
- allow future edit operations such as segment split, merge, indent, outdent, and list item creation

## Event Shape

```ts
type CompEvent = {
  id?: string;
  type: string;
  sourceId: string;
  targetId: string;
  data: any;
};
```

Field meaning:

- `id`: event id. Store creates one when caller does not provide it.
- `type`: event category and operation name.
- `sourceId`: component or system sender id.
- `targetId`: document id for document-scoped events.
- `data`: event-specific data.

Result shape:

```ts
type CompEventResult = {
  code: number;
  message?: string;
  data?: any;
};
```

`code = 0` means accepted. Negative `code` means rejected or not handled.

## Event Naming

Use short operation names.

Preferred:

- `focus`
- `unfocus`
- `clickSingle`
- `keyDown`
- `textInput`
- `rowIndent`

Avoid request-style names such as `focusRequest`, `textInputRequest`, or `rowIndentRequest`.

Reason:

- an event already represents a requested operation
- the result `{ code }` tells whether the operation was accepted
- shorter names keep routing logic easier to read

## Processing Pattern

There are two directions.

Component to store:

```ts
component event -> onEvent(event) -> store.receiveEvent(docId, event)
```

Use this when a component observes a user action or internal state change and asks the document store to process it.

Store to component:

```ts
store.sendEventToComp(docId, compId, event) -> component.dispatchEvent(event)
```

Use this when the store, test utility, or another component needs a component to handle a command-like event.

The store can also receive an event, update state, and then generate a new event:

```ts
receiveEvent -> update store state -> sendEventToComp / sendEventToParent / default route
```

This is needed for focus movement, parent-child bubbling, and neighbor routing.

## Store Responsibilities

`DocStore` owns document-level event processing.

Responsibilities:

- normalize event id, type, source id, target id, and data
- validate document target
- update document data and operational state
- update `focusState`, `elActiveState`, and `selectionState`
- dispatch direct events to registered components
- route unhandled events to parent or neighbor components
- return `{code}` result for every operation

Important store APIs:

```ts
receiveEvent(docId, event)
sendEventToComp(docId, compId, event)
sendEventToCompDirect(docId, compId, event)
sendEventToParent(docId, compId, event)
```

`sendEventToComp` may apply default routing after a component rejects an event. `sendEventToCompDirect` is for test utilities and should be used sparingly.

## Store Routing

Store routing has three layers.

Direct dispatch:

```ts
sendEventToComp(docId, compId, event)
```

This validates the document target, sends the event to the registered component handler, and may apply default routing if the component does not handle the event.

Parent dispatch:

```ts
sendEventToParent(docId, compId, event)
```

This finds the registered parent component and forwards the event upward. It is used when row-level logic cannot finish an operation locally and list-level logic should decide what happens next.

Direct test dispatch:

```ts
sendEventToCompDirect(docId, compId, event)
```

This sends to a component without default routing. It is mainly for test utilities.

Default routing should stay small and predictable. Current baseline behavior:

- `unfocus` with `direction='left'`: focus previous registered component with `direction='fromRight'`
- `unfocus` with `direction='right'`: focus next registered component with `direction='fromLeft'`
- `unfocus` with `direction='up'` or `direction='down'`: forward to parent

This mirrors same-row sibling routing first, then parent-level routing for cross-row or cross-list behavior.

## Component Responsibilities

Every interactive component can expose:

```ts
dispatchEvent(event)
```

It can also submit events through:

```ts
onEvent(event)
```

Component responsibilities are local:

- `TextSeg`: text editing, text focus, caret-related events
- `Row`: segment lane behavior inside one row
- `List`: vertical behavior across rows and nested lists
- document/test shell: browser-level listeners such as `selectionchange`

Components should not own document-level focus or selection state. They should ask the store to update it.

## Event Categories

### Focus Events

Focus events update logical focus and may synchronize `doc.ElActive`.

For the distinction between logical focus and `doc.ElActive`, see `./comp_focus.md`.

Common event types:

- `focus`
- `unfocus`
- `clickSingle`
- `clickGap`
- `moveFocus`

Typical data:

```ts
{
  direction?: 'fromLeft' | 'fromRight' | 'fromAbove' | 'fromBelow';
  reason?: 'clickSingle' | 'clickGap' | 'keyNav' | 'parentEntry' | 'childBubble';
  mousePos?: { xRatio?: number; yRatio?: number };
  segId?: string;
  offset?: number;
}
```

Processing:

1. component receives user action or inbound event
2. row/list/text event logic decides the local target
3. store updates `focusState`
4. component may call DOM focus, causing `doc.ElActive` tracking to update

### Selection Events

Browser DOM selection is the primary selection mechanism. The app does not replace mouse drag selection.

For the document-level `selectionState` shape and component-derived selection flags, see `./comp_selection.md`.

Document shell listens to browser selection changes and converts DOM endpoints into component coordinates:

```ts
{
  isSelectionActive: boolean;
  mode: 'caret' | 'range';
  pointAnchor: { compId, segId, offset } | null;
  pointFocus: { compId, segId, offset } | null;
}
```

This state belongs to the document, not to individual components. Component flags such as `isSelectionWithin` are derived from document-level `selectionState`.

Selection processing:

1. browser updates DOM selection
2. document shell reads `window.getSelection()`
3. row-level selection helper maps DOM nodes to `TextSeg` ids and offsets
4. store updates `selectionState`
5. components re-render with derived visual states

### Text Edit Events

Text edit events update component data immediately.

Implemented simple path:

```ts
TextSeg onInput -> store.updateCompDataByPatch(docId, compId, { text })
```

Planned text edit event types:

- `textInput`
- `textDeleteBackward`
- `textDeleteForward`
- `textDeleteEmpty`
- `textSplit`
- `textMergePrev`
- `textMergeNext`

Expected processing:

1. `TextSeg` captures edit operation
2. row-level logic decides whether operation stays inside segment or crosses segment boundary
3. store applies accepted data change
4. store updates focus and selection state
5. row/list logic routes follow-up focus if needed

Empty segment deletion:

1. editable `TextSeg` detects that a delete operation changed its text from non-empty to empty
2. `TextSeg` emits `textDeleteEmpty` with `direction='left'`
3. the document store treats this as a text-edit semantic event and performs the same structural removal as `segDelete`
4. after deletion, focus moves as though the deleted segment exited toward the left
5. focus lands on the previous surviving segment when one exists, otherwise the next surviving segment or parent row/list receives focus

`textDeleteEmpty` is intentionally more specific than `segDelete`: it records why text editing crossed into structural removal. Generic non-text segment removal should use `segDelete`.

### Row Structure Events

Row structure events affect segments inside one row.

Planned event types:

- `segFocusPrev`
- `segFocusNext`
- `segSplit`
- `segDelete`
- `segMergePrev`
- `segMergeNext`
- `rowClickGap`

`eventLogicRow.ts` should own:

- choosing nearest segment for row gap click
- left/right navigation between segments
- mapping mouse position to segment offset
- coordinating segment split and merge
- coordinating segment removal after `textDeleteEmpty`
- routing unhandled up/down movement to parent list
- extracting DOM selection endpoints from segment DOM

### List Structure Events

List structure events affect rows and nested lists.

Planned event types:

- `rowFocusPrev`
- `rowFocusNext`
- `rowCreateBefore`
- `rowCreateAfter`
- `rowMergePrev`
- `rowMergeNext`
- `rowIndent`
- `rowOutdent`
- `listEnterFromAbove`
- `listEnterFromBelow`

`eventLogicList.ts` should own:

- vertical navigation across rows
- entering a list from parent or sibling
- choosing first/last focusable descendant
- indent/outdent between list levels
- row creation and row removal
- merging row content across neighbors
- routing events between nested lists

## Event Flow By Level

### TextSeg Level

`TextSeg` handles text and caret-local behavior.

Examples:

```ts
{ type: 'focus', sourceId: 'segA', targetId: docId, data: { offset: 3 } }
{ type: 'textInput', sourceId: 'segA', targetId: docId, data: { textNext: 'abc' } }
```

If the event cannot be handled inside one segment, it should be escalated to row logic.

### Row Level

`Row` handles behavior among child segments.

Examples:

```ts
{ type: 'segFocusNext', sourceId: 'segA', targetId: docId, data: {} }
{ type: 'rowClickGap', sourceId: 'rowA', targetId: docId, data: { mousePos: { xRatio: 0.6 } } }
```

If the event crosses row boundary, row logic should generate an event for list logic.

### List Level

`List` handles behavior across rows and nested list entries.

Examples:

```ts
{ type: 'rowFocusNext', sourceId: 'rowA', targetId: docId, data: { direction: 'fromAbove' } }
{ type: 'rowIndent', sourceId: 'rowA', targetId: docId, data: {} }
```

If the event crosses list boundary, list logic should route to parent list or document root.

## EventTester Flow

`EventTester` is a test utility. It can ask the store to send an event to a specific component.

```ts
{
  type: 'sendEventToTarget',
  sourceId,
  targetId: docId,
  data: {
    compIdTarget,
    event
  }
}
```

Store handles this through direct component dispatch:

```ts
store.sendEventToCompDirect(docId, compIdTarget, event)
```

This bypasses default routing and should not be used as the normal component interaction path.

## Implemented Baseline

Implemented:

- event normalization in store
- direct component dispatch
- parent/default routing for a small set of unfocus directions
- logical focus state update
- `doc.ElActive` tracking from DOM focus
- DOM selection tracking into document-level `selectionState`
- immediate `TextSeg` text update through `contentEditable`
- row/list click gap handling shell

Not yet complete:

- precise caret offset from mouse x-position
- segment split and merge
- row split and merge
- list item indent and outdent
- robust up/down navigation using x-position
- neighbor routing across nested lists
- focus restore after structural edit

## Design Direction

`eventLogicRow.ts` and `eventLogicList.ts` should grow as behavior is added.

`eventLogicRow.ts` should remain responsible for segment-level operations inside one row.

`eventLogicList.ts` should remain responsible for inter-row and nested-list operations.

`DocStore` should remain responsible for document-level state, validation, and final acceptance/rejection of changes.

