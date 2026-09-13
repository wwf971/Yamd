import React from 'react';
import { observer } from 'mobx-react-lite';
import { useDocStoreContext } from '../../DocStoreContext';
import { docStoreCollectSegmentIds } from '../../docStoreSegment';
import { registerSegTrait } from '../../docStoreSegTrait';
import type { CompEvent, SelectionState, SelectionTrackPoint } from '../../docStoreTypes';
import {
  applyCaretByDirection,
  applyCaretByOffset,
  getCaretClientX,
  getCaretOffset,
  isCaretOnFirstLine,
  isCaretOnLastLine,
} from '../../util/caretUtils';
import { useDocDragInteraction } from '../../util/useDocDragInteraction';
import { applyRangeSelectionByOffset } from '../seg-text/TextSeg.dom';
import { focusStoreFocusedSegIfKeyEventIsStale } from '../seg-text/TextSeg.keyboard';
import { getSelectionOffsetRange } from '../seg-text-block/TextBlockSeg.dom';
import {
  COMP_NAME_MATH_INLINE,
  createMathClipboardText,
  createSelfSelectionDeleteResult,
  createSelfSelectionEdgeDeleteResult,
  parsePasteTextMathInline,
} from './MathInlineSeg.editResults';
import { ensureSvgForTex, mathJaxState } from './mathJaxSvg';
import './MathInlineSeg.css';

// MathInlineSeg is an inline latex math segment. See seg_math_inline.md in
// this folder for the design and the ui behavior stipulation.
// - createClipboardText: the whole segment copies as $source$.
// - parsePasteInline: pasted plain text containing $...$ pairs splits into
//   text parts and MathInlineSeg parts.
registerSegTrait(COMP_NAME_MATH_INLINE, {
  createClipboardText: createMathClipboardText,
  parsePasteInline: parsePasteTextMathInline,
});

// Pending focus action for the tooltip editor, applied once the editor
// element is mounted.
type EditorFocusPending =
  | { kind: 'selectAll' }
  | { kind: 'caretByPoint'; direction: string; x: number };

// The editor renders the source text with a phantom trailing newline (like
// TextBlockSeg), so a real trailing newline in the source shows as a visible
// empty last line. Reading the source back strips that one phantom newline.
function getSourceTextFromEditor(editorEl: HTMLElement | null) {
  const textRaw = String(editorEl?.textContent || '');
  return textRaw.endsWith('\n') ? textRaw.slice(0, -1) : textRaw;
}

// A range selection covering the whole segment cannot rely on the native
// selection highlight (the rendered math is user-select: none), and
// isSelectionWithin only marks the range endpoints. So the covered state is
// computed from the logical selection range and shown through a css class.
function getIsSegCoveredByRangeSelection(
  contextDocStore: ReturnType<typeof useDocStoreContext>,
  compId: string,
  selectionState: SelectionState | undefined,
) {
  if (!contextDocStore || !compId) return false;
  if (selectionState?.isSelectionActive !== true) return false;
  const pointAnchor = selectionState.pointAnchor;
  const pointFocus = selectionState.pointFocus;
  if (!pointAnchor || !pointFocus) return false;
  if (pointAnchor.segId === compId && pointFocus.segId === compId) {
    const offsetMin = Math.min(Number(pointAnchor.offset || 0), Number(pointFocus.offset || 0));
    const offsetMax = Math.max(Number(pointAnchor.offset || 0), Number(pointFocus.offset || 0));
    return offsetMin <= 0 && offsetMax >= 1;
  }
  const docRecord = contextDocStore.store.ensureDoc(contextDocStore.docId);
  const segIdList = docStoreCollectSegmentIds(docRecord);
  const indexSelf = segIdList.indexOf(compId);
  const indexAnchor = segIdList.indexOf(String(pointAnchor.segId || ''));
  const indexFocus = segIdList.indexOf(String(pointFocus.segId || ''));
  if (indexSelf === -1 || indexAnchor === -1 || indexFocus === -1) return false;
  const indexStart = Math.min(indexAnchor, indexFocus);
  const indexEnd = Math.max(indexAnchor, indexFocus);
  if (indexSelf < indexStart || indexSelf > indexEnd) return false;
  if (indexSelf > indexStart && indexSelf < indexEnd) return true;
  // The segment is a range endpoint: the atomic content [0, 1] is covered
  // when the endpoint offset reaches past it.
  const pointSelf = pointAnchor.segId === compId ? pointAnchor : pointFocus;
  return indexSelf === indexStart
    ? Number(pointSelf.offset || 0) <= 0
    : Number(pointSelf.offset || 0) >= 1;
}

type MathInlineSegProps = {
  data?: {
    compId?: string;
    sourceId?: string;
    targetId?: string;
    text?: string;
  };
  config?: {
    isEditable?: boolean;
  };
  onEvent?: (event: CompEvent) => Promise<any> | any;
};

const MathInlineSeg = observer(React.forwardRef<any, MathInlineSegProps>(({ data = {}, config = {}, onEvent }, ref) => {
  const contextDocStore = useDocStoreContext();
  const compId = String(data.compId || '');
  const compData = contextDocStore && compId
    ? contextDocStore.store.getCompDataById(contextDocStore.docId, compId)
    : null;
  const dataComp = compData?.data || data || {};
  const configComp = compData?.config || config || {};
  const sourceId = String(compId || dataComp.sourceId || 'math-inline-seg');
  const targetId = String(dataComp.targetId || contextDocStore?.docId || '');
  const text = String(dataComp.text || '');
  const isEditable = configComp.isEditable === true;
  const runtimeState = contextDocStore && compId
    ? contextDocStore.store.getCompRuntimeState(contextDocStore.docId, compId)
    : null;
  const isFocusedLogical = runtimeState?.isFocusedLogical === true;
  const isElActive = runtimeState?.isElActive === true;
  const isSelectionWithin = runtimeState?.isSelectionWithin === true;
  // The selection state is read unconditionally: the segment can sit in the
  // middle of a range selection without being an endpoint, and still needs to
  // paint the covered state.
  const interactionState = contextDocStore
    ? contextDocStore.store.getInteractionState(contextDocStore.docId)
    : null;
  const selectionState = interactionState?.selectionState;
  const isCoveredBySelection = getIsSegCoveredByRangeSelection(contextDocStore, compId, selectionState);
  const isSelectionActive = (isFocusedLogical || isSelectionWithin || isCoveredBySelection)
    && selectionState?.isSelectionActive === true;
  const dragItemId = compId ? `segment:${compId}` : '';
  const dragRuntimeState = contextDocStore && dragItemId
    ? contextDocStore.store.getDragItemRuntimeState(contextDocStore.docId, dragItemId)
    : null;
  const bulletPositionState = contextDocStore && compId
    ? contextDocStore.store.getCompBulletPosState(contextDocStore.docId, compId)
    : null;
  const counterBulletMeasureReq = Number(bulletPositionState?.counterBulletMeasureReq || 0);
  const compIdBasisBullet = String(bulletPositionState?.compIdBasis || '');
  const isBulletMeasureEnabled = bulletPositionState?.isBulletMeasureEnabled !== false;
  // The source tooltip is pure store-driven ui state: focused + editable and
  // not part of an active range selection (a range covers the segment as a
  // whole; editing inside it would be confusing).
  const isTooltipVisible = isEditable && isFocusedLogical && !isSelectionActive;
  const svgState = text ? mathJaxState.svgStateByTex.get(text) : undefined;

  const rootRef = React.useRef<HTMLSpanElement | null>(null);
  const contentRef = React.useRef<HTMLSpanElement | null>(null);
  const editorRef = React.useRef<HTMLSpanElement | null>(null);
  const offsetPendingRestoreRef = React.useRef<number | null>(null);
  const isComposingRef = React.useRef(false);
  const editorFocusPendingRef = React.useRef<EditorFocusPending | null>(null);

  const className = [
    'mobx-math-inline-seg',
    isCoveredBySelection ? 'mobx-math-inline-range-selected' : '',
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

  // Focus the tooltip editor once it is mounted. dispatchEvent sets the
  // pending action; the layout effect below consumes it after the
  // store-driven render mounted the editor element.
  const applyEditorFocusIfPending = React.useCallback(() => {
    const pending = editorFocusPendingRef.current;
    const editorEl = editorRef.current;
    if (!pending || !editorEl) return;
    editorFocusPendingRef.current = null;
    editorEl.focus();
    if (pending.kind === 'caretByPoint') {
      // Entering from above/below with a horizontal position: the caret goes
      // to the first/last source line at that x, like a text segment.
      applyCaretByDirection(editorEl, pending.direction, { x: pending.x });
      return;
    }
    applyRangeSelectionByOffset(editorEl, 0, getSourceTextFromEditor(editorEl).length);
  }, []);

  React.useLayoutEffect(() => {
    applyEditorFocusIfPending();
  });

  // Whole-segment focus. The segment never has an inner caret at document
  // level: focusing it from any direction selects it as a whole, and (when
  // editable) opens the source tooltip. Entering from above/below with a
  // horizontal position places the source caret at that x; every other way in
  // selects the whole source.
  const focusWhole = React.useCallback((reason: string, dataEvent: any = {}) => {
    if (!contextDocStore || !compId) return;
    const direction = String(dataEvent?.direction || '');
    const isFromEnd = direction === 'fromRight' || direction === 'fromBelow';
    contextDocStore.store.updateElActiveState(contextDocStore.docId, compId);
    if (dataEvent?.isSelectionExtend === true && dataEvent?.selectionAnchor) {
      // Keyboard selection extension passes through the segment: it joins the
      // range as a whole. No tooltip; browser focus stays on the root so the
      // next shift+arrow keeps extending.
      const selectionAnchorRaw = dataEvent.selectionAnchor;
      const pointAnchor: SelectionTrackPoint = {
        compId: String(selectionAnchorRaw.compId || compId),
        segId: String(selectionAnchorRaw.segId || compId),
        offset: Math.max(0, Number(selectionAnchorRaw.offset || 0)),
      };
      // Extending from the right edge means moving left: the focus point goes
      // to the segment start, so the range covers the whole segment.
      const offsetFocus = isFromEnd ? 0 : 1;
      contextDocStore.store.updateSelectionState(contextDocStore.docId, {
        isSelectionActive: true,
        mode: 'range',
        pointAnchor,
        pointFocus: { compId, segId: compId, offset: offsetFocus },
      });
      contextDocStore.store.segFocus(contextDocStore.docId, compId, offsetFocus, reason);
      rootRef.current?.focus();
      return;
    }
    contextDocStore.store.clearSelectionState(contextDocStore.docId);
    contextDocStore.store.segFocus(contextDocStore.docId, compId, isFromEnd ? 1 : 0, reason);
    if (!isEditable) {
      rootRef.current?.focus();
      return;
    }
    // Entering from above/below with a horizontal position places the caret
    // in the source text at that x, like a text segment; every other way in
    // selects the whole source.
    const xMouse = Number(dataEvent?.mousePos?.clientX ?? dataEvent?.mousePos?.x);
    const isFromVertical = direction === 'fromAbove' || direction === 'fromBelow';
    if (isFromVertical && Number.isFinite(xMouse)) {
      editorFocusPendingRef.current = { kind: 'caretByPoint', direction, x: xMouse };
    } else {
      editorFocusPendingRef.current = { kind: 'selectAll' };
    }
    applyEditorFocusIfPending();
  }, [contextDocStore, compId, isEditable, applyEditorFocusIfPending]);

  const getContentCenterX = React.useCallback(() => {
    const contentEl = contentRef.current || rootRef.current;
    if (!contentEl) return 0;
    const rect = contentEl.getBoundingClientRect();
    return rect.left + rect.width / 2;
  }, []);

  const resolveSelectionAnchorForExtend = React.useCallback((direction: string): SelectionTrackPoint => {
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
    // Starting a new extension from the whole-selected segment: the anchor is
    // the segment edge opposite to the movement direction.
    return { compId, segId: compId, offset: direction === 'left' ? 1 : 0 };
  }, [compId, selectionState?.isSelectionActive, selectionState?.pointAnchor, selectionState?.pointFocus]);

  const syncTextFromEditor = React.useCallback((editorEl: HTMLSpanElement | null) => {
    if (!contextDocStore || !compId || !isEditable || !editorEl) return;
    const textNext = getSourceTextFromEditor(editorEl);
    if (textNext === text) return;
    offsetPendingRestoreRef.current = Math.min(textNext.length, getCaretOffset(editorEl));
    // A single text-field patch joins the textInput history group of this
    // component, so continuous typing becomes one history node.
    contextDocStore.store.updateCompDataByPatch(contextDocStore.docId, compId, { text: textNext });
  }, [contextDocStore, compId, isEditable, text]);

  // Keyboard behavior inside the source editor. The caret moves like normal
  // text; crossing the source boundary turns into inter-segment navigation.
  const handleEditorKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLSpanElement>) => {
    // Root-level whole-segment keys must not see editor keys.
    event.stopPropagation();
    const editorEl = editorRef.current;
    if (!editorEl) return;
    if (event.nativeEvent.isComposing || event.key === 'Process') return;
    if (event.ctrlKey || event.metaKey) {
      if (event.key.toLowerCase() === 'a') {
        // Keep select-all inside the editor instead of the whole page.
        event.preventDefault();
        applyRangeSelectionByOffset(editorEl, 0, getSourceTextFromEditor(editorEl).length);
      }
      // Undo/redo bubbles to the document shell; copy/cut/paste of the source
      // selection stay native inside the editor.
      return;
    }
    if (focusStoreFocusedSegIfKeyEventIsStale(contextDocStore, compId, event)) {
      event.preventDefault();
      return;
    }
    const isArrowKey = event.key === 'ArrowLeft'
      || event.key === 'ArrowRight'
      || event.key === 'ArrowUp'
      || event.key === 'ArrowDown';
    if (event.shiftKey && isArrowKey) {
      // Selection inside the source editor is internal state; shift-arrows
      // never escape the editor.
      return;
    }
    const selection = window.getSelection();
    const isSelectionCollapsed = selection ? selection.isCollapsed === true : true;
    const offsetCaret = getCaretOffset(editorEl);
    const lengthText = getSourceTextFromEditor(editorEl).length;

    if (event.key === 'Enter' && event.shiftKey) {
      // Shift+Enter inserts a line break into the source text.
      event.preventDefault();
      if (!contextDocStore) return;
      const offsetRange = getSelectionOffsetRange(editorEl, text.length);
      const textNext = `${text.slice(0, offsetRange.offsetStart)}\n${text.slice(offsetRange.offsetEnd)}`;
      offsetPendingRestoreRef.current = offsetRange.offsetStart + 1;
      contextDocStore.store.updateCompDataByPatch(contextDocStore.docId, compId, { text: textNext });
      return;
    }
    if (event.key === 'Enter') {
      // The source is committed continuously on input; Enter ends editing by
      // moving to the next segment.
      event.preventDefault();
      emitEvent('segNavigate', { direction: 'right', offset: 1 });
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      emitEvent(event.shiftKey ? 'rowOutdentAttempt' : 'rowIndentAttempt', {
        compIdChild: compId,
        point: { offset: 0 },
      });
      return;
    }
    if ((event.key === 'Backspace' || event.key === 'Delete') && text.length === 0) {
      // Deleting inside an already empty source attempts to delete the whole
      // math segment.
      event.preventDefault();
      emitEvent('childDeleteAttempt', {
        compIdChild: compId,
        direction: 'left',
        point: { offset: 0 },
      });
      return;
    }
    if (event.key === 'ArrowLeft' && isSelectionCollapsed && offsetCaret <= 0) {
      event.preventDefault();
      emitEvent('segNavigate', { direction: 'left', offset: 0 });
      return;
    }
    if (event.key === 'ArrowRight' && isSelectionCollapsed && offsetCaret >= lengthText) {
      event.preventDefault();
      emitEvent('segNavigate', { direction: 'right', offset: 1 });
      return;
    }
    if (event.key === 'ArrowUp') {
      // Up on the first source line leaves toward the row above, carrying the
      // caret x; on any other line the caret moves between source lines
      // natively.
      if (isCaretOnFirstLine(editorEl)) {
        event.preventDefault();
        emitEvent('segNavigate', { direction: 'up', offset: 0, x: getCaretClientX(editorEl) });
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      if (isCaretOnLastLine(editorEl)) {
        event.preventDefault();
        emitEvent('segNavigate', { direction: 'down', offset: 1, x: getCaretClientX(editorEl) });
      }
      return;
    }
    // Everything else edits the source text natively; onInput syncs to store.
    // The caret must not sit past the trailing phantom newline when a real
    // character is about to be typed. Snap it back before native input runs.
    if (isSelectionCollapsed && offsetCaret > lengthText) {
      applyCaretByOffset(editorEl, lengthText);
    }
  }, [contextDocStore, compId, emitEvent, text]);

  const handleEditorPaste = React.useCallback((event: React.ClipboardEvent<HTMLSpanElement>) => {
    // Paste inside the source editor inserts plain text into the source; it
    // never goes through the document paste parsing.
    event.preventDefault();
    event.stopPropagation();
    const editorEl = editorRef.current;
    if (!contextDocStore || !compId || !isEditable || !editorEl) return;
    const textPaste = String(event.clipboardData?.getData('text/plain') || '')
      .replace(/\r\n|\r/g, '\n');
    if (!textPaste) return;
    const offsetRange = getSelectionOffsetRange(editorEl, text.length);
    const textNext = text.slice(0, offsetRange.offsetStart) + textPaste + text.slice(offsetRange.offsetEnd);
    offsetPendingRestoreRef.current = offsetRange.offsetStart + textPaste.length;
    contextDocStore.store.updateCompDataByPatch(contextDocStore.docId, compId, { text: textNext });
  }, [contextDocStore, compId, isEditable, text]);

  // Keyboard behavior when the root itself holds browser focus: the segment
  // is selected as a whole (non-editable segment, or selection extension).
  const handleRootKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLSpanElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.ctrlKey || event.metaKey) return;
    if (focusStoreFocusedSegIfKeyEventIsStale(contextDocStore, compId, event)) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      const direction = event.key === 'ArrowLeft' ? 'left' : 'right';
      emitEvent('segNavigate', {
        direction,
        offset: direction === 'left' ? 0 : 1,
        isSelectionExtend: true,
        selectionAnchor: resolveSelectionAnchorForExtend(direction),
      });
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      emitEvent('segNavigate', { direction: 'left', offset: 0 });
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      emitEvent('segNavigate', { direction: 'right', offset: 1 });
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      emitEvent('segNavigate', { direction: 'up', offset: 0, x: getContentCenterX() });
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      emitEvent('segNavigate', { direction: 'down', offset: 1, x: getContentCenterX() });
      return;
    }
    if ((event.key === 'Backspace' || event.key === 'Delete') && isEditable) {
      // The whole-selected segment deletes as a whole.
      event.preventDefault();
      emitEvent('childDeleteAttempt', {
        compIdChild: compId,
        direction: 'left',
        point: { offset: 0 },
      });
    }
  }, [contextDocStore, compId, emitEvent, getContentCenterX, isEditable, resolveSelectionAnchorForExtend]);

  const measureBulletPosition = React.useCallback(() => {
    if (!contextDocStore || !compId || !isBulletMeasureEnabled) return;
    const contentEl = contentRef.current || rootRef.current;
    const basisEl = contextDocStore.store.getCompElement(contextDocStore.docId, compIdBasisBullet || compId);
    if (!contentEl || !basisEl) {
      contextDocStore.store.updateCompBulletPosResult(contextDocStore.docId, compId, {
        compIdBasis: compIdBasisBullet || compId,
        compIdProvider: compId,
        posYBulletPreferred: null,
        messageBulletMeasure: contentEl ? 'Basis element missing.' : 'MathInlineSeg element missing.',
      });
      return;
    }
    // The rendered math is one visual box; the bullet aligns with its
    // vertical center.
    const rectContent = contentEl.getBoundingClientRect();
    const rectBasis = basisEl.getBoundingClientRect();
    contextDocStore.store.updateCompBulletPosResult(contextDocStore.docId, compId, {
      compIdBasis: compIdBasisBullet || compId,
      compIdProvider: compId,
      posYBulletPreferred: rectContent.top - rectBasis.top + rectContent.height / 2,
      messageBulletMeasure: 'measured',
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

  // Trigger the async conversion for the current source. The svg lands in the
  // shared observable cache and the observer re-renders.
  React.useEffect(() => {
    if (text) {
      ensureSvgForTex(text);
    }
  }, [text]);

  React.useLayoutEffect(() => {
    if (counterBulletMeasureReq <= 0) return;
    measureBulletPosition();
  }, [counterBulletMeasureReq, text, svgState, measureBulletPosition]);

  // Re-measure the bullet position when the rendered size changes (the svg
  // arrives after an async conversion, or the source edit changes the box).
  React.useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl || !isBulletMeasureEnabled || counterBulletMeasureReq <= 0) return undefined;
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
    resizeObserver.observe(contentEl);
    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      resizeObserver.disconnect();
    };
  }, [counterBulletMeasureReq, isBulletMeasureEnabled, measureBulletPosition]);

  // Restore the editor caret after a source edit re-rendered the text child.
  React.useLayoutEffect(() => {
    const offsetPending = offsetPendingRestoreRef.current;
    if (offsetPending === null) return;
    if (isComposingRef.current) return;
    offsetPendingRestoreRef.current = null;
    const editorEl = editorRef.current;
    if (!editorEl || document.activeElement !== editorEl) return;
    applyCaretByOffset(editorEl, offsetPending);
  }, [text]);

  React.useImperativeHandle(ref, () => ({
    dispatchEvent: async (event: CompEvent) => {
      const type = String(event?.type || '');
      if (type === 'focus') {
        focusWhole('focus', event?.data || {});
        emitEvent('focus', { ...(event?.data || {}), offset: 0 });
        return { code: 0, message: 'MathInlineSeg focused.' };
      }
      if (type === 'clickSingle') {
        focusWhole('clickSingle', event?.data || {});
        emitEvent('clickSingle', { ...(event?.data || {}), offset: 0 });
        return { code: 0, message: 'MathInlineSeg click received.' };
      }
      if (type === 'selfSplitQuery') {
        return { code: -1, message: 'MathInlineSeg does not split.' };
      }
      if (type === 'selfMergeQuery') {
        return { code: -1, message: 'MathInlineSeg does not merge with other segments.' };
      }
      if (type === 'selfDeleteQuery') {
        if (configComp?.isEditable !== true) {
          return { code: -1, message: 'MathInlineSeg is not editable.' };
        }
        return {
          code: 0,
          message: 'MathInlineSeg delete result created.',
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
          message: 'MathInlineSeg empty state created.',
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
        return {
          code: 0,
          message: 'MathInlineSeg clipboard text created.',
          data: {
            text: createMathClipboardText(
              compData,
              event?.data?.offsetStart,
              event?.data?.offsetEnd,
            ),
          },
        };
      }
      return { code: -1, message: `Unsupported event: ${type}` };
    },
  }), [compData, compId, configComp, dataComp, emitEvent, focusWhole]);

  const renderContent = () => {
    if (!text) {
      return <span className="mobx-math-inline-placeholder">$$</span>;
    }
    if (svgState?.svgHtml) {
      return (
        <span
          className={svgState.isError ? 'mobx-math-inline-svg mobx-math-inline-svg-error' : 'mobx-math-inline-svg'}
          title={svgState.isError ? svgState.message : undefined}
          dangerouslySetInnerHTML={{ __html: svgState.svgHtml }}
        />
      );
    }
    // MathJax has not converted this formula yet; show the raw source.
    return <span className="mobx-math-inline-raw">{`$${text}$`}</span>;
  };

  return (
    <span
      ref={rootRef}
      tabIndex={0}
      className={className}
      data-mobx-comp-id={compId}
      data-mobx-comp-name={COMP_NAME_MATH_INLINE}
      data-mobx-seg-id={compId}
      data-mobx-drag-item-id={dragItemId}
      onPointerDownCapture={handlePointerDownCapture}
      onFocus={(event) => {
        if (!contextDocStore || !compId) return;
        contextDocStore.store.updateElActiveState(contextDocStore.docId, compId);
        if (event.target === rootRef.current && !isFocusedLogical) {
          contextDocStore.store.segFocus(contextDocStore.docId, compId, 0, 'focus');
        }
      }}
      onMouseDown={(event) => {
        if (event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        // The rendered math is atomic; no native caret or selection starts
        // inside it. A click selects the segment as a whole.
        event.preventDefault();
      }}
      onMouseUp={(event) => {
        // Selection-translate extensions (Google Translate) place their
        // inline icon at the pointer position of a mouseup that happens while
        // text is selected — such as right before the click on this segment
        // runs select-all in the source editor. A gesture on this segment is
        // not a page selection gesture, so its mouseup must not reach the
        // document where such extensions listen.
        event.stopPropagation();
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
        focusWhole('clickSingle');
        emitEvent('clickSingle', {
          offset: 0,
          mousePos: {
            clientX: event.clientX,
            clientY: event.clientY,
          },
        });
      }}
      onKeyDown={handleRootKeyDown}
    >
      <span ref={contentRef} className="mobx-math-inline-content">
        {renderContent()}
      </span>
      {isTooltipVisible ? (
        // data-mobx-seg-selection-internal: DOM selection inside the tooltip
        // is component-internal state; the document selection tracking skips
        // it (see eventLogicRow.ts selectionPointRead).
        <span
          className="mobx-math-inline-tooltip"
          data-mobx-seg-selection-internal="true"
          onMouseDown={(event) => {
            // Keep root whole-segment handlers away from editor clicks, but
            // keep native caret placement inside the editor.
            event.stopPropagation();
            // Pressing inside the selected source must not start a native
            // drag of the selected text (ghost image): clearing the selection
            // makes the press start a fresh selection from this point.
            const selection = window.getSelection();
            if (event.button === 0 && !event.shiftKey && selection && selection.isCollapsed !== true) {
              selection.removeAllRanges();
            }
          }}
          onMouseUp={(event) => {
            // Selection inside the source editor is component-internal; its
            // mouseup must not reach selection-translate extensions listening
            // on the document (see the root mouseup handler).
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <span
            ref={editorRef}
            className="mobx-math-inline-editor"
            contentEditable={isEditable}
            suppressContentEditableWarning
            tabIndex={-1}
            onInput={(event) => {
              if (isComposingRef.current) return;
              syncTextFromEditor(event.currentTarget);
            }}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={(event) => {
              isComposingRef.current = false;
              syncTextFromEditor(event.currentTarget);
            }}
            onKeyDown={handleEditorKeyDown}
            onPaste={handleEditorPaste}
            onBlur={() => {
              syncTextFromEditor(editorRef.current);
            }}
          >
            {/* One plain text child only: the browser owns contentEditable
                children. All decoration lives outside this element. The
                trailing phantom newline makes a real trailing newline in the
                source render as a visible empty last line. */}
            {`${text}\n`}
          </span>
        </span>
      ) : null}
    </span>
  );
}));

export default MathInlineSeg;
