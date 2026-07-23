import React from 'react';
import type { DocStore } from '../docStore';
import { docStoreIsSegment } from '../docStoreSegment';

type PointerState = {
  x: number;
  y: number;
  isDragging: boolean;
};

type UseDocDragInteractionParams = {
  docId: string;
  compId: string;
  store: DocStore | null | undefined;
  isDragMoveEnabled?: boolean;
};

export function useDocDragInteraction({
  docId,
  compId,
  store,
  isDragMoveEnabled = true,
}: UseDocDragInteractionParams) {
  const pointerStateRef = React.useRef<PointerState | null>(null);

  const handlePointerDownCapture = React.useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (!store || !docId || !compId || !isDragMoveEnabled || !event.shiftKey || event.button !== 0) {
      return;
    }
    const targetEl = event.target instanceof Element ? event.target : null;
    if (targetEl?.closest('[data-mobx-comp-id]') !== event.currentTarget) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    focusLeafIfOutsideCurrentFocus(store, docId, compId);
    pointerStateRef.current = {
      x: event.clientX,
      y: event.clientY,
      isDragging: false,
    };

    const handlePointerMove = (eventMove: PointerEvent) => {
      const pointerState = pointerStateRef.current;
      if (!pointerState) return;
      const distanceX = Math.abs(eventMove.clientX - pointerState.x);
      const distanceY = Math.abs(eventMove.clientY - pointerState.y);
      if (!pointerState.isDragging && (distanceX > 3 || distanceY > 3)) {
        const result = store.startDragFromFocus(docId, compId);
        if (result.code !== 0) {
          pointerStateRef.current = null;
          window.removeEventListener('pointermove', handlePointerMove);
          window.removeEventListener('pointerup', handlePointerUp);
          return;
        }
        pointerState.isDragging = true;
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
        window.setTimeout(() => {
          store.clearFocusClickSuppressed(docId);
        }, 200);
        return;
      }
      store.focusExpandToParent(docId, compId, 'shiftClickExpand');
      store.suppressNextFocusClick(docId);
      window.setTimeout(() => {
        store.clearFocusClickSuppressed(docId);
      }, 0);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  }, [compId, docId, isDragMoveEnabled, store]);

  return { handlePointerDownCapture };
}

function focusLeafIfOutsideCurrentFocus(store: DocStore, docId: string, compId: string) {
  if (!docStoreIsSegment(store.ensureDoc(docId), compId)) return;
  const focusState = store.getInteractionState(docId).focusState;
  const compIdFocused = String(focusState.compIdFocused || focusState.segIdFocused || '');
  if (!compIdFocused || compIdFocused === compId) return;
  if (isCompDescendantOrSelf(store, docId, compIdFocused, compId)) return;
  store.segFocus(docId, compId, focusState.offsetFocused, 'shiftDragLeaf');
}

function isCompDescendantOrSelf(store: DocStore, docId: string, compIdAncestor: string, compIdTarget: string) {
  const ancestorId = String(compIdAncestor || '');
  const targetId = String(compIdTarget || '');
  if (!ancestorId || !targetId) return false;
  if (ancestorId === targetId) return true;
  const stack = getChildIdList(store.getCompDataById(docId, ancestorId));
  const idVisitedSet = new Set<string>();
  while (stack.length > 0) {
    const compIdCurrent = String(stack.pop() || '');
    if (!compIdCurrent || idVisitedSet.has(compIdCurrent)) continue;
    if (compIdCurrent === targetId) return true;
    idVisitedSet.add(compIdCurrent);
    stack.push(...getChildIdList(store.getCompDataById(docId, compIdCurrent)));
  }
  return false;
}

function getChildIdList(compData: any) {
  return [
    String(compData?.mainCompId || ''),
    ...(Array.isArray(compData?.childIdList) ? compData.childIdList.map((childId: unknown) => String(childId || '')) : []),
  ].filter(Boolean);
}
