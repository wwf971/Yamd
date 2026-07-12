# Drag Move

This document describes the planned drag move feature for the MobX document renderer.

The feature is based on logical focus. Shift-click chooses the focus subject. Shift-drag moves that focused subject.

The design follows the same principle as the JSON MobX drag move implementation: DOM position is used for hit testing only. Once the pointer is over a document component, all validation and move logic should use store metadata and document structure.

## Core Idea

Drag move has three layers:

1. Components expose document ids and pointer events.
2. `DocStore` owns drag operation state and registered move metadata.
3. Move helpers validate and mutate the document tree.

The drag subject is not text selection. It is the current logical focus target:

```text
TextSeg focus means move that segment inside row segment lists
Row focus means move that row
List focus means move that list entry
DocViewer or root focus is not movable
```

For a nested list item, the real outline entry can be either a `Row` or a `List`:

```text
Row alone:
parent List childIdList contains rowId

Row with children:
parent List childIdList contains listId
that List has mainCompId equal to rowId
```

The move helper should work with component ids and document structure, not with DOM nodes.

## Drop Kinds

Unlike JSON MobX, different document component kinds have different legal drop containers.

Segment-level components:

```text
can be inserted into any Row childIdList
can target the main row of a List
drop preview uses a vertical insertion marker between inline segments
```

Rows:

```text
can be inserted into a List childIdList
can replace a List main row
can move out from a List main row, leaving that List mainless
```

Lists:

```text
can be inserted into another List childIdList
can be inserted into the root List childIdList
cannot replace a main row
cannot move the root List itself
```

A List top edge is a split drop target:

```text
left half: set dragged Row as this List main row
right half: insert dragged Row or List as previous sibling
```

For the root List, the right half inserts into the root child list because the root has no previous sibling.

## Store State

Add drag state to `DocInteractionState`.

```ts
type DragDropType = 'before' | 'after' | 'inside';

type DragItemMeta = {
  itemId: string;
  compId: string;
  entryId: string;
  rowId: string;
  parentListId: string;
  itemKind: 'segment' | 'row' | 'list';
  itemParentId: string;
  itemPreviousId: string;
  itemNextId: string;
  listIdInside: string;
};

type DragDropInfo = {
  targetItemId: string;
  drop: {
    type: DragDropType;
    parentListId: string;
    itemBeforeId: string;
    itemAfterId: string;
  } | null;
};

type DragItemRuntimeState = {
  isDragged: boolean;
  isDragHovered: boolean;
  isDropAllowed: boolean;
  isInsertBefore: boolean;
  isInsertAfter: boolean;
  isInsertInside: boolean;
};

type DragState = {
  isDragging: boolean;
  itemIdDragged: string;
  itemMetaDragged: DragItemMeta | null;
  dropInfoActive: DragDropInfo | null;
  itemMetaById: Record<string, DragItemMeta>;
  runtimeStateByItemId: Record<string, DragItemRuntimeState>;
  versionDrag: number;
};
```

Suggested placement:

```ts
type DocInteractionState = {
  focusState: FocusState;
  elActiveState: ElActiveState;
  selectionState: SelectionState;
  dragState: DragState;
  runtimeStateByCompId: Record<string, CompRuntimeState>;
  bulletPosStateByCompId: Record<string, CompBulletPosState>;
};
```

The store should expose these methods:

```ts
registerDragItem(docId, itemMeta)
unregisterDragItem(docId, itemId)
getDragItemRuntimeState(docId, itemId)
startDrag(docId, itemId)
previewDragDrop(docId, dropInfo, isDropAllowed)
clearDragPreview(docId)
clearDragState(docId)
completeDragMove(docId)
```

Boolean fields should keep the `isXxx` shape. Entity words should stay first, for example `itemIdDragged`, `itemMetaDragged`, `dropInfoActive`, and `versionDrag`.

## Metadata Registration

`Row` and `List` should register metadata for the outline entry they represent.

The metadata answers these questions:

```text
what entry will move
which parent list currently owns it
which item is before it
which item is after it
which list can receive children inside it
```

Rows should not decide move semantics by themselves. They ask the store for entry metadata:

```ts
const itemMeta = store.getDragItemMetaByCompId(docId, compId);
store.registerDragItem(docId, itemMeta);
```

A segment-level component can be a separate drag item. If shift-drag starts from a segment, the drag subject is resolved from `focusState` and the segment can move between row segment lists.

## Gesture Flow

Use pointer events, not native browser drag.

Reason:

1. Native drag is unreliable when the pointer starts inside editable or selectable text.
2. The document already uses browser selection for text range selection.
3. Shift-drag should be reserved for structural movement.

Pointer flow:

```text
pointer down with Shift
record start point
prevent browser text selection change
if pointer passes threshold, start drag from logical focus
on pointer move, update drop preview from elementFromPoint
on pointer up, complete move or clear drag state
briefly suppress the following click
```

Proposed hook:

```ts
function useDocDragInteraction({
  docId,
  compId,
  store,
  isDragMoveEnabled,
}) {
  const pointerStateRef = React.useRef(null);

  const handlePointerDownCapture = React.useCallback((event) => {
    if (!isDragMoveEnabled || !event.shiftKey || event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    pointerStateRef.current = {
      x: event.clientX,
      y: event.clientY,
      isDragging: false,
      isClickSuppressed: true,
    };

    const handlePointerMove = (eventMove) => {
      const pointerState = pointerStateRef.current;
      if (!pointerState) return;

      const distanceX = Math.abs(eventMove.clientX - pointerState.x);
      const distanceY = Math.abs(eventMove.clientY - pointerState.y);
      if (!pointerState.isDragging && (distanceX > 3 || distanceY > 3)) {
        pointerState.isDragging = true;
        store.startDragFromFocus(docId, compId);
      }

      if (pointerState.isDragging) {
        store.previewDragDropFromPoint(docId, eventMove.clientX, eventMove.clientY);
      }
    };

    const handlePointerUp = () => {
      const pointerState = pointerStateRef.current;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      pointerStateRef.current = null;

      if (pointerState?.isDragging) {
        store.completeDragMove(docId);
        store.suppressNextFocusClick(docId);
        window.setTimeout(() => store.clearFocusClickSuppressed(docId), 200);
        return;
      }

      store.focusExpandToParent(docId, compId, 'shiftClickExpand');
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  }, [compId, docId, isDragMoveEnabled, store]);

  return { handlePointerDownCapture };
}
```

The real implementation can live in `src-mobx/util/useDocDragInteraction.ts` or `src-mobx/event/useDocDragInteraction.ts`. The hook should call store APIs and not mutate document data directly.

## Drop Preview

Drop preview should use `document.elementFromPoint(clientX, clientY)` and find the closest registered drag item:

```ts
function previewDragDropFromPoint(store, docId, clientX, clientY) {
  const elTarget = document.elementFromPoint(clientX, clientY);
  const elItem = elTarget?.closest?.('[data-mobx-drag-item-id]');
  const itemIdTarget = String(elItem?.dataset.mobxDragItemId || '');
  const itemMetaTarget = store.getDragItemMeta(docId, itemIdTarget);

  if (!elItem || !itemMetaTarget) {
    store.clearDragPreview(docId);
    return;
  }

  const dropInfo = getDocDropInfoFromClientY({
    clientY,
    itemMeta: itemMetaTarget,
    rect: elItem.getBoundingClientRect(),
  });
  const isDropAllowed = getIsDocDropAllowed(store, docId, dropInfo);
  store.previewDragDrop(docId, dropInfo, isDropAllowed);
}
```

Drop zones:

```text
top part of target item means before
bottom part of target item means after
middle part of target item means inside, only when the target can own children
```

Use ratios similar to JSON MobX:

```ts
function getDocDropInfoFromClientY({ clientY, itemMeta, rect }) {
  const yInItem = clientY - rect.top;
  const heightItem = rect.height || 1;
  const isInsideZone = itemMeta.listIdInside
    && yInItem > heightItem * 0.28
    && yInItem < heightItem * 0.72;

  if (isInsideZone) {
    return {
      targetItemId: itemMeta.itemId,
      drop: {
        type: 'inside',
        parentListId: itemMeta.listIdInside,
        itemBeforeId: '',
        itemAfterId: '',
      },
    };
  }

  if (yInItem < heightItem / 2) {
    return {
      targetItemId: itemMeta.itemId,
      drop: {
        type: 'before',
        parentListId: itemMeta.parentListId,
        itemBeforeId: itemMeta.itemPreviousId,
        itemAfterId: itemMeta.entryId,
      },
    };
  }

  return {
    targetItemId: itemMeta.itemId,
    drop: {
      type: 'after',
      parentListId: itemMeta.parentListId,
      itemBeforeId: itemMeta.entryId,
      itemAfterId: itemMeta.itemNextId,
    },
  };
}
```

## Validation

Default validation should be strict.

Reject when:

```text
there is no dragged item
there is no drop target
the dragged item is the target item
the target is inside the dragged subtree
the drop is immediately before or after the same item
the drop parent list is missing
the move would make the root invalid
```

Validation should be in a pure helper:

```ts
function getIsDocDropAllowed({ docRecord, itemMetaDragged, dropInfo }) {
  if (!itemMetaDragged || !dropInfo?.drop) return false;
  const drop = dropInfo.drop;
  if (dropInfo.targetItemId === itemMetaDragged.itemId) return false;
  if (drop.itemBeforeId === itemMetaDragged.entryId) return false;
  if (drop.itemAfterId === itemMetaDragged.entryId) return false;
  if (!docRecord.compDataById[drop.parentListId]) return false;
  if (isEntryDescendantOfEntry(docRecord, drop.parentListId, itemMetaDragged.entryId)) return false;
  return true;
}
```

The helper should stay in a drag move module, for example `src-mobx/docStoreDragMove.ts`.

## Move Completion

Pointer up should finish quickly:

1. read `itemMetaDragged` and `dropInfoActive`
2. clear drag visual state
3. if the drop is invalid, return a rejected result
4. if valid, mutate document structure in one MobX action
5. focus the moved entry after the move
6. suppress the follow-up click for a short time

The move request should be store-owned:

```ts
function docStoreCompleteDragMove(store, docId) {
  const docRecord = store.ensureDoc(docId);
  const dragState = docRecord.interactionState.dragState;
  const itemMetaDragged = dragState.itemMetaDragged;
  const dropInfoActive = dragState.dropInfoActive;
  const isDropAllowed = getIsDocDropAllowed({
    docRecord,
    itemMetaDragged,
    dropInfo: dropInfoActive,
  });

  store.clearDragState(docId);
  if (!isDropAllowed) {
    return { code: -1, message: 'Drop target is not valid.' };
  }

  return moveDocEntryByDrop({
    docRecord,
    entryId: itemMetaDragged.entryId,
    rowId: itemMetaDragged.rowId,
    drop: dropInfoActive.drop,
  });
}
```

The actual mutation should be separate:

```ts
function moveDocEntryByDrop({ docRecord, entryId, rowId, drop }) {
  removeEntryFromParentList(docRecord, entryId);
  insertEntryIntoParentList(docRecord, entryId, drop);
  cleanupEmptyListAfterMove(docRecord);
  focusMovedEntryAfterRender(docRecord, rowId);
  return { code: 0, message: 'Entry moved.' };
}
```

This keeps drag operation state separate from document tree mutation.

## Moving Outline Entries

Moving an entry is different from indent and outdent but can reuse similar helpers.

Required helpers:

```ts
getOutlineEntryInfoByCompId(docRecord, compId)
getOutlineEntryInfoByRowId(docRecord, rowId)
getOwningListIdForChildEntry(docRecord, entryId)
isEntryDescendantOfEntry(docRecord, entryIdChild, entryIdAncestor)
removeEntryFromParentList(docRecord, entryId)
insertEntryIntoParentList(docRecord, entryId, drop)
cleanupEmptyListAfterMove(docRecord)
```

Important rule:

```text
If the focused component is a List, move the whole List.

If the focused component is a Row and that row is the main row of a List, move only the Row. The source List becomes mainless after a successful drop.
```

For a row that already has nested children, the entry id is the owning `List`, not the row id.

## Visual State

Visual classes should be derived from store drag state.

Suggested classes:

```text
mobx-drag-item
mobx-drag-item-dragged
mobx-drag-item-hovered
mobx-drag-item-drop-denied
mobx-drag-insert-before
mobx-drag-insert-after
mobx-drag-insert-inside
```

`Row` and `List` should read:

```ts
const dragRuntimeState = store.getDragItemRuntimeState(docId, itemId);
```

They should not keep local visual drag state.

## File Plan

Suggested new files:

```text
src-mobx/docStoreDrag.ts
src-mobx/docStoreDragMove.ts
src-mobx/util/useDocDragInteraction.ts
```

Suggested edits:

```text
src-mobx/docStoreTypes.ts
add drag types and dragState to DocInteractionState

src-mobx/docStore.ts
create drag state, expose store methods, clear stale drag state when docs reset

src-mobx/comp/Row.tsx
register row/list entry metadata, attach drag item attributes, attach pointer handler

src-mobx/comp/List.tsx
register list entry metadata, attach drag item attributes, attach pointer handler

src-mobx/comp/TextSeg.tsx
keep shift pointer default prevented so text selection does not change

src-mobx/comp/Row.css and src-mobx/comp/List.css
render drop preview classes
```

## Points To Be Careful About

Keep one drag state in the store. Do not create local drag flags in each component.

Do not use native browser drag.

Do not use DOM position to decide what moves. Use DOM only to find the registered target item id.

Do not let shift-drag update DOM text selection.

Do not move a row separately from its nested child list.

Do not allow dropping an entry into its own descendant.

Do not await a long async operation before suppressing the follow-up click.

If a future owner-side request can reject the move, record a drag revision before the request and only restore focus when the revision is still current.
