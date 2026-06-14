import type { DocStore } from './docStore';
import type { DragItemRuntimeState, DragState } from './docStoreTypes';
import {
  docStoreCompleteDragMove,
  docStoreGetDragSubjectFromFocus,
  docStoreGetDropInfoFromPoint,
  docStoreGetIsDropAllowed,
} from './docStoreDragMove';

export const createDragItemRuntimeState = (): DragItemRuntimeState => ({
  isDragged: false,
  isDragHovered: false,
  isDropAllowed: true,
  isInsertBefore: false,
  isInsertAfter: false,
  isInsertInside: false,
  isInsertMain: false,
  isInsertBeforeSibling: false,
  isInsertSegmentBefore: false,
  isInsertSegmentAfter: false,
});

export const createDragState = (): DragState => ({
  isDragging: false,
  itemIdDragged: '',
  itemKindDragged: '',
  compIdDragged: '',
  dropInfoActive: null,
  runtimeStateByItemId: {},
  versionDrag: 0,
  isFocusClickSuppressed: false,
});

export function docStoreGetDragItemRuntimeState(store: DocStore, docId: string, itemId: string) {
  const dragState = store.ensureDoc(docId).interactionState.dragState;
  const itemIdSafe = String(itemId || '');
  if (!itemIdSafe) return createDragItemRuntimeState();
  if (!dragState.runtimeStateByItemId[itemIdSafe]) {
    dragState.runtimeStateByItemId[itemIdSafe] = createDragItemRuntimeState();
  }
  return dragState.runtimeStateByItemId[itemIdSafe];
}

export function docStoreStartDragFromFocus(store: DocStore, docId: string, compIdFallback = '') {
  const docRecord = store.ensureDoc(docId);
  const subject = docStoreGetDragSubjectFromFocus(store, docId, compIdFallback);
  if (!subject.compIdDragged || !subject.itemKindDragged) {
    return { code: -1, message: 'No movable focus target.' };
  }
  docStoreClearDragState(store, docId);
  const dragState = docRecord.interactionState.dragState;
  dragState.isDragging = true;
  dragState.itemKindDragged = subject.itemKindDragged;
  dragState.compIdDragged = subject.compIdDragged;
  dragState.itemIdDragged = `${subject.itemKindDragged}:${subject.compIdDragged}`;
  dragState.versionDrag += 1;
  docStoreGetDragItemRuntimeState(store, docId, dragState.itemIdDragged).isDragged = true;
  return { code: 0, message: 'Drag started.' };
}

export function docStorePreviewDragDropFromPoint(store: DocStore, docId: string, clientX: number, clientY: number) {
  const dropInfo = docStoreGetDropInfoFromPoint(store, docId, clientX, clientY);
  if (!dropInfo) {
    docStoreClearDragPreview(store, docId);
    return { code: -1, message: 'No drop target.' };
  }
  const isDropAllowed = docStoreGetIsDropAllowed(store, docId, dropInfo);
  docStorePreviewDragDrop(store, docId, dropInfo, isDropAllowed);
  return { code: 0, message: 'Drop preview updated.' };
}

export function docStorePreviewDragDrop(
  store: DocStore,
  docId: string,
  dropInfo: DragState['dropInfoActive'],
  isDropAllowed: boolean,
) {
  const dragState = store.ensureDoc(docId).interactionState.dragState;
  if (!dragState.isDragging || !dropInfo?.targetId) return { code: -1, message: 'Drag is not active.' };
  docStoreClearDragPreview(store, docId);
  dragState.dropInfoActive = dropInfo;
  const itemIdDragged = String(dragState.itemIdDragged || '');
  if (itemIdDragged) {
    docStoreGetDragItemRuntimeState(store, docId, itemIdDragged).isDragged = true;
  }
  const runtimeState = docStoreGetDragItemRuntimeState(store, docId, dropInfo.targetId);
  runtimeState.isDragHovered = true;
  runtimeState.isDropAllowed = isDropAllowed !== false;
  runtimeState.isInsertBefore = dropInfo.drop?.side === 'before';
  runtimeState.isInsertAfter = dropInfo.drop?.side === 'after';
  runtimeState.isInsertInside = dropInfo.drop?.side === 'inside';
  runtimeState.isInsertMain = dropInfo.kind === 'mainRow';
  runtimeState.isInsertBeforeSibling = dropInfo.drop?.side === 'beforeSibling';
  runtimeState.isInsertSegmentBefore = dropInfo.kind === 'segment' && dropInfo.drop?.side === 'before';
  runtimeState.isInsertSegmentAfter = dropInfo.kind === 'segment' && dropInfo.drop?.side === 'after';
  dragState.versionDrag += 1;
  return { code: 0, message: 'Drop preview updated.' };
}

export function docStoreClearDragPreview(store: DocStore, docId: string) {
  const dragState = store.ensureDoc(docId).interactionState.dragState;
  const targetId = String(dragState.dropInfoActive?.targetId || '');
  if (targetId && dragState.runtimeStateByItemId[targetId]) {
    Object.assign(dragState.runtimeStateByItemId[targetId], createDragItemRuntimeState());
  }
  const itemIdDragged = String(dragState.itemIdDragged || '');
  if (itemIdDragged && dragState.runtimeStateByItemId[itemIdDragged]) {
    dragState.runtimeStateByItemId[itemIdDragged].isDragged = dragState.isDragging;
  }
  dragState.dropInfoActive = null;
}

export function docStoreClearDragState(store: DocStore, docId: string) {
  const dragState = store.ensureDoc(docId).interactionState.dragState;
  Object.values(dragState.runtimeStateByItemId).forEach((runtimeState) => {
    Object.assign(runtimeState, createDragItemRuntimeState());
  });
  dragState.isDragging = false;
  dragState.itemIdDragged = '';
  dragState.itemKindDragged = '';
  dragState.compIdDragged = '';
  dragState.dropInfoActive = null;
  dragState.runtimeStateByItemId = {};
  dragState.versionDrag += 1;
}

export function docStoreCompleteDragMoveFromState(store: DocStore, docId: string) {
  const result = docStoreCompleteDragMove(store, docId);
  if (result.code === 0) {
    requestBulletMeasureAfterDragMove(store, docId);
  }
  docStoreClearDragState(store, docId);
  return result;
}

export function docStoreSuppressNextFocusClick(store: DocStore, docId: string) {
  const dragState = store.ensureDoc(docId).interactionState.dragState;
  dragState.isFocusClickSuppressed = true;
  dragState.versionDrag += 1;
}

export function docStoreConsumeFocusClickSuppressed(store: DocStore, docId: string) {
  const dragState = store.ensureDoc(docId).interactionState.dragState;
  if (!dragState.isFocusClickSuppressed) return false;
  dragState.isFocusClickSuppressed = false;
  dragState.versionDrag += 1;
  return true;
}

export function docStoreClearFocusClickSuppressed(store: DocStore, docId: string) {
  const dragState = store.ensureDoc(docId).interactionState.dragState;
  if (!dragState.isFocusClickSuppressed) return;
  dragState.isFocusClickSuppressed = false;
  dragState.versionDrag += 1;
}

function requestBulletMeasureAfterDragMove(store: DocStore, docId: string) {
  const docRecord = store.ensureDoc(docId);
  Object.values(docRecord.compDataById).forEach((compData) => {
    if (String(compData.compName || '') !== 'List') return;
    const listId = String(compData.compId || '');
    const mainCompId = String(compData.mainCompId || '');
    if (mainCompId) {
      const compIdProvider = store.pickCompBulletProviderId(docId, mainCompId);
      store.requestCompBulletPos(docId, mainCompId, {
        compIdRequester: listId,
        compIdBasis: listId,
        compIdProvider,
        isBulletMeasureEnabled: true,
      });
    }
    const childIdList = Array.isArray(compData.childIdList) ? compData.childIdList : [];
    childIdList.forEach((childIdRaw) => {
      const childId = String(childIdRaw || '');
      if (!childId) return;
      const compIdProvider = store.pickCompBulletProviderId(docId, childId);
      store.requestCompBulletPos(docId, childId, {
        compIdRequester: listId,
        compIdBasis: childId,
        compIdProvider,
        isBulletMeasureEnabled: true,
      });
    });
  });
}
