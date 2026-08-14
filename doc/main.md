# Yamd

Yamd renders and edits markdown-like documents represented by serializable component data. Parsing markdown text is outside its document model.

## Document model

The main hierarchy is:

```text
List
  -> Row
      -> Segment
```

A `List` owns outline entries. A `Row` owns ordered inline segments. A segment owns its content and answers edit queries for content-specific operations.

`TextSeg` is one segment implementation. Document processing recognizes segments from their position inside a `Row`; it does not use `TextSeg` as a built-in document type.

## Data and rendering

The MobX `DocStore` is the source of truth for:

- serializable document component data
- logical focus and DOM active element tracking
- DOM selection tracking
- drag state
- accepted document edit transactions

React components observe store data and submit events or edit queries. Components can prepare a change, but only the store applies accepted document changes.

For the MobX component tree and event model, refer to [MobX document renderer](../doc-mobx/doc-mobx.md).

## Document edits

One user edit is one synchronous store transaction:

```text
DOM event
  -> component query
  -> Row or List prepares the change
  -> DocStore.runDocEdit()
      -> apply all document mutations
      -> accept all or restore the previous document state
  -> observer components render the accepted state
```

Focus and selection can change with an edit, but they are not document content. Selection and navigation alone do not create edit history.

For history tree semantics and undo or redo APIs, refer to [Edit history](../doc-mobx/history.md).

## Other implementation guides

- [Component design](./design-guide.md)
- [Custom components](./custom-comp.md)
- [Indent event](./event-indent.md)
- [Focus event](./event-focus.md)
- [MobX custom component design](../doc-mobx/yamd_comp_design.md)
