import React from 'react';
import { observer } from 'mobx-react-lite';
import { useDocStoreContext } from '../DocStoreContext';
import type { CompData, CompEvent, SelectionTrackPoint } from '../docStoreTypes';
import {
  applyCaretByDirection,
  applyCaretByOffset,
  applyCaretByPoint,
  getCaretClientX,
  getCaretOffset,
  isCaretOnFirstLine,
  isCaretOnLastLine,
} from '../util/caretUtils';
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
  const runtimeState = contextDocStore && compId
    ? contextDocStore.store.getCompRuntimeState(contextDocStore.docId, compId)
    : null;
  const interactionState = contextDocStore
    ? contextDocStore.store.getInteractionState(contextDocStore.docId)
    : null;
  const bulletPositionState = contextDocStore && compId
    ? contextDocStore.store.getCompBulletPosState(contextDocStore.docId, compId)
    : null;
  const rootRef = React.useRef<HTMLSpanElement | null>(null);
  const offsetPendingRestoreRef = React.useRef<number | null>(null);
  const isComposingRef = React.useRef(false);
  const [isPointerDown, setIsPointerDown] = React.useState(false);
  const counterBulletMeasureReq = Number(bulletPositionState?.counterBulletMeasureReq || 0);
  const compIdBasisBullet = String(bulletPositionState?.compIdBasis || '');
  const isBulletMeasureEnabled = bulletPositionState?.isBulletMeasureEnabled !== false;
  const isSelectionActive = interactionState?.selectionState.isSelectionActive === true;
  const isDomCaretMode = isEditable
    && runtimeState?.isFocusedLogical === true
    && isPointerDown === false
    && !isSelectionActive;
  const isLogicalCaretMode = !isDomCaretMode;
  const isLogicalCaretVisible = isLogicalCaretMode
    && isPointerDown === false
    && runtimeState?.isFocusedLogical === true
    && !isSelectionActive;
  const offsetLogicalCaret = isLogicalCaretVisible
    ? Math.min(text.length, Math.max(0, Number(interactionState?.focusState.offsetFocused || 0)))
    : -1;
  const className = [
    'mobx-text-seg',
    isActive ? 'is-active' : '',
    runtimeState?.isFocusedLogical ? 'mobx-seg-focused-logical' : '',
    runtimeState?.isElActive ? 'mobx-seg-el-active' : '',
    runtimeState?.isSelectionWithin ? 'mobx-seg-selection-within' : '',
    isDebug ? 'mobx-seg-debug' : '',
  ].filter(Boolean).join(' ');

  const updateFocusState = React.useCallback((reason: string, offset?: number) => {
    if (!contextDocStore || !compId) return;
    const offsetFocused = Number.isFinite(offset) ? Number(offset) : getCaretOffset(rootRef.current);
    contextDocStore.store.updateFocusState(contextDocStore.docId, {
      compIdFocused: compId,
      segIdFocused: compId,
      offsetFocused,
      reasonLast: reason,
    });
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
    const pointAnchorSelection = interactionState?.selectionState.pointAnchor;
    const pointFocusSelection = interactionState?.selectionState.pointFocus;
    const isSelectionCurrent = interactionState?.selectionState.isSelectionActive === true;
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
  }, [compId, getPointCurrent, interactionState?.selectionState.isSelectionActive, interactionState?.selectionState.pointAnchor, interactionState?.selectionState.pointFocus]);

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
  }, [updateFocusState]);

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

  const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLSpanElement>) => {
    const rootEl = rootRef.current;
    if (!rootEl) return;
    if (event.nativeEvent.isComposing || event.key === 'Process') return;
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

    const pointFocusSelection = interactionState?.selectionState.pointFocus;
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
    getCaretClientXCurrent,
    isEditable,
    isLogicalCaretMode,
    isLogicalCaretVisible,
    isSelectionActive,
    offsetLogicalCaret,
    text,
    text.length,
    updateFocusState,
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
          dataComp,
          configComp,
          offsetRaw: Number(event?.data?.point?.offset || 0),
        });
      }
      if (type === 'selfMergeQuery') {
        return createSelfMergeResult({
          compId,
          dataComp,
          configComp,
          compDataOther: event?.data?.compDataOther,
          direction: String(event?.data?.direction || ''),
        });
      }
      if (type === 'selfDeleteQuery') {
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
      onMouseDown={() => {
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
        if (selection && !selection.isCollapsed) {
          return;
        }
        setIsPointerDown(false);
        if (rootEl) {
          rootEl.focus();
          applyCaretByPoint(rootEl, event.clientX, event.clientY);
        }
        const offset = getCaretOffset(rootEl);
        updateFocusState('clickSingle', offset);
        emitEvent('clickSingle', {
          offset,
          mousePos: {
            clientX: event.clientX,
            clientY: event.clientY,
          },
        });
      }}
      onKeyDown={handleKeyDown}
    >
      {isLogicalCaretVisible ? (
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
  dataComp,
  configComp,
  offsetRaw,
}: {
  compId: string;
  dataComp: any;
  configComp: any;
  offsetRaw: number;
}) {
  const text = String(dataComp?.text || '');
  const offset = Math.min(text.length, Math.max(0, Number(offsetRaw || 0)));
  const compIdRight = createCompIdLocal('seg');
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

function createCompIdLocal(prefix: string) {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${randomPart}`;
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
