// Stable component entry point. Consumers should import components from this
// module instead of depending on implementation folders such as seg-text/.
import DocViewer from './comp/DocViewer';
import List from './comp/List';
import Row from './comp/Row';
import TextBasic from './comp/TextBasic';
import TextSeg from './comp/seg-text/TextSeg';
import TextBlockSeg from './comp/seg-text-block/TextBlockSeg';

export {
  DocViewer,
  List,
  Row,
  TextBasic,
  TextSeg,
  TextBlockSeg,
};

export const compByNameDefault: Record<string, any> = {
  DocViewer,
  List,
  Row,
  TextBasic,
  TextSeg,
  TextBlockSeg,
};

export function getCompByName(
  compName: string,
  compByName: Record<string, any> = compByNameDefault,
) {
  return compByName[String(compName || '')] || null;
}
