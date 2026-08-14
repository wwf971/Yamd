import React from 'react';
import { observer } from 'mobx-react-lite';
import { useDocStoreContext } from '../../DocStoreContext';
import { compIdCreateRandom } from '../../docStoreCompData';
import type { CompEvent, SelectionTrackPoint } from '../../docStoreTypes';
import {
  applyCaretByDirection,
  applyCaretByOffset,
  getCaretClientX,
  getCaretOffset,
  getCaretOffsetByPoint,
} from '../../util/caretUtils';
import { useDocDragInteraction } from '../../util/useDocDragInteraction';
import {
  calcCaretOverlayPos,
  calcTextSegBulletPosition,
  createTextSegRenderDebugText,
  resetCaretBlink,
} from './TextSeg.dom';
import {
  createSelfClipboardTextResult,
  createSelfMergeResult,
  createSelfSelectionDeleteResult,
  createSelfSelectionEdgeDeleteResult,
  createSelfSplitResult,
} from './TextSeg.editResults';
import {
  focusStoreFocusedSegIfKeyEventIsStale,
  useTextSegKeyDown,
} from './TextSeg.keyboard';
import { startSelectionDragFromTextSeg } from './TextSeg.mouse';
import './TextSeg.history';
import './TextSeg.css';

type TextSegProps = {
  data?: {
    compId?: string;
    sourceId?: string;
    targetId?: string;
    text?: string;
  };
  config?: {
    isActive?: boolean;
    isDebug?: boolean;
    isEditable?: boolean;
    isRenderDebugEnabled?: boolean;
  };
  onEvent?: (event: CompEvent) => Promise<any> | any;
};

const TextSeg = observer(React.forwardRef<any, TextSegProps>(({ data = {}, config = {}, onEvent }, ref) => {
  const contextDocStore = useDocStoreContext();
  const compId = String(data.compId || '');
  const compData = contextDocStore && compId
    ? contextDocStore.store.getCompDataById(contextDocStore.docId, compId)
    : null;
  const dataComp = compData?.data || data || {};
  const configComp = compData?.config || config || {};
  const sourceId = String(compId || dataComp.sourceId || 'text-seg');
  const targetId = String(dataComp.targetId || contextDocStore?.docId || '');
  const text = String(dataComp.text || '');
  const isActive = configComp.isActive === true;
  const isDebug = configComp.isDebug === true;
  const isEditable = configComp.isEditable === true;
  const isRenderDebugEnabled = configComp.isRenderDebugEnabled === true;
  const runtimeState = contextDocStore && compId
    ? contextDocStore.store.getCompRuntimeState(contextDocStore.docId, compId)
    : null;
  const isFocusedLogical = runtimeState?.isFocusedLogical === true;
  const isElActive = runtimeState?.isElActive === true;
  const isSelectionWithin = runtimeState?.isSelectionWithin === true;
  const isInteractionStateNeeded = isFocusedLogical || isSelectionWithin;
  const interactionState = contextDocStore && isInteractionStateNeeded
    ? contextDocStore.store.getInteractionState(contextDocStore.docId)
    : null;
  const selectionState = interactionState?.selectionState;
  const dragItemId = compId ? `segment:${compId}` : '';
  const dragRuntimeState = contextDocStore && dragItemId
    ? contextDocStore.store.getDragItemRuntimeState(contextDocStore.docId, dragItemId)
    : null;
  const bulletPositionState = contextDocStore && compId
    ? contextDocStore.store.getCompBulletPosState(contextDocStore.docId, compId)
    : null;
  const rootRef = React.useRef<HTMLSpanElement | null>(null);
  const offsetPendingRestoreRef = React.useRef<number | null>(null);
  const cleanupSelectionDragRef = React.useRef<(() => void) | null>(null);
  const isComposingRef = React.useRef(false);
  const counterRenderRef = React.useRef(0);
  const mouseDownStateRef = React.useRef<{
    clientX: number;
    clientY: number;
    isSelectionActive: boolean;
    isDomSelectionRange: boolean;
  } | null>(null);
  const [isPointerDown, setIsPointerDown] = React.useState(false);
  counterRenderRef.current += 1;
  const counterBulletMeasureReq = Number(bulletPositionState?.counterBulletMeasureReq || 0);
  const compIdBasisBullet = String(bulletPositionState?.compIdBasis || '');
  const isBulletMeasureEnabled = bulletPositionState?.isBulletMeasureEnabled !== false;
  const textDebug = isRenderDebugEnabled
    ? createTextSegRenderDebugText(compId, text, counterRenderRef.current)
    : '';
  const isSelectionActive = (isFocusedLogical || isSelectionWithin) && selectionState?.isSelectionActive === true;
  const isDomCaretMode = isEditable
    && isFocusedLogical
    && isPointerDown === false
    && !isSelectionActive;
  const isLogicalCaretMode = !isDomCaretMode;
  // Always plot the custom caret when focused. Dom caret mode still uses
  // contentEditable for input, but the native caret is hidden via CSS.
  const isLogicalCaretVisible = isPointerDown === false
    && isFocusedLogical
    && !isSelectionActive;
  // In dom caret mode the browser mutates the contentEditable children, so
  // React must render exactly one plain text child. The caret is drawn as a
  // css pseudo-element on the root instead of an inline span there.
  const isCaretSpanRendered = isLogicalCaretVisible && isLogicalCaretMode;
  const isCaretPseudoRendered = isLogicalCaretVisible && isDomCaretMode;
  const offsetLogicalCaret = isLogicalCaretVisible
    ? Math.min(text.length, Math.max(0, Number(interactionState?.focusState.offsetFocused || 0)))
    : -1;
  const className = [
    'mobx-text-seg',
    isCaretPseudoRendered ? 'mobx-text-seg-caret-dom' : '',
    isActive ? 'is-active' : '',
    isFocusedLogical ? 'mobx-seg-focused-logical' : '',
    isElActive ? 'mobx-seg-el-active' : '',
    isSelectionWithin ? 'mobx-seg-selection-within' : '',
    dragRuntimeState?.isDragged ? 'mobx-drag-item-dragged' : '',
    dragRuntimeState?.isDragHovered ? 'mobx-drag-item-hovered' : '',
    dragRuntimeState?.isDropAllowed === false ? 'mobx-drag-item-drop-denied' : '',
    dragRuntimeState?.isInsertSegmentBefore ? 'mobx-drag-seg-insert-before' : '',
    dragRuntimeState?.isInsertSegmentAfter ? 'mobx-drag-seg-insert-after' : '',
    isRenderDebugEnabled ? 'mobx-seg-render-debug-enabled' : '',
    isDebug ? 'mobx-seg-debug' : '',
  ].filter(Boolean).join(' ');

  const { handlePointerDownCapture } = useDocDragInteraction({
    docId: contextDocStore?.docId || '',
    compId,
    store: contextDocStore?.store,
  });

  const updateFocusState = React.useCallback((reason: string, offset?: number) => {
    if (!contextDocStore || !compId) return;
    const offsetFocused = Number.isFinite(offset) ? Number(offset) : getCaretOffset(rootRef.current);
    contextDocStore.store.segFocus(contextDocStore.docId, compId, offsetFocused, reason);
  }, [contextDocStore, compId]);

  const getPointCurrent = React.useCallback((offset: number): SelectionTrackPoint => ({
    compId,
    segId: compId,
    offset: Math.min(text.length, Math.max(0, Number(offset || 0))),
  }), [compId, text.length]);

  const updateKeyboardSelectionState = React.useCallback((reason: string, pointAnchor: SelectionTrackPoint, offsetFocus: number) => {
    if (!contextDocStore) return;
    const pointFocus = getPointCurrent(offsetFocus);
    const isCollapsed = pointAnchor.segId === pointFocus.segId && pointAnchor.offset === pointFocus.offset;
    if (isCollapsed) {
      contextDocStore.store.clearSelectionState(contextDocStore.docId);
      updateFocusState(reason, pointFocus.offset);
      return;
    }
    contextDocStore.store.updateSelectionState(contextDocStore.docId, {
      isSelectionActive: true,
      mode: 'range',
      pointAnchor,
      pointFocus,
    });
    updateFocusState(reason, pointFocus.offset);
  }, [contextDocStore, getPointCurrent, updateFocusState]);

  const resolveSelectionAnchorForExtend = React.useCallback((offsetCurrent: number): SelectionTrackPoint => {
    const pointAnchorSelection = selectionState?.pointAnchor;
    const pointFocusSelection = selectionState?.pointFocus;
    const isSelectionCurrent = selectionState?.isSelectionActive === true;
    if (
      isSelectionCurrent
      && pointAnchorSelection
      && pointFocusSelection
      && pointFocusSelection.segId === compId
    ) {
      return {
        compId: String(pointAnchorSelection.compId || compId),
        segId: String(pointAnchorSelection.segId || compId),
        offset: Math.max(0, Number(pointAnchorSelection.offset || 0)),
      };
    }
    return getPointCurrent(offsetCurrent);
  }, [compId, getPointCurrent, selectionState?.isSelectionActive, selectionState?.pointAnchor, selectionState?.pointFocus]);

  const emitEvent = React.useCallback((type: string, dataEvent: any = {}) => {
    if (!onEvent) return undefined;
    return onEvent({
      type,
      sourceId,
      targetId,
      data: {
        segId: compId,
        ...dataEvent,
      },
    });
  }, [onEvent, sourceId, targetId, compId]);

  const applyFocusToDom = React.useCallback((reason: string, dataEvent: any = {}) => {
    const rootEl = rootRef.current;
    if (!rootEl) return 0;
    if (contextDocStore && compId) {
      contextDocStore.store.updateElActiveState(contextDocStore.docId, compId);
    }
    rootEl.focus();
    if (Number.isFinite(dataEvent?.offset)) {
      applyCaretByOffset(rootEl, Number(dataEvent.offset));
    } else if (dataEvent?.mousePos) {
      applyCaretByDirection(rootEl, String(dataEvent.direction || 'click'), dataEvent.mousePos);
    } else {
      applyCaretByDirection(rootEl, String(dataEvent.direction || 'fromLeft'));
    }
    const offsetFocused = getCaretOffset(rootEl);
    updateFocusState(reason, offsetFocused);
    resetCaretBlink(rootEl);
    return offsetFocused;
  }, [contextDocStore, compId, updateFocusState]);

  const syncTextFromDom = React.useCallback((rootEl: HTMLSpanElement | null) => {
    if (!contextDocStore || !compId || !isEditable || !rootEl) return;
    const textNext = String(rootEl.textContent || '');
    if (text.length > 0 && textNext.length === 0) {
      offsetPendingRestoreRef.current = null;
      emitEvent('childDeleteAttempt', {
        compIdChild: compId,
        direction: 'left',
        point: { offset: 0 },
      });
      return;
    }
    if (textNext !== text) {
      offsetPendingRestoreRef.current = getCaretOffset(rootEl);
      contextDocStore.store.updateCompDataByPatch(contextDocStore.docId, compId, { text: textNext });
    }
  }, [contextDocStore, compId, emitEvent, isEditable, text]);

  const handleInput = React.useCallback((event: React.FormEvent<HTMLSpanElement>) => {
    if (isComposingRef.current) return;
    syncTextFromDom(event.currentTarget);
  }, [syncTextFromDom]);

  const getCaretClientXCurrent = React.useCallback(() => {
    const rootEl = rootRef.current;
    if (!rootEl) return 0;
    if (isLogicalCaretVisible) {
      const caretEl = rootEl.querySelector<HTMLElement>('.mobx-text-seg-caret');
      const rect = caretEl?.getBoundingClientRect();
      if (rect) return rect.left;
    }
    return getCaretClientX(rootEl);
  }, [isLogicalCaretVisible]);

  const measureBulletPosition = React.useCallback(() => {
    if (!contextDocStore || !compId || !isBulletMeasureEnabled) return;
    const rootEl = rootRef.current;
    const basisEl = contextDocStore.store.getCompElement(contextDocStore.docId, compIdBasisBullet || compId);
    const result = calcTextSegBulletPosition(rootEl, basisEl);
    contextDocStore.store.updateCompBulletPosResult(contextDocStore.docId, compId, {
      compIdBasis: compIdBasisBullet || compId,
      compIdProvider: compId,
      posYBulletPreferred: result.posYBulletPreferred,
      messageBulletMeasure: result.messageBulletMeasure,
    });
  }, [contextDocStore, compId, compIdBasisBullet, isBulletMeasureEnabled]);

  React.useLayoutEffect(() => {
    if (!contextDocStore || !compId) return undefined;
    const rootEl = rootRef.current;
    if (!rootEl) return undefined;
    contextDocStore.store.registerCompElement(contextDocStore.docId, compId, rootEl);
    return () => {
      contextDocStore.store.unregisterCompElement(contextDocStore.docId, compId, rootEl);
    };
  }, [contextDocStore, compId]);

  React.useLayoutEffect(() => {
    if (counterBulletMeasureReq <= 0) return;
    measureBulletPosition();
  }, [counterBulletMeasureReq, text, measureBulletPosition]);

  React.useEffect(() => {
    const rootEl = rootRef.current;
    if (!rootEl || !isBulletMeasureEnabled || counterBulletMeasureReq <= 0) return undefined;
    let frameId = 0;
    const resizeObserver = new ResizeObserver(() => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      frameId = requestAnimationFrame(() => {
        frameId = 0;
        measureBulletPosition();
      });
    });
    resizeObserver.observe(rootEl);
    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      resizeObserver.disconnect();
    };
  }, [counterBulletMeasureReq, isBulletMeasureEnabled, measureBulletPosition]);

  React.useEffect(() => {
    if (!isPointerDown) return undefined;
    const handlePointerEnd = () => {
      window.setTimeout(() => {
        setIsPointerDown(false);
      }, 0);
    };
    window.addEventListener('mouseup', handlePointerEnd, true);
    return () => {
      window.removeEventListener('mouseup', handlePointerEnd, true);
    };
  }, [isPointerDown]);

  React.useEffect(() => () => {
    cleanupSelectionDragRef.current?.();
    cleanupSelectionDragRef.current = null;
  }, []);

  React.useLayoutEffect(() => {
    const offsetPending = offsetPendingRestoreRef.current;
    if (offsetPending === null) return;
    if (isComposingRef.current) return;
    offsetPendingRestoreRef.current = null;
    const rootEl = rootRef.current;
    if (!rootEl || document.activeElement !== rootEl) return;
    applyCaretByOffset(rootEl, offsetPending);
    updateFocusState('textInput', getCaretOffset(rootEl));
  }, [text, updateFocusState]);

  React.useLayoutEffect(() => {
    const rootEl = rootRef.current;
    if (!rootEl || !isDomCaretMode || isSelectionActive || document.activeElement !== rootEl) return;
    const offsetFocused = Number(interactionState?.focusState.offsetFocused || 0);
    applyCaretByOffset(rootEl, offsetFocused);
  }, [isDomCaretMode, isSelectionActive, interactionState?.focusState.offsetFocused]);

  // Position the pseudo-element caret in dom caret mode. Runs after the
  // native caret effects above, so measurement sees the final layout.
  React.useLayoutEffect(() => {
    const rootEl = rootRef.current;
    if (!rootEl) return;
    if (!isCaretPseudoRendered) {
      rootEl.style.removeProperty('--mobx-caret-left');
      rootEl.style.removeProperty('--mobx-caret-top');
      rootEl.style.removeProperty('--mobx-caret-height');
      return;
    }
    const posCaret = calcCaretOverlayPos(rootEl, offsetLogicalCaret);
    rootEl.style.setProperty('--mobx-caret-left', `${posCaret.left}px`);
    rootEl.style.setProperty('--mobx-caret-top', `${posCaret.top}px`);
    rootEl.style.setProperty('--mobx-caret-height', `${posCaret.height}px`);
  }, [isCaretPseudoRendered, offsetLogicalCaret, text]);

  const handlePaste = React.useCallback((event: React.ClipboardEvent<HTMLSpanElement>) => {
    if (!isEditable) return;
    const rootEl = rootRef.current;
    if (!rootEl) return;
    event.preventDefault();
    if (focusStoreFocusedSegIfKeyEventIsStale(contextDocStore, compId)) {
      return;
    }
    const textPaste = String(event.clipboardData?.getData('text/plain') || '');
    if (!textPaste) return;
    const pointFocusSelection = selectionState?.pointFocus;
    const offsetFocusFromSelection = (
      isSelectionActive
      && pointFocusSelection
      && pointFocusSelection.segId === compId
    )
      ? Number(pointFocusSelection.offset || 0)
      : undefined;
    const offsetCurrentRaw = Number.isFinite(offsetFocusFromSelection)
      ? Number(offsetFocusFromSelection)
      : (isLogicalCaretVisible ? offsetLogicalCaret : getCaretOffset(rootEl));
    const offsetCurrent = Math.min(text.length, Math.max(0, Number(offsetCurrentRaw || 0)));
    emitEvent('childPasteAttempt', {
      compIdChild: compId,
      text: textPaste,
      point: { offset: offsetCurrent },
      pointAnchor: selectionState?.pointAnchor,
      pointFocus: selectionState?.pointFocus,
    });
  }, [
    compId,
    contextDocStore,
    emitEvent,
    isEditable,
    isLogicalCaretVisible,
    isSelectionActive,
    offsetLogicalCaret,
    selectionState?.pointAnchor,
    selectionState?.pointFocus,
    text.length,
  ]);

  const handleKeyDown = useTextSegKeyDown({
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
  });

  React.useImperativeHandle(ref, () => ({
    dispatchEvent: async (event: CompEvent) => {
      const type = String(event?.type || '');
      if (type === 'focus') {
        const offset = applyFocusToDom('focus', event?.data || {});
        if (contextDocStore && event?.data?.isSelectionExtend === true && event?.data?.selectionAnchor) {
          const selectionAnchorRaw = event.data.selectionAnchor;
          const pointAnchor: SelectionTrackPoint = {
            compId: String(selectionAnchorRaw.compId || compId),
            segId: String(selectionAnchorRaw.segId || compId),
            offset: Math.max(0, Number(selectionAnchorRaw.offset || 0)),
          };
          updateKeyboardSelectionState('keySelect', pointAnchor, offset);
        }
        emitEvent('focus', { ...(event?.data || {}), offset });
        return { code: 0, message: 'TextSeg focused.' };
      }
      if (type === 'clickSingle') {
        const offset = applyFocusToDom('clickSingle', event?.data || {});
        emitEvent('clickSingle', { ...(event?.data || {}), offset });
        return { code: 0, message: 'TextSeg click received.' };
      }
      if (type === 'selfSplitQuery') {
        return createSelfSplitResult({
          compId,
          compIdRight: contextDocStore?.store.createCompId(contextDocStore.docId, 'seg') || compIdCreateRandom('seg'),
          dataComp,
          configComp,
          offsetRaw: Number(event?.data?.point?.offset || 0),
        });
      }
      if (type === 'selfMergeQuery') {
        const compDataSelf = event?.data?.compDataSelf;
        return createSelfMergeResult({
          compId,
          dataComp: compDataSelf?.data || dataComp,
          configComp: compDataSelf?.config || configComp,
          compDataOther: event?.data?.compDataOther,
          direction: String(event?.data?.direction || ''),
        });
      }
      if (type === 'selfDeleteQuery') {
        if (configComp?.isEditable !== true) {
          return { code: -1, message: 'TextSeg is not editable.' };
        }
        return {
          code: 0,
          message: 'TextSeg delete result created.',
          data: {
            op: 'deleteSelf',
            compIdListOriginal: [compId],
            compListNext: [],
          },
        };
      }
      if (type === 'selfIsEmptyQuery') {
        return {
          code: 0,
          message: 'TextSeg empty state created.',
          data: {
            isEmpty: String(dataComp?.text || '').length === 0,
          },
        };
      }
      if (type === 'selfSelectionEdgeDeleteQuery') {
        return createSelfSelectionEdgeDeleteResult({
          compId,
          dataComp,
          configComp,
          point: event?.data?.point,
          side: String(event?.data?.side || ''),
        });
      }
      if (type === 'selfSelectionDeleteQuery') {
        return createSelfSelectionDeleteResult({
          compId,
          dataComp,
          configComp,
          pointAnchor: event?.data?.pointAnchor,
          pointFocus: event?.data?.pointFocus,
        });
      }
      if (type === 'selfClipboardTextQuery') {
        return createSelfClipboardTextResult({
          dataComp,
          offsetStartRaw: event?.data?.offsetStart,
          offsetEndRaw: event?.data?.offsetEnd,
        });
      }
      return { code: -1, message: `Unsupported event: ${type}` };
    },
  }), [applyFocusToDom, compId, configComp, contextDocStore, dataComp, emitEvent, updateKeyboardSelectionState]);

  return (
    <span
      ref={rootRef}
      tabIndex={0}
      contentEditable={isDomCaretMode}
      suppressContentEditableWarning
      className={className}
      data-mobx-comp-id={compId}
      data-mobx-comp-name="TextSeg"
      data-mobx-seg-id={compId}
      data-mobx-drag-item-id={dragItemId}
      data-mobx-render-debug={textDebug}
      onPointerDownCapture={handlePointerDownCapture}
      onFocus={() => {
        if (!contextDocStore || !compId) return;
        contextDocStore.store.updateElActiveState(contextDocStore.docId, compId);
        updateFocusState('focus');
      }}
      onInput={handleInput}
      onCompositionStart={() => {
        isComposingRef.current = true;
      }}
      onCompositionEnd={(event) => {
        isComposingRef.current = false;
        syncTextFromDom(event.currentTarget);
      }}
      onMouseDown={(event) => {
        if (event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          mouseDownStateRef.current = null;
          setIsPointerDown(false);
          return;
        }
        const selection = window.getSelection();
        mouseDownStateRef.current = {
          clientX: event.clientX,
          clientY: event.clientY,
          isSelectionActive,
          isDomSelectionRange: selection ? selection.isCollapsed !== true : false,
        };
        if (isDomCaretMode) {
          // Firefox keeps selection inside one contentEditable editing host.
          // Build the DOM range from pointer coordinates instead, but only
          // for a drag that starts in the active editing segment. Clicks and
          // drags from ordinary text keep their existing behavior.
          event.preventDefault();
          cleanupSelectionDragRef.current?.();
          cleanupSelectionDragRef.current = startSelectionDragFromTextSeg(
            event.currentTarget,
            event.clientX,
            event.clientY,
            () => {
              cleanupSelectionDragRef.current = null;
            },
          );
        }
        setIsPointerDown(true);
      }}
      onMouseUp={() => {
        window.setTimeout(() => {
          setIsPointerDown(false);
        }, 0);
      }}
      onBlur={() => {
        syncTextFromDom(rootRef.current);
        setIsPointerDown(false);
      }}
      onClick={(event) => {
        const rootEl = rootRef.current;
        const selection = window.getSelection();
        const mouseDownState = mouseDownStateRef.current;
        mouseDownStateRef.current = null;
        if (event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          setIsPointerDown(false);
          if (contextDocStore?.store.consumeFocusClickSuppressed(contextDocStore.docId)) {
            return;
          }
          contextDocStore?.store.focusExpandToParent(contextDocStore.docId, compId, 'shiftClickExpand');
          return;
        }
        const distanceMouse = mouseDownState
          ? Math.abs(event.clientX - mouseDownState.clientX) + Math.abs(event.clientY - mouseDownState.clientY)
          : Number.POSITIVE_INFINITY;
        const isClickCollapseSelection = distanceMouse <= 4
          && mouseDownState?.isSelectionActive === true
          && mouseDownState?.isDomSelectionRange === true;
        if (selection && !selection.isCollapsed && !isClickCollapseSelection) {
          return;
        }
        setIsPointerDown(false);
        const offset = rootEl
          ? getCaretOffsetByPoint(rootEl, event.clientX, event.clientY)
          : 0;
        if (rootEl) {
          rootEl.focus();
          applyCaretByOffset(rootEl, offset);
        }
        if (contextDocStore && compId) {
          contextDocStore.store.updateSelectionAndFocusState(
            contextDocStore.docId,
            {
              isSelectionActive: false,
              mode: 'caret',
              pointAnchor: null,
              pointFocus: null,
            },
            {
              compIdFocused: compId,
              segIdFocused: compId,
              offsetFocused: offset,
              reasonLast: 'clickSingle',
            },
          );
        } else {
          updateFocusState('clickSingle', offset);
        }
        emitEvent('clickSingle', {
          offset,
          mousePos: {
            clientX: event.clientX,
            clientY: event.clientY,
          },
        });
      }}
      onDoubleClick={(event) => {
        if (!event.shiftKey) return;
        event.preventDefault();
        event.stopPropagation();
      }}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
    >
      {isCaretSpanRendered ? (
        <>
          {text.slice(0, offsetLogicalCaret)}
          <span className="mobx-text-seg-caret" aria-hidden="true" />
          {text.slice(offsetLogicalCaret)}
        </>
      ) : text}
    </span>
  );
}));

export default TextSeg;
