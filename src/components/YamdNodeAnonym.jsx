import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import YamdChildrenNodes from '../YamdChildrenNodes.jsx';
import { useYamdDocStore } from '../YamdDocStore.js';
import { createBulletEqualityFn } from '../YamdRenderUtils.js';


/**
 * Anonymous node renderer - skips title completely and renders only children (for nodes with empty textRaw)
 */
const YamdNodeAnonym = forwardRef(({ nodeId, parentInfo, globalInfo }, ref) => {
  const firstChildRef = useRef(null);
  console.log('nodeId:', nodeId, 'YamdNodeAnonym parentInfo:', parentInfo);
  // Expose calcPreferredBulletYPos to parent via ref
  useImperativeHandle(ref, () => ({
    calcPreferredBulletYPos: () => {
      const docId = globalInfo?.docId;
      calcPreferredBulletYPos(nodeId, docId, globalInfo, firstChildRef);
    }
  }), [nodeId, globalInfo]);

  // ===== ZUSTAND LOGIC =====
  const docId = globalInfo?.docId;
  
  // Subscribe to request counter changes with custom equality function
  useEffect(() => {
    if (!nodeId || !docId) {
      console.warn('noteId:', nodeId, 'docId:', docId, 'YamdNodeAnonym useEffect subscribe skipped');
      return;
    }
    console.log('noteId:', nodeId, 'docId:', docId, 'YamdNodeAnonym useEffect subscribe');
    const unsubscribe = useYamdDocStore.subscribe(
      (state) => state.bulletPreferredYPosRequests[docId]?.[nodeId] || {},
      (requests) => {
        console.log('noteId:', nodeId, 'YamdNodeAnonym useEffect subscribe triggered with requests:', requests);
        // this will only fire if equalityFn returns false
        calcPreferredBulletYPos(nodeId, docId, globalInfo, firstChildRef);
      },
      {
        equalityFn: createBulletEqualityFn(nodeId, 'YamdNodeAnonym'),
      }
    );
    
    // Immediately check for existing requests
    calcPreferredBulletYPos(nodeId, docId, globalInfo, firstChildRef);
    return unsubscribe;
  }, [nodeId, docId]);
  // ===== END ZUSTAND LOGIC =====

  if (!globalInfo?.getNodeDataById) {
    return <div className="yamd-error">Missing globalInfo.getNodeDataById</div>;
  }
  
  const nodeData = globalInfo.getNodeDataById(nodeId);
  
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
  return (
    <YamdChildrenNodes
      childIds={nodeData.children || []}
      shouldAddIndent={false}
      parentInfo={childrenParentInfo}
      globalInfo={globalInfo}
      firstChildRef={firstChildRef} // Pass ref to first child
    />
  );
});


/**
 * Calculate preferred bullet Y position for anonymous node by forwarding to first child
 * @param {string} nodeId - Node ID
 * @param {string} docId - Document ID  
 * @param {object} globalInfo - Global info object
 * @param {React.RefObject} firstChildRef - Reference to first child component
 * @returns {void}
 */
const calcPreferredBulletYPos = (nodeId, docId, globalInfo, firstChildRef) => {
  const store = useYamdDocStore.getState();
  // Get all requests for this node
  const requests = store.getPreferredYPosRequests(docId, nodeId);
  console.log('noteId:', nodeId, 'YamdNodeAnonym calcPreferredBulletYPos requests:', requests);
  
  // Update result for each requesting container
  Object.keys(requests).forEach(containerClassName => {
    try {
      // OLD LOGIC (commented out): Try to forward request to first child using imperative handle
      // if (firstChildRef.current?.calcPreferredBulletYPos) {
      //   firstChildRef.current.calcPreferredBulletYPos();
      //   // Since the first child will handle the positioning, we don't need to update store here
      //   // The child will update the store with its own result
      //   console.log('noteId:', nodeId, 'YamdNodeAnonym forwarded to first child');
      //   return;
      // }
      
      // NEW LOGIC: Forward request through Zustand store
      // Get the first child node data to forward the request
      const nodeData = globalInfo.getNodeDataById(nodeId);
      if (nodeData?.children && nodeData.children.length > 0) {
        const firstChildId = nodeData.children[0];
        
        // Forward the positioning request to the first child
        console.log('YamdNodeAnonym noteId:', nodeId, 'firstChildId:', firstChildId);
        
        // Add request for the first child with the same container class
        store.addBulletPreferredYPosRequest(docId, firstChildId, containerClassName);
        store.incRequestCounter(docId, firstChildId, containerClassName);
        
        // Subscribe to the first child's response and forward it back
        const unsubscribeChild = useYamdDocStore.subscribe(
          (state) => state.bulletPreferredYPosRequests[docId]?.[firstChildId]?.[containerClassName]?.responseCounter,
          (responseCounter) => {
            const childResult = store.getPreferredYPosRequests(docId, firstChildId)[containerClassName]?.result;
            console.log('noteId:', nodeId, 'YamdNodeAnonym received result from first child:', childResult);
            if (childResult) {
              // Forward the child's result as our own result
              store.updateRequestResult(docId, nodeId, containerClassName, childResult);
              store.incResponseCounter(docId, nodeId, containerClassName);
              unsubscribeChild(); // Clean up subscription
            }
          }
        );
        
        return;
      } else {
        // No children to forward to
        const result = { code: -2, message: 'Anonymous node: no children to forward positioning request to', data: null };
        store.updateRequestResult(docId, nodeId, containerClassName, result);
        store.incResponseCounter(docId, nodeId, containerClassName);
      }
    } catch (error) {
      const result = { code: -1, message: `Anonymous node positioning error: ${error.message}`, data: null };
      store.updateRequestResult(docId, nodeId, containerClassName, result);
      store.incResponseCounter(docId, nodeId, containerClassName);
    }
  });
};

export default YamdNodeAnonym;
