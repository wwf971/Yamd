import React, { useRef, useEffect, useState } from 'react';
import { getNodeClass } from '@/core/YamdNode.jsx';
import { useRenderUtilsContext } from '@/core/RenderUtils.ts';
import NodeTextRich from './NodeRichText.jsx';
import NodeTextPlain from './NodePlainText.jsx';
import { createBulletEqualityFn } from '@/core/RenderUtils.ts';

/**
 * render a text node, and then render its children nodes.
 */
const YamdNodeText = React.memo(({ nodeId, parentInfo, globalInfo }) => {
  const nodeRef = useRef(null);

  // Get render utils from context
  const renderUtils = useRenderUtilsContext();

  // Register the node reference after the component finishes rendering
  useEffect(() => {
    if (nodeRef.current) {
      renderUtils.registerNodeRef?.(nodeId, nodeRef.current);
    }
  }, [nodeId, renderUtils.registerNodeRef]);
  
  // ref to access NodeTextRich or NodeTextPlain methods
  const textContentRef = useRef(null);
  
  // ===== ZUSTAND LOGIC =====
  // get docId from globalInfo or use default
  const docId = globalInfo?.docId

  // console.log('noteId:', nodeId, 'YamdNodeText docId:', docId);
  // Subscribe to request counter changes with custom equality function
  // Subscribe to bullet positioning requests from Zustand store
  useEffect(() => {
    if (!nodeId || !docId) return;
    
    const unsubscribe = globalInfo.getDocStore().subscribe(
      (state) => state.bulletYPosReq[docId]?.[nodeId] || {},
      (requests) => {
        calcBulletYPos(nodeId, docId, nodeRef, textContentRef, globalInfo);
      },
      {
        equalityFn: createBulletEqualityFn(nodeId, 'YamdNodeText'),
      }
    );
    
    // Calculate initial bullet positions
    calcBulletYPos(nodeId, docId, nodeRef, textContentRef, globalInfo);
    
    return unsubscribe;
  }, [nodeId, docId, globalInfo]);

  // Subscribe to node data changes (especially children array changes)
  const nodeData = renderUtils.useNodeData(nodeId);
  
  if (!nodeData) {
    return <div className="yamd-error">Node not found: {nodeId}</div>;
  }

  // Use ?? instead of || to handle empty strings correctly
  const selfText = nodeData.textRaw ?? nodeData.textOriginal ?? '';
  const textRich = nodeData.textRich; // Rich text segments if LaTeX was processed
  
  // Determine if this is plain text (no textRich, or textRich with only one text segment)
  const isPlainText = !textRich || 
    (Array.isArray(textRich) && textRich.length === 1 && textRich[0].type === 'text');
  
  const childDisplay = renderUtils.getChildDisplay(nodeData, false, parentInfo);
  const childClass = nodeData.attr?.childClass;
  const shouldRenderBullet = parentInfo?.childDisplay === 'ul' || parentInfo?.childDisplay === 'ol';
  
  // Use the utility function to get appropriate CSS class
  const nodeClass = getNodeClass(nodeData, parentInfo) || 'yamd-title-default';
  // console.log("textRich:", textRich, "isPlainText:", isPlainText);
  
  // Check if text node has content (including empty string for editable mode)
  const hasTextContent = nodeData.textRaw !== undefined || nodeData.textOriginal !== undefined;

  return (
    <div ref={nodeRef} className="yamd-node-text">
      {/* self content */}
      {hasTextContent && isPlainText && (
        <NodeTextPlain 
          ref={textContentRef}
          nodeId={nodeId}
          className={nodeClass}
          parentInfo={parentInfo}
          globalInfo={globalInfo}
        />
      )}
      {hasTextContent && !isPlainText && (
        <NodeTextRich 
          ref={textContentRef}
          text={selfText}
          textRich={textRich}
          className={nodeClass}
          parentInfo={parentInfo}
          globalInfo={globalInfo}
        />
      )}

      {/* children content */}
      {nodeData.children && nodeData.children.length > 0 && (
        renderUtils.renderChildNodes({
          childIds: nodeData.children,
          shouldAddIndent: true,
          parentInfo: { 
            ...parentInfo, 
            ...(childDisplay && { childDisplay }),
            ...(childClass && { childClass })
          },
          globalInfo: globalInfo,
          firstChildRef: null
        })
      )}
    </div>
  );
});


// Calculate and provide bullet Y position for this text node
const calcBulletYPos = (nodeId, docId, nodeRef, textContentRef, globalInfo) => {
  // Guard: refs must be ready
  if (!nodeRef.current || !textContentRef.current?.calcBulletYPos) {
    return;
  }

  const store = globalInfo.getDocStore().getState();
  const requests = store.getBulletYPosReqs(docId, nodeId);
  
  // Update result for each requesting container
  Object.keys(requests).forEach(containerClassName => {
    const result = textContentRef.current.calcBulletYPos(containerClassName);
    store.updateReqResult(docId, nodeId, containerClassName, result);
    store.incRespCounter(docId, nodeId, containerClassName);
  });
};


export default YamdNodeText;
