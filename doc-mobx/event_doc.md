# Document Event Processing

This document describes document-level event processing in the MobX document store.

Component-local event behavior is described in `./event_comp.md`.

## Test Flow

`EventTester` sends document-level test events through a wrapper event:

```ts
{
  type: 'sendEventToDoc',
  sourceId,
  targetId: docId,
  data: {
    event
  }
}
```

The store handles this by calling:

```ts
store.sendEventToDoc(docId, event)
```

The document route chooses the current target from document state. This keeps tests from depending on a component id that may become stale after split, merge, indent, outdent, or delete.

## Document-Level Entry Point

The store should expose a document-level event API:

```ts
store.sendEventToDoc(docId, event)
```

This API should accept events addressed to the document, normalize them, validate the document target, and decide where the event should go next.

The intended public event paths are:

```ts
component -> store.receiveEvent(docId, event)
test/tool -> store.sendEventToDoc(docId, event)
store -> store.sendEventToComp(docId, compId, event)
```

`sendEventToCompDirect` remains available for narrow test utilities, but it should not be the normal path for document-level examples.

## Routing Responsibility

Document-level routing should be based on current document state, not on stale component ids held by the test UI.

For events that need a concrete component target, the document store can choose from:

- the currently focused segment from `focusState.segIdFocused`
- the currently focused component from `focusState.compIdFocused`
- the root document component from `compIdRoot`
- the first focusable text segment in document order

Recommended default:

```ts
focused segment -> focused component -> root component -> first focusable segment
```

This makes tests survive structural edits such as split, merge, indent, outdent, and delete.

## Event Rewriting

Document-level routing may rewrite event fields before forwarding.

Examples:

```ts
{
  type: 'textSplit',
  sourceId: docId,
  targetId: docId,
  data: { offset }
}
```

can become:

```ts
{
  type: 'textSplit',
  sourceId: segIdFocused,
  targetId: docId,
  data: { segId: segIdFocused, offset }
}
```

For structure events such as `rowIndent` and `rowOutdent`, the document store should resolve the focused segment first, then call the store operation that owns the structure change.

## EventTester Direction

`EventTester` should have two modes:

- document mode: sends events to `store.sendEventToDoc(docId, event)`
- component mode: sends direct events to a selected component for low-level tests

Document mode should be the default for document examples:

- `test-text-basic.yaml`
- `test-row.yaml`
- `test-list-row.yaml`

Component mode is still useful when testing a specific component contract, such as whether a `Row` handles `segNavigate`.

## Store-Level Decisions

Document-level event processing should own:

- event normalization
- target document validation
- current focus lookup
- selection lookup
- structure operations that update document data
- choosing the component that should receive a forwarded event
- clearing or preserving selection state after accepted changes
- scheduling focus restore after structural changes

Component-level logic should still own local behavior:

- `TextSeg`: caret-local movement and text input detection
- `Row`: movement between segments inside one row
- `List`: movement and structure behavior across rows and nested lists

## Proposed API Shape

```ts
async sendEventToDoc(docId: string, event: CompEvent): Promise<CompEventResult> {
  const eventNormalized = this.normalizeEvent(docId, event);
  const compIdTarget = this.pickDocEventTarget(docId, eventNormalized);
  const eventForwarded = this.rewriteDocEventForTarget(docId, eventNormalized, compIdTarget);
  return this.receiveEvent(docId, eventForwarded);
}
```

The implementation does not have to route every event at once. It can start with focus, click, text split, merge, indent, outdent, and navigation events that are already used by the MobX tests.
