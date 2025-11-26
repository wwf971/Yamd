import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { getNodeClass } from '@/core/YamdNode.jsx';
import { useRenderUtilsContext } from '@/core/RenderUtils.ts';
// Store is now accessed via RenderUtils context
import { createBulletEqualityFn } from '@/core/RenderUtils.ts';

/**
 * Panel node renderer - displays collapsible panel with show/hide functionality
 */
const NodePanel = forwardRef(({ nodeId, parentInfo, globalInfo }, ref) => {
  const nodeRef = useRef(null);

  // Get render utils from context
  const renderUtils = useRenderUtilsContext();
  const docStore = renderUtils.docStore;
  const docId = renderUtils.docId;
  
  // Debug: check if docIds match
  if (globalInfo?.docId && docId !== globalInfo.docId) {
    console.warn('⚠️ NodePanel docId mismatch:', { renderUtilsDocId: docId, globalInfoDocId: globalInfo.docId });
  }

  // Register the node reference after the component finishes rendering
  useEffect(() => {
    if (nodeRef.current) {
      renderUtils.registerNodeRef?.(nodeId, nodeRef.current);
    }
  }, [nodeId, renderUtils.registerNodeRef]);

  // expose calcBulletYPos to parent via ref
  useImperativeHandle(ref, () => ({
    calcBulletYPos: () => {
      calcBulletYPos(nodeId, docId, nodeRef, buttonRef, docStore);
    }
  }), [nodeId, docId, docStore]);

  // ===== ZUSTAND LOGIC =====
  
  // Subscribe to request counter changes with custom equality function
  useEffect(() => {
    if (!nodeId || !docId || !docStore) return;
    console.log('NodePanel noteId:', nodeId, 'useEffect subscribe');
    const unsubscribe = docStore.subscribe(
      (state) => state.bulletYPosReq[docId]?.[nodeId] || {},
      (requests) => {
        console.log('noteId:', nodeId, 'NodePanel useEffect subscribe triggered with requests:', requests);
        // This will only fire if equalityFn returns false
        calcBulletYPos(nodeId, docId, nodeRef, buttonRef, docStore);
      },
      {
        equalityFn: createBulletEqualityFn(nodeId, 'NodePanel'),
      }
    );
    
    // Immediately check for existing requests
    calcBulletYPos(nodeId, docId, nodeRef, buttonRef, docStore);
    return unsubscribe;
  }, [nodeId, docId, docStore]);
  // ===== END ZUSTAND LOGIC =====

  // Subscribe to node data changes (especially children array changes)
  const nodeData = renderUtils.useNodeData(nodeId);
  
  if (!nodeData) {
    return <div className="yamd-error">Node not found: {nodeId}</div>;
  }

  const title = nodeData.textRaw ?? nodeData.textOriginal ?? '';
  const childDisplay = renderUtils.getChildDisplay(nodeData, false, parentInfo);
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
 * @param {object} docStore - Zustand document store
 * @returns {void}
 */
const calcBulletYPos = (nodeId, docId, nodeRef, buttonRef, docStore) => {
  if (!nodeRef.current || !buttonRef.current) return;
  
  const store = docStore.getState();
  // Get all requests for this node
  const requests = store.getBulletYPosReqs(docId, nodeId);
  console.log('noteId:', nodeId, 'NodePanel calcBulletYPos requests:', requests);
  
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

export default NodePanel;
