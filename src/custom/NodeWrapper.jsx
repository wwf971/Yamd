import React, { useRef, useEffect, useLayoutEffect, forwardRef, useImperativeHandle } from 'react';
import { useRenderUtilsContext, createBulletEqualityFn } from '@/core/RenderUtils.ts';
import { docsState, docsBulletState, nodeBulletState } from '@/core/DocStore.js';

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
 * - nodeState: object - The node state from docsState (focus, etc.)
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
  
  // Get render utils from context
  const renderUtils = useRenderUtilsContext();
  
  // Subscribe to node state (focus, etc.) from Jotai
  const docId = globalInfo?.docId;
  const nodeState = renderUtils.useNodeState ? renderUtils.useNodeState(nodeId) : {};
  
  // Expose calcBulletYPos to parent via ref
  useImperativeHandle(ref, () => ({
    calcBulletYPos: () => {
      const docId = globalInfo?.docId;
      calcBulletYPos(nodeId, docId, customNodeRef, globalInfo);
    }
  }), [nodeId, globalInfo]);

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
  // Use useLayoutEffect to calculate BEFORE paint, preventing flash of wrong position
  useLayoutEffect(() => {
    if (!nodeId || !docId) {
      console.warn('nodeId:', nodeId, 'docId:', docId, 'YamdCustomNodeWrapper useLayoutEffect subscribe skipped');
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
      console.log('nodeId:', nodeId, 'docId:', docId, 'YamdCustomNodeWrapper reqCounter increased');
    // React guarantees child effects run before parent effects,
    // so CustomComponent's useImperativeHandle has already executed
    calcBulletYPos(nodeId, docId, customNodeRef, globalInfo);
    }
  }, [nodeId, docId, reqCounters, globalInfo]);
  // ===== END JOTAI LOGIC =====
  
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
      nodeState={nodeState}
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

  // Get all requests for this node using Jotai
  const requests = nodeBulletState.getAllBulletYPosReqs(docId, nodeId);
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
        nodeBulletState.updateBulletYPosResult(docId, nodeId, containerClassName, errorResult);
        return;
      }
      
      // Update result in Jotai (automatically increments response counter)
      nodeBulletState.updateBulletYPosResult(docId, nodeId, containerClassName, result);
      
      console.log('nodeId:', nodeId, 'YamdCustomNodeWrapper successfully processed result:', result);
    } catch (error) {
      console.error('nodeId:', nodeId, 'YamdCustomNodeWrapper calcBulletYPos error:', error);
      const errorResult = { 
        code: -1, 
        message: `Custom component error: ${error.message}`, 
        data: null 
      };
      nodeBulletState.updateBulletYPosResult(docId, nodeId, containerClassName, errorResult);
    }
  });
};

export default YamdCustomNodeWrapper;

