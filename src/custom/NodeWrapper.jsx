import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useRenderUtilsContext, createBulletEqualityFn } from '@/core/RenderUtils.ts';

/**
 * YamdCustomNodeWrapper - Wrapper component for custom user nodes
 * 
 * Handles all Zustand store logic for bullet positioning, allowing custom components
 * to focus only on rendering and providing a simple calcBulletYPos method.
 * 
 * Custom Component Requirements:
 * - Must be a forwardRef component
 * - Must expose a calcBulletYPos(containerClassName) method via useImperativeHandle
 * - calcBulletYPos should return: { code: 0|-1|-2, message: string, data: number|null }
 *   where data is the preferred Y position in pixels relative to the container
 * 
 * Props the custom component will receive:
 * - nodeId: string - The node ID
 * - nodeData: object - The node data from renderUtils.getNodeDataById(nodeId)
 * - parentInfo: object - Parent context information
 * - globalInfo: object - Global info with utility functions
 * 
 * @param {string} nodeId - Node ID
 * @param {object} parentInfo - Parent context information
 * @param {object} globalInfo - Global info object
 * @param {React.ComponentType} CustomComponent - The custom component to render
 */
const YamdCustomNodeWrapper = forwardRef(({ nodeId, parentInfo, globalInfo, CustomComponent }, ref) => {
  const customNodeRef = useRef(null);
  
  // Expose calcBulletYPos to parent via ref
  useImperativeHandle(ref, () => ({
    calcBulletYPos: () => {
      const docId = globalInfo?.docId;
      calcBulletYPos(nodeId, docId, customNodeRef, globalInfo);
    }
  }), [nodeId, globalInfo]);

  // ===== ZUSTAND LOGIC =====
  const docId = globalInfo?.docId;
  
  // Subscribe to request counter changes with custom equality function
  useEffect(() => {
    if (!nodeId || !docId) {
      console.warn('nodeId:', nodeId, 'docId:', docId, 'YamdCustomNodeWrapper useEffect subscribe skipped');
      return;
    }
    console.log('nodeId:', nodeId, 'docId:', docId, 'YamdCustomNodeWrapper useEffect subscribe');
    const unsubscribe = globalInfo.getDocStore().subscribe(
      (state) => state.bulletYPosReq[docId]?.[nodeId] || {},
      (requests) => {
        console.log('nodeId:', nodeId, 'YamdCustomNodeWrapper useEffect subscribe triggered with requests:', requests);
        // This will only fire if equalityFn returns false
        calcBulletYPos(nodeId, docId, customNodeRef, globalInfo);
      },
      {
        equalityFn: createBulletEqualityFn(nodeId, 'YamdCustomNodeWrapper'),
      }
    );
    
    // Immediately check for existing requests
    // React guarantees child effects run before parent effects,
    // so CustomComponent's useImperativeHandle has already executed
    calcBulletYPos(nodeId, docId, customNodeRef, globalInfo);
    
    return unsubscribe;
  }, [nodeId, docId, globalInfo]);
  // ===== END ZUSTAND LOGIC =====

  // Get render utils from context
  const renderUtils = useRenderUtilsContext();

  const nodeData = renderUtils.getNodeDataById(nodeId);
  
  if (!nodeData) {
    return <div className="yamd-error">Node not found: {nodeId}</div>;
  }

  if (!CustomComponent) {
    return <div className="yamd-error">No CustomComponent provided to YamdCustomNodeWrapper</div>;
  }

  // Render the custom component with necessary props
  return (
    <CustomComponent
      ref={customNodeRef}
      nodeId={nodeId}
      nodeData={nodeData}
      parentInfo={parentInfo}
      globalInfo={globalInfo}
    />
  );
});

/**
 * Calculate preferred bullet Y position by delegating to custom component
 * @param {string} nodeId - Node ID
 * @param {string} docId - Document ID
 * @param {React.RefObject} customNodeRef - Reference to custom component
 * @param {object} globalInfo - Global info object
 * @returns {void}
 */
const calcBulletYPos = (nodeId, docId, customNodeRef, globalInfo) => {
  // Guard: check if custom component ref is ready
  // Note: React guarantees child effects run before parent effects,
  // so this should always be true when called from useEffect
  if (!customNodeRef.current?.calcBulletYPos) {
    console.warn(
      `nodeId: ${nodeId}, YamdCustomNodeWrapper calcBulletYPos: custom component ref not ready. ` +
      `This should not happen due to React's effect execution order.`
    );
    return;
  }

  const store = globalInfo.getDocStore().getState();
  // Get all requests for this node
  const requests = store.getBulletYPosReqs(docId, nodeId);
  console.log('nodeId:', nodeId, 'YamdCustomNodeWrapper calcBulletYPos requests:', requests);
  
  // If no requests, nothing to do
  if (Object.keys(requests).length === 0) {
    console.log('nodeId:', nodeId, 'YamdCustomNodeWrapper calcBulletYPos: no requests to process');
    return;
  }
  
  // Update result for each requesting container
  Object.keys(requests).forEach(containerClassName => {
    try {
      // Delegate to custom component's calcBulletYPos method
      const result = customNodeRef.current.calcBulletYPos(containerClassName);
      
      // Validate result format
      if (!result || typeof result.code !== 'number') {
        console.error('nodeId:', nodeId, 'Custom component calcBulletYPos returned invalid result:', result);
        const errorResult = { 
          code: -1, 
          message: 'Custom component returned invalid result format', 
          data: null 
        };
        store.updateReqResult(docId, nodeId, containerClassName, errorResult);
        store.incRespCounter(docId, nodeId, containerClassName);
        return;
      }
      
      // Update result in the Zustand store
      store.updateReqResult(docId, nodeId, containerClassName, result);
      // Increment response counter in store
      store.incRespCounter(docId, nodeId, containerClassName);
      
      console.log('nodeId:', nodeId, 'YamdCustomNodeWrapper successfully processed result:', result);
    } catch (error) {
      console.error('nodeId:', nodeId, 'YamdCustomNodeWrapper calcBulletYPos error:', error);
      const errorResult = { 
        code: -1, 
        message: `Custom component error: ${error.message}`, 
        data: null 
      };
      store.updateReqResult(docId, nodeId, containerClassName, errorResult);
      store.incRespCounter(docId, nodeId, containerClassName);
    }
  });
};

export default YamdCustomNodeWrapper;

