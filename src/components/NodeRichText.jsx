import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import NodeTextPlain from './NodePlainText.jsx';
import NodeTextRichLaTeXInline from './NodeRichTextLaTeXInline.jsx';
import SegmentRef from './SegmentRef.jsx';
import NodeTextRichBib from './NodeRichTextBib.jsx';
import { calcBulletYPos as _calcBulletYPos} from './NodeRichText.js';
import { useRenderUtilsContext } from '@/core/RenderUtils.ts';

/**
 * Rich text renderer with inline LaTeX math support
 * Renders segmented text content using segment nodes
 * Also handles bullet positioning like NodeTextPlain
 */
const NodeTextRich = forwardRef(({ nodeId, className, parentInfo, globalInfo = null }, ref) => {
  // ref to measure text for bullet positioning (used by Zustand system)
  const textRef = useRef(null);

  // Get render utils from context
  const renderUtils = useRenderUtilsContext();
  
  // Get node data to access segments
  const nodeData = renderUtils.useNodeData(nodeId);
  const segments = nodeData?.segments || [];

  // expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    calcBulletYPos: (containerClassName) => {
      return _calcBulletYPos(textRef.current, segments, containerClassName);
    }
  }), [segments]);

  // Note: Bullet positioning is now handled entirely by Zustand store in YamdNodeText
  // All positioning logic moved to calcBulletYPos in NodeRichText.js
  
  // If no segments, show error
  if (!segments || segments.length === 0) {
    console.log("ERROR: segments is missing or empty:", segments);
    return (
      <span ref={textRef} className={`${className} yamd-error`} style={{color: 'red', border: '1px solid red'}}>
        ERROR: segments missing or empty. nodeId="{nodeId}", segments={JSON.stringify(segments)}
      </span>
    );
  }
  
  // Render segments using segment node IDs
  return (
    <span ref={textRef} className={className}>
      {segments.map((segmentId) => {
        const segmentNode = renderUtils.getNodeDataById(segmentId);
        
        if (!segmentNode) {
          return (
            <span key={segmentId} className="yamd-error" style={{color: 'red'}}>
              [Segment {segmentId} not found]
            </span>
          );
        }
        
        const segmentType = segmentNode.selfDisplay;
        
        if (segmentType === 'latex_inline') {
          // Use dedicated LaTeX component - NO MathJax fallback!
          return (
            <NodeTextRichLaTeXInline 
              key={segmentId}
              segment={segmentNode}
              globalInfo={globalInfo}
            />
          );
        } else if (segmentType === 'ref-asset') {
          // Use dedicated reference component
          return (
            <SegmentRef
              key={segmentId}
              segment={segmentNode}
              globalInfo={globalInfo}
            />
          );
        } else if (segmentType === 'ref-bib') {
          // Use dedicated bibliography component
          return (
            <NodeTextRichBib
              key={segmentId}
              segment={segmentNode}
              globalInfo={globalInfo}
            />
          );
        } else {
          // Regular text segment
          return (
            <span key={segmentId} className="yamd-text-segment">
              {segmentNode.textRaw}
            </span>
          );
        }
      })}
    </span>
  );
});

NodeTextRich.displayName = 'NodeTextRich';

export default NodeTextRich;
