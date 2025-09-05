import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { getNodeClass } from '../YamdNode.jsx';
import YamdChildrenNodes from '../YamdChildrenNodes.jsx';
import { getChildrenDisplay } from '../YamdRenderUtils.js';
import { useYamdDocStore } from '../YamdDocStore.js';

/**
 * Divider node renderer - displays title as a divider line with text
 */
const YamdNodeDivider = forwardRef(({ nodeId, parentInfo, globalInfo }, ref) => {
  const nodeRef = useRef(null);

  // Register the node reference after the component finishes rendering
  useEffect(() => {
    if (nodeRef.current) {
      globalInfo?.registerNodeRef?.(nodeId, nodeRef.current);
    }
  }, [nodeId, globalInfo]);

  // Expose calcPreferredBulletYPos to parent via ref
  useImperativeHandle(ref, () => ({
    calcPreferredBulletYPos: () => {
      const docId = globalInfo?.docId;
      calcPreferredBulletYPos(nodeId, docId, nodeRef, dividerRef);
    }
  }), [nodeId, globalInfo]);

  // ===== ZUSTAND LOGIC =====
  const docId = globalInfo?.docId;
  
  // Subscribe to request counter changes with custom equality function
  useEffect(() => {
    if (!nodeId || !docId) {
      console.warn('noteId:', nodeId, 'docId:', docId, 'YamdNodeDivider useEffect subscribe skipped');
      return;
    }
    console.log('noteId:', nodeId, 'docId:', docId, 'YamdNodeDivider useEffect subscribe');
    const unsubscribe = useYamdDocStore.subscribe(
      (state) => state.listBulletPreferredYPosRequests[docId]?.[nodeId] || {},
      (requests) => {
        console.log('noteId:', nodeId, 'YamdNodeDivider useEffect subscribe triggered with requests:', requests);
        // This will only fire if equalityFn returns false
        calcPreferredBulletYPos(nodeId, docId, nodeRef, dividerRef);
      },
      {
        equalityFn: (prev, next) => {
          console.log("noteId:", nodeId, "YamdNodeDivider equalityFn prev:", prev, "next:", next);
          // Only trigger if requestCounter has increased (ignore responseCounter changes)
          const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
          const hasNewRequests = Array.from(keys).some((key) => 
            (next[key]?.requestCounter || 0) > (prev[key]?.requestCounter || 0)
          );
          const shouldSkip = !hasNewRequests; // Skip if no new requests
          console.log("noteId:", nodeId, "YamdNodeDivider equalityFn hasNewRequests:", hasNewRequests, "shouldSkip:", shouldSkip);
          return shouldSkip;
        },
      }
    );
    
    // Immediately check for existing requests
    calcPreferredBulletYPos(nodeId, docId, nodeRef, dividerRef);
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

  const title = nodeData.textRaw || nodeData.textOriginal || '';
  const childDisplay = getChildrenDisplay(nodeData, false, parentInfo);
  const childClass = nodeData.attr?.childClass;
  
  // Use the utility function to get appropriate CSS class
  const nodeClass = getNodeClass(nodeData, parentInfo) || 'yamd-divider-text';

  // Ref to measure divider line height for bullet positioning
  const dividerRef = useRef(null);

  // Note: This component now provides bullet positioning via Zustand on demand
  // and exposes calcPreferredBulletYPos via useImperativeHandle

  return (
    <div ref={nodeRef} className="yamd-node-divider yamd-full-width">
      <div ref={dividerRef} className="yamd-divider-line">
        <span className={nodeClass}>{title}</span>
      </div>
      {nodeData.children && nodeData.children.length > 0 && (
        <YamdChildrenNodes
          childIds={nodeData.children}
          shouldAddIndent={false}
          parentInfo={{ 
            ...parentInfo, 
            ...(childDisplay && { childDisplay }),
            ...(childClass && { childClass })
          }}
          globalInfo={globalInfo}
        />
      )}
    </div>
  );
});


/**
 * Calculate preferred bullet Y position for divider
 * @param {string} nodeId - Node ID
 * @param {string} docId - Document ID  
 * @param {React.RefObject} nodeRef - Node DOM reference
 * @param {React.RefObject} dividerRef - Divider line DOM reference
 * @returns {void}
 */
const calcPreferredBulletYPos = (nodeId, docId, nodeRef, dividerRef) => {
  if (!nodeRef.current || !dividerRef.current) return;
  
  const store = useYamdDocStore.getState();
  // Get all requests for this node
  const requests = store.getPreferredYPosRequests(docId, nodeId);
  console.log('noteId:', nodeId, 'YamdNodeDivider calcPreferredBulletYPos requests:', requests);
  
  // Update result for each requesting container
  Object.keys(requests).forEach(containerClassName => {
    try {
             // CORRECT: Calculate relative to bullet container, not divider container
       const dividerRect = dividerRef.current.getBoundingClientRect();
       const bulletContainer = nodeRef.current.closest(containerClassName);
       
       if (!bulletContainer) {
         const result = { code: -1, message: `Divider: bullet container ${containerClassName} not found`, data: null };
         store.updateRequestResult(docId, nodeId, containerClassName, result);
         store.incResponseCounter(docId, nodeId, containerClassName);
         return;
       }
       
       const containerRect = bulletContainer.getBoundingClientRect();
       
       // Divider's Y position relative to bullet container  
       const dividerRelativeTop = dividerRect.top - containerRect.top;
       const preferredYPos = dividerRelativeTop + (dividerRect.height / 2);
      
      const result = { code: 0, message: 'Divider line position', data: preferredYPos };
      
      // Update result in the Zustand store
      store.updateRequestResult(docId, nodeId, containerClassName, result);
      // Increment response counter in store
      store.incResponseCounter(docId, nodeId, containerClassName);
    } catch (error) {
      const result = { code: -1, message: `Divider positioning error: ${error.message}`, data: null };
      store.updateRequestResult(docId, nodeId, containerClassName, result);
      store.incResponseCounter(docId, nodeId, containerClassName);
    }
  });
};



export default YamdNodeDivider;
