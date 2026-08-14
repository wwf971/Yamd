import type { CompData, SelectionTrackPoint } from '../../docStoreTypes';

export function createSelfSplitResult({
  compId,
  compIdRight,
  dataComp,
  configComp,
  offsetRaw,
}: {
  compId: string;
  compIdRight: string;
  dataComp: any;
  configComp: any;
  offsetRaw: number;
}) {
  const text = String(dataComp?.text || '');
  const offset = Math.min(text.length, Math.max(0, Number(offsetRaw || 0)));
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

export function createSelfMergeResult({
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

export function createSelfSelectionDeleteResult({
  compId,
  dataComp,
  configComp,
  pointAnchor,
  pointFocus,
}: {
  compId: string;
  dataComp: any;
  configComp: any;
  pointAnchor: SelectionTrackPoint | null | undefined;
  pointFocus: SelectionTrackPoint | null | undefined;
}) {
  if (configComp?.isEditable !== true) {
    return { code: -1, message: 'TextSeg is not editable.' };
  }
  if (!pointAnchor || !pointFocus || pointAnchor.segId !== compId || pointFocus.segId !== compId) {
    return { code: -1, message: 'Selection is not within this component.' };
  }
  const text = String(dataComp?.text || '');
  const offsetStart = Math.min(
    text.length,
    Math.max(0, Math.min(Number(pointAnchor.offset || 0), Number(pointFocus.offset || 0))),
  );
  const offsetEnd = Math.min(
    text.length,
    Math.max(0, Math.max(Number(pointAnchor.offset || 0), Number(pointFocus.offset || 0))),
  );
  if (offsetStart === offsetEnd) {
    return { code: 0, message: 'Selection delete has no range.', data: { op: 'noop', compIdListOriginal: [compId], compListNext: [] } };
  }
  const compDataNext: CompData = {
    compId,
    compName: 'TextSeg',
    childIdList: [],
    data: {
      ...(dataComp || {}),
      sourceId: compId,
      text: text.slice(0, offsetStart) + text.slice(offsetEnd),
    },
    config: { ...(configComp || {}) },
  };
  return {
    code: 0,
    message: 'TextSeg selection delete result created.',
    data: {
      op: 'replaceSelf',
      compIdListOriginal: [compId],
      compListNext: [compDataNext],
      focus: {
        compId,
        point: { offset: offsetStart },
      },
    },
  };
}

export function createSelfSelectionEdgeDeleteResult({
  compId,
  dataComp,
  configComp,
  point,
  side,
}: {
  compId: string;
  dataComp: any;
  configComp: any;
  point: SelectionTrackPoint | null | undefined;
  side: string;
}) {
  if (configComp?.isEditable !== true) {
    return { code: -1, message: 'TextSeg is not editable.' };
  }
  if (!point || point.segId !== compId) {
    return { code: -1, message: 'Selection point is not within this component.' };
  }
  const text = String(dataComp?.text || '');
  const offset = Math.min(text.length, Math.max(0, Number(point.offset || 0)));
  const textNext = side === 'keepBefore'
    ? text.slice(0, offset)
    : text.slice(offset);
  if (side !== 'keepBefore' && side !== 'keepAfter') {
    return { code: -1, message: `Unsupported selection edge side. side=${side}` };
  }
  const compDataNext: CompData = {
    compId,
    compName: 'TextSeg',
    childIdList: [],
    data: {
      ...(dataComp || {}),
      sourceId: compId,
      text: textNext,
    },
    config: { ...(configComp || {}) },
  };
  return {
    code: 0,
    message: 'TextSeg selection edge delete result created.',
    data: {
      op: 'replaceSelf',
      compIdListOriginal: [compId],
      compListNext: [compDataNext],
      focus: {
        compId,
        point: { offset: side === 'keepBefore' ? textNext.length : 0 },
      },
    },
  };
}

export function createSelfClipboardTextResult({
  dataComp,
  offsetStartRaw,
  offsetEndRaw,
}: {
  dataComp: any;
  offsetStartRaw: number | undefined;
  offsetEndRaw: number | undefined;
}) {
  const text = String(dataComp?.text || '');
  const offsetStart = Number.isFinite(Number(offsetStartRaw))
    ? Math.min(text.length, Math.max(0, Number(offsetStartRaw)))
    : 0;
  const offsetEnd = Number.isFinite(Number(offsetEndRaw))
    ? Math.min(text.length, Math.max(0, Number(offsetEndRaw)))
    : text.length;
  return {
    code: 0,
    message: 'TextSeg clipboard text created.',
    data: {
      text: text.slice(Math.min(offsetStart, offsetEnd), Math.max(offsetStart, offsetEnd)),
    },
  };
}
