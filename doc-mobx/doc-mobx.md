# MobX Document Renderer

The MobX implementation renders and edits markdown-like document data through a store-owned component tree. `DocStore` owns document data, component data, focus state, selection state, event routing, and accepted structure edits. Render components observe store state and submit events upward.


## Document Structure

The document's conecptual structure is a nested list.
The overall hierarchy is (root-->) List --> Row --> Segment(abbreviated as seg).

For `List` and `Row` , see `./comp_list_row.md`.

## Data Representation
For document data shape, see `./doc_data.md`.
For component data shape, see `./comp_data.md`.

## Event System

For document-level event processing, see `./event_doc.md`.


For component event routing, see `./event_comp.md`.

## Selection and Focus System

For logical focus behavior, see `./comp_focus.md`.

For DOM text selection tracking, see `./comp_selection.md`.

## Edit actions

For split, indent, and outdent behavior, see `./comp_indent_split.md`.

For delete and copy actions, see `./comp_delete_copy.md`.

Accepted content and structure changes run through one document edit transaction. For the transaction boundary, history tree, and undo or redo API, see `./history.md`.

## Bullet Position System

For measured list bullet placement and connector line behavior, see `./comp_bullet.md`.

## Segment Level Components

`TextSeg` is one segment implementation. Document-level processing identifies segments by their direct position inside a `Row` and uses segment query contracts for content-specific behavior.

For the component data, history, and rendering rules shared by custom components, see `./yamd_comp_design.md`.

For `TextSeg`, see `./comp_text_seg.md`.

For `TextBasic`, see `./comp_text_basic.md`.
