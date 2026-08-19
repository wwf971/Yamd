import React from 'react';
import { observer } from 'mobx-react-lite';
import { useDocStoreContext } from '../../DocStoreContext';
import { compIdCreateRandom } from '../../docStoreCompData';
import { registerSegTrait } from '../../docStoreSegTrait';
import type { CompEvent, SelectionTrackPoint } from '../../docStoreTypes';
import {
  applyCaretByDirection,
  applyCaretByOffset,
  getCaretOffset,
} from '../../util/caretUtils';
import { useDocDragInteraction } from '../../util/useDocDragInteraction';
import { applyRangeSelectionByOffset, calcTextSegBulletPosition } from '../seg-text/TextSeg.dom';
import { focusStoreFocusedSegIfKeyEventIsStale } from '../seg-text/TextSeg.keyboard';
import {
  getCaretOffsetClamped,
  getSelectionOffsetRange,
} from './TextBlockSeg.dom';
import {
  createSelfClipboardTextResult,
  createSelfSelectionDeleteResult,
  createSelfSelectionEdgeDeleteResult,
  createSelfSplitResult,
} from './TextBlockSeg.editResults';
import { useTextBlockSegKeyDown } from './TextBlockSeg.keyboard';
import './TextBlockSeg.history';
import './TextBlockSeg.css';

// TextBlockSeg is a row-exclusive segment: doc-level structure logic keeps it
// as the only segment of its Row. See doc-mobx/comp_seg_exclusive.md.
registerSegTrait('TextBlockSeg', { isRowExclusive: true });

type TextBlockSegProps = {
  data?: {
    compId?: string;
    sourceId?: string;
    targetId?: string;
    text?: string;
  };
  config?: {
    isEditable?: boolean;
    style?: {
      colorBackground?: string;
      colorText?: string;
      fontSize?: number;
      fontFamily?: string;
    };
  };
  onEvent?: (event: CompEvent) => Promise<any> | any;
};

const TextBlockSeg = observer(React.forwardRef<any, TextBlockSegProps>(({ data = {}, config = {}, onEvent }, ref) => {
  const contextDocStore = useDocStoreContext();
  const compId = String(data.compId || '');
  const compData = contextDocStore && compId
    ? contextDocStore.store.getCompDataById(contextDocStore.docId, compId)
    : null;
  const dataComp = compData?.data || data || {};
  const configComp = compData?.config || config || {};
  const sourceId = String(compId || dataComp.sourceId || 'text-block-seg');
  const targetId = String(dataComp.targetId || contextDocStore?.docId || '');
  const text = String(dataComp.text || '');
  const isEditable = configComp.isEditable === true;
  const styleConfig = configComp.style || {};
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
  const isSelectionActive = (isFocusedLogical || isSelectionWithin) && selectionState?.isSelectionActive === true;
  const dragItemId = compId ? `segment:${compId}` : '';
  const dragRuntimeState = contextDocStore && dragItemId
    ? contextDocStore.store.getDragItemRuntimeState(contextDocStore.docId, dragItemId)
    : null;
  const bulletPositionState = contextDocStore && compId
    ? contextDocStore.store.getCompBulletPosState(contextDocStore.docId, compId)
    : null;
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const offsetPendingRestoreRef = React.useRef<number | null>(null);
  const isComposingRef = React.useRef(false);
  const counterBulletMeasureReq = Number(bulletPositionState?.counterBulletMeasureReq || 0);
  const compIdBasisBullet = String(bulletPositionState?.compIdBasis || '');
  const isBulletMeasureEnabled = bulletPositionState?.isBulletMeasureEnabled !== false;

  const styleBlock: React.CSSProperties = {};
  if (styleConfig.colorBackground) styleBlock.background = String(styleConfig.colorBackground);
  if (styleConfig.colorText) styleBlock.color = String(styleConfig.colorText);
  if (styleConfig.fontSize) styleBlock.fontSize = Number(styleConfig.fontSize);
  if (styleConfig.fontFamily) styleBlock.fontFamily = String(styleConfig.fontFamily);

  const className = [
    'mobx-text-block-seg',
    isFocusedLogical ? 'mobx-seg-focused-logical' : '',
    isElActive ? 'mobx-seg-el-active' : '',
    isSelectionWithin ? 'mobx-seg-selection-within' : '',
    dragRuntimeState?.isDragged ? 'mobx-drag-item-dragged' : '',
    dragRuntimeState?.isDragHovered ? 'mobx-drag-item-hovered' : '',
    dragRuntimeState?.isDropAllowed === false ? 'mobx-drag-item-drop-denied' : '',
    dragRuntimeState?.isInsertSegmentBefore ? 'mobx-drag-seg-insert-before' : '',
    dragRuntimeState?.isInsertSegmentAfter ? 'mobx-drag-seg-insert-after' : '',
  ].filter(Boolean).join(' ');

  const { handlePointerDownCapture } = useDocDragInteraction({
    docId: contextDocStore?.docId || '',
    compId,
    store: contextDocStore?.store,
  });

  const updateFocusState = React.useCallback((reason: string, offset?: number) => {
    if (!contextDocStore || !compId) return;
    const offsetFocused = Number.isFinite(offset)
      ? Number(offset)
      : getCaretOffset(rootRef.current);
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
    if (
      selectionState?.isSelectionActive === true
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

  const insertTextAtSelection = React.useCallback((textInsert: string) => {
    const rootEl = rootRef.current;
    if (!contextDocStore || !compId || !isEditable || !rootEl) return;
    const offsetRange = getSelectionOffsetRange(rootEl, text.length);
    const textNext = text.slice(0, offsetRange.offsetStart) + textInsert + text.slice(offsetRange.offsetEnd);
    offsetPendingRestoreRef.current = offsetRange.offsetStart + textInsert.length;
    contextDocStore.store.updateCompDataByPatch(contextDocStore.docId, compId, { text: textNext });
  }, [contextDocStore, compId, isEditable, text]);

  const deleteTextAtSelection = React.useCallback((direction: 'backward' | 'forward') => {
    const rootEl = rootRef.current;
    if (!contextDocStore || !compId || !isEditable || !rootEl) return;
    const offsetRange = getSelectionOffsetRange(rootEl, text.length);
    let offsetStart = offsetRange.offsetStart;
    let offsetEnd = offsetRange.offsetEnd;
    if (offsetStart === offsetEnd) {
      if (direction === 'backward') {
        if (offsetStart <= 0) return;
        offsetStart -= 1;
      } else {
        if (offsetEnd >= text.length) return;
        offsetEnd += 1;
      }
    }
    const textNext = text.slice(0, offsetStart) + text.slice(offsetEnd);
    offsetPendingRestoreRef.current = offsetStart;
    contextDocStore.store.updateCompDataByPatch(contextDocStore.docId, compId, { text: textNext });
  }, [contextDocStore, compId, isEditable, text]);

  const applySelectAllInBlock = React.useCallback(() => {
    const rootEl = rootRef.current;
    if (!contextDocStore || !compId || !rootEl) return;
    contextDocStore.store.updateSelectionState(contextDocStore.docId, {
      isSelectionActive: true,
      mode: 'range',
      pointAnchor: getPointCurrent(0),
      pointFocus: getPointCurrent(text.length),
    });
    updateFocusState('selectAllTextBlockSeg', text.length);
    applyRangeSelectionByOffset(rootEl, 0, text.length);
  }, [contextDocStore, compId, getPointCurrent, text.length, updateFocusState]);

  const applyFocusToDom = React.useCallback((reason: string, dataEvent: any = {}) => {
    const rootEl = rootRef.current;
    if (!rootEl) return 0;
    if (contextDocStore && compId) {
      contextDocStore.store.updateElActiveState(contextDocStore.docId, compId);
    }
    rootEl.focus();
    if (Number.isFinite(dataEvent?.offset)) {
      applyCaretByOffset(rootEl, Math.min(text.length, Math.max(0, Number(dataEvent.offset))));
    } else if (dataEvent?.mousePos) {
      applyCaretByDirection(rootEl, String(dataEvent.direction || 'click'), dataEvent.mousePos);
    } else {
      applyCaretByDirection(rootEl, String(dataEvent.direction || 'fromLeft'));
    }
    // Direction-based placement can land after the trailing phantom newline;
    // clamp the caret back into the logical text.
    let offsetFocused = getCaretOffset(rootEl);
    if (offsetFocused > text.length) {
      applyCaretByOffset(rootEl, text.length);
      offsetFocused = text.length;
    }
    updateFocusState(reason, offsetFocused);
    return offsetFocused;
  }, [contextDocStore, compId, text.length, updateFocusState]);

  const syncTextFromDom = React.useCallback((rootEl: HTMLDivElement | null) => {
    if (!contextDocStore || !compId || !isEditable || !rootEl) return;
    const textRaw = String(rootEl.textContent || '');
    const textNext = textRaw.endsWith('\n') ? textRaw.slice(0, -1) : textRaw;
    if (textNext === text) return;
    offsetPendingRestoreRef.current = getCaretOffsetClamped(rootEl, textNext.length);
    contextDocStore.store.updateCompDataByPatch(contextDocStore.docId, compId, { text: textNext });
  }, [contextDocStore, compId, isEditable, text]);

  const handleInput = React.useCallback((event: React.FormEvent<HTMLDivElement>) => {
    if (isComposingRef.current) return;
    syncTextFromDom(event.currentTarget);
  }, [syncTextFromDom]);

  const handlePaste = React.useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    if (!isEditable) return;
    event.preventDefault();
    if (focusStoreFocusedSegIfKeyEventIsStale(contextDocStore, compId)) {
      return;
    }
    // Paste stays inside the block and keeps newlines, like a code block.
    const textPaste = String(event.clipboardData?.getData('text/plain') || '').replace(/\r\n|\r/g, '\n');
    if (!textPaste) return;
    insertTextAtSelection(textPaste);
  }, [compId, contextDocStore, insertTextAtSelection, isEditable]);

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

  React.useLayoutEffect(() => {
    const offsetPending = offsetPendingRestoreRef.current;
    if (offsetPending === null) return;
    if (isComposingRef.current) return;
    offsetPendingRestoreRef.current = null;
    const rootEl = rootRef.current;
    if (!rootEl || document.activeElement !== rootEl) return;
    applyCaretByOffset(rootEl, Math.min(text.length, Math.max(0, offsetPending)));
    updateFocusState('textInput', getCaretOffsetClamped(rootEl, text.length));
  }, [text, updateFocusState]);

  const handleKeyDown = useTextBlockSegKeyDown({
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
        return { code: 0, message: 'TextBlockSeg focused.' };
      }
      if (type === 'clickSingle') {
        const offset = applyFocusToDom('clickSingle', event?.data || {});
        emitEvent('clickSingle', { ...(event?.data || {}), offset });
        return { code: 0, message: 'TextBlockSeg click received.' };
      }
      if (type === 'selfSplitQuery') {
        if (configComp?.isEditable !== true) {
          return { code: -1, message: 'TextBlockSeg is not editable.' };
        }
        return createSelfSplitResult({
          compId,
          compIdRight: contextDocStore?.store.createCompId(contextDocStore.docId, 'seg') || compIdCreateRandom('seg'),
          dataComp,
          configComp,
          offsetRaw: Number(event?.data?.point?.offset || 0),
        });
      }
      if (type === 'selfMergeQuery') {
        // A row-exclusive block never merges, in either direction.
        return { code: -1, message: 'TextBlockSeg does not merge with other segments.' };
      }
      if (type === 'selfDeleteQuery') {
        if (configComp?.isEditable !== true) {
          return { code: -1, message: 'TextBlockSeg is not editable.' };
        }
        return {
          code: 0,
          message: 'TextBlockSeg delete result created.',
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
          message: 'TextBlockSeg empty state created.',
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
    <div
      ref={rootRef}
      tabIndex={0}
      contentEditable={isEditable}
      suppressContentEditableWarning
      className={className}
      style={styleBlock}
      data-mobx-comp-id={compId}
      data-mobx-comp-name="TextBlockSeg"
      data-mobx-seg-id={compId}
      data-mobx-drag-item-id={dragItemId}
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
        if (!event.shiftKey) return;
        event.preventDefault();
        event.stopPropagation();
      }}
      onBlur={() => {
        syncTextFromDom(rootRef.current);
      }}
      onClick={(event) => {
        if (event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          if (contextDocStore?.store.consumeFocusClickSuppressed(contextDocStore.docId)) {
            return;
          }
          contextDocStore?.store.focusExpandToParent(contextDocStore.docId, compId, 'shiftClickExpand');
          return;
        }
        // The native click already placed the caret; sync the focus state.
        const offset = getCaretOffsetClamped(rootRef.current, text.length);
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
      onPaste={handlePaste}
    >
      {/* One plain text child only: the browser owns contentEditable children.
          The trailing phantom newline makes a real trailing newline in data
          render as a visible empty last line. */}
      {`${text}\n`}
    </div>
  );
}));

export default TextBlockSeg;
