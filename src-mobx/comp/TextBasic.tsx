import React from 'react';
import { useDocStoreContext } from '../DocStoreContext';
import type { CompEvent } from '../docStoreTypes';
import './TextBasic.css';

type TextBasicData = {
  compId?: string;
  sourceId?: string;
  targetId?: string;
  text: string;
};

type TextBasicConfig = {
  isEditable?: boolean;
  placeholder?: string;
};

type TextBasicProps = {
  data: TextBasicData;
  config?: TextBasicConfig;
  onEvent?: (event: CompEvent) => Promise<any> | any;
  onDataChange?: (dataPatch: Record<string, any>) => Promise<any> | any;
};

const TextBasic = React.forwardRef<any, TextBasicProps>(({
  data,
  config = {},
  onEvent,
  onDataChange,
}, ref) => {
  const contextDocStore = useDocStoreContext();
  const compId = String(data?.compId || '');
  const compData = contextDocStore && compId
    ? contextDocStore.store.getCompDataById(contextDocStore.docId, compId)
    : null;
  const dataComp = compData?.data || data || {};
  const configComp = compData?.config || config || {};
  const sourceId = String(dataComp?.sourceId || compId || 'comp-text-basic');
  const targetId = String(dataComp?.targetId || contextDocStore?.docId || '');
  const isEditable = configComp.isEditable === true;
  const text = String(dataComp?.text ?? '');
  const editableRef = React.useRef<HTMLDivElement | null>(null);
  const isSyncingRef = React.useRef(false);

  React.useEffect(() => {
    const editableElement = editableRef.current;
    if (!editableElement) return;
    if (editableElement.textContent === text) return;
    isSyncingRef.current = true;
    editableElement.textContent = text;
    requestAnimationFrame(() => {
      isSyncingRef.current = false;
    });
  }, [text]);

  const handleEvent = React.useCallback(
    async (event: CompEvent) => {
      if (!onEvent) return { code: 0, message: 'No handler.' };
      return onEvent(event);
    },
    [onEvent],
  );

  const emitEvent = React.useCallback(
    async (type: string, dataEvent: any = {}, sourceIdOverride?: string) => {
      const event: CompEvent = {
        type,
        sourceId: String(sourceIdOverride || sourceId),
        targetId: String(targetId),
        data: dataEvent,
      };
      return handleEvent(event);
    },
    [sourceId, targetId, handleEvent],
  );

  React.useImperativeHandle(ref, () => ({
    dispatchEvent: async (event: CompEvent) => {
      const eventType = String(event?.type || '');
      const dataEvent = event?.data ?? {};

      if (eventType === 'focus') {
        const direction = String(dataEvent?.direction || 'fromLeft');
        const mousePos = dataEvent?.mousePos || null;
        const editableElement = editableRef.current;
        if (!editableElement) {
          return { code: -1, message: 'Editable element missing.' };
        }
        editableElement.focus();
        applyCaretByDirection(editableElement, direction, mousePos);
        await emitEvent('focus', { direction, mousePos }, sourceId);
        return { code: 0, message: 'Focus applied.' };
      }
      if (eventType === 'clickSingle') {
        const editableElement = editableRef.current;
        if (!editableElement) {
          return { code: -1, message: 'Editable element missing.' };
        }
        const mousePos = dataEvent?.mousePos || null;
        editableElement.focus();
        if (mousePos) {
          const clickPoint = getClampedMousePoint(editableElement, mousePos, 'click');
          applyCaretByPoint(editableElement, clickPoint.x, clickPoint.y);
        }
        await emitEvent('clickSingle', { mousePos }, sourceId);
        return { code: 0, message: 'Click applied.' };
      }
      return { code: -1, message: `Unsupported event: ${eventType}` };
    },
  }));

  const handleInput = (event: React.FormEvent<HTMLDivElement>) => {
    if (!isEditable) return;
    if (isSyncingRef.current) return;
    const textNext = event.currentTarget.textContent || '';
    if (onDataChange) {
      onDataChange({ text: textNext });
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    emitEvent('keyDown', {
      key: event.key,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
    }, `${sourceId}:native`);
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    emitEvent('clickSingle', {
      clientX: event.clientX,
      clientY: event.clientY,
    }, `${sourceId}:native`);
  };

  const handleFocus = () => {
    emitEvent('focus', {}, `${sourceId}:native`);
  };

  const handleBlur = () => {
    emitEvent('unfocus', {}, `${sourceId}:native`);
  };

  return (
    <div className="mobx-text-root">
      {isEditable ? (
        <div
          ref={editableRef}
          className="mobx-text-content mobx-text-content-edit"
          contentEditable={true}
          suppressContentEditableWarning={true}
          data-placeholder={configComp.placeholder || ''}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onClick={handleClick}
          onFocus={handleFocus}
          onBlur={handleBlur}
        >
          {text}
        </div>
      ) : (
        <div
          ref={editableRef}
          className="mobx-text-content mobx-text-content-view"
          onClick={handleClick}
          onFocus={handleFocus}
          onBlur={handleBlur}
          tabIndex={0}
        >
          {text || configComp.placeholder || ''}
        </div>
      )}
    </div>
  );
});

TextBasic.displayName = 'TextBasic';

export default TextBasic;

function applyCaretByPoint(element: HTMLElement, x: number, y: number) {
  const documentAny = document as any;
  if (documentAny.caretRangeFromPoint) {
    const range = documentAny.caretRangeFromPoint(x, y);
    if (!range) return false;
    const selection = window.getSelection();
    if (!selection) return false;
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }
  if (documentAny.caretPositionFromPoint) {
    const position = documentAny.caretPositionFromPoint(x, y);
    if (!position) return false;
    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    const selection = window.getSelection();
    if (!selection) return false;
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }
  return false;
}

function applyCaretByDirection(
  element: HTMLElement,
  direction: string,
  mousePos?: { x?: number; y?: number; xRatio?: number },
) {
  if (mousePos) {
    const clampedPoint = getClampedMousePoint(element, mousePos, direction);
    if (applyCaretByPoint(element, clampedPoint.x, clampedPoint.y)) {
      return;
    }
  }

  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  range.selectNodeContents(element);
  const isStartDirection = direction === 'fromLeft' || direction === 'fromUp' || direction === 'fromAbove';
  range.collapse(isStartDirection);
  selection.removeAllRanges();
  selection.addRange(range);
}

function getClampedMousePoint(
  element: HTMLElement,
  mousePos: { x?: number; y?: number; xRatio?: number },
  direction: string,
) {
  const rect = element.getBoundingClientRect();
  const lineBounds = getTextLineBounds(element);
  const xMin = rect.left + 1;
  const xMax = rect.right - 1;
  const yMin = (lineBounds?.top ?? rect.top) + 1;
  const yMax = (lineBounds?.bottom ?? rect.bottom) - 1;

  const xRaw = Number.isFinite(mousePos.x)
    ? Number(mousePos.x)
    : (Number.isFinite(mousePos.xRatio) ? rect.left + rect.width * Number(mousePos.xRatio) : rect.left + rect.width / 2);
  const x = Math.min(xMax, Math.max(xMin, xRaw));

  let yTarget = Number.isFinite(mousePos.y) ? Number(mousePos.y) : rect.top + rect.height / 2;
  if (direction === 'fromAbove') {
    yTarget = yMin;
  } else if (direction === 'fromBelow') {
    yTarget = yMax;
  }
  const y = Math.min(yMax, Math.max(yMin, yTarget));

  return { x, y };
}

function getTextLineBounds(element: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(element);
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 || rect.height > 0);
  if (rects.length === 0) {
    return null;
  }
  let top = rects[0].top;
  let bottom = rects[0].bottom;
  for (const rect of rects) {
    if (rect.top < top) top = rect.top;
    if (rect.bottom > bottom) bottom = rect.bottom;
  }
  return { top, bottom };
}
