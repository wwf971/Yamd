import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { getNodeClass } from '@/core/YamdNode.jsx';
import { useRenderUtilsContext } from '@/core/RenderUtils.ts';
import Segments from './Segments.jsx';
import { createBulletEqualityFn } from '@/core/RenderUtils.ts';
import { docsBulletState, nodeBulletState } from '@/core/DocStore.js';

/**
 * render a list item (text node), and then render its children nodes.
 */
const ListItem = React.memo(({ nodeId, parentInfo, globalInfo }) => {
  const nodeRef = useRef(null);

  // Get render utils from context
  const renderUtils = useRenderUtilsContext();

  // Register the node reference after the component finishes rendering
  useEffect(() => {
    if (nodeRef.current) {
      renderUtils.registerNodeRef?.(nodeId, nodeRef.current);
    }
  }, [nodeId, renderUtils.registerNodeRef]);
  
  // ref to access Segments methods (for bullet positioning)
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

  const THROTTLE_MS = 100; // Minimum time between calculations
  // Recalculate bullet position when layout changes (e.g., width change wraps text)
  useEffect(() => {
    if (!shouldRenderBullet || !nodeId || !docId || !nodeRef.current) return;
    let rafId = null;
    let lastCalcTime = 0;

    const observer = new ResizeObserver(() => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const now = Date.now();
        if (now - lastCalcTime < THROTTLE_MS) return;
        if (!nodeBulletState.hasAnyBulletReqs(docId, nodeId)) return;
        lastCalcTime = now;
        // console.log(`[LAYOUT CHANGE] ListItem [${nodeId}] layout changed, recalculating bullet position`);
        calcBulletYPos(nodeId, docId, nodeRef, textContentRef, globalInfo);
      });
    });
    
    observer.observe(nodeRef.current);
    
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [shouldRenderBullet, nodeId, docId, globalInfo]);
  
  // Use the utility function to get appropriate CSS class
  const nodeClass = getNodeClass(nodeData, parentInfo) || 'yamd-title-default';
  
  // Check if text node has content (including empty string for editable mode)
  const hasTextContent = nodeData.textRaw !== undefined || nodeData.textOriginal !== undefined;

  // Check if editable mode is enabled
  const isEditable = renderUtils.isEditable;

  // Handle click on list item - focus the rich text node inside
  const handleClick = (e) => {
    if (!isEditable) return;
    
    // Check if click landed directly on this list item wrapper (not on rich text or children)
    // e.currentTarget is the element the handler is attached to
    // e.target is the actual element that was clicked
    if (e.target !== e.currentTarget) {
      console.log(`[🖱️CLICK EVENT] ListItem [${nodeId}] click on child element, ignoring`);
      return;
    }
    
    console.log(`[🖱️CLICK EVENT] ListItem [${nodeId}] click on wrapper, focusing rich text node with cursor coords`);
    
    // Convert clientX/Y to pageX/Y
    const cursorPageX = e.clientX + window.scrollX;
    const cursorPageY = e.clientY + window.scrollY;
    
    // Trigger focus on the rich text node with cursor coordinates
    renderUtils.triggerFocus?.(nodeId, 'parentClick', { cursorPageX, cursorPageY });
  };

  return (
    <div 
      ref={nodeRef} 
      className="yamd-node-text"
      onClick={isEditable ? handleClick : undefined}
    >
      {/* self content - always use Segments */}
      {hasTextContent && (
        <Segments 
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


export default ListItem;

