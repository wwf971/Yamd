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
