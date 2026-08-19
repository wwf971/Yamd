import type { CompData, SelectionTrackPoint } from '../../docStoreTypes';

function createBlockCompData(compId: string, dataComp: any, configComp: any, text: string): CompData {
  return {
    compId,
    compName: 'TextBlockSeg',
    childIdList: [],
    data: {
      ...(dataComp || {}),
      sourceId: compId,
      text,
    },
    config: { ...(configComp || {}) },
  };
}

// Mod+Enter splits the block at the caret into two blocks. Each result block
// is row-exclusive, so List-level split places them in two separate rows.
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
  return {
    code: 0,
    message: 'TextBlockSeg split result created.',
    data: {
      op: 'replaceSelf',
      compIdListOriginal: [compId],
      compListNext: [
        createBlockCompData(compId, dataComp, configComp, text.slice(0, offset)),
        createBlockCompData(compIdRight, dataComp, configComp, text.slice(offset)),
      ],
      focus: {
        compId: compIdRight,
        point: { offset: 0 },
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
    return { code: -1, message: 'TextBlockSeg is not editable.' };
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
    return {
      code: 0,
      message: 'Selection delete has no range.',
      data: { op: 'noop', compIdListOriginal: [compId], compListNext: [] },
    };
  }
  return {
    code: 0,
    message: 'TextBlockSeg selection delete result created.',
    data: {
      op: 'replaceSelf',
      compIdListOriginal: [compId],
      compListNext: [
        createBlockCompData(compId, dataComp, configComp, text.slice(0, offsetStart) + text.slice(offsetEnd)),
      ],
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
    return { code: -1, message: 'TextBlockSeg is not editable.' };
  }
  if (!point || point.segId !== compId) {
    return { code: -1, message: 'Selection point is not within this component.' };
  }
  if (side !== 'keepBefore' && side !== 'keepAfter') {
    return { code: -1, message: `Unsupported selection edge side. side=${side}` };
  }
  const text = String(dataComp?.text || '');
  const offset = Math.min(text.length, Math.max(0, Number(point.offset || 0)));
  const textNext = side === 'keepBefore'
    ? text.slice(0, offset)
    : text.slice(offset);
  return {
    code: 0,
    message: 'TextBlockSeg selection edge delete result created.',
    data: {
      op: 'replaceSelf',
      compIdListOriginal: [compId],
      compListNext: [createBlockCompData(compId, dataComp, configComp, textNext)],
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
    message: 'TextBlockSeg clipboard text created.',
    data: {
      text: text.slice(Math.min(offsetStart, offsetEnd), Math.max(offsetStart, offsetEnd)),
    },
  };
}
