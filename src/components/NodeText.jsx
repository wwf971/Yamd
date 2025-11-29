import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { getNodeClass } from '@/core/YamdNode.jsx';
import { useRenderUtilsContext } from '@/core/RenderUtils.ts';
import NodeTextRich from './NodeRichText.jsx';
import { createBulletEqualityFn } from '@/core/RenderUtils.ts';
import { docsBulletState, nodeBulletState } from '@/core/DocStore.js';

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
  
  // ref to access NodeTextRich methods (for bullet positioning)
  const textContentRef = useRef(null);
  
  // ===== JOTAI LOGIC =====
  // get docId from globalInfo or use default
  const docId = globalInfo?.docId

  // Subscribe to request counters (only changes when reqCounter changes)
  const reqCounters = docsBulletState.useReqCounters(docId, nodeId);
  
  // Track previous reqCounters to detect changes
  // Key by docId to handle document reloads
  const prevReqCountersRef = useRef({});
  const lastDocIdRef = useRef(docId);
  
  // Reset ref when docId changes (document reload)
  if (lastDocIdRef.current !== docId) {
    prevReqCountersRef.current = {};
    lastDocIdRef.current = docId;
  }
  
  // Trigger calculation when reqCounters change
  // Use useLayoutEffect to calculate BEFORE paint
  useLayoutEffect(() => {
    if (!nodeId || !docId) return;
    
    let shouldCalculate = false;
    Object.keys(reqCounters).forEach(containerClassName => {
      const currentReqCounter = reqCounters[containerClassName] || 0;
      const prevReqCounter = prevReqCountersRef.current[containerClassName] || 0;
      
      if (currentReqCounter > prevReqCounter) {
        shouldCalculate = true;
        prevReqCountersRef.current[containerClassName] = currentReqCounter;
      }
    });
    
    if (shouldCalculate) {
      calcBulletYPos(nodeId, docId, nodeRef, textContentRef, globalInfo);
    }
  }, [nodeId, docId, reqCounters, globalInfo]);

  // Subscribe to node data changes (especially children array changes)
  const nodeData = renderUtils.useNodeData(nodeId);
  
  if (!nodeData) {
    return <div className="yamd-error">Node not found: {nodeId}</div>;
  }

  // Use ?? instead of || to handle empty strings correctly
  const selfText = nodeData.textRaw ?? nodeData.textOriginal ?? '';
  const segments = nodeData.segments; // Array of segment node IDs
  
  const childDisplay = renderUtils.getChildDisplay(nodeData, false, parentInfo);
  const childClass = nodeData.attr?.childClass;
  const shouldRenderBullet = parentInfo?.childDisplay === 'ul' || parentInfo?.childDisplay === 'ol';
  
  // Use the utility function to get appropriate CSS class
  const nodeClass = getNodeClass(nodeData, parentInfo) || 'yamd-title-default';
  
  // Check if text node has content (including empty string for editable mode)
  const hasTextContent = nodeData.textRaw !== undefined || nodeData.textOriginal !== undefined;

  return (
    <div ref={nodeRef} className="yamd-node-text">
      {/* self content - always use NodeTextRich */}
      {hasTextContent && (
        <NodeTextRich 
          ref={textContentRef}
          nodeId={nodeId}
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

  const requests = nodeBulletState.getAllBulletYPosReqs(docId, nodeId);
  
  // Update result for each requesting container
  Object.keys(requests).forEach(containerClassName => {
    const result = textContentRef.current.calcBulletYPos(containerClassName);
    nodeBulletState.updateBulletYPosResult(docId, nodeId, containerClassName, result);
  });
};


export default YamdNodeText;
