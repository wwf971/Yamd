import React, { useState, useRef, useCallback, useMemo, useEffect, useLayoutEffect } from 'react';
import { useAtom } from 'jotai';
import YamdNode from '@/core/YamdNode.jsx';
import YamdChildNodes from '@/core/YamdChildNodes.jsx';
import YamdRefHandler from '@/components/NodeRefHandler.jsx';
import YamdBibsList from '@/components/NodeBibsList.jsx';
import NodeWrapper from '@/custom/NodeWrapper.jsx';
import { handleRefClick, handleBibClick, handleBackToSource } from '@/core/YamdDoc.js';
import { useDocStore, generateDocId, docsData, docsState, nodeBulletState } from '@/core/DocStore.js';
// Import RenderUtils context for direct usage
import { RenderUtilsContext, createRenderUtilsContextValue } from '@/core/RenderUtils.ts';



/**
 * YamdDoc - Document container that manages global reference handling
 * Renders the root YamdNode and provides reference navigation functionality
 */
const YamdDoc = ({
  docId,
  disableRefJump = false,
  disableBibsList = false,
  customNodeRenderer = null,
  isEditable = false,
  onCurrentSegmentChange = null, // Callback for current segment ID changes
}) => {
  if (!docId) {
    console.error('YamdDoc: docId is required');
    return <div className="yamd-error">Error: docId is required</div>;
  }
  
  const containerRef = useRef(null);
  const nodeRefsMap = useRef(new Map()); // Map from nodeId to DOM element reference
  const [refState, setRefState] = useState({
    isVisible: false,
    type: null, // 'ref' or 'bib'
    refSourceId: null,
    targetId: null,
    clickY: 0,
    sourceElement: null
  });
  
  // Track currently focused segment (for editable mode)
  const [currentSegmentId, setCurrentSegmentIdState] = useState(null);
  const prevSegmentIdRef = useRef(null);
  
  // Notify previous segment to unfocus
  const notifySegmentToUnfocus = useCallback((prevSegmentId, newSegmentId) => {
    if (!isEditable || !prevSegmentId || prevSegmentId === newSegmentId) return;
    
    console.log(`🔔 Notifying segment ${prevSegmentId} to unfocus, new focus: ${newSegmentId}`);
    docsState.triggerUnfocus(docId, prevSegmentId, prevSegmentId, 'clickAway');
  }, [isEditable, docId]);
  
  // Wrapper for setCurrentSegmentId that also notifies previous segment
  const setCurrentSegmentId = useCallback((newSegmentId) => {
    const prevSegmentId = prevSegmentIdRef.current;
    
    // Skip if already the current segment (avoid double-notification from mousedown + focus)
    if (prevSegmentId === newSegmentId) return;
    
    // Notify previous segment to unfocus
    notifySegmentToUnfocus(prevSegmentId, newSegmentId);
    
    // Update state and ref
    setCurrentSegmentIdState(newSegmentId);
    prevSegmentIdRef.current = newSegmentId;
    
    // Notify parent component
    if (onCurrentSegmentChange) {
      onCurrentSegmentChange(newSegmentId);
    }
  }, [notifySegmentToUnfocus, onCurrentSegmentChange]);
  
  // Cancel current segment (set to null)
  const cancelCurrentSegmentId = useCallback(() => {
    const prevSegmentId = prevSegmentIdRef.current;
    console.log(`🚫 YamdDoc canceling currentSegmentId (was: ${prevSegmentId})`);
    
    // Notify previous segment to unfocus before clearing
    if (isEditable && prevSegmentId) {
      console.log(`🔔 Notifying segment ${prevSegmentId} to unfocus (cancel)`);
      docsState.triggerUnfocus(docId, prevSegmentId, prevSegmentId, 'clickAway');
    }
    
    setCurrentSegmentIdState(null);
    prevSegmentIdRef.current = null;
    
    // Notify parent component
    if (onCurrentSegmentChange) {
      onCurrentSegmentChange(null);
    }
  }, [isEditable, docId, onCurrentSegmentChange]);
  
  // Handle keyboard events at root level and forward to focused segment
  const handleKeyDown = useCallback((e) => {
    handleRootKeyDown(e, isEditable, currentSegmentId, docId);
  }, [isEditable, currentSegmentId, docId]);

  // handle reference click from NodeTextRichRef components
  const handleRefClickCallback = useCallback((refData) => {
    handleRefClick(refData, containerRef, setRefState);
  }, []);

  // handle bibliography click from NodeTextRichBib components
  const handleBibClickCallback = useCallback((bibData) => {
    handleBibClick(bibData, containerRef, setRefState, disableRefJump, disableBibsList);
  }, [disableRefJump, disableBibsList]);

  // handle going back to source
  const handleBackToSourceCallback = useCallback(() => {
    handleBackToSource(setRefState);
  }, []);

  // register node reference - called by components after they finish rendering
  const registerNodeRef = useCallback((nodeId, nodeRef) => {
    if (nodeId && nodeRef) {
      nodeRefsMap.current.set(nodeId, nodeRef);
      // console.log(`📌 Registered node ref for ${nodeId}:`, nodeRef);
    }
  }, [nodeRefsMap]);

  // Get node reference by ID
  const getNodeRefById = useCallback((nodeId) => {
    return nodeRefsMap.current.get(nodeId);
  }, []);

  // Create stable globalInfo object to prevent infinite re-renders
  const globalInfo = useMemo(() => {
    // Create the globalInfo object (will be used recursively)
    const globalInfo = { 
      docId: docId, // Include docId for Zustand positioning
      docStore: useDocStore, // Direct reference to Zustand store
      
      onRefClick: handleRefClickCallback, // Function for reference handling
      onBibClick: handleBibClickCallback, // Function for bibliography handling
      registerNodeRef: registerNodeRef, // Function for registering node DOM references
      getNodeRefById: getNodeRefById, // Function for retrieving node DOM references
      getDocStore: () => useDocStore, // Function to get Zustand document store (backwards compat)
      
      
      /**
       * Render custom node - calls user-provided custom node renderer wrapped in NodeWrapper
       * @param {object} nodeData - The node data with type='custom' and customType
       * @param {object} parentInfo - Parent context information
       * @returns {React.Element} Rendered custom node component
       */
      renderCustomNode: (nodeData, parentInfo) => {
        if (!customNodeRenderer) {
          return <div className="yamd-error">No custom node renderer provided</div>;
        }
        
        const customType = nodeData.attr?.customType;
        if (!customType) {
          return <div className="yamd-error">Custom node missing customType attribute</div>;
        }
        
        const CustomComponent = customNodeRenderer[customType];
        if (!CustomComponent) {
          return <div className="yamd-error">Unknown custom type: {customType}</div>;
        }
        
        // Wrap the custom component with NodeWrapper to handle bullet positioning
        return <NodeWrapper 
          nodeId={nodeData.id}
          nodeData={nodeData}
          parentInfo={parentInfo}
          globalInfo={globalInfo}
          CustomComponent={CustomComponent}
        />;
      },
      
      getBibText: (bibKey) => {
        // For now, always return fallback (user can override this)
        return {
          code: -1,
          message: 'Bibliography text fetching not implemented',
          data: null
        };
      },
      
      fetchExternalData: (nodeData) => {
        console.log('🌐 fetchExternalData called with:', nodeData);
        return {
          code: 1, // Component should handle data fetching itself
          message: 'Component should handle data fetching directly',
          data: null
        };
      }
    };
    
    return globalInfo;
  }, [handleRefClickCallback, handleBibClickCallback,
      registerNodeRef, getNodeRefById, docId, customNodeRenderer
    ]
  );

  // Create renderChildNodes function
  const renderChildNodes = useCallback(({
    childIds, 
    shouldAddIndent = false, 
    parentInfo = null, 
    globalInfo, 
    firstChildRef = null
  }) => {
    return (
      <YamdChildNodes
        childIds={childIds}
        shouldAddIndent={shouldAddIndent}
        parentInfo={parentInfo}
        globalInfo={globalInfo}
        firstChildRef={firstChildRef}
      />
    );
  }, []);

  // Initialize render utils context value
  // Note: currentSegmentId is intentionally NOT included - it would cause all segments to re-render on every click
  const renderUtilsContextValue = useMemo(() => 
    createRenderUtilsContextValue({ 
      registerNodeRef, 
      renderChildNodes,
      isEditable,
      docId: docId,
      docStore: useDocStore,
      setCurrentSegmentId,
      cancelCurrentSegmentId
    }), 
    [registerNodeRef, renderChildNodes, isEditable, docId, setCurrentSegmentId, cancelCurrentSegmentId]
  );

  // Get document data from Jotai atoms
  const [rootNodeId] = useAtom(docsData.getRootNodeId(docId));
  const [bibs] = useAtom(docsData.getBibs(docId));

  // If no rootNodeId yet, document hasn't been loaded
  if (!rootNodeId) {
    return <div className="yamd-loading">Loading document...</div>;
  }

  return (
    <RenderUtilsContext.Provider value={renderUtilsContextValue}>
      <div 
        ref={containerRef} 
        style={{ 
          position: 'relative',
          outline: isEditable ? 'none' : undefined
        }} 
        data-doc-id={docId}
        contentEditable={isEditable ? true : undefined}
        suppressContentEditableWarning={isEditable ? true : undefined}
        onKeyDown={handleKeyDown}
      >
        
        {/* main document, rendering start from root node*/}
        <YamdNode
          nodeId={rootNodeId}
          parentInfo={null}
          globalInfo={globalInfo}
        />

        {/* bibliography list at the end of document */}
        {!disableBibsList && (
          <YamdBibsList 
            bibs={bibs}
            globalInfo={globalInfo}
          />
        )}

        {/* deals with user click on refs and bibs*/}
        {!disableRefJump && (
          <YamdRefHandler
            refState={refState}
            onBackToSource={handleBackToSourceCallback}
            containerRef={containerRef}
          />
        )}
      </div>
    </RenderUtilsContext.Provider>
  );
};

export default YamdDoc;


/**
 * Handle keyboard events at root level and forward to focused segment
 * @param {KeyboardEvent} e - The keyboard event
 * @param {boolean} isEditable - Whether document is in editable mode
 * @param {string|null} currentSegmentId - Currently focused segment ID
 * @param {string} docId - Document ID
 * @returns {void}
 */
const handleRootKeyDown = (e, isEditable, currentSegmentId, docId) => {
  if (!isEditable || !currentSegmentId) return;

  // Ignore events from child elements (nested contentEditable, buttons, etc.)
  // Only handle events that originate from the root contentEditable itself
  if (e.target !== e.currentTarget) {
    return;
  }

  // Only forward events with modifier keys (Ctrl, Alt, Meta)
  // OR arrow keys (for navigation in edit panels)
  const hasModifier = e.ctrlKey || e.altKey || e.metaKey;
  const isArrowKey = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key);
  const isEnterOrEscape = ['Enter', 'Escape'].includes(e.key);
  
  if (!hasModifier && !isArrowKey && !isEnterOrEscape) {
    // Let browser handle regular character input naturally
    return;
  }
  
  // Note: We don't call preventDefault() here for arrow keys
  // Browser moves cursor in contentEditable before this handler runs
  // Segments will preventDefault only when triggering unfocus
  
  // Extract important event attributes and add no-op methods
  const eventData = {
    key: e.key,
    ctrlKey: e.ctrlKey,
    shiftKey: e.shiftKey,
    metaKey: e.metaKey,
    altKey: e.altKey,
    preventDefault: () => {}, // No-op (segments handle this)
    stopPropagation: () => {} // No-op (event already at root)
  };
  
  // Forward to currently focused segment
  docsState.triggerKeyboard(docId, currentSegmentId, eventData);
};