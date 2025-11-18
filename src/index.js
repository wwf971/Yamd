// Main entry point for Yamd module
export { default as YamdDoc } from '@/core/YamdDoc.jsx';
export { default as YamdNode, getNodeClass } from '@/core/YamdNode.jsx';
export { default as YamdChildrenNodes } from '@/core/YamdChildrenNodes.jsx';
export { default as YamdImageList } from '@/components/NodeImageList.jsx';
export { default as YamdVideoList } from '@/components/NodeVideoList.jsx';
export { default as TestYamd } from './TestYamd.jsx';

// Export parsing utilities
export {
  parseYamlToJson,
  formatJson,
  getSampleYaml,
  getCornerCaseYaml,
  processNodes,
  flattenJson,
  processAllTextSegments,
  scanAssets,
  processYamd
} from '@/parse/ParseYamd.js';

// Export render utilities
export {
  renderYamdListBullet,
  getChildrenDisplay,
  getChildrenDefaultDisplay,
  getAlignmentStrategy,
  createBulletEqualityFn
} from './YamdRenderUtils.js';

export {
  AddListBulletBeforeYamdNode,
} from '@/core/AddBullet.jsx';

// export render settings
export {
  BULLET_DIMENSIONS,
  LIST_SETTINGS,
  LATEX_SETTINGS,
  PANEL_SETTINGS,
  TIMELINE_SETTINGS,
  IMAGE_SETTINGS,
  VIDEO_SETTINGS,
  IMAGE_LIST_SETTINGS,
  VIDEO_LIST_SETTINGS,
  TIMELINE_BULLET_SETTINGS
} from '@/config/RenderConfig.js';

// export MathJax utilities
export { loadMathJax } from './mathjax/MathJaxLoad.js';
export { setupInlineMathJax, renderMathJax } from './mathjax/MathJaxInline.js';
export { useMathJaxStore, typesetMathJax } from './mathjax/MathJaxStore.js';
export { LaTeX2Svg, LaTeX2Chtml } from './mathjax/MathJaxConvert.js';

// export text processing utilities
export {
  parseTextSegments,
  parseInlineLatex,
  hasInlineLatex,
  hasReferences,
  hasBibCitations,
  segmentsToText,
  segmentsToMathJax,
  registerLatexBlock,
  registerImageBlock,
  registerVideoBlock,
  parseLatexInline,
  debugLatexParsing
} from './parse/_4_text_segment.js';

// export attribute parsing utilities
export {
  extractSquareBracketAttr,
  normalizeAttrKey,
  normalizeAttributeValue,
  parseShorthandAttribute
} from './parse/_1_parse_attr.js';

// export NodeParse utilities
export { useNodeParseStore } from './core/NodeParse.js';

// export CSS for styling
import './core/YamdNode.css';
