import type { CompData } from './docStoreTypes';

// Segment traits are static capabilities that a segment component declares
// for its compName, similar to registerCompDataDiffHandler in
// docStoreVersion.ts. The component module registers its traits at load time,
// and doc-level structure logic reads them through these helpers. This keeps
// Row/List/store logic free of hard-coded component names while still letting
// components influence structural rules.
export type SegTrait = {
  // A row-exclusive segment must be the only segment in its Row. Doc-level
  // structure operations refuse to place any other segment next to it.
  // See doc-mobx/comp_seg_exclusive.md.
  isRowExclusive?: boolean;
  // The segment's clipboard text serializes as an indented fenced block
  // (```-wrapped lines) in the markdown copy output, and a pasted fenced
  // block deserializes into a new segment of this compName.
  // See doc-mobx/comp_delete_copy_cut.md.
  isCopyAsFencedBlock?: boolean;
  // The segment stores text style entries under data.style and renders them.
  // The centralized set-style-on-selection logic only touches segments with
  // this trait. See doc-mobx/comp_text_style.md.
  isTextStyleSupported?: boolean;
  // Create the segment's clipboard text from its data alone, without asking
  // the mounted component. Used by the synchronous copy path and as the
  // fallback of the async path, for segments whose clipboard text is not the
  // raw text field (an inline math segment serializes as $source$).
  // offsetStart/offsetEnd are selection offsets in the segment's own logical
  // offset space; undefined means the segment edge.
  createClipboardText?: (
    compData: CompData,
    offsetStart?: number,
    offsetEnd?: number,
  ) => string;
  // Recognize inline widget markup inside pasted plain text. Returns the
  // paste text split into an ordered part list, or null when the text
  // contains no markup of this kind. A part without compName stays plain text
  // for the paste target segment kind; a part with compName becomes a new
  // segment of that component with the part text as its text field.
  parsePasteInline?: (textPaste: string) => SegPasteInlinePart[] | null;
};

export type SegPasteInlinePart = {
  compName?: string;
  text: string;
};

const segTraitByCompName: Record<string, SegTrait> = {};

export function registerSegTrait(compName: string, trait: SegTrait) {
  segTraitByCompName[String(compName || '')] = { ...(trait || {}) };
}

export function docStoreGetSegTrait(compName: string): SegTrait {
  return segTraitByCompName[String(compName || '')] || {};
}

export function docStoreIsSegRowExclusive(compData: CompData | null | undefined) {
  return docStoreGetSegTrait(String(compData?.compName || '')).isRowExclusive === true;
}

export function docStoreIsSegCopyFenced(compData: CompData | null | undefined) {
  return docStoreGetSegTrait(String(compData?.compName || '')).isCopyAsFencedBlock === true;
}

export function docStoreIsSegTextStyleSupported(compData: CompData | null | undefined) {
  return docStoreGetSegTrait(String(compData?.compName || '')).isTextStyleSupported === true;
}

// Clipboard text from the trait registry, or null when the segment's
// component did not register createClipboardText.
export function docStoreCreateSegClipboardTextByTrait(
  compData: CompData | null | undefined,
  offsetStart?: number,
  offsetEnd?: number,
) {
  const trait = docStoreGetSegTrait(String(compData?.compName || ''));
  if (typeof trait.createClipboardText !== 'function' || !compData) {
    return null;
  }
  return trait.createClipboardText(compData, offsetStart, offsetEnd);
}

// Ask every registered inline paste parser to recognize the paste text. The
// first parser that returns parts wins. Returns null when no parser matched.
export function docStoreParsePasteInline(textPaste: string): SegPasteInlinePart[] | null {
  for (const trait of Object.values(segTraitByCompName)) {
    if (typeof trait.parsePasteInline !== 'function') continue;
    const partList = trait.parsePasteInline(textPaste);
    if (Array.isArray(partList) && partList.length > 0) {
      return partList;
    }
  }
  return null;
}

// The compName that fenced paste blocks deserialize into. The registry keeps
// doc-level paste logic free of hard-coded component names.
export function docStoreGetCompNameCopyFenced() {
  for (const [compName, trait] of Object.entries(segTraitByCompName)) {
    if (trait.isCopyAsFencedBlock === true) return compName;
  }
  return '';
}
