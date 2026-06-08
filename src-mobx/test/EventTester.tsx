import React from 'react';
import { LeftIcon, RightIcon, UpIcon, DownIcon } from '@wwf971/react-comp-misc';
import { observer } from 'mobx-react-lite';
import { useDocStoreContext } from '../DocStoreContext';
import type { CompEvent } from '../docStoreTypes';
import { useDocUnfocusBoundary } from '../util/useDocUnfocusBoundary';
import { useDocCompRenderContext } from './DocCompRenderContext';
import './testMobx.css';

type EventTesterProps = {
  data?: {
    compId?: string;
    sourceId?: string;
    targetId?: string;
  };
  config?: {
    isInline?: boolean;
  };
  onEvent?: (event: CompEvent) => Promise<any> | any;
  onDataChange?: (dataPatch: Record<string, any>) => Promise<any> | any;
};

const EventTester = observer(({ data = {}, config = {}, onEvent, onDataChange }: EventTesterProps) => {
  const contextDocStore = useDocStoreContext();
  const { renderCompListByParentId } = useDocCompRenderContext();
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const docAreaRef = React.useRef<HTMLDivElement | null>(null);
  const isFocusWithinPrevRef = React.useRef(false);
  const compId = String(data.compId || '');
  const compData = contextDocStore && compId
    ? contextDocStore.store.getCompDataById(contextDocStore.docId, compId)
    : null;
  const dataComp = compData?.data || data || {};
  const configComp = compData?.config || config || {};
  const isInline = configComp.isInline === true;
  const compIdTarget = String(dataComp.compIdTarget || compData?.childIdList?.[0] || '');
  const runtimeState = contextDocStore && compId
    ? contextDocStore.store.getCompRuntimeState(contextDocStore.docId, compId)
    : null;
  const isFocusWithin = runtimeState?.isFocusWithin === true;

  const [focusXPercent, setFocusXPercent] = React.useState(50);
  const [targetId, setTargetId] = React.useState(String(data.targetId || ''));
  const [sourceId, setSourceId] = React.useState(String(data.sourceId || 'event-tester'));
  const [logs, setLogs] = React.useState<any[]>([]);
  const idRef = React.useRef(1);

  React.useEffect(() => {
    setTargetId(String(dataComp.targetId || contextDocStore?.docId || ''));
  }, [dataComp.targetId, contextDocStore?.docId]);

  React.useEffect(() => {
    setSourceId(String(dataComp.sourceId || compId || 'event-tester'));
  }, [dataComp.sourceId, compId]);

  React.useLayoutEffect(() => {
    if (!contextDocStore || !compId) return undefined;
    const rootEl = rootRef.current;
    if (!rootEl) return undefined;
    contextDocStore.store.registerCompElement(contextDocStore.docId, compId, rootEl);
    return () => {
      contextDocStore.store.unregisterCompElement(contextDocStore.docId, compId, rootEl);
    };
  }, [contextDocStore, compId]);

  React.useEffect(() => {
    const wasFocusWithin = isFocusWithinPrevRef.current;
    isFocusWithinPrevRef.current = isFocusWithin;
    if (!wasFocusWithin || isFocusWithin) return;
    const docAreaEl = docAreaRef.current;
    if (!docAreaEl) return;
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && docAreaEl.contains(activeElement)) {
      activeElement.blur();
    }
    const selection = window.getSelection?.();
    if (selection && selection.rangeCount > 0) {
      selection.removeAllRanges();
    }
  }, [isFocusWithin]);

  useDocUnfocusBoundary({
    store: contextDocStore?.store,
    docId: String(contextDocStore?.docId || ''),
    focusAreaRef: docAreaRef,
    triggerAreaRef: rootRef,
    compIdFocusOnBoundary: compId,
    reason: 'eventTesterDocUnfocus',
  });

  const pushLog = React.useCallback((direction: string, eventType: string, dataEvent: any) => {
    setLogs((prev) => {
      const next = [
        {
          id: idRef.current,
          direction,
          eventType,
          eventData: dataEvent,
          time: new Date().toLocaleTimeString(),
        },
        ...prev,
      ];
      idRef.current += 1;
      return next.slice(0, 80);
    });
  }, []);

  const sendWrappedEvent = React.useCallback(async (eventTarget: CompEvent) => {
    const eventTester: CompEvent = {
      type: 'sendEventToDoc',
      sourceId,
      targetId,
      data: {
        event: eventTarget,
      },
    };
    pushLog('in', eventTarget.type, eventTarget);
    const result = onEvent ? await onEvent(eventTester) : { code: -1, message: 'No target connected.' };
    pushLog('in-result', eventTarget.type, result || { code: -1, message: 'No result' });
  }, [pushLog, onEvent, sourceId, targetId]);

  const sendEvent = React.useCallback(async (type: string, dataEvent: any = {}) => {
    await sendWrappedEvent({
      type,
      sourceId,
      targetId,
      data: dataEvent,
    });
  }, [sendWrappedEvent, sourceId, targetId]);

  return (
    <div
      ref={rootRef}
      className={`event-tester-root ${isInline ? 'is-inline' : ''}`}
      data-mobx-comp-id={compId}
      data-mobx-comp-name="EventTester"
    >
      <div className="event-tester-title-row">
        <div className="event-tester-title">Event Tester</div>
        <button type="button" className="event-btn event-btn-sub" onClick={() => setLogs([])}>
          Clear
        </button>
      </div>
      <div ref={docAreaRef} className="event-tester-doc-area">
        {compId ? renderCompListByParentId(compId) : null}
      </div>

      <div className="event-input-row">
        <label className="event-inline-field">
          <div className="event-label">sourceId</div>
          <input value={sourceId} onChange={(event) => setSourceId(event.target.value)} className="event-input-short" />
        </label>
        <label className="event-inline-field">
          <div className="event-label">targetId</div>
          <input value={targetId} onChange={(event) => setTargetId(event.target.value)} className="event-input-short" />
        </label>
        <label className="event-inline-field">
          <div className="event-label">data target</div>
          <input value={compIdTarget} readOnly className="event-input-short" />
        </label>
      </div>

      <div className="event-slider-row">
        <input
          type="range"
          min={0}
          max={100}
          value={focusXPercent}
          onChange={(event) => setFocusXPercent(Number(event.target.value))}
          className="event-slider"
        />
        <div className="event-slider-value">{focusXPercent}%</div>
      </div>

      <div className="event-focus-grid">
        <div className="event-focus-empty" />
        <button type="button" className="event-btn event-btn-icon" onClick={() => sendEvent('focus', { direction: 'fromUp' })}>
          <span className="event-btn-icon-glyph"><DownIcon /></span>
          <span>up</span>
        </button>
        <button
          type="button"
          className="event-btn event-btn-icon"
          onClick={() => sendEvent('focus', { direction: 'fromAbove', mousePos: { xRatio: focusXPercent / 100 } })}
        >
          <span className="event-btn-icon-glyph"><DownIcon /></span>
          <span>up(mouse)</span>
        </button>
        <div className="event-focus-empty" />

        <button type="button" className="event-btn event-btn-icon" onClick={() => sendEvent('focus', { direction: 'fromLeft' })}>
          <span className="event-btn-icon-glyph"><RightIcon /></span>
          <span>left</span>
        </button>
        <div className="event-focus-empty" />
        <div className="event-focus-empty" />
        <button type="button" className="event-btn event-btn-icon" onClick={() => sendEvent('focus', { direction: 'fromRight' })}>
          <span className="event-btn-icon-glyph"><LeftIcon /></span>
          <span>right</span>
        </button>

        <div className="event-focus-empty" />
        <button type="button" className="event-btn event-btn-icon" onClick={() => sendEvent('focus', { direction: 'fromDown' })}>
          <span className="event-btn-icon-glyph"><UpIcon /></span>
          <span>down</span>
        </button>
        <button
          type="button"
          className="event-btn event-btn-icon"
          onClick={() => sendEvent('focus', { direction: 'fromBelow', mousePos: { xRatio: focusXPercent / 100 } })}
        >
          <span className="event-btn-icon-glyph"><UpIcon /></span>
          <span>down(mouse)</span>
        </button>
        <div className="event-focus-empty" />
      </div>

      <div className="event-btn-group">
        <button
          type="button"
          className="event-btn"
          onClick={() => sendEvent('clickSingle', { mousePos: { xRatio: focusXPercent / 100 } })}
        >
          clickSingle
        </button>
        <button type="button" className="event-btn" onClick={() => sendEvent('unfocus', { direction: 'left' })}>
          unfocus left
        </button>
        <button type="button" className="event-btn" onClick={() => sendEvent('unfocus', { direction: 'right' })}>
          unfocus right
        </button>
        <button
          type="button"
          className="event-btn event-btn-sub"
          onClick={async () => {
            if (!onDataChange) {
              pushLog('in-result', 'setTextData', { code: -1, message: 'No data-change handler.' });
              return;
            }
            const result = await onDataChange({
              compIdTarget,
              dataPatch: {
                text: `TextBasic text updated by EventTester.
Line 2 keeps explicit break.
Line 3 checks wrapping in narrow width.`,
              },
            });
            pushLog('in-result', 'setTextData', result || { code: -1, message: 'No result' });
          }}
        >
          Quick setTextData
        </button>
      </div>

      <div className="event-log-title">Event Log</div>
      <div className="event-log-list">
        {logs.map((log) => (
          <div className="event-log-item" key={log.id}>
            [{log.time}] {log.direction} {log.eventType} {JSON.stringify(log.eventData)}
          </div>
        ))}
      </div>
    </div>
  );
});

export default EventTester;
