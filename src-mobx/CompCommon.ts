// Stable component entry point. Standard components register into the
// unified component registry here at module load. Consumers should import
// components and the registry API from this module instead of depending on
// implementation folders such as seg-text/. See doc-mobx/comp_registry.md.
import DocViewer from './comp/DocViewer';
import List from './comp/List';
import Row from './comp/Row';
import TextBasic from './comp/TextBasic';
import TextSeg from './comp/seg-text/TextSeg';
import TextBlockSeg from './comp/seg-text-block/TextBlockSeg';
import MathInlineSeg from './comp/seg-math-inline/MathInlineSeg';
import { registerCompEntry } from './compRegistry';

export {
  DocViewer,
  List,
  Row,
  TextBasic,
  TextSeg,
  TextBlockSeg,
  MathInlineSeg,
};

export {
  registerCompEntry,
  compRegistryGetByName,
  compRegistryGetById,
  compRegistryGetByRef,
  compRegistryGetComp,
  compRegistrySearchByType,
  compRegistryIsType,
} from './compRegistry';
export type { CompRegistryEntry } from './compRegistry';

// Registration makes the standard components fetchable through the registry;
// it does not make them special. Doc-level logic treats every registered
// component uniformly.
registerCompEntry({ compDefId: 'yamd/DocViewer', compName: 'DocViewer', compTypeList: ['doc'], Comp: DocViewer });
registerCompEntry({ compDefId: 'yamd/TextBasic', compName: 'TextBasic', compTypeList: ['doc'], Comp: TextBasic });
registerCompEntry({ compDefId: 'yamd/List', compName: 'List', compTypeList: ['list'], Comp: List });
registerCompEntry({ compDefId: 'yamd/Row', compName: 'Row', compTypeList: ['row'], Comp: Row });
registerCompEntry({ compDefId: 'yamd/TextSeg', compName: 'TextSeg', compTypeList: ['seg'], Comp: TextSeg });
registerCompEntry({ compDefId: 'yamd/TextBlockSeg', compName: 'TextBlockSeg', compTypeList: ['seg'], Comp: TextBlockSeg });
registerCompEntry({ compDefId: 'yamd/MathInlineSeg', compName: 'MathInlineSeg', compTypeList: ['seg'], Comp: MathInlineSeg });
