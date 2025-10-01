import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { getNodeClass } from '../YamdNode.jsx';
import YamdChildrenNodes from '../YamdChildrenNodes.jsx';
import { getChildrenDisplay } from '../YamdRenderUtils.js';
import { useYamdDocStore } from '../YamdDocStore.js';
import { createBulletEqualityFn } from '../YamdRenderUtils.js';

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
      (state) => state.bulletPreferredYPosRequests[docId]?.[nodeId] || {},
      (requests) => {
        console.log('noteId:', nodeId, 'YamdNodeDivider useEffect subscribe triggered with requests:', requests);
        // This will only fire if equalityFn returns false
        calcPreferredBulletYPos(nodeId, docId, nodeRef, dividerRef);
      },
      {
        equalityFn: createBulletEqualityFn(nodeId, 'YamdNodeDivider'),
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
 * @param {React.RefObject} dividerRef - Divider line DOM reference (points to left line)
 * @returns {void}
 */
const calcPreferredBulletYPos = (nodeId, docId, nodeRef, dividerRef) => {
  if (!nodeRef.current || !dividerRef.current) return;
  
  const store = useYamdDocStore.getState();
  // get all requests for this node
  const requests = store.getPreferredYPosRequests(docId, nodeId);
  console.log('noteId:', nodeId, 'YamdNodeDivider calcPreferredBulletYPos requests:', requests);
  
  // update result for each requesting container
  Object.keys(requests).forEach(containerClassName => {
    try {
       // Get the flex container that contains the lines
       const dividerContainer = dividerRef.current.parentElement; // The flex container
       const bulletContainer = nodeRef.current.closest(containerClassName);
       
       if (!bulletContainer || !dividerContainer) {
         const result = { code: -1, message: `Divider: bullet container ${containerClassName} not found`, data: null };
         store.updateRequestResult(docId, nodeId, containerClassName, result);
         store.incResponseCounter(docId, nodeId, containerClassName);
         return;
       }
       
       const containerRect = bulletContainer.getBoundingClientRect();
       const dividerContainerRect = dividerContainer.getBoundingClientRect();
       
       // Target the vertical center of the flex container (where lines are positioned)
       const dividerRelativeTop = dividerContainerRect.top - containerRect.top;
       const preferredYPos = dividerRelativeTop + (dividerContainerRect.height / 2);
      
      const result = { code: 0, message: 'Divider line center position', data: preferredYPos };
      
      // update result in the Zustand store
      store.updateRequestResult(docId, nodeId, containerClassName, result);
      // increment response counter in store
      store.incResponseCounter(docId, nodeId, containerClassName);
    } catch (error) {
      const result = { code: -1, message: `Divider positioning error: ${error.message}`, data: null };
      store.updateRequestResult(docId, nodeId, containerClassName, result);
      store.incResponseCounter(docId, nodeId, containerClassName);
    }
  });
};

export default YamdNodeDivider;
