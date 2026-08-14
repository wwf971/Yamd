import React from 'react';
import type { useDocStoreContext } from '../../DocStoreContext';
import type { SelectionState, SelectionTrackPoint } from '../../docStoreTypes';
import {
  applyCaretByOffset,
  getCaretOffset,
  isCaretOnFirstLine,
  isCaretOnLastLine,
} from '../../util/caretUtils';
import { applyRangeSelectionByOffset, resetCaretBlink } from './TextSeg.dom';

export const arrowKeyEventForwardedSet = new WeakSet<KeyboardEvent>();

type TextSegKeyDownOptions = {
  rootRef: React.RefObject<HTMLSpanElement | null>;
  contextDocStore: ReturnType<typeof useDocStoreContext>;
  compId: string;
  text: string;
  isEditable: boolean;
  isLogicalCaretMode: boolean;
  isLogicalCaretVisible: boolean;
  isSelectionActive: boolean;
  offsetLogicalCaret: number;
  selectionState: SelectionState | undefined;
  emitEvent: (type: string, dataEvent?: any) => any;
  getCaretClientXCurrent: () => number;
  getPointCurrent: (offset: number) => SelectionTrackPoint;
  resolveSelectionAnchorForExtend: (offsetCurrent: number) => SelectionTrackPoint;
  updateKeyboardSelectionState: (reason: string, pointAnchor: SelectionTrackPoint, offsetFocus: number) => void;
  updateFocusState: (reason: string, offset?: number) => void;
};

export function useTextSegKeyDown({
  rootRef,
  contextDocStore,
  compId,
  text,
  isEditable,
  isLogicalCaretMode,
  isLogicalCaretVisible,
  isSelectionActive,
  offsetLogicalCaret,
  selectionState,
  emitEvent,
  getCaretClientXCurrent,
  getPointCurrent,
  resolveSelectionAnchorForExtend,
  updateKeyboardSelectionState,
  updateFocusState,
}: TextSegKeyDownOptions) {
  return React.useCallback((event: React.KeyboardEvent<HTMLSpanElement>) => {
    const rootEl = rootRef.current;
    if (!rootEl) return;
    const isArrowKeyForwarded = arrowKeyEventForwardedSet.has(event.nativeEvent);
    if (event.nativeEvent.isComposing || event.key === 'Process') return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      if (focusStoreFocusedSegIfKeyEventIsStale(contextDocStore, compId)) {
        return;
      }
      contextDocStore?.store.updateSelectionState(contextDocStore.docId, {
        isSelectionActive: true,
        mode: 'range',
        pointAnchor: getPointCurrent(0),
        pointFocus: getPointCurrent(text.length),
      });
      updateFocusState('selectAllTextSeg', text.length);
      applyRangeSelectionByOffset(rootEl, 0, text.length);
      return;
    }
    if (
      event.key === 'Control'
      || event.key === 'Meta'
      || event.key === 'Shift'
      || event.key === 'Alt'
      || event.ctrlKey
      || event.metaKey
    ) {
      return;
    }
    if (focusStoreFocusedSegIfKeyEventIsStale(contextDocStore, compId, event)) {
      event.preventDefault();
      return;
    }

    const pointFocusSelection = selectionState?.pointFocus;
    const offsetFocusFromSelection = (
      isSelectionActive
      && pointFocusSelection
      && pointFocusSelection.segId === compId
    )
      ? Number(pointFocusSelection.offset || 0)
      : undefined;
    const focusStateCurrent = contextDocStore?.store.getInteractionState(contextDocStore.docId).focusState;
    const offsetFocusFromStore = focusStateCurrent?.segIdFocused === compId
      ? Number(focusStateCurrent.offsetFocused || 0)
      : undefined;
    const offsetCurrentRaw = Number.isFinite(offsetFocusFromSelection)
      ? Number(offsetFocusFromSelection)
      : (Number.isFinite(offsetFocusFromStore)
        ? Number(offsetFocusFromStore)
        : (isLogicalCaretVisible ? offsetLogicalCaret : getCaretOffset(rootEl)));
    const offsetCurrent = Math.min(text.length, Math.max(0, Number(offsetCurrentRaw || 0)));
    const textLength = text.length;
    const isArrowKey = event.key === 'ArrowLeft'
      || event.key === 'ArrowRight'
      || event.key === 'ArrowUp'
      || event.key === 'ArrowDown';
    if (
      (event.key === 'Backspace' || event.key === 'Delete')
      && isEditable
      && isSelectionActive
      && selectionState?.pointAnchor
      && selectionState?.pointFocus
    ) {
      event.preventDefault();
      emitEvent('childSelectionDeleteAttempt', {
        compIdChild: compId,
        pointAnchor: selectionState.pointAnchor,
        pointFocus: selectionState.pointFocus,
      });
      return;
    }
    if (event.shiftKey && isArrowKey) {
      event.preventDefault();
      applyCaretByOffset(rootEl, offsetCurrent);
      const pointAnchor = resolveSelectionAnchorForExtend(offsetCurrent);
      if (event.key === 'ArrowLeft' && offsetCurrent <= 0) {
        emitEvent('segNavigate', {
          direction: 'left',
          offset: 0,
          isSelectionExtend: true,
          selectionAnchor: pointAnchor,
        });
        return;
      }
      if (event.key === 'ArrowLeft') {
        const offsetNext = Math.max(0, offsetCurrent - 1);
        applyCaretByOffset(rootEl, offsetNext);
        updateKeyboardSelectionState('keySelect', pointAnchor, offsetNext);
        return;
      }
      if (event.key === 'ArrowRight' && offsetCurrent >= textLength) {
        emitEvent('segNavigate', {
          direction: 'right',
          offset: offsetCurrent,
          isSelectionExtend: true,
          selectionAnchor: pointAnchor,
        });
        return;
      }
      if (event.key === 'ArrowRight') {
        const offsetNext = Math.min(textLength, offsetCurrent + 1);
        applyCaretByOffset(rootEl, offsetNext);
        updateKeyboardSelectionState('keySelect', pointAnchor, offsetNext);
        return;
      }
      if (event.key === 'ArrowUp' && isCaretOnFirstLine(rootEl)) {
        emitEvent('segNavigate', {
          direction: 'up',
          offset: offsetCurrent,
          x: getCaretClientXCurrent(),
          isSelectionExtend: true,
          selectionAnchor: pointAnchor,
        });
        return;
      }
      if (event.key === 'ArrowUp') {
        const selection = window.getSelection();
        selection?.modify?.('move', 'backward', 'line');
        const offsetNext = selection?.anchorNode && rootEl.contains(selection.anchorNode)
          ? getCaretOffset(rootEl)
          : offsetCurrent;
        applyCaretByOffset(rootEl, offsetNext);
        updateKeyboardSelectionState('keySelect', pointAnchor, offsetNext);
        return;
      }
      if (event.key === 'ArrowDown' && isCaretOnLastLine(rootEl)) {
        emitEvent('segNavigate', {
          direction: 'down',
          offset: offsetCurrent,
          x: getCaretClientXCurrent(),
          isSelectionExtend: true,
          selectionAnchor: pointAnchor,
        });
        return;
      }
      if (event.key === 'ArrowDown') {
        const selection = window.getSelection();
        selection?.modify?.('move', 'forward', 'line');
        const offsetNext = selection?.anchorNode && rootEl.contains(selection.anchorNode)
          ? getCaretOffset(rootEl)
          : offsetCurrent;
        applyCaretByOffset(rootEl, offsetNext);
        updateKeyboardSelectionState('keySelect', pointAnchor, offsetNext);
        return;
      }
    }
    if (isLogicalCaretMode && !isSelectionActive) {
      applyCaretByOffset(rootEl, offsetCurrent);
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      emitEvent(event.shiftKey ? 'rowOutdentAttempt' : 'rowIndentAttempt', {
        compIdChild: compId,
        point: { offset: offsetCurrent },
      });
      return;
    }

    if (event.key === 'Enter' && isEditable) {
      event.preventDefault();
      emitEvent('childSplitAttempt', {
        compIdChild: compId,
        point: { offset: offsetCurrent },
      });
      return;
    }

    if ((event.key === 'Backspace' || event.key === 'Delete') && isEditable && offsetCurrent <= 0) {
      event.preventDefault();
      emitEvent('childMergePrevAttempt', {
        compIdChild: compId,
        direction: 'left',
        point: { offset: 0 },
      });
      return;
    }

    if (event.key === 'ArrowLeft' && offsetCurrent <= 0) {
      event.preventDefault();
      emitEvent('segNavigate', { direction: 'left', offset: 0 });
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const offsetNext = Math.max(0, offsetCurrent - 1);
      applyCaretByOffset(rootEl, offsetNext);
      updateFocusState('keyNav', offsetNext);
      resetCaretBlink(rootEl);
      return;
    }

    if (event.key === 'ArrowRight' && offsetCurrent >= textLength) {
      event.preventDefault();
      emitEvent('segNavigate', { direction: 'right', offset: offsetCurrent });
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      const offsetNext = Math.min(textLength, offsetCurrent + 1);
      applyCaretByOffset(rootEl, offsetNext);
      updateFocusState('keyNav', offsetNext);
      resetCaretBlink(rootEl);
      return;
    }

    if (event.key === 'ArrowUp' && isCaretOnFirstLine(rootEl)) {
      event.preventDefault();
      emitEvent('segNavigate', { direction: 'up', offset: offsetCurrent, x: getCaretClientXCurrent() });
      return;
    }
    if (event.key === 'ArrowUp' && (isLogicalCaretMode || isArrowKeyForwarded)) {
      event.preventDefault();
      const selection = window.getSelection();
      selection?.modify?.('move', 'backward', 'line');
      const offsetNext = selection?.anchorNode && rootEl.contains(selection.anchorNode)
        ? getCaretOffset(rootEl)
        : offsetCurrent;
      applyCaretByOffset(rootEl, offsetNext);
      updateFocusState('keyNav', offsetNext);
      return;
    }

    if (event.key === 'ArrowDown' && isCaretOnLastLine(rootEl)) {
      event.preventDefault();
      emitEvent('segNavigate', { direction: 'down', offset: offsetCurrent, x: getCaretClientXCurrent() });
      return;
    }
    if (event.key === 'ArrowDown' && (isLogicalCaretMode || isArrowKeyForwarded)) {
      event.preventDefault();
      const selection = window.getSelection();
      selection?.modify?.('move', 'forward', 'line');
      const offsetNext = selection?.anchorNode && rootEl.contains(selection.anchorNode)
        ? getCaretOffset(rootEl)
        : offsetCurrent;
      applyCaretByOffset(rootEl, offsetNext);
      updateFocusState('keyNav', offsetNext);
      return;
    }

    if (isEditable || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    emitEvent('clickSingle', { offset: getCaretOffset(rootEl) });
  }, [
    emitEvent,
    contextDocStore,
    getCaretClientXCurrent,
    compId,
    isEditable,
    isLogicalCaretMode,
    isLogicalCaretVisible,
    isSelectionActive,
    offsetLogicalCaret,
    resolveSelectionAnchorForExtend,
    rootRef,
    selectionState,
    text,
    updateKeyboardSelectionState,
    updateFocusState,
    getPointCurrent,
  ]);
}

export function focusStoreFocusedSegIfKeyEventIsStale(
  contextDocStore: ReturnType<typeof useDocStoreContext>,
  compId: string,
  keyEvent?: React.KeyboardEvent<HTMLElement>,
) {
  if (!contextDocStore || !compId) {
    return false;
  }
  const focusState = contextDocStore.store.getInteractionState(contextDocStore.docId).focusState;
  const segIdFocused = String(focusState.segIdFocused || '');
  if (!segIdFocused || segIdFocused === compId) {
    return false;
  }
  const keyEventForward = keyEvent && isArrowKeyName(keyEvent.key)
    ? createForwardedArrowKeyEvent(keyEvent)
    : null;
  void contextDocStore.store.sendEventToComp(contextDocStore.docId, segIdFocused, {
    type: 'focus',
    sourceId: segIdFocused,
    targetId: contextDocStore.docId,
    data: {
      segId: segIdFocused,
      offset: Number(focusState.offsetFocused || 0),
    },
  }).then((result) => {
    if (result.code !== 0 || !keyEventForward) return;
    const segElFocused = contextDocStore.store.getCompElement(contextDocStore.docId, segIdFocused);
    segElFocused?.dispatchEvent(keyEventForward);
  });
  return true;
}

function isArrowKeyName(key: string) {
  return key === 'ArrowLeft'
    || key === 'ArrowRight'
    || key === 'ArrowUp'
    || key === 'ArrowDown';
}

function createForwardedArrowKeyEvent(event: React.KeyboardEvent<HTMLElement>) {
  const eventForwarded = new KeyboardEvent('keydown', {
    key: event.key,
    code: event.code,
    location: event.location,
    repeat: event.repeat,
    shiftKey: event.shiftKey,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
    bubbles: true,
    cancelable: true,
  });
  arrowKeyEventForwardedSet.add(eventForwarded);
  return eventForwarded;
}
