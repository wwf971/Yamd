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

// The compName that fenced paste blocks deserialize into. The registry keeps
// doc-level paste logic free of hard-coded component names.
export function docStoreGetCompNameCopyFenced() {
  for (const [compName, trait] of Object.entries(segTraitByCompName)) {
    if (trait.isCopyAsFencedBlock === true) return compName;
  }
  return '';
}
