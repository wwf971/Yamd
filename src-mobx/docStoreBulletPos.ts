import type { DocStore } from './docStore';
import type { CompBulletPosState, DocRecord } from './docStoreTypes';
import { docStoreIsSegment } from './docStoreSegment';

const createCompBulletPosState = (): CompBulletPosState => ({
  isBulletMeasureEnabled: true,
  counterBulletMeasureReq: 0,
  counterBulletMeasureDone: 0,
  compIdRequester: '',
  compIdBasis: '',
  compIdProvider: '',
  posYBulletPreferred: null,
  messageBulletMeasure: '',
});

export function docStoreGetCompBulletPosState(
  store: DocStore,
  docId: string,
  compId: string,
) {
  const docRecord = store.ensureDoc(docId);
  const compIdSafe = String(compId || '');
  if (!compIdSafe) {
    return createCompBulletPosState();
  }
  if (!docRecord.interactionState.bulletPosStateByCompId[compIdSafe]) {
    docRecord.interactionState.bulletPosStateByCompId[compIdSafe] = createCompBulletPosState();
  }
  return docRecord.interactionState.bulletPosStateByCompId[compIdSafe];
}

export function docStoreRequestCompBulletPos(
  store: DocStore,
  docId: string,
  compIdTarget: string,
  request: Partial<CompBulletPosState> = {},
) {
  const state = store.getCompBulletPosState(docId, compIdTarget);
  state.isBulletMeasureEnabled = request.isBulletMeasureEnabled !== false;
  state.counterBulletMeasureReq += 1;
  state.compIdRequester = String(request.compIdRequester || '');
  state.compIdBasis = String(request.compIdBasis || compIdTarget || '');
  state.compIdProvider = String(request.compIdProvider || '');
  state.posYBulletPreferred = null;
  state.messageBulletMeasure = 'requested';
  return { code: 0, message: 'Bullet position requested.' };
}

export function docStoreUpdateCompBulletPosResult(
  store: DocStore,
  docId: string,
  compIdTarget: string,
  result: Partial<CompBulletPosState> = {},
) {
  const state = store.getCompBulletPosState(docId, compIdTarget);
  const compIdBasisResult = result.compIdBasis !== undefined
    ? String(result.compIdBasis || '')
    : state.compIdBasis;
  if (compIdBasisResult && state.compIdBasis && compIdBasisResult !== state.compIdBasis) {
    return { code: -1, message: 'Stale bullet position ignored.' };
  }
  state.counterBulletMeasureDone += 1;
  state.posYBulletPreferred = Number.isFinite(result.posYBulletPreferred)
    ? Number(result.posYBulletPreferred)
    : null;
  state.messageBulletMeasure = String(result.messageBulletMeasure || '');
  if (result.compIdProvider !== undefined) {
    state.compIdProvider = String(result.compIdProvider || '');
  }
  if (result.compIdBasis !== undefined) {
    state.compIdBasis = String(result.compIdBasis || '');
  }
  return { code: 0, message: 'Bullet position updated.' };
}

export function docStorePickCompBulletProviderId(
  store: DocStore,
  docId: string,
  compId: string,
) {
  const docRecord = store.ensureDoc(docId);
  const compData = docRecord.compDataById[String(compId || '')];
  const compName = String(compData?.compName || '');
  if (docStoreIsSegment(docRecord, String(compData?.compId || ''))) {
    return compData.compId;
  }
  if (compName === 'List') {
    const compIdMain = String(compData.mainCompId || '').trim();
    return isCompName(docRecord, compIdMain, 'Row') ? compIdMain : '';
  }
  if (compName === 'Row') {
    const childIdList = Array.isArray(compData.childIdList) ? compData.childIdList : [];
    return childIdList.map((childId) => String(childId || '')).find((childId) => (
      isCompBulletPosProvider(docRecord, childId)
    )) || '';
  }
  return '';
}

function isCompName(docRecord: DocRecord, compId: string, compName: string) {
  if (!compId) return false;
  return String(docRecord.compDataById[compId]?.compName || '') === compName;
}

function isCompBulletPosProvider(docRecord: DocRecord, compId: string) {
  return docStoreIsSegment(docRecord, compId);
}
