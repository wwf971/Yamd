import type { CompData, SelectionTrackPoint } from '../../docStoreTypes';
import type { SegPasteInlinePart } from '../../docStoreSegTrait';

export const COMP_NAME_MATH_INLINE = 'MathInlineSeg';

// MathInlineSeg is atomic for selection: its logical text length is 1.
// Offset 0 means "before the segment", offset 1 (or larger, when a DOM read
// produced a bigger number) means "after the segment". A selection range
// either covers the whole segment or does not touch its content.

function createCompDataWithText(
  compId: string,
  dataComp: any,
  configComp: any,
  textNext: string,
): CompData {
  return {
    compId,
    compName: COMP_NAME_MATH_INLINE,
    childIdList: [],
    data: {
      ...(dataComp || {}),
      sourceId: compId,
      text: String(textNext ?? ''),
    },
    config: { ...(configComp || {}) },
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
    return { code: -1, message: 'MathInlineSeg is not editable.' };
  }
  if (!pointAnchor || !pointFocus || pointAnchor.segId !== compId || pointFocus.segId !== compId) {
    return { code: -1, message: 'Selection is not within this component.' };
  }
  const offsetMin = Math.min(Number(pointAnchor.offset || 0), Number(pointFocus.offset || 0));
  const offsetMax = Math.max(Number(pointAnchor.offset || 0), Number(pointFocus.offset || 0));
  const isCovered = offsetMin <= 0 && offsetMax >= 1;
  if (!isCovered) {
    return {
      code: 0,
      message: 'Selection delete has no range.',
      data: { op: 'noop', compIdListOriginal: [compId], compListNext: [] },
    };
  }
  // The covered segment keeps its identity with an empty source (rendered as
  // the $$ placeholder). A following Backspace on the empty segment deletes
  // it entirely.
  return {
    code: 0,
    message: 'MathInlineSeg selection delete result created.',
    data: {
      op: 'replaceSelf',
      compIdListOriginal: [compId],
      compListNext: [createCompDataWithText(compId, dataComp, configComp, '')],
      focus: {
        compId,
        point: { offset: 0 },
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
    return { code: -1, message: 'MathInlineSeg is not editable.' };
  }
  if (!point || point.segId !== compId) {
    return { code: -1, message: 'Selection point is not within this component.' };
  }
  if (side !== 'keepBefore' && side !== 'keepAfter') {
    return { code: -1, message: `Unsupported selection edge side. side=${side}` };
  }
  const offset = Number(point.offset || 0);
  const text = String(dataComp?.text || '');
  // keepBefore with the point after the segment keeps the whole segment;
  // keepBefore with the point before it means the segment is fully inside the
  // deleted range, so the source clears. keepAfter mirrors this.
  const isKeptWhole = side === 'keepBefore' ? offset >= 1 : offset <= 0;
  const textNext = isKeptWhole ? text : '';
  return {
    code: 0,
    message: 'MathInlineSeg selection edge delete result created.',
    data: {
      op: 'replaceSelf',
      compIdListOriginal: [compId],
      compListNext: [createCompDataWithText(compId, dataComp, configComp, textNext)],
      focus: {
        compId,
        point: { offset: side === 'keepBefore' && isKeptWhole ? 1 : 0 },
      },
    },
  };
}

// Clipboard serialization: the whole segment becomes $source$. Also used by
// the createClipboardText trait, so the synchronous copy path produces the
// same text without asking the mounted component.
export function createMathClipboardText(
  compData: CompData | null | undefined,
  offsetStartRaw?: number,
  offsetEndRaw?: number,
) {
  const text = String(compData?.data?.text || '');
  const offsetStart = Number.isFinite(Number(offsetStartRaw)) ? Number(offsetStartRaw) : 0;
  const offsetEnd = Number.isFinite(Number(offsetEndRaw)) ? Number(offsetEndRaw) : 1;
  const isCovered = Math.min(offsetStart, offsetEnd) <= 0 && Math.max(offsetStart, offsetEnd) >= 1;
  return isCovered ? `$${text}$` : '';
}

// Paste recognition for the parsePasteInline trait. A pair of unescaped $
// whose content is non-empty, contains no $, and does not start or end with
// whitespace becomes one math segment. Everything between matches stays plain
// text for the paste target segment kind. Returns null when no math is found,
// so the generic plain-text paste takes over.
const REGEX_MATH_INLINE_PASTE = /(?<!\\)\$([^$\s](?:[^$]*[^$\s])?)\$/g;

export function parsePasteTextMathInline(textPaste: string): SegPasteInlinePart[] | null {
  const text = String(textPaste || '');
  if (!text.includes('$')) {
    return null;
  }
  const partList: SegPasteInlinePart[] = [];
  let indexAfterMatchLast = 0;
  let isMathFound = false;
  for (const match of text.matchAll(REGEX_MATH_INLINE_PASTE)) {
    const indexMatch = Number(match.index || 0);
    if (indexMatch > indexAfterMatchLast) {
      partList.push({ text: text.slice(indexAfterMatchLast, indexMatch) });
    }
    partList.push({ compName: COMP_NAME_MATH_INLINE, text: match[1] });
    isMathFound = true;
    indexAfterMatchLast = indexMatch + match[0].length;
  }
  if (!isMathFound) {
    return null;
  }
  if (indexAfterMatchLast < text.length) {
    partList.push({ text: text.slice(indexAfterMatchLast) });
  }
  return partList;
}
