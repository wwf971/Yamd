# Split, Indent, And Outdent

This document defines editable outline structure behavior for document components.

For `List` and `Row` ownership, see `./comp_list_row.md`.
For keyboard focus, see `./comp_focus.md`.
For DOM selection tracking, see `./comp_selection.md`.
For event routing, see `./event_comp.md`.

## Scope

This covers:

- Enter in an editable leaf
- deleting the last content from an editable leaf
- splitting an editable leaf
- splitting a row
- the special split rule for a list main row
- Tab indent
- Shift+Tab outdent
- multi-row indent and outdent from DOM selection

The editable structure is stored in `DocStore.compDataById`. Components should submit events and let store logic accept or reject the final data change.

## Keyboard Entry Points

The editable leaf component handles Enter because it owns the caret or edit offset inside its own content.

`List` or the document shell handles Tab and Shift+Tab because indent and outdent are outline-level operations.

Current MobX event direction:

```ts
childSplitAttempt
childDeleteAttempt
rowSplitAttempt
rowIndentAttempt
rowOutdentAttempt
```

Recommended data fields:

```ts
{
  rowId: string;
  childId: string;
  offset: number;
  rowIdList?: string[];
}
```

`rowIdList` is used when the current DOM selection spans multiple rows.

## Enter In Editable Leaf

When an editable leaf component receives Enter:

1. prevent the browser from inserting a newline
2. read the current caret offset
3. classify the offset
4. emit a child split attempt to row/list logic

Offset classification:

- `begin`: offset is `0`
- `end`: offset is content length
- `middle`: offset is greater than `0` and less than content length

The first implementation should focus on `middle`, because it is the case that changes both leaf data and row structure.

## Middle Leaf Split

For editable leaf content `abcdef` and offset `3`:

```ts
contentLeft = 'abc';
contentRight = 'def';
```

Data changes:

1. update the original leaf to `contentLeft`
2. create a new leaf for `contentRight`
3. split the owning row's child list at the original leaf

If the row has children:

```ts
[childA, childB, childC]
```

and `childB` splits into `childB` and `childBRight`, the row-level split becomes:

```ts
rowLeft.childIdList = [childA, childB]
rowRight.childIdList = [childBRight, childC]
```

The right row receives focus at offset `0` in `childBRight`.

## Repeated Enter Split Focus

Holding Enter should keep splitting the current right-side leaf. For example, when the caret is between `b` and `c` in `abcd`, repeated Enter should create empty rows between `ab` and `cd`, and the caret should remain before `c` in the final right-side leaf.

Crucial implementation points:

1. apply the accepted structure edit and update store-owned logical focus in the same operation
2. make the logical focus target the newly created right-side leaf at offset `0`
3. apply DOM focus only after render, because the new leaf element may not exist yet
4. before deferred DOM focus runs, check that store-owned logical focus still points to the same leaf and offset
5. if a repeated key event arrives on an old DOM element whose leaf is no longer the logical focus target, do not split that old leaf
6. in that stale-key case, redirect DOM focus to the current logical focus target and let later key events operate there

The store is the source of truth for which leaf receives the next split. DOM focus is allowed to lag behind render, but it must never be allowed to move focus backward or let an outdated element emit another structure edit.

## Empty Leaf Delete

When deleting content causes an editable leaf to become empty, the leaf should not remain as an empty component by default unless the owning row intentionally allows empty leaves.

Recommended flow:

1. the editable leaf detects a transition from non-empty content to empty content
2. the editable leaf emits a child delete attempt with direction `left`
3. `Row` handles the event in child order
4. store removes the leaf data from `compDataById`
5. store removes the child id from the owning row's `childIdList`
6. `Row` routes focus as if the deleted child emitted `unfocus` toward the left

Focus target:

- if there is a previous editable child in the same row, focus it from the right
- if there is no previous editable child but a next editable child exists, focus it from the left
- if the row has no editable children after deletion, route row-level focus to the parent `List`

If deleting the child makes the row empty and the row is itself removable, list-level logic can remove the row too. That row removal should be a separate accepted store operation so child deletion and row deletion remain testable independently.

## Row Split When Row Is A List Child

This is the normal case.

Before:

```ts
List B
  childIdList: [rowA, rowB, rowC]
```

Splitting `rowB` creates `rowBRight` and inserts it after `rowB`.

After:

```ts
List B
  childIdList: [rowA, rowB, rowBRight, rowC]
```

`rowB` keeps the first part. `rowBRight` receives the second part.

## Row Split When Row Is A List Main Row

This is the special case.

Before:

```ts
List B
  childIdList: [listA]

List A
  mainCompId: rowA
  childIdList: [...]
```

Splitting `rowA` creates two logical rows:

- `rowA1`: first part
- `rowA2`: second part

After:

```ts
List B
  childIdList: [rowA1, listA]

List A
  mainCompId: rowA2
  childIdList: [...]
```

Rules:

- `rowA1` is inserted into parent `List B` immediately before `List A`.
- `rowA2` becomes the new `mainCompId` of `List A`.
- `List A.childIdList` is preserved.
- focus moves to the first editable child of `rowA2`.

Implementation can either reuse `rowA` as `rowA2` and create a new `rowA1`, or create both rows and retire `rowA`. The externally visible rule is that the first part becomes a sibling above `List A`, and the second part remains the main row of `List A`.

The document root list has no `mainCompId`, so a visible top-level row is represented by a child entry list:

```ts
RootList
  childIdList: [List A]

List A
  mainCompId: rowA
  childIdList: [...]
```

Splitting `rowA` follows the parent-list rule. The first part becomes a top-level sibling row before `List A`, while the second part remains `List A.mainCompId`. Merging the second part back into the previous row removes that temporary top-level row and preserves `List A.childIdList`.

## Begin And End Split

`begin` and `end` can be added after `middle` is stable.

Suggested behavior:

- `begin`: create an empty row before the current row and focus it
- `end`: create an empty row after the current row and focus it

When the current row is a list main row, the same main-row rule applies:

- `begin` inserts an empty row above the list
- `end` creates an empty row as the new main row's next position according to the parent list rule

## Indent

Tab runs `rowIndent`.

Single-entry indent:

1. find the current outline entry from logical focus
2. find its parent `List`
3. find the previous sibling entry in that parent list
4. move the current entry under the previous sibling

If the previous sibling is a `List`, append the moved entry to that list's `childIdList`.

If the previous sibling is a `Row`, wrap it in a new `List`:

```ts
Before:
List B
  childIdList: [rowA, rowB]

After:
List B
  childIdList: [listA]

List A
  mainCompId: rowA
  childIdList: [rowB]
```

Reject indent when:

- there is no parent `List`
- the entry is first in its parent `childIdList`
- the previous sibling cannot become a parent entry

Focus remains on the moved entry.

## Outdent

Shift+Tab runs `rowOutdent`.

Single-entry outdent:

1. find the current outline entry from logical focus
2. find its parent `List`
3. find the parent list's parent `List`
4. move the current entry after the parent list in the grandparent list
5. move following siblings under the outdented entry

Before:

```ts
List B
  childIdList: [listA, rowD]

List A
  mainCompId: rowA
  childIdList: [rowB, rowC]
```

Outdenting `rowB`:

```ts
List B
  childIdList: [listA, listB, rowD]

List A
  mainCompId: rowA
  childIdList: []

List listB
  mainCompId: rowB
  childIdList: [rowC]
```

In the example, `rowB` is wrapped as `listB` because it receives `rowC` as a child. If the outdented entry is already a `List`, reuse it and append the following siblings to its `childIdList`.

Reject outdent when:

- there is no parent `List`
- the parent list has no parent `List`
- the entry has no parent list above it

Focus remains on the moved entry.

## Multi-Row Indent And Outdent

When DOM selection is a range, derive selected rows from `selectionState`.

Steps:

1. collect all editable leaf ids touched by the selection
2. map each leaf to its owning `Row`
3. normalize rows to outline entries
4. remove entries whose ancestor entry is also selected
5. preserve document order

Initial reliable scope:

- selected entries share the same parent `List`
- selected entries are contiguous in that parent
- focus remains on the previously focused editable leaf if it still exists

Multi-row indent:

- the first selected entry must have a previous sibling
- all selected entries move under that previous sibling
- order inside the moved block is preserved
- if the previous sibling is a `Row`, wrap it as a `List`

Multi-row outdent:

- selected entries must have a parent list whose parent is also a `List`
- selected entries move after their parent list in the grandparent list
- order inside the moved block is preserved
- when one entry is outdented, following siblings move under the outdented entry
- when multiple entries are outdented, the selected block moves together and later siblings stay with the old parent

The implementation now supports multi-row indent and outdent for selected top-level entries. It filters out selected descendants when their ancestor entry is also selected.

## Store Helper Direction

These operations need small store helpers rather than component-local mutation.

Useful helpers:

```ts
getParentCompId(docId, compId)
getOwningRowId(docId, childId)
getOwningListIdForEntry(docId, entryId)
createCompId(prefix)
createLeaf(content)
createRow(childIdList)
createList(mainRowId, childIdList)
deleteComp(compId)
replaceChildId(parentListId, oldChildId, newChildId)
insertChildAfter(parentListId, refChildId, childId)
removeChildId(parentId, childId)
```

The helper names can change, but the behavior should stay store-owned.

## Acceptance Criteria

- Enter in the middle of an editable leaf splits leaf content and row structure.
- splitting a normal row inserts the second row after the first in the same list.
- splitting a list main row moves the first half above the list and keeps the second half as the list main row.
- Tab indents the focused row/list entry under its previous sibling.
- Shift+Tab outdents the focused row/list entry after its parent list.
- DOM range selection can drive multi-row indent and outdent for contiguous entries in one parent list.
- deleting the last content in an editable leaf removes that leaf and restores focus leftward.
- focus state remains consistent with `./comp_focus.md`.
- selection state remains consistent with `./comp_selection.md`.
