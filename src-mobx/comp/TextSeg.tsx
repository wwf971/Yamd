import React from 'react';
import { observer } from 'mobx-react-lite';
import { useDocStoreContext } from '../DocStoreContext';
import { CompEvent } from '../docStore';
import {
  applyCaretByDirection,
  applyCaretByOffset,
  applyCaretByPoint,
  getCaretClientX,
  getCaretOffset,
  isCaretOnFirstLine,
  isCaretOnLastLine,
} from '../util/caretUtils';

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
  const sourceId = String(dataComp.sourceId || compId || 'text-seg');
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
  const rootRef = React.useRef<HTMLSpanElement | null>(null);
  const offsetPendingRestoreRef = React.useRef<number | null>(null);
  const [isPointerDown, setIsPointerDown] = React.useState(false);
  const isSelectionActive = interactionState?.selectionState.isSelectionActive === true;
  const isDomCaretMode = isEditable
    && runtimeState?.isFocusedLogical === true
    && isPointerDown === false;
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
      emitEvent('textDeleteEmpty', { direction: 'left' });
      return;
    }
    if (textNext !== text) {
      offsetPendingRestoreRef.current = getCaretOffset(rootEl);
      contextDocStore.store.updateCompDataByPatch(contextDocStore.docId, compId, { text: textNext });
    }
  }, [contextDocStore, compId, emitEvent, isEditable, text]);

  const handleInput = React.useCallback((event: React.FormEvent<HTMLSpanElement>) => {
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

  React.useLayoutEffect(() => {
    const offsetPending = offsetPendingRestoreRef.current;
    if (offsetPending === null) return;
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

    const offsetCurrent = isLogicalCaretVisible ? offsetLogicalCaret : getCaretOffset(rootEl);
    const textLength = text.length;
    if (isLogicalCaretMode && !isSelectionActive) {
      applyCaretByOffset(rootEl, offsetCurrent);
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      emitEvent(event.shiftKey ? 'rowOutdent' : 'rowIndent', { offset: offsetCurrent });
      return;
    }

    if (event.key === 'Enter' && isEditable) {
      event.preventDefault();
      emitEvent('textSplit', { offset: offsetCurrent });
      return;
    }

    if ((event.key === 'Backspace' || event.key === 'Delete') && isEditable && offsetCurrent <= 0) {
      event.preventDefault();
      emitEvent('textMergePrev', { offset: 0, direction: 'left' });
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
        emitEvent('focus', { ...(event?.data || {}), offset });
        return { code: 0, message: 'TextSeg focused.' };
      }
      if (type === 'clickSingle') {
        const offset = applyFocusToDom('clickSingle', event?.data || {});
        emitEvent('clickSingle', { ...(event?.data || {}), offset });
        return { code: 0, message: 'TextSeg click received.' };
      }
      return { code: -1, message: `Unsupported event: ${type}` };
    },
  }), [applyFocusToDom, emitEvent]);

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
      onMouseDown={() => {
        setIsPointerDown(true);
      }}
      onMouseUp={() => {
        setIsPointerDown(false);
      }}
      onBlur={() => {
        syncTextFromDom(rootRef.current);
        setIsPointerDown(false);
      }}
      onClick={(event) => {
        setIsPointerDown(false);
        const rootEl = rootRef.current;
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) {
          updateFocusState('rangeSelect', getCaretOffset(rootEl));
          return;
        }
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
