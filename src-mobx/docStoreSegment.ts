import type { CompData, DocRecord } from './docStoreTypes';

export function docStoreGetOwningRowId(docRecord: DocRecord, compIdSegment: string) {
  const compIdSegmentSafe = String(compIdSegment || '');
  for (const compData of Object.values(docRecord.compDataById || {})) {
    if (String(compData.compName || '') !== 'Row') continue;
    if (getChildIdList(compData).includes(compIdSegmentSafe)) {
      return String(compData.compId || '');
    }
  }
  return '';
}

export function docStoreIsSegment(docRecord: DocRecord, compId: string) {
  return Boolean(docStoreGetOwningRowId(docRecord, compId));
}

export function docStoreGetSegmentIdListInRow(docRecord: DocRecord, rowId: string) {
  const rowData = docRecord.compDataById[String(rowId || '')];
  if (String(rowData?.compName || '') !== 'Row') return [];
  return getChildIdList(rowData).filter((compId) => Boolean(docRecord.compDataById[compId]));
}

export function docStoreCollectSegmentIds(docRecord: DocRecord) {
  const compIdList: string[] = [];
  collectSegmentIdsFromComp(docRecord, String(docRecord.compIdRoot || ''), compIdList, new Set<string>());
  return compIdList;
}

export function docStoreGetSegmentText(compData: CompData | null | undefined) {
  const fieldName = getSegmentTextFieldName(compData);
  return String(compData?.data?.[fieldName] || '');
}

export function docStoreSetSegmentText(compData: CompData, textNext: string) {
  const fieldName = getSegmentTextFieldName(compData);
  compData.data = {
    ...(compData.data || {}),
    [fieldName]: String(textNext ?? ''),
  };
}

export function docStoreCloneSegmentWithText(
  compDataTemplate: CompData,
  compId: string,
  text: string,
): CompData {
  const compDataNext: CompData = {
    ...compDataTemplate,
    compId,
    childIdList: [],
    data: { ...(compDataTemplate.data || {}) },
    config: { ...(compDataTemplate.config || {}) },
  };
  if (compDataNext.data?.sourceId === compDataTemplate.compId) {
    compDataNext.data.sourceId = compId;
  }
  docStoreSetSegmentText(compDataNext, text);
  return compDataNext;
}

function collectSegmentIdsFromComp(
  docRecord: DocRecord,
  compId: string,
  compIdList: string[],
  compIdSetVisited: Set<string>,
) {
  const compIdSafe = String(compId || '');
  if (!compIdSafe || compIdSetVisited.has(compIdSafe)) return;
  compIdSetVisited.add(compIdSafe);
  const compData = docRecord.compDataById[compIdSafe];
  if (!compData) return;
  if (String(compData.compName || '') === 'Row') {
    compIdList.push(...docStoreGetSegmentIdListInRow(docRecord, compIdSafe));
    return;
  }
  const mainCompId = String(compData.mainCompId || '');
  if (mainCompId) {
    collectSegmentIdsFromComp(docRecord, mainCompId, compIdList, compIdSetVisited);
  }
  for (const childId of getChildIdList(compData)) {
    collectSegmentIdsFromComp(docRecord, childId, compIdList, compIdSetVisited);
  }
}

export function docStoreGetSegmentTextFieldName(compData: CompData | null | undefined) {
  return getSegmentTextFieldName(compData);
}

function getSegmentTextFieldName(compData: CompData | null | undefined) {
  return String(compData?.config?.fieldNameText || 'text');
}

function getChildIdList(compData: CompData | null | undefined) {
  return Array.isArray(compData?.childIdList)
    ? compData.childIdList.map((compId) => String(compId || '')).filter(Boolean)
    : [];
}
