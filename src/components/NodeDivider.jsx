import React, { useRef, useEffect, useLayoutEffect, forwardRef, useImperativeHandle } from 'react';
import { getNodeClass } from '@/core/YamdNode.jsx';
import { useRenderUtilsContext } from '@/core/RenderUtils.ts';
import { createBulletEqualityFn } from '@/core/RenderUtils.ts';
import { docsBulletState, nodeBulletState } from '@/core/DocStore.js';

/**
 * Divider node renderer - displays title as a divider line with text
 */
const NodeDivider = forwardRef(({ nodeId, parentInfo, globalInfo }, ref) => {
  const nodeRef = useRef(null);
  
  // Get render utils from context
  const renderUtils = useRenderUtilsContext();
  const docStore = renderUtils.docStore;
  const docId = renderUtils.docId;

  // Register the node reference after the component finishes rendering
  useEffect(() => {
    if (nodeRef.current) {
      globalInfo?.registerNodeRef?.(nodeId, nodeRef.current);
    }
  }, [nodeId, globalInfo]);

  // Expose calcBulletYPos to parent via ref
  useImperativeHandle(ref, () => ({
    calcBulletYPos: () => {
      calcBulletYPos(nodeId, docId, nodeRef, dividerRef, docStore);
    }
  }), [nodeId, docId, docStore]);

  // ===== JOTAI LOGIC =====
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
  useLayoutEffect(() => {
    if (!nodeId || !docId) {
      console.warn('noteId:', nodeId, 'docId:', docId, 'NodeDivider useLayoutEffect subscribe skipped');
      return;
    }
    
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
      console.log('noteId:', nodeId, 'docId:', docId, 'NodeDivider reqCounter increased');
      calcBulletYPos(nodeId, docId, nodeRef, dividerRef, docStore);
    }
  }, [nodeId, docId, reqCounters, docStore]);
  // ===== END JOTAI LOGIC =====

  // Subscribe to node data changes (especially children array changes)
  const nodeData = renderUtils.useNodeData(nodeId);
  
  if (!nodeData) {
    return <div className="yamd-error">Node not found: {nodeId}</div>;
  }

  const title = nodeData.textRaw ?? nodeData.textOriginal ?? '';
  const childDisplay = renderUtils.getChildDisplay(nodeData, false, parentInfo);
  const childClass = nodeData.attr?.childClass;
  
  // Use the utility function to get appropriate CSS class
  const nodeClass = getNodeClass(nodeData, parentInfo) || 'yamd-divider-text';

  // Ref to measure divider line height for bullet positioning
  const dividerRef = useRef(null);

  // Note: This component now provides bullet positioning via Zustand on demand
  // and exposes calcBulletYPos via useImperativeHandle

  return (
    <div ref={nodeRef} className="yamd-node-divider yamd-full-width">
      {/* Flexbox layout: line - text - line */}
      <div className="yamd-divider-container" style={{
      }}>
        {/* Left line */}
        <div 
          ref={dividerRef}
          className="yamd-divider-line-left" 
          style={{
            flex: 1,
            height: '1px',
            backgroundColor: 'currentColor',
            opacity: 0.3
          }}
        />
        
        {/* Text in the middle */}
        {title && (
          <span className={`${nodeClass} yamd-divider-text-span`}>
            {title}
          </span>
        )}
        
        {/* Right line */}
        <div 
          className="yamd-divider-line-right" 
          style={{
            flex: 1,
            height: '1px',
            backgroundColor: 'currentColor',
            opacity: 0.3
          }}
        />
      </div>
      
      {nodeData.children && nodeData.children.length > 0 && (
        renderUtils.renderChildNodes({
          childIds: nodeData.children,
          shouldAddIndent: false,
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


/**
 * Calculate preferred bullet Y position for divider
 * @param {string} nodeId - Node ID
 * @param {string} docId - Document ID  
 * @param {React.RefObject} nodeRef - Node DOM reference
 * @param {React.RefObject} dividerRef - Divider line DOM reference (points to left line)
 * @returns {void}
 */
const calcBulletYPos = (nodeId, docId, nodeRef, dividerRef, docStore) => {
  if (!nodeRef.current || !dividerRef.current) return;
  
  // Get all requests for this node using Jotai
  const requests = nodeBulletState.getAllBulletYPosReqs(docId, nodeId);
  console.log('noteId:', nodeId, 'NodeDivider calcBulletYPos requests:', requests);
  
  // update result for each requesting container
  Object.keys(requests).forEach(containerClassName => {
    try {
       // Get the flex container that contains the lines
       const dividerContainer = dividerRef.current.parentElement; // The flex container
       const bulletContainer = nodeRef.current.closest(containerClassName);
       
       if (!bulletContainer || !dividerContainer) {
         const result = { code: -1, message: `Divider: bullet container ${containerClassName} not found`, data: null };
         nodeBulletState.updateBulletYPosResult(docId, nodeId, containerClassName, result);
         return;
       }
       
       const containerRect = bulletContainer.getBoundingClientRect();
       const dividerContainerRect = dividerContainer.getBoundingClientRect();
       
       // Target the vertical center of the flex container (where lines are positioned)
       const dividerRelativeTop = dividerContainerRect.top - containerRect.top;
       const preferredYPos = dividerRelativeTop + (dividerContainerRect.height / 2);
      
      const result = { code: 0, message: 'Divider line center position', data: preferredYPos };
      
      // Update result using Jotai
      nodeBulletState.updateBulletYPosResult(docId, nodeId, containerClassName, result);
    } catch (error) {
      const result = { code: -1, message: `Divider positioning error: ${error.message}`, data: null };
      nodeBulletState.updateBulletYPosResult(docId, nodeId, containerClassName, result);
    }
  });
};

export default NodeDivider;
