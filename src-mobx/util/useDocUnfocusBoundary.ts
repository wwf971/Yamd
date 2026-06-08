import React from 'react';
import type { DocStore } from '../docStore';

type DocUnfocusBoundaryOptions = {
  store?: DocStore | null;
  docId: string;
  focusAreaRef: React.RefObject<HTMLElement | null>;
  triggerAreaRef?: React.RefObject<HTMLElement | null>;
  compIdFocusOnBoundary?: string;
  isEnabled?: boolean;
  reason?: string;
};

export function useDocUnfocusBoundary({
  store,
  docId,
  focusAreaRef,
  triggerAreaRef,
  compIdFocusOnBoundary = '',
  isEnabled = true,
  reason = 'docUnfocus',
}: DocUnfocusBoundaryOptions) {
  const isMouseDownInsideFocusAreaRef = React.useRef(false);
  const isMouseDownInsideTriggerAreaRef = React.useRef(false);

  React.useEffect(() => {
    if (!store || !docId || !isEnabled) return undefined;

    const isTargetInsideRef = (target: EventTarget | null, ref: React.RefObject<HTMLElement | null>) => {
      const targetNode = target instanceof Node ? target : null;
      const rootEl = ref.current;
      return Boolean(targetNode && rootEl && rootEl.contains(targetNode));
    };

    const isTargetInsideTriggerArea = (target: EventTarget | null) => {
      if (!triggerAreaRef) return true;
      return isTargetInsideRef(target, triggerAreaRef);
    };

    const isDocFocusInsideArea = () => {
      const focusAreaEl = focusAreaRef.current;
      if (!focusAreaEl) return false;
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement && focusAreaEl.contains(activeElement)) {
        return true;
      }
      const interactionState = store.getInteractionState(docId);
      const compIdFocused = String(interactionState.focusState.compIdFocused || '');
      const segIdFocused = String(interactionState.focusState.segIdFocused || '');
      const compElFocused = compIdFocused ? store.getCompElement(docId, compIdFocused) : null;
      const segElFocused = segIdFocused ? store.getCompElement(docId, segIdFocused) : null;
      return Boolean(
        (compElFocused && focusAreaEl.contains(compElFocused))
        || (segElFocused && focusAreaEl.contains(segElFocused))
      );
    };

    const applyBoundaryFocusChange = () => {
      const focusAreaEl = focusAreaRef.current;
      const compIdFocus = String(compIdFocusOnBoundary || '');
      if (!focusAreaEl || (!compIdFocus && !isDocFocusInsideArea())) return;
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement && focusAreaEl.contains(activeElement)) {
        activeElement.blur();
      }
      const selection = window.getSelection?.();
      if (selection && selection.rangeCount > 0) {
        selection.removeAllRanges();
      }
      if (compIdFocus) {
        store.updateSelectionAndFocusState(
          docId,
          {
            isSelectionActive: false,
            mode: 'caret',
            pointAnchor: null,
            pointFocus: null,
          },
          {
            compIdFocused: compIdFocus,
            segIdFocused: '',
            offsetFocused: 0,
            reasonLast: reason,
          },
        );
        return;
      }
      store.updateElActiveState(docId, '');
      store.unfocusDoc(docId, reason);
    };

    const handleMouseDown = (event: MouseEvent) => {
      isMouseDownInsideFocusAreaRef.current = isTargetInsideRef(event.target, focusAreaRef);
      isMouseDownInsideTriggerAreaRef.current = isTargetInsideTriggerArea(event.target);
    };

    const handleMouseUp = (event: MouseEvent) => {
      const isMouseUpInsideFocusArea = isTargetInsideRef(event.target, focusAreaRef);
      const isMouseUpInsideTriggerArea = isTargetInsideTriggerArea(event.target);
      if (
        !isMouseDownInsideFocusAreaRef.current
        && !isMouseUpInsideFocusArea
        && isMouseDownInsideTriggerAreaRef.current
        && isMouseUpInsideTriggerArea
      ) {
        applyBoundaryFocusChange();
      }
      isMouseDownInsideFocusAreaRef.current = false;
      isMouseDownInsideTriggerAreaRef.current = false;
    };

    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('mouseup', handleMouseUp, true);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('mouseup', handleMouseUp, true);
    };
  }, [compIdFocusOnBoundary, docId, focusAreaRef, isEnabled, reason, store, triggerAreaRef]);
}
