import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { getNodeClass } from '@/core/YamdNode.jsx';
import { getChildrenDisplay } from '../YamdRenderUtils.js';
import { useYamdDocStore } from '@/core/YamdDocStore.js';
import { createBulletEqualityFn } from '../YamdRenderUtils.js';

/**
 * Panel node renderer - displays collapsible panel with show/hide functionality
 */
const YamdPanel = forwardRef(({ nodeId, parentInfo, globalInfo }, ref) => {
  const nodeRef = useRef(null);

  // Register the node reference after the component finishes rendering
  useEffect(() => {
    if (nodeRef.current) {
      globalInfo?.registerNodeRef?.(nodeId, nodeRef.current);
    }
  }, [nodeId, globalInfo]);

  // expose calcBulletYPos to parent via ref
  useImperativeHandle(ref, () => ({
    calcBulletYPos: () => {
      const docId = globalInfo?.docId;
      calcBulletYPos(nodeId, docId, nodeRef, buttonRef);
    }
  }), [nodeId, globalInfo]);

  // ===== ZUSTAND LOGIC =====
  // get docId from globalInfo or use default
  const docId = globalInfo?.docId; // don't use 'default-doc' here. let it be undefined.
  
  // Subscribe to request counter changes with custom equality function
  useEffect(() => {
    if (!nodeId || !docId) return;
    console.log('YamdPanel noteId:', nodeId, 'useEffect subscribe');
    const unsubscribe = useYamdDocStore.subscribe(
      (state) => state.bulletPreferredYPosReq[docId]?.[nodeId] || {},
      (requests) => {
        console.log('noteId:', nodeId, 'YamdPanel useEffect subscribe triggered with requests:', requests);
        // This will only fire if equalityFn returns false
        calcBulletYPos(nodeId, docId, nodeRef, buttonRef);
      },
      {
        equalityFn: createBulletEqualityFn(nodeId, 'YamdPanel'),
      }
    );
    
    // Immediately check for existing requests
    calcBulletYPos(nodeId, docId, nodeRef, buttonRef);
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
  
  // use the utility function to get appropriate CSS class
  const nodeClass = getNodeClass(nodeData, parentInfo) || 'yamd-panel-title';
  
  // compute initial state only once and cache it
  const [isExpanded, setIsExpanded] = useState(() => {
    return nodeData.attr?.panelDefault?.toLowerCase() === 'collapse' ? false : 
           nodeData.attr?.panelDefault?.toLowerCase() === 'expand' ? true :
           true;
  });

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // ref to measure button position for bullet positioning
  const buttonRef = useRef(null);

  // Note: This component now provides bullet positioning via Zustand on demand

  return (
    <div ref={nodeRef} className="yamd-panel">
      <div 
        className="yamd-panel-header" 
        onClick={toggleExpanded}
      >
        <span className={nodeClass}>{title}</span>
        <button 
          ref={buttonRef}
          className="yamd-panel-toggle" 
          type="button"
        >
          {isExpanded ? 'hide' : 'show'}
        </button>
      </div>
      {isExpanded && (
        <div className="yamd-panel-content">
          {nodeData.children && nodeData.children.length > 0 && (
            globalInfo.renderChildNodes(nodeData.children, {
              shouldAddIndent: false,
              parentInfo: { 
                ...parentInfo, 
                ...(childDisplay && { childDisplay }),
                ...(childClass && { childClass })
              }
            })
          )}
        </div>
      )}
    </div>
  );
});

/**
 * Calculate preferred bullet Y position for panel
 * @param {string} nodeId - Node ID
 * @param {string} docId - Document ID  
 * @param {React.RefObject} nodeRef - Node DOM reference
 * @param {React.RefObject} buttonRef - Button DOM reference
 * @returns {void}
 */
const calcBulletYPos = (nodeId, docId, nodeRef, buttonRef) => {
  if (!nodeRef.current || !buttonRef.current) return;
  
  const store = useYamdDocStore.getState();
  // Get all requests for this node
  const requests = store.getBulletYPosReqs(docId, nodeId);
  console.log('noteId:', nodeId, 'YamdPanel calcBulletYPos requests:', requests);
  
  // Update result for each requesting container
  Object.keys(requests).forEach(containerClassName => {
    try {
      // CORRECT: Calculate relative to bullet container, not panel container
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const bulletContainer = nodeRef.current.closest(containerClassName);
      
      if (!bulletContainer) {
        const result = { code: -1, message: `Panel: bullet container ${containerClassName} not found`, data: null };
        store.updateReqResult(docId, nodeId, containerClassName, result);
        store.incRespCounter(docId, nodeId, containerClassName);
        return;
      }
      
      const containerRect = bulletContainer.getBoundingClientRect();
      
      // Button's Y position relative to bullet container
      const buttonRelativeTop = buttonRect.top - containerRect.top;
      const preferredYPos = buttonRelativeTop + (buttonRect.height / 2);
      
      const result = { code: 0, message: 'Panel button position', data: preferredYPos };
      
      // Update result in the Zustand store
      store.updateReqResult(docId, nodeId, containerClassName, result);
      // Increment response counter in store
      store.incRespCounter(docId, nodeId, containerClassName);
    } catch (error) {
      const result = { code: -1, message: `Panel positioning error: ${error.message}`, data: null };
      store.updateReqResult(docId, nodeId, containerClassName, result);
      store.incRespCounter(docId, nodeId, containerClassName);
    }
  });
};

export default YamdPanel;
