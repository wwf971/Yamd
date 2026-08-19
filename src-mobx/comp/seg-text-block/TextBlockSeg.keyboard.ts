import React from 'react';
import type { useDocStoreContext } from '../../DocStoreContext';
import type { SelectionState, SelectionTrackPoint } from '../../docStoreTypes';
import {
  applyCaretByOffset,
  getCaretClientX,
  getCaretOffset,
  isCaretOnFirstLine,
  isCaretOnLastLine,
} from '../../util/caretUtils';
import { focusStoreFocusedSegIfKeyEventIsStale } from '../seg-text/TextSeg.keyboard';
import { getCaretOffsetClamped } from './TextBlockSeg.dom';

type TextBlockSegKeyDownOptions = {
  rootRef: React.RefObject<HTMLDivElement | null>;
  contextDocStore: ReturnType<typeof useDocStoreContext>;
  compId: string;
  text: string;
  isEditable: boolean;
  isSelectionActive: boolean;
  selectionState: SelectionState | undefined;
  emitEvent: (type: string, dataEvent?: any) => any;
  insertTextAtSelection: (textInsert: string) => void;
  deleteTextAtSelection: (direction: 'backward' | 'forward') => void;
  applySelectAllInBlock: () => void;
  resolveSelectionAnchorForExtend: (offsetCurrent: number) => SelectionTrackPoint;
};

// The block keeps the native caret and native in-block movement. The keydown
// handler only takes over where the document framework must act:
// - Enter inserts a newline through the store (never a browser <br>).
// - Mod+Enter asks the doc to split the block into two block rows.
// - Backspace/Delete are store edits; on an empty block they delete the block.
// - Arrow keys at the block boundary navigate to sibling segments/rows.
// - Tab / Shift+Tab indent or outdent the row.
export function useTextBlockSegKeyDown({
  rootRef,
  contextDocStore,
  compId,
  text,
  isEditable,
  isSelectionActive,
  selectionState,
  emitEvent,
  insertTextAtSelection,
  deleteTextAtSelection,
  applySelectAllInBlock,
  resolveSelectionAnchorForExtend,
}: TextBlockSegKeyDownOptions) {
  return React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const rootEl = rootRef.current;
    if (!rootEl) return;
    if (event.nativeEvent.isComposing || event.key === 'Process') return;
    const isEditModifier = event.ctrlKey || event.metaKey;
    if (isEditModifier && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      if (focusStoreFocusedSegIfKeyEventIsStale(contextDocStore, compId)) {
        return;
      }
      applySelectAllInBlock();
      return;
    }
    if (isEditModifier && event.key === 'Enter') {
      if (!isEditable) return;
      event.preventDefault();
      if (focusStoreFocusedSegIfKeyEventIsStale(contextDocStore, compId)) {
        return;
      }
      emitEvent('childSplitAttempt', {
        compIdChild: compId,
        point: { offset: getCaretOffsetClamped(rootEl, text.length) },
      });
      return;
    }
    if (
      event.key === 'Control'
      || event.key === 'Meta'
      || event.key === 'Shift'
      || event.key === 'Alt'
      || isEditModifier
    ) {
      return;
    }
    if (focusStoreFocusedSegIfKeyEventIsStale(contextDocStore, compId, event)) {
      event.preventDefault();
      return;
    }

    const offsetCurrent = getCaretOffsetClamped(rootEl, text.length);
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
      // Selection extension beyond the block boundary goes through the doc
      // framework. Inside the block the native selection is kept, and the
      // document selectionchange tracking picks it up.
      const pointAnchor = resolveSelectionAnchorForExtend(offsetCurrent);
      if (event.key === 'ArrowLeft' && offsetCurrent <= 0) {
        event.preventDefault();
        emitEvent('segNavigate', {
          direction: 'left',
          offset: 0,
          isSelectionExtend: true,
          selectionAnchor: pointAnchor,
        });
        return;
      }
      if (event.key === 'ArrowRight' && offsetCurrent >= text.length) {
        event.preventDefault();
        emitEvent('segNavigate', {
          direction: 'right',
          offset: offsetCurrent,
          isSelectionExtend: true,
          selectionAnchor: pointAnchor,
        });
        return;
      }
      if (event.key === 'ArrowUp' && isCaretOnFirstLine(rootEl)) {
        event.preventDefault();
        emitEvent('segNavigate', {
          direction: 'up',
          offset: offsetCurrent,
          x: getCaretClientX(rootEl),
          isSelectionExtend: true,
          selectionAnchor: pointAnchor,
        });
        return;
      }
      if (event.key === 'ArrowDown' && isCaretOnLastLine(rootEl)) {
        event.preventDefault();
        emitEvent('segNavigate', {
          direction: 'down',
          offset: offsetCurrent,
          x: getCaretClientX(rootEl),
          isSelectionExtend: true,
          selectionAnchor: pointAnchor,
        });
        return;
      }
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      emitEvent(event.shiftKey ? 'rowOutdentAttempt' : 'rowIndentAttempt', {
        compIdChild: compId,
        point: { offset: offsetCurrent },
      });
      return;
    }

    if (event.key === 'Enter') {
      if (!isEditable) return;
      event.preventDefault();
      insertTextAtSelection('\n');
      return;
    }

    if (event.key === 'Backspace' || event.key === 'Delete') {
      if (!isEditable) return;
      event.preventDefault();
      if (text.length === 0) {
        // Deleting inside an empty block deletes the block itself.
        emitEvent('childDeleteAttempt', {
          compIdChild: compId,
          direction: 'left',
          point: { offset: 0 },
        });
        return;
      }
      deleteTextAtSelection(event.key === 'Backspace' ? 'backward' : 'forward');
      return;
    }

    if (event.key === 'ArrowLeft' && offsetCurrent <= 0) {
      event.preventDefault();
      emitEvent('segNavigate', { direction: 'left', offset: 0 });
      return;
    }
    if (event.key === 'ArrowRight' && offsetCurrent >= text.length) {
      event.preventDefault();
      emitEvent('segNavigate', { direction: 'right', offset: offsetCurrent });
      return;
    }
    if (event.key === 'ArrowUp' && isCaretOnFirstLine(rootEl)) {
      event.preventDefault();
      emitEvent('segNavigate', { direction: 'up', offset: offsetCurrent, x: getCaretClientX(rootEl) });
      return;
    }
    if (event.key === 'ArrowDown' && isCaretOnLastLine(rootEl)) {
      event.preventDefault();
      emitEvent('segNavigate', { direction: 'down', offset: offsetCurrent, x: getCaretClientX(rootEl) });
      return;
    }
    if (isArrowKey) return;

    // The caret must not sit past the trailing phantom newline when a real
    // character is about to be typed. Snap it back before native input runs.
    const selection = window.getSelection();
    if (selection?.isCollapsed && getCaretOffset(rootEl) > text.length) {
      applyCaretByOffset(rootEl, text.length);
    }
  }, [
    applySelectAllInBlock,
    compId,
    contextDocStore,
    deleteTextAtSelection,
    emitEvent,
    insertTextAtSelection,
    isEditable,
    isSelectionActive,
    resolveSelectionAnchorForExtend,
    rootRef,
    selectionState,
    text,
  ]);
}
