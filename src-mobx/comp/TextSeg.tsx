import React from 'react';
import { observer } from 'mobx-react-lite';
import { useDocStoreContext } from '../DocStoreContext';
import { compIdCreateRandom } from '../docStoreCompData';
import type { CompData, CompEvent, SelectionTrackPoint } from '../docStoreTypes';
import {
  applyCaretByDirection,
  applyCaretByOffset,
  getCaretClientX,
  getCaretOffset,
  getCaretOffsetByPoint,
  isCaretOnFirstLine,
  isCaretOnLastLine,
} from '../util/caretUtils';
import { useDocDragInteraction } from '../util/useDocDragInteraction';
import { registerCompDataDiffHandler } from '../docStoreVersion';
import './TextSeg.css';

// History version diff handler. A text-only change is described as one splice
// against the base version: delete countDelete chars at offset, insert
// textInsert there. Any other data change declines, so the doc-level generic
// field diff takes over. Doc-level logic never interprets this diff shape.
registerCompDataDiffHandler('TextSeg', {
  createDataDiff: (dataBefore: any, dataAfter: any) => {
    const fieldNameSet = new Set([
      ...Object.keys(dataBefore || {}),
      ...Object.keys(dataAfter || {}),
    ]);
    for (const fieldName of fieldNameSet) {
      if (fieldName === 'text') continue;
      if (JSON.stringify(dataBefore?.[fieldName]) !== JSON.stringify(dataAfter?.[fieldName])) {
        return null;
      }
    }
    const textBefore = String(dataBefore?.text || '');
    const textAfter = String(dataAfter?.text || '');
    if (textBefore === textAfter) return null;
    const lengthMin = Math.min(textBefore.length, textAfter.length);
    let lengthPrefix = 0;
    while (lengthPrefix < lengthMin && textBefore[lengthPrefix] === textAfter[lengthPrefix]) {
      lengthPrefix += 1;
    }
    let lengthSuffix = 0;
    while (
      lengthSuffix < lengthMin - lengthPrefix
      && textBefore[textBefore.length - 1 - lengthSuffix] === textAfter[textAfter.length - 1 - lengthSuffix]
    ) {
      lengthSuffix += 1;
    }
    return {
      offset: lengthPrefix,
      countDelete: textBefore.length - lengthPrefix - lengthSuffix,
      textInsert: textAfter.slice(lengthPrefix, textAfter.length - lengthSuffix),
    };
  },
  applyDataDiff: (dataBase: any, dataDiff: any) => {
    const textBase = String(dataBase?.text || '');
    const offset = Math.max(0, Math.min(textBase.length, Number(dataDiff?.offset || 0)));
    const countDelete = Math.max(0, Number(dataDiff?.countDelete || 0));
    const textInsert = String(dataDiff?.textInsert || '');
    return {
      ...(dataBase || {}),
      text: `${textBase.slice(0, offset)}${textInsert}${textBase.slice(offset + countDelete)}`,
    };
  },
});

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

  const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLSpanElement>) => {
    const rootEl = rootRef.current;
    if (!rootEl) return;
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
    if (focusStoreFocusedSegIfKeyEventIsStale(contextDocStore, compId)) {
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
    const offsetCurrentRaw = Number.isFinite(offsetFocusFromSelection)
      ? Number(offsetFocusFromSelection)
      : (isLogicalCaretVisible ? offsetLogicalCaret : getCaretOffset(rootEl));
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
    if (event.key === 'ArrowLeft' && isLogicalCaretMode) {
      event.preventDefault();
      const offsetNext = Math.max(0, offsetCurrent - 1);
      applyCaretByOffset(rootEl, offsetNext);
      updateFocusState('keyNav', offsetNext);
      return;
    }

    if (event.key === 'ArrowRight' && offsetCurrent >= textLength) {
      event.preventDefault();
      emitEvent('segNavigate', { direction: 'right', offset: offsetCurrent });
      return;
    }
    if (event.key === 'ArrowRight' && isLogicalCaretMode) {
      event.preventDefault();
      const offsetNext = Math.min(textLength, offsetCurrent + 1);
      applyCaretByOffset(rootEl, offsetNext);
      updateFocusState('keyNav', offsetNext);
      return;
    }

    if (event.key === 'ArrowUp' && isCaretOnFirstLine(rootEl)) {
      event.preventDefault();
      emitEvent('segNavigate', { direction: 'up', offset: offsetCurrent, x: getCaretClientXCurrent() });
      return;
    }
    if (event.key === 'ArrowUp' && isLogicalCaretMode) {
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
    if (event.key === 'ArrowDown' && isLogicalCaretMode) {
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
    selectionState,
    text,
    text.length,
    updateKeyboardSelectionState,
    updateFocusState,
    getPointCurrent,
  ]);

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

// Measure the caret position for a text offset, relative to the root
// element, without touching the DOM selection. Used by the pseudo-element
// caret in dom caret mode.
function calcCaretOverlayPos(rootEl: HTMLElement, offset: number) {
  const rootRect = rootEl.getBoundingClientRect();
  const posFallback = { left: 1, top: 0, height: rootRect.height || 16 };
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
  let offsetRemain = Math.max(0, Number(offset || 0));
  let nodeText: Text | null = null;
  let offsetLocal = 0;
  let nodeCurrent = walker.nextNode() as Text | null;
  while (nodeCurrent) {
    const lengthNode = nodeCurrent.textContent?.length || 0;
    if (offsetRemain <= lengthNode) {
      nodeText = nodeCurrent;
      offsetLocal = offsetRemain;
      break;
    }
    offsetRemain -= lengthNode;
    nodeText = nodeCurrent;
    offsetLocal = lengthNode;
    nodeCurrent = walker.nextNode() as Text | null;
  }
  if (!nodeText) {
    return posFallback;
  }
  const range = document.createRange();
  range.setStart(nodeText, Math.min(offsetLocal, nodeText.textContent?.length || 0));
  range.collapse(true);
  const rectList = range.getClientRects();
  const rect = rectList.length > 0 ? rectList[0] : range.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    return posFallback;
  }
  return {
    left: rect.left - rootRect.left,
    top: rect.top - rootRect.top,
    height: rect.height || rootRect.height || 16,
  };
}

function calcTextSegBulletPosition(textEl: HTMLElement | null, basisEl: HTMLElement | null) {
  if (!textEl) {
    return { posYBulletPreferred: null, messageBulletMeasure: 'TextSeg element missing.' };
  }
  if (!basisEl) {
    return { posYBulletPreferred: null, messageBulletMeasure: 'Basis element missing.' };
  }
  const basisRect = basisEl.getBoundingClientRect();
  const lineRect = getFirstTextLineRect(textEl) || getFallbackLineRect(textEl);
  if (!lineRect) {
    return { posYBulletPreferred: null, messageBulletMeasure: 'Text line missing.' };
  }
  return {
    posYBulletPreferred: lineRect.top - basisRect.top + lineRect.height * ratioBulletYInLine,
    messageBulletMeasure: 'measured',
  };
}

const ratioBulletYInLine = 0.55;

function createSelfSplitResult({
  compId,
  compIdRight,
  dataComp,
  configComp,
  offsetRaw,
}: {
  compId: string;
  compIdRight: string;
  dataComp: any;
  configComp: any;
  offsetRaw: number;
}) {
  const text = String(dataComp?.text || '');
  const offset = Math.min(text.length, Math.max(0, Number(offsetRaw || 0)));
  const compDataLeft: CompData = {
    compId,
    compName: 'TextSeg',
    childIdList: [],
    data: {
      ...(dataComp || {}),
      sourceId: compId,
      text: text.slice(0, offset),
    },
    config: { ...(configComp || {}) },
  };
  const compDataRight: CompData = {
    compId: compIdRight,
    compName: 'TextSeg',
    childIdList: [],
    data: {
      ...(dataComp || {}),
      sourceId: compIdRight,
      text: text.slice(offset),
    },
    config: { ...(configComp || {}) },
  };
  return {
    code: 0,
    message: 'TextSeg split result created.',
    data: {
      op: 'replaceSelf',
      compIdListOriginal: [compId],
      compListNext: [compDataLeft, compDataRight],
      focus: {
        compId: compIdRight,
        point: { offset: 0 },
      },
    },
  };
}

function createSelfMergeResult({
  compId,
  dataComp,
  configComp,
  compDataOther,
  direction,
}: {
  compId: string;
  dataComp: any;
  configComp: any;
  compDataOther: CompData | null | undefined;
  direction: string;
}) {
  if (direction !== 'left') {
    return { code: -1, message: `Unsupported merge direction. direction=${direction}` };
  }
  if (!compDataOther || String(compDataOther.compName || '') !== 'TextSeg') {
    return { code: -1, message: 'Other component is not mergeable.' };
  }
  const compIdOther = String(compDataOther.compId || '');
  const textOther = String(compDataOther.data?.text || '');
  const textCurrent = String(dataComp?.text || '');
  const isEditableMerged = compDataOther.config?.isEditable === true || configComp?.isEditable === true;
  const compDataMerged: CompData = {
    compId: compIdOther,
    compName: 'TextSeg',
    childIdList: [],
    data: {
      ...(compDataOther.data || {}),
      sourceId: compIdOther,
      text: textOther + textCurrent,
    },
    config: {
      ...(compDataOther.config || {}),
      ...(configComp || {}),
      isEditable: isEditableMerged,
    },
  };
  return {
    code: 0,
    message: 'TextSeg merge result created.',
    data: {
      op: 'replaceRange',
      compIdListOriginal: [compIdOther, compId],
      compListNext: [compDataMerged],
      focus: {
        compId: compIdOther,
        point: { offset: textOther.length },
      },
    },
  };
}

function createSelfSelectionDeleteResult({
  compId,
  dataComp,
  configComp,
  pointAnchor,
  pointFocus,
}: {
  compId: string;
  dataComp: any;
  configComp: any;
  pointAnchor: SelectionTrackPoint | null | undefined;
  pointFocus: SelectionTrackPoint | null | undefined;
}) {
  if (configComp?.isEditable !== true) {
    return { code: -1, message: 'TextSeg is not editable.' };
  }
  if (!pointAnchor || !pointFocus || pointAnchor.segId !== compId || pointFocus.segId !== compId) {
    return { code: -1, message: 'Selection is not within this component.' };
  }
  const text = String(dataComp?.text || '');
  const offsetStart = Math.min(
    text.length,
    Math.max(0, Math.min(Number(pointAnchor.offset || 0), Number(pointFocus.offset || 0))),
  );
  const offsetEnd = Math.min(
    text.length,
    Math.max(0, Math.max(Number(pointAnchor.offset || 0), Number(pointFocus.offset || 0))),
  );
  if (offsetStart === offsetEnd) {
    return { code: 0, message: 'Selection delete has no range.', data: { op: 'noop', compIdListOriginal: [compId], compListNext: [] } };
  }
  const compDataNext: CompData = {
    compId,
    compName: 'TextSeg',
    childIdList: [],
    data: {
      ...(dataComp || {}),
      sourceId: compId,
      text: text.slice(0, offsetStart) + text.slice(offsetEnd),
    },
    config: { ...(configComp || {}) },
  };
  return {
    code: 0,
    message: 'TextSeg selection delete result created.',
    data: {
      op: 'replaceSelf',
      compIdListOriginal: [compId],
      compListNext: [compDataNext],
      focus: {
        compId,
        point: { offset: offsetStart },
      },
    },
  };
}

function createSelfSelectionEdgeDeleteResult({
  compId,
  dataComp,
  configComp,
  point,
  side,
}: {
  compId: string;
  dataComp: any;
  configComp: any;
  point: SelectionTrackPoint | null | undefined;
  side: string;
}) {
  if (configComp?.isEditable !== true) {
    return { code: -1, message: 'TextSeg is not editable.' };
  }
  if (!point || point.segId !== compId) {
    return { code: -1, message: 'Selection point is not within this component.' };
  }
  const text = String(dataComp?.text || '');
  const offset = Math.min(text.length, Math.max(0, Number(point.offset || 0)));
  const textNext = side === 'keepBefore'
    ? text.slice(0, offset)
    : text.slice(offset);
  if (side !== 'keepBefore' && side !== 'keepAfter') {
    return { code: -1, message: `Unsupported selection edge side. side=${side}` };
  }
  const compDataNext: CompData = {
    compId,
    compName: 'TextSeg',
    childIdList: [],
    data: {
      ...(dataComp || {}),
      sourceId: compId,
      text: textNext,
    },
    config: { ...(configComp || {}) },
  };
  return {
    code: 0,
    message: 'TextSeg selection edge delete result created.',
    data: {
      op: 'replaceSelf',
      compIdListOriginal: [compId],
      compListNext: [compDataNext],
      focus: {
        compId,
        point: { offset: side === 'keepBefore' ? textNext.length : 0 },
      },
    },
  };
}

function createSelfClipboardTextResult({
  dataComp,
  offsetStartRaw,
  offsetEndRaw,
}: {
  dataComp: any;
  offsetStartRaw: number | undefined;
  offsetEndRaw: number | undefined;
}) {
  const text = String(dataComp?.text || '');
  const offsetStart = Number.isFinite(Number(offsetStartRaw))
    ? Math.min(text.length, Math.max(0, Number(offsetStartRaw)))
    : 0;
  const offsetEnd = Number.isFinite(Number(offsetEndRaw))
    ? Math.min(text.length, Math.max(0, Number(offsetEndRaw)))
    : text.length;
  return {
    code: 0,
    message: 'TextSeg clipboard text created.',
    data: {
      text: text.slice(Math.min(offsetStart, offsetEnd), Math.max(offsetStart, offsetEnd)),
    },
  };
}

function focusStoreFocusedSegIfKeyEventIsStale(contextDocStore: ReturnType<typeof useDocStoreContext>, compId: string) {
  if (!contextDocStore || !compId) {
    return false;
  }
  const focusState = contextDocStore.store.getInteractionState(contextDocStore.docId).focusState;
  const segIdFocused = String(focusState.segIdFocused || '');
  if (!segIdFocused || segIdFocused === compId) {
    return false;
  }
  void contextDocStore.store.sendEventToComp(contextDocStore.docId, segIdFocused, {
    type: 'focus',
    sourceId: segIdFocused,
    targetId: contextDocStore.docId,
    data: {
      segId: segIdFocused,
      offset: Number(focusState.offsetFocused || 0),
    },
  });
  return true;
}

function createTextSegRenderDebugText(compId: string, text: string, counterRender: number) {
  const textMain = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 32);
  return `render ${counterRender} id ${compId} text ${textMain}`;
}

function applyRangeSelectionByOffset(element: HTMLElement | null, offsetStart: number, offsetEnd: number) {
  if (!element) return false;
  const pointStart = getDomPointAtOffset(element, offsetStart);
  const pointEnd = getDomPointAtOffset(element, offsetEnd);
  const selection = window.getSelection();
  if (!pointStart || !pointEnd || !selection) return false;
  const range = document.createRange();
  range.setStart(pointStart.node, pointStart.offset);
  range.setEnd(pointEnd.node, pointEnd.offset);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

function getDomPointAtOffset(element: HTMLElement, offsetRaw: number) {
  const offsetTarget = Math.min(
    String(element.textContent || '').length,
    Math.max(0, Number(offsetRaw || 0)),
  );
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let offsetPassed = 0;
  let textNodeLast: Node | null = null;
  while (true) {
    const nodeCurrent = walker.nextNode();
    if (!nodeCurrent) break;
    textNodeLast = nodeCurrent;
    const textLength = String(nodeCurrent.textContent || '').length;
    if (offsetTarget <= offsetPassed + textLength) {
      return {
        node: nodeCurrent,
        offset: Math.max(0, offsetTarget - offsetPassed),
      };
    }
    offsetPassed += textLength;
  }
  if (textNodeLast) {
    return {
      node: textNodeLast,
      offset: String(textNodeLast.textContent || '').length,
    };
  }
  return {
    node: element,
    offset: 0,
  };
}

function getFirstTextLineRect(textEl: HTMLElement) {
  const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT);
  const lineHeight = getLineHeight(textEl);
  while (true) {
    const nodeCurrent = walker.nextNode();
    if (!nodeCurrent) break;
    const textCurrent = String(nodeCurrent.textContent || '');
    if (!textCurrent) continue;
    const range = document.createRange();
    range.setStart(nodeCurrent, 0);
    range.setEnd(nodeCurrent, Math.min(1, textCurrent.length));
    const rect = Array.from(range.getClientRects())[0] || null;
    range.detach?.();
    if (rect && rect.height > 0) {
      return {
        top: rect.top + (rect.height - lineHeight) / 2,
        height: lineHeight,
      };
    }
  }
  return null;
}

function getFallbackLineRect(textEl: HTMLElement) {
  const rect = textEl.getBoundingClientRect();
  const lineHeight = getLineHeight(textEl);
  if (rect.height > 0) {
    return {
      top: rect.top,
      height: lineHeight,
    };
  }
  return {
    top: rect.top,
    height: lineHeight,
  };
}

function getLineHeight(textEl: HTMLElement) {
  const style = window.getComputedStyle(textEl);
  const fontSize = Number.parseFloat(style.fontSize) || 14;
  return Number.parseFloat(style.lineHeight) || fontSize * 1.25;
}
