import React, { useRef, useEffect, useLayoutEffect, forwardRef, useImperativeHandle } from 'react';
import { createBulletEqualityFn, useRenderUtilsContext } from '@/core/RenderUtils.ts';

/**
 * Anonymous node renderer - skips title completely and renders only children (for nodes with empty textRaw)
 */
const YamdNodeAnonym = forwardRef(({ nodeId, parentInfo, globalInfo }, ref) => {
  const firstChildRef = useRef(null);
  // Track child subscriptions to prevent memory leaks
  const childSubscriptionsRef = useRef(new Map());
  // Get render utils from context
  const renderUtils = useRenderUtilsContext();

  console.log('nodeId:', nodeId, 'YamdNodeAnonym parentInfo:', parentInfo);
  // Expose calcBulletYPos to parent via ref
  useImperativeHandle(ref, () => ({
    calcBulletYPos: () => {
      const docId = globalInfo?.docId;
      calcBulletYPos(nodeId, docId, globalInfo, childSubscriptionsRef, renderUtils);
    }
  }), [nodeId, globalInfo, renderUtils]);

  // ===== ZUSTAND LOGIC =====
  const docId = globalInfo?.docId;
  
  // Subscribe to request counter changes with custom equality function
  useEffect(() => {
    if (!nodeId || !docId) {
      console.warn('noteId:', nodeId, 'docId:', docId, 'YamdNodeAnonym useEffect subscribe skipped');
      return;
    }
    console.log('noteId:', nodeId, 'docId:', docId, 'YamdNodeAnonym useEffect subscribe');
    const unsubscribe = globalInfo.getDocStore().subscribe(
      (state) => state.bulletYPosReq[docId]?.[nodeId] || {},
      (requests) => {
        console.log('noteId:', nodeId, 'YamdNodeAnonym useEffect subscribe triggered with requests:', requests);
        // this will only fire if equalityFn returns false
        calcBulletYPos(nodeId, docId, globalInfo, childSubscriptionsRef, renderUtils);
      },
      {
        equalityFn: createBulletEqualityFn(nodeId, 'YamdNodeAnonym'),
      }
    );
    
    // Immediately check for existing requests
    calcBulletYPos(nodeId, docId, globalInfo, childSubscriptionsRef, renderUtils);
    
    return () => {
      unsubscribe();
      // Clean up all child subscriptions on unmount
      childSubscriptionsRef.current.forEach(unsub => unsub());
      childSubscriptionsRef.current.clear();
    };
  }, [nodeId, docId, globalInfo, renderUtils]);
  // ===== END ZUSTAND LOGIC =====

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
  const store = globalInfo.getDocStore().getState();
  // Get all requests for this node
  const requests = store.getBulletYPosReqs(docId, nodeId);
  console.log('noteId:', nodeId, 'YamdNodeAnonym calcBulletYPos requests:', requests);
  
  // Update result for each requesting container
  Object.keys(requests).forEach(containerClassName => {
    try {
      // OLD LOGIC (commented out): Try to forward request to first child using imperative handle
      // if (firstChildRef.current?.calcBulletYPos) {
      //   firstChildRef.current.calcBulletYPos();
      //   // Since the first child will handle the positioning, we don't need to update store here
      //   // The child will update the store with its own result
      //   console.log('noteId:', nodeId, 'YamdNodeAnonym forwarded to first child');
      //   return;
      // }
      
      // NEW LOGIC: Forward request through Zustand store
      // Get the first child node data to forward the request
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
        
        // Add request for the first child with the same container class
        store.addBulletYPosReq(docId, firstChildId, containerClassName);
        store.incReqCounter(docId, firstChildId, containerClassName);
        
        // Subscribe to the first child's response and forward it back
        const unsubscribeChild = globalInfo.getDocStore().subscribe(
          (state) => state.bulletYPosReq[docId]?.[firstChildId]?.[containerClassName]?.responseCounter,
          (responseCounter) => {
            // Always use fresh store reference to avoid stale closures
            const freshStore = globalInfo.getDocStore().getState();
            const childResult = freshStore.getBulletYPosReqs(docId, firstChildId)[containerClassName]?.result;
            console.log('noteId:', nodeId, 'YamdNodeAnonym received result from first child:', childResult);
            if (childResult) {
              // Forward the child's result as our own result
              freshStore.updateReqResult(docId, nodeId, containerClassName, childResult);
              freshStore.incRespCounter(docId, nodeId, containerClassName);
              
              // Clean up subscription after successful response
              unsubscribeChild();
              childSubscriptionsRef.current.delete(subscriptionKey);
            }
          }
        );
        
        // Track this subscription for cleanup
        childSubscriptionsRef.current.set(subscriptionKey, unsubscribeChild);
        
        return;
      } else {
        // No children to forward to
        const result = { code: -2, message: 'Anonymous node: no children to forward positioning request to', data: null };
        store.updateReqResult(docId, nodeId, containerClassName, result);
        store.incRespCounter(docId, nodeId, containerClassName);
      }
    } catch (error) {
      const result = { code: -1, message: `Anonymous node positioning error: ${error.message}`, data: null };
      store.updateReqResult(docId, nodeId, containerClassName, result);
      store.incRespCounter(docId, nodeId, containerClassName);
    }
  });
};

export default YamdNodeAnonym;
