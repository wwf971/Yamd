import React, { useRef, useEffect, useLayoutEffect, forwardRef, useImperativeHandle } from 'react';
import { createBulletEqualityFn, useRenderUtilsContext } from '@/core/RenderUtils.ts';
import { docsBulletState, nodeBulletState } from '@/core/DocStore.js';

/**
 * Anonymous node renderer - skips title completely and renders only children (for nodes with empty textRaw)
 */
const YamdNodeAnonym = forwardRef(({ nodeId, parentInfo, globalInfo }, ref) => {
  const firstChildRef = useRef(null);
  // Track child subscriptions to prevent memory leaks
  const childSubscriptionsRef = useRef(new Map());
  // Get render utils from context
  const renderUtils = useRenderUtilsContext();

  // console.log('nodeId:', nodeId, 'YamdNodeAnonym parentInfo:', parentInfo);
  // Expose calcBulletYPos to parent via ref
  useImperativeHandle(ref, () => ({
    calcBulletYPos: () => {
      const docId = globalInfo?.docId;
      calcBulletYPos(nodeId, docId, globalInfo, childSubscriptionsRef, renderUtils);
    }
  }), [nodeId, globalInfo, renderUtils]);

  // ===== JOTAI LOGIC =====
  const docId = globalInfo?.docId;
  
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
  // Use useLayoutEffect to calculate BEFORE paint, preventing flash of wrong position
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
      console.log('noteId:', nodeId, 'YamdNodeAnonym reqCounter increased');
      calcBulletYPos(nodeId, docId, globalInfo, childSubscriptionsRef, renderUtils);
    }
    
    // Clean up child subscriptions on unmount
    return () => {
      childSubscriptionsRef.current.forEach(unsub => unsub());
      childSubscriptionsRef.current.clear();
    };
  }, [nodeId, docId, reqCounters, globalInfo, renderUtils]);
  // ===== END JOTAI LOGIC =====

  // Subscribe to node data changes (especially children array changes)
  const nodeData = renderUtils.useNodeData(nodeId);
  
  if (!nodeData) {
    return <div className="yamd-error">Node not found: {nodeId}</div>;
  }

  // For anonymous nodes, only override parentInfo if node has explicit attributes
  const childrenParentInfo = {
    ...parentInfo,
    ...(nodeData.attr?.childDisplay && { childDisplay: nodeData.attr.childDisplay }),
    ...(nodeData.attr?.childClass && { childClass: nodeData.attr.childClass })
  };

  // Render only children, no title
  // Pass firstChildRef to the first child for forwarding positioning requests

  return renderUtils.renderChildNodes({
    childIds: nodeData.children || [],
    shouldAddIndent: false,
    parentInfo: childrenParentInfo,
    globalInfo: globalInfo,
    firstChildRef: firstChildRef // Pass ref to first child
  });
});


/**
 * Calculate preferred bullet Y position for anonymous node by forwarding to first child
 * @param {string} nodeId - Node ID
 * @param {string} docId - Document ID  
 * @param {object} globalInfo - Global info object
 * @param {React.RefObject} childSubscriptionsRef - Reference to Map tracking child subscriptions
 * @param {object} renderUtils - Render utilities from context
 * @returns {void}
 */
const calcBulletYPos = (nodeId, docId, globalInfo, childSubscriptionsRef, renderUtils) => {
  // Get all requests for this node using Jotai
  const requests = nodeBulletState.getAllBulletYPosReqs(docId, nodeId);
  console.log('noteId:', nodeId, 'YamdNodeAnonym calcBulletYPos requests:', requests);
  
  // Update result for each requesting container
  Object.keys(requests).forEach(containerClassName => {
    try {
      // Forward request to first child through Jotai
      const nodeData = renderUtils.getNodeDataById(nodeId);
      if (nodeData?.children && nodeData.children.length > 0) {
        const firstChildId = nodeData.children[0];
        
        // Create a unique key for this subscription
        const subscriptionKey = `${firstChildId}:${containerClassName}`;
        
        // Check if we already have a subscription for this child/container
        if (childSubscriptionsRef.current.has(subscriptionKey)) {
          console.log('noteId:', nodeId, 'YamdNodeAnonym already subscribed to:', subscriptionKey);
          return;
        }
        
        // Forward the positioning request to the first child
        console.log('YamdNodeAnonym noteId:', nodeId, 'firstChildId:', firstChildId);
        
        // Register and request calculation for the first child
        nodeBulletState.registerBulletYPosReq(docId, firstChildId, containerClassName);
        nodeBulletState.reqCalcBulletYPos(docId, firstChildId, containerClassName);
        
        // Subscribe to the first child's response atom and forward it back
        // Use the response atom which only changes when result changes
        const childRespAtom = docsBulletState.respAtom(docId, firstChildId);
        const store = docsBulletState._store;
        
        // Manual subscription to child's response atom (since we're outside React component)
        const unsubscribeChild = store.sub(childRespAtom, () => {
          const childResults = store.get(childRespAtom);
          const childResult = childResults[containerClassName];
          
          console.log('noteId:', nodeId, 'YamdNodeAnonym received result from first child:', childResult);
          if (childResult) {
            // Forward the child's result as our own result
            nodeBulletState.updateBulletYPosResult(docId, nodeId, containerClassName, childResult);
            
            // Clean up subscription after successful response
            unsubscribeChild();
            childSubscriptionsRef.current.delete(subscriptionKey);
          }
        });
        
        // Track this subscription for cleanup
        childSubscriptionsRef.current.set(subscriptionKey, unsubscribeChild);
        
        return;
      } else {
        // No children to forward to
        const result = { code: -2, message: 'Anonymous node: no children to forward positioning request to', data: null };
        nodeBulletState.updateBulletYPosResult(docId, nodeId, containerClassName, result);
      }
    } catch (error) {
      const result = { code: -1, message: `Anonymous node positioning error: ${error.message}`, data: null };
      nodeBulletState.updateBulletYPosResult(docId, nodeId, containerClassName, result);
    }
  });
};

export default YamdNodeAnonym;
