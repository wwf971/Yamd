import type { DocStore } from '../docStore';
import type { CompEvent, CompEventResult, DocRecord } from '../docStoreTypes';

const createEventId = (length = 12) => {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let index = 0; index < length; index += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};

export async function docStoreSendEventToComp(
  store: DocStore,
  docId: string,
  compId: string,
  event: CompEvent,
): Promise<CompEventResult> {
  const docRecord = store.ensureDoc(docId);
  const compEntry = docRecord.compById[compId];
  if (!compEntry) {
    return { code: -1, message: `Component not found. compId=${compId}` };
  }

  const targetId = String(event?.targetId || '').trim();
  if (targetId && targetId !== docId) {
    return { code: -1, message: `Target mismatch. targetId=${targetId}, docId=${docId}` };
  }

  const eventNormalized = normalizeEvent(docId, event);
  const result = await compEntry.eventHandler(eventNormalized);
  const isHandled = result?.code === 0;
  if (isHandled) {
    return result;
  }

  return routeEventDefault(store, docId, compId, eventNormalized);
}

export async function docStoreSendEventToCompDirect(
  store: DocStore,
  docId: string,
  compId: string,
  event: CompEvent,
): Promise<CompEventResult> {
  const docRecord = store.ensureDoc(docId);
  const compEntry = docRecord.compById[compId];
  if (!compEntry) {
    return { code: -1, message: `Component not found. compId=${compId}` };
  }

  const targetId = String(event?.targetId || '').trim();
  if (targetId && targetId !== docId) {
    return { code: -1, message: `Target mismatch. targetId=${targetId}, docId=${docId}` };
  }

  const eventNormalized = normalizeEvent(docId, event);
  return compEntry.eventHandler(eventNormalized);
}

export async function docStoreSendEventToParent(
  store: DocStore,
  docId: string,
  compId: string,
  event: CompEvent,
): Promise<CompEventResult> {
  const docRecord = store.ensureDoc(docId);
  const compEntry = docRecord.compById[compId];
  if (!compEntry) {
    return { code: -1, message: `Component not found. compId=${compId}` };
  }
  const compIdParent = store.getParentCompId(docId, compId) || compEntry.parentId;
  if (!compIdParent) {
    return { code: -1, message: `No parent component. compId=${compId}` };
  }
  return docStoreSendEventToComp(store, docId, compIdParent, event);
}

export async function docStoreSendEventToDoc(
  store: DocStore,
  docId: string,
  event: CompEvent,
): Promise<CompEventResult> {
  const docRecord = store.ensureDoc(docId);
  const dataDoc = docRecord.data;
  const eventNormalized = normalizeEvent(docId, event);
  dataDoc.lastEventType = eventNormalized.type;

  const compIdTarget = pickDocEventTarget(docRecord, eventNormalized);
  if (!compIdTarget) {
    return { code: -1, message: `No document event target. type=${eventNormalized.type}` };
  }

  const eventForwarded = rewriteDocEventForTarget(docRecord, eventNormalized, compIdTarget);
  if (isStoreOwnedEvent(eventForwarded.type)) {
    return docStoreReceiveEvent(store, docId, eventForwarded);
  }
  return docStoreSendEventToComp(store, docId, compIdTarget, eventForwarded);
}

export async function docStoreReceiveEvent(
  store: DocStore,
  docId: string,
  event: CompEvent,
): Promise<CompEventResult> {
  const docRecord = store.ensureDoc(docId);
  const dataDoc = docRecord.data;
  const eventNormalized = normalizeEvent(docId, event);
  dataDoc.lastEventType = eventNormalized.type;

  if (eventNormalized.type === 'sendEventToTarget') {
    const compIdTarget = String(eventNormalized?.data?.compIdTarget || '').trim();
    const eventNested = eventNormalized?.data?.event;
    if (!compIdTarget || !eventNested) {
      return { code: -1, message: 'sendEventToTarget requires compIdTarget and event.' };
    }
    return docStoreSendEventToCompDirect(store, docId, compIdTarget, eventNested);
  }

  if (eventNormalized.type === 'sendEventToDoc') {
    const eventDoc = eventNormalized?.data?.event;
    if (!eventDoc) {
      return { code: -1, message: 'sendEventToDoc requires event.' };
    }
    return docStoreSendEventToDoc(store, docId, eventDoc);
  }

  if (eventNormalized.type === 'focus') {
    const segIdFocused = String(eventNormalized?.data?.segId || '');
    if (segIdFocused) {
      store.segFocus(docId, segIdFocused, Number(eventNormalized?.data?.offset || 0), String(eventNormalized?.data?.reason || eventNormalized.type));
    } else {
      store.compIdFocus(docId, eventNormalized.sourceId, String(eventNormalized?.data?.reason || eventNormalized.type));
    }
    return { code: 0, message: 'Focus event received.' };
  }

  if (eventNormalized.type === 'unfocus') {
    const resultParent = await docStoreSendEventToParent(store, docId, eventNormalized.sourceId, eventNormalized);
    if (resultParent.code === 0) {
      return resultParent;
    }
    return routeEventDefault(store, docId, eventNormalized.sourceId, eventNormalized);
  }

  if (eventNormalized.type === 'clickSingle') {
    const segIdFocused = String(eventNormalized?.data?.segId || '');
    if (segIdFocused) {
      store.segFocus(docId, segIdFocused, Number(eventNormalized?.data?.offset || 0), String(eventNormalized?.data?.reason || eventNormalized.type));
    } else {
      store.compIdFocus(docId, eventNormalized.sourceId, String(eventNormalized?.data?.reason || eventNormalized.type));
    }
    return { code: 0, message: 'Click event received.' };
  }

  if (eventNormalized.type === 'keyDown') {
    return { code: 0, message: 'Key down event received.' };
  }

  if (
    eventNormalized.type === 'childSplitAttempt'
    || eventNormalized.type === 'childMergePrevAttempt'
    || eventNormalized.type === 'childDeleteAttempt'
    || eventNormalized.type === 'childSelectionDeleteAttempt'
    || eventNormalized.type === 'childPasteAttempt'
    || eventNormalized.type === 'rowSplitAttempt'
    || eventNormalized.type === 'rowSelectionDeleteAttempt'
    || eventNormalized.type === 'rowIndentAttempt'
    || eventNormalized.type === 'rowOutdentAttempt'
    || eventNormalized.type === 'rowMergePrevAttempt'
    || eventNormalized.type === 'rowDeleteAttempt'
  ) {
    return docStoreSendEventToParent(store, docId, eventNormalized.sourceId, eventNormalized);
  }

  if (eventNormalized.type === 'segNavigate' || eventNormalized.type === 'rowNavigate') {
    return docStoreSendEventToParent(store, docId, eventNormalized.sourceId, eventNormalized);
  }

  return { code: -1, message: `Unsupported event: ${eventNormalized.type}` };
}

export async function docStoreOnEvent(
  store: DocStore,
  docId: string,
  event: CompEvent,
): Promise<CompEventResult> {
  return docStoreReceiveEvent(store, docId, event);
}

async function routeEventDefault(
  store: DocStore,
  docId: string,
  compId: string,
  event: CompEvent,
): Promise<CompEventResult> {
  const docRecord = store.ensureDoc(docId);
  if (event.type !== 'unfocus') {
    return { code: -1, message: `Unhandled event. type=${event.type}` };
  }

  const direction = String(event?.data?.direction || '');
  const compIndex = docRecord.compOrder.indexOf(compId);
  if (compIndex === -1) {
    return { code: -1, message: `Component not in order list. compId=${compId}` };
  }

  if (direction === 'left' && compIndex > 0) {
    const compIdPrev = docRecord.compOrder[compIndex - 1];
    return docStoreSendEventToComp(store, docId, compIdPrev, {
      type: 'focus',
      sourceId: event.sourceId,
      targetId: docId,
      data: { direction: 'fromRight' },
    });
  }

  if (direction === 'right' && compIndex < docRecord.compOrder.length - 1) {
    const compIdNext = docRecord.compOrder[compIndex + 1];
    return docStoreSendEventToComp(store, docId, compIdNext, {
      type: 'focus',
      sourceId: event.sourceId,
      targetId: docId,
      data: { direction: 'fromLeft' },
    });
  }

  if (direction === 'up' || direction === 'down') {
    return docStoreSendEventToParent(store, docId, compId, event);
  }

  return { code: -1, message: `No default route for direction=${direction}` };
}

function normalizeEvent(docId: string, event: CompEvent): CompEvent {
  return {
    id: String(event?.id || createEventId()),
    type: String(event?.type || ''),
    sourceId: String(event?.sourceId || 'unknown'),
    targetId: docId,
    data: event?.data ?? {},
  };
}

function pickDocEventTarget(docRecord: DocRecord, event: CompEvent) {
  const compIdExplicit = String(event?.data?.compIdTarget || '').trim();
  if (compIdExplicit && docRecord.compDataById[compIdExplicit]) {
    return compIdExplicit;
  }

  const focusState = docRecord.interactionState.focusState;
  if (shouldDocEventPreferFocusedSeg(event.type)) {
    const compIdFocused = String(focusState.compIdFocused || '');
    const compIdRowTarget = shouldDocEventPreferFocusedRow(event.type)
      ? getRowTargetFromFocusedComp(docRecord, compIdFocused)
      : '';
    if (compIdRowTarget) {
      return compIdRowTarget;
    }
    if (compIdFocused && docRecord.compDataById[compIdFocused]) {
      return compIdFocused;
    }
    const segIdFocused = String(focusState.segIdFocused || '');
    if (segIdFocused && docRecord.compDataById[segIdFocused]) {
      return segIdFocused;
    }
  }

  const compIdRoot = String(docRecord.compIdRoot || '');
  const compIdMain = findFirstDocEventTargetFromComp(docRecord, compIdRoot);
  if (compIdMain) {
    return compIdMain;
  }

  return docRecord.compOrder[0] || String(focusState.compIdFocused || '');
}

function rewriteDocEventForTarget(docRecord: DocRecord, event: CompEvent, compIdTarget: string): CompEvent {
  const compIdSource = getSourceCompIdForDocEvent(docRecord, event, compIdTarget);
  return {
    ...event,
    sourceId: compIdSource,
    data: event.data || {},
  };
}

function getSourceCompIdForDocEvent(docRecord: DocRecord, event: CompEvent, compIdTarget: string) {
  if (!isStoreOwnedEvent(event.type)) {
    return compIdTarget;
  }
  const focusState = docRecord.interactionState.focusState;
  const compIdFocused = String(focusState.compIdFocused || '');
  if (compIdFocused && docRecord.compDataById[compIdFocused]) {
    return compIdFocused;
  }
  return compIdTarget;
}

function shouldDocEventPreferFocusedSeg(type: string) {
  return [
    'childSplitAttempt',
    'childMergePrevAttempt',
    'childDeleteAttempt',
    'childSelectionDeleteAttempt',
    'childPasteAttempt',
    'rowSplitAttempt',
    'rowSelectionDeleteAttempt',
    'rowIndentAttempt',
    'rowOutdentAttempt',
    'rowMergePrevAttempt',
    'rowDeleteAttempt',
    'segNavigate',
    'rowNavigate',
  ].includes(type);
}

function shouldDocEventPreferFocusedRow(type: string) {
  return [
    'rowSplitAttempt',
    'rowSelectionDeleteAttempt',
    'rowIndentAttempt',
    'rowOutdentAttempt',
    'rowMergePrevAttempt',
    'rowDeleteAttempt',
    'rowNavigate',
  ].includes(type);
}

function isStoreOwnedEvent(type: string) {
  return [].includes(type);
}

function findFirstDocEventTargetFromComp(docRecord: DocRecord, compId: string): string {
  const compData = docRecord.compDataById[compId];
  if (!compData) return '';
  const compName = String(compData.compName || '');
  if (['TextBasic', 'List', 'Row'].includes(compName)) {
    return compId;
  }
  const childIdList = [
    String(compData.mainCompId || ''),
    ...(Array.isArray(compData.childIdList) ? compData.childIdList.map((id) => String(id || '')) : []),
  ].filter(Boolean);
  for (const childId of childIdList) {
    const compIdFound = findFirstDocEventTargetFromComp(docRecord, childId);
    if (compIdFound) {
      return compIdFound;
    }
  }
  return '';
}

function getRowTargetFromFocusedComp(docRecord: DocRecord, compIdFocused: string) {
  const compDataFocused = docRecord.compDataById[String(compIdFocused || '')];
  const compName = String(compDataFocused?.compName || '');
  if (compName === 'Row') {
    return String(compDataFocused.compId || '');
  }
  if (compName === 'List') {
    const mainCompId = String(compDataFocused.mainCompId || '');
    if (isCompName(docRecord, mainCompId, 'Row')) {
      return mainCompId;
    }
    return findFirstRowFromComp(docRecord, compDataFocused.compId);
  }
  return '';
}

function findFirstRowFromComp(docRecord: DocRecord, compId: string): string {
  const compData = docRecord.compDataById[String(compId || '')];
  if (!compData) return '';
  if (String(compData.compName || '') === 'Row') {
    return String(compData.compId || '');
  }
  const mainCompId = String(compData.mainCompId || '');
  if (mainCompId) {
    const rowIdMain = findFirstRowFromComp(docRecord, mainCompId);
    if (rowIdMain) return rowIdMain;
  }
  const childIdList = Array.isArray(compData.childIdList) ? compData.childIdList : [];
  for (const childId of childIdList) {
    const rowIdChild = findFirstRowFromComp(docRecord, String(childId || ''));
    if (rowIdChild) return rowIdChild;
  }
  return '';
}

function isCompName(docRecord: DocRecord, compId: string, compName: string) {
  if (!compId) return false;
  return String(docRecord.compDataById[compId]?.compName || '') === compName;
}
