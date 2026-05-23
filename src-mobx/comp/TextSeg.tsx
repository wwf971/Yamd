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
  isCaretAtEnd,
  isCaretAtStart,
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
  const rootRef = React.useRef<HTMLSpanElement | null>(null);
  const offsetPendingRestoreRef = React.useRef<number | null>(null);
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

  const handleInput = React.useCallback((event: React.FormEvent<HTMLSpanElement>) => {
    if (!contextDocStore || !compId || !isEditable) return;
    offsetPendingRestoreRef.current = getCaretOffset(event.currentTarget);
    const textNext = String(event.currentTarget.textContent || '');
    contextDocStore.store.updateCompDataByPatch(contextDocStore.docId, compId, { text: textNext });
  }, [contextDocStore, compId, isEditable]);

  React.useLayoutEffect(() => {
    const offsetPending = offsetPendingRestoreRef.current;
    if (offsetPending === null) return;
    offsetPendingRestoreRef.current = null;
    const rootEl = rootRef.current;
    if (!rootEl || document.activeElement !== rootEl) return;
    applyCaretByOffset(rootEl, offsetPending);
    updateFocusState('textInput', getCaretOffset(rootEl));
  }, [text, updateFocusState]);

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
      contentEditable={isEditable}
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
      onClick={(event) => {
        const rootEl = rootRef.current;
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
      onKeyDown={(event) => {
        const rootEl = rootRef.current;
        if (!rootEl) return;
        if (event.key === 'ArrowLeft' && isCaretAtStart(rootEl)) {
          event.preventDefault();
          emitEvent('segNavigate', { direction: 'left', offset: 0 });
          return;
        }
        if (event.key === 'ArrowRight' && isCaretAtEnd(rootEl)) {
          event.preventDefault();
          emitEvent('segNavigate', { direction: 'right', offset: getCaretOffset(rootEl) });
          return;
        }
        if (event.key === 'ArrowUp' && isCaretOnFirstLine(rootEl)) {
          event.preventDefault();
          emitEvent('segNavigate', { direction: 'up', offset: getCaretOffset(rootEl), x: getCaretClientX(rootEl) });
          return;
        }
        if (event.key === 'ArrowDown' && isCaretOnLastLine(rootEl)) {
          event.preventDefault();
          emitEvent('segNavigate', { direction: 'down', offset: getCaretOffset(rootEl), x: getCaretClientX(rootEl) });
          return;
        }
        if (isEditable || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        emitEvent('clickSingle', { offset: getCaretOffset(rootEl) });
      }}
    >
      {text}
    </span>
  );
}));

export default TextSeg;
