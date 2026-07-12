# List And Row Components

This document defines how `List` and `Row` cooperate in the document tree.

For event routing, see `./event_comp.md`.
For logical focus, see `./comp_focus.md`.
For DOM selection tracking, see `./comp_selection.md`.
For split, indent, and outdent behavior, see `./comp_indent_split.md`.

## Component Roles

`Row` arranges segment-level components in inline order. Segments flow left to right and wrap to the next visual line when there is not enough horizontal space.

- owns ordered segment-level children
- maps row gap clicks to a target segment
- routes left and right movement between segments in the same row
- sends row-boundary movement to parent `List`

`List` is one vertical outline item with optional nested entries.

- owns one optional `mainCompId`, normally a `Row`
- owns ordered nested entries in `childIdList`
- routes up and down movement across rows
- owns row split, indent, and outdent structure changes

A segment is the smallest inline unit inside a row. `TextSeg` is the current basic text segment, but future rows can contain other segment-level components, such as inline math, tags, references, or embedded controls.

Segment-level components stay local. They should not directly change list structure.

## Data Shape

`Row` uses `childIdList` for segment-level components.

```ts
type RowCompData = {
  compId: string;
  compName: 'Row';
  childIdList: string[]; // segment component ids
  data: object;
  config: {
    isRoot?: boolean;
  };
};
```

`List` uses `mainCompId` for its own visible row and `childIdList` for nested entries.

```ts
type ListCompData = {
  compId: string;
  compName: 'List';
  mainCompId?: string;   // Row id
  childIdList: string[]; // Row or List ids
  data: {
    bulletType?: 'circle' | 'flat' | 'index';
  };
  config: {
    isRoot?: boolean;
  };
};
```

Rules:

- `mainCompId` is not duplicated in `childIdList`.
- `childIdList` entries can be `Row` or `List`.
- A `Row` in `childIdList` is a leaf outline item.
- A `List` in `childIdList` is an outline item with its own main row and nested entries.
- The document root is a `List` with `config.isRoot=true` and no `mainCompId`.
- A non-root editable outline `List` normally has a `mainCompId`.
- `data.bulletType` controls how child entries are marked. It defaults to `circle`.

## Render Order

`List` with `mainCompId` renders in this order:

1. `mainCompId` as the list item's main row
2. each entry in `childIdList`, in order
3. nested entries recursively

A `List` without `mainCompId` renders only its `childIdList`. This is independent from marker rendering.

Child marker modes:

- `circle`: render a small circle before each child entry.
- `flat`: render child entries without marker space.
- `index`: render a numeric marker before each child entry.

`Row` renders its segment children in `childIdList` order.

This gives the document order used by selection tracking:

```ts
List.mainCompId
List.childIdList[0]
List.childIdList[0].mainCompId if it is a List
List.childIdList[0].childIdList recursively
List.childIdList[1]
```

## Entry Meaning

For editing, an outline entry is one of these:

- a `Row` child of a parent `List`
- a `List` child of a parent `List`
- the `mainCompId` row of a `List`

Most structural operations work on entries, not only on raw rows.

When an operation needs to give a `Row` nested children, the row should be wrapped in a new `List`:

1. create a `List`
2. set its `mainCompId` to the row id
3. replace the row id in the parent list's `childIdList` with the new list id
4. put nested entries into the new list's `childIdList`

This preserves the row id and avoids moving text segments between unrelated rows.

## Event Responsibilities

`Row` handles segment-lane events:

- `segNavigate`
- row click gap targeting
- segment split inside the row before list-level structure is changed
- segment deletion inside the row before list-level cleanup is needed

`List` handles vertical and structural events:

- `rowNavigate`
- `rowSplit`
- `rowIndent`
- `rowOutdent`
- multi-row indent and outdent

`DocStore` accepts or rejects the final change and updates focus and selection state.

Recommended flow:

```ts
TextSeg keyboard event
Row event logic
List event logic
DocStore data update
DocStore focus and selection update
components render from store
```

## Focus After Structure Changes

After a structure change, focus should be restored through store state, not local component state.

Rules:

- split focuses the first segment of the second part
- indent keeps focus on the moved entry
- outdent keeps focus on the moved entry
- deleting a segment routes focus as a leftward unfocus from the deleted segment
- multi-row operations keep focus on the last focused segment if it is still present
- if the focused segment was deleted, focus the nearest surviving segment in document order

The focus state is the same state described in `./comp_focus.md`.

## Acceptance Criteria

- `List` can render a main row and nested rows/lists.
- `Row` can render multiple segment-level children in order.
- document order can be derived without reading DOM layout.
- row navigation crosses list boundaries through `eventLogicList.ts`.
- structural operations preserve serializable `compById`, `mainCompId`, and `childIdList`.
- no component keeps hidden structural state outside `DocStore`.
