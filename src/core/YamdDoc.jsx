import React, { useState, useRef, useCallback, useMemo, useEffect, useLayoutEffect } from 'react';
import { useAtom } from 'jotai';
import YamdNode from '@/core/YamdNode.jsx';
import Children from '@/core/Children.jsx';
import YamdRefHandler from '@/components/NodeRefHandler.jsx';
import YamdBibsList from '@/components/NodeBibsList.jsx';
import NodeWrapper from '@/custom/NodeWrapper.jsx';
import { handleRefClick, handleBibClick, handleBackToSource } from '@/core/YamdDoc.js';
import { useDocStore, generateDocId, docsData, docsState, nodeBulletState } from '@/core/DocStore.js';
// Import RenderUtils context for direct usage
import { RenderUtilsContext, createRenderUtilsContextValue } from '@/core/RenderUtils.ts';
import { findSegFromSelection, getFirstSegInTree, getLastSegInTree, findSegIdFromNode } from '@/components/TextUtils.js';



/**
 * YamdDoc - Document container that manages global reference handling
 * Renders the root YamdNode and provides reference navigation functionality
 */
const YamdDoc = ({
  docId,
  disableRefJump = false,
  disableBibsList = false,
  getCustomComp = null,
  isEditable = false,
  onCurrentSegmentChange = null, // Callback for current segment ID changes
  onCreate = null, // Callback when a node/segment is created: (id, data) => void
  onDelete = null, // Callback when a node/segment is deleted: (id, data) => void
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
  const [currentSegId, setCurrentSegIdState] = useState(null);
  const prevSegIdRef = useRef(null);
  
  // Notify previous segment to unfocus
  const notifySegmentToUnfocus = useCallback((prevSegId, newSegId) => {
    if (!isEditable || !prevSegId || prevSegId === newSegId) return;
    
    // console.log(`[🔔UNFOCUS] Notifying segment ${prevSegId} to unfocus, new focus: ${newSegId}`);
    docsState.triggerUnfocus(docId, prevSegId, prevSegId, 'clickAway');
  }, [isEditable, docId]);
  
  // Wrapper for setCurrentSegId that also notifies previous segment
  const setCurrentSegId = useCallback((newSegId) => {
    const prevSegId = prevSegIdRef.current;
    
    // Skip if already the current segment (avoid double-notification from mousedown + focus)
    if (prevSegId === newSegId) return;
    
    // Notify previous segment to unfocus
    notifySegmentToUnfocus(prevSegId, newSegId);
    
    // Update state and ref
    setCurrentSegIdState(newSegId);
    prevSegIdRef.current = newSegId;
    
    // Notify parent component
    if (onCurrentSegmentChange) {
      onCurrentSegmentChange(newSegId);
    }
  }, [notifySegmentToUnfocus, onCurrentSegmentChange]);
  
  // Cancel current segment (set to null)
  const cancelCurrentSegId = useCallback(() => {
    const prevSegId = prevSegIdRef.current;
    console.log(`🚫 YamdDoc canceling currentSegId (was: ${prevSegId})`);
    
    // Notify previous segment to unfocus before clearing
    if (isEditable && prevSegId) {
      // console.log(`[🔔UNFOCUS] Notifying segment ${prevSegId} to unfocus (cancel)`);
      docsState.triggerUnfocus(docId, prevSegId, prevSegId, 'clickAway');
    }
    
    setCurrentSegIdState(null);
    prevSegIdRef.current = null;
    
    // Notify parent component
    if (onCurrentSegmentChange) {
      onCurrentSegmentChange(null);
    }
  }, [isEditable, docId, onCurrentSegmentChange]);

  // Handle blur events on root - unfocus current segment when clicking outside
  const handleBlur = useCallback((e) => {
    // Only handle if editable and there's a focused segment
    if (!isEditable || !currentSegId) return;
    
    // Ignore blur when the document loses focus (such as when switching to another browser tab)
    // Keep logical focus so edits remain tracked when the tab becomes active again
    if (document.visibilityState !== 'visible' || !document.hasFocus()) {
      return;
    }

    // Check if the blur is due to clicking outside the document
    // relatedTarget is the element that received focus (null if clicking outside)
    const clickedOutside = !e.relatedTarget || !e.currentTarget.contains(e.relatedTarget);
    
    if (clickedOutside) {
      console.log(`🔵 YamdDoc blur: clicking outside, unfocusing segment ${currentSegId}`);
      cancelCurrentSegId();
    }
  }, [isEditable, currentSegId, cancelCurrentSegId]);

  // Helper function to check if click is below the last item
  const isClickBelowLastItem = useCallback((clickY) => {
    if (clickY === undefined) return false;
    
    // Find the node with the lowest bottom position among all registered nodes
    let lowestBottom = -Infinity;
    
    for (const [nodeId, nodeElement] of nodeRefsMap.current.entries()) {
      if (nodeElement) {
        const rect = nodeElement.getBoundingClientRect();
        if (rect.bottom > lowestBottom) {
          lowestBottom = rect.bottom;
        }
      }
    }
    
    return lowestBottom !== -Infinity && clickY > lowestBottom;
  }, []);

  // Handle mousedown - check if click is below last item and prevent cursor placement
  const handleMouseDown = useCallback((e) => {
    if (!isEditable) return;
    
    // If click is below the last item, prevent default to stop cursor placement
    if (isClickBelowLastItem(e.clientY)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, [isEditable, isClickBelowLastItem]);

  // Handle click on root - check if click lands on root element itself
  const handleClick = useCallback((e, currentRootNodeId) => {
    // onClick fires on mouse release, not on mouse down.
    if (!isEditable) return;
    
    // Check if click is below the last item's bounding rect
    // If so, unfocus the document instead of focusing any segment
    if (isClickBelowLastItem(e.clientY)) {
      e.preventDefault();
      e.stopPropagation();
      cancelCurrentSegId();
      
      // Clear any selection/cursor that the browser might have created
      // Use requestAnimationFrame to ensure it happens after browser's default behavior
      requestAnimationFrame(() => {
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
        }
      });
      
      return;
    }
    
    // Check selection synchronously before any async operations
    // If selection spans multiple segments, focus on the end segment but preserve selection
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      
      // Find segments for start and end - search across component boundaries
      const segStartId = findSegIdFromNode(range.startContainer);
      const segEndId = findSegIdFromNode(range.endContainer);
      
      // If selection spans multiple segments, focus on the end segment (preserves selection)
      if (segStartId && segEndId && segStartId !== segEndId) {
        e.preventDefault();
        e.stopPropagation();
        // Focus on the end segment - the focus handler will preserve the selection
        docsState.triggerFocus(docId, segEndId, 'fromLeft');
        return;
      }
    }
    
    // Check if click landed directly on the root wrapper (between nodes)
    // e.currentTarget is the element the handler is attached to
    // e.target is the actual element that was clicked
    if (e.target === e.currentTarget) {
      // Capture the element reference before requestAnimationFrame
      // (React recycles synthetic events, so e.currentTarget becomes null)
      const rootElement = e.currentTarget;
      
      // Use the browser's natural selection/cursor position to find the nearest segment
      // This is much more efficient than calculating distances to all segments
      requestAnimationFrame(() => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        
        // Double-check: if selection is not collapsed, verify it doesn't span multiple segments
        if (!selection.isCollapsed) {
          const range = selection.getRangeAt(0);
          const segStartId = findSegIdFromNode(range.startContainer);
          const segEndId = findSegIdFromNode(range.endContainer);
          
          // If selection spans multiple segments, focus on the end segment (preserves selection)
          if (segStartId && segEndId && segStartId !== segEndId) {
            docsState.triggerFocus(docId, segEndId, 'fromLeft');
            return;
          }
        }
        
        const { segId, focusType, isDocumentBoundary, boundaryPosition } = findSegFromSelection(rootElement);
        
        if (segId) {
          docsState.triggerFocus(docId, segId, focusType);
        } else if (isDocumentBoundary && currentRootNodeId) {
          // Click is at document boundary (before first or after last node)
          const getNodeData = (nodeId) => {
            const store = useDocStore.getState();
            return store.docNodes?.[docId]?.[nodeId];
          };
          
          if (boundaryPosition === 'end') {
            // Click is after the last node - focus the last segment
            const boundarySegId = getLastSegInTree(currentRootNodeId, getNodeData);
            if (boundarySegId) {
              docsState.triggerFocus(docId, boundarySegId, focusType);
            }
          } else {
            // Click is before the first node - focus the first segment
            const boundarySegId = getFirstSegInTree(currentRootNodeId, getNodeData);
            if (boundarySegId) {
              docsState.triggerFocus(docId, boundarySegId, focusType);
            }
          }
        }
      });
    }
  }, [docId, isEditable, cancelCurrentSegId]);

  // handle reference click from SegmentsRef components
  const handleRefClickCallback = useCallback((refData) => {
    handleRefClick(refData, containerRef, setRefState);
  }, []);

  // handle bibliography click from NodeRichTextBib components
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
       * @param {object} globalInfo - Global info object
       * @returns {React.Element} Rendered custom node component
       */
      renderCustomNode: (nodeData, parentInfo, globalInfo) => {
        if (!getCustomComp) {
          return <div className="yamd-error">No getCustomComp provided</div>;
        }
        
        const customType = nodeData.attr?.customType;
        if (!customType) {
          return <div className="yamd-error">Custom node missing customType attribute</div>;
        }
        
        const CustomComponent = getCustomComp(customType);
        if (!CustomComponent) {
          return <div className="yamd-error">Custom component not found</div>;
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
      registerNodeRef, getNodeRefById, docId, getCustomComp
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
      <Children
        childIds={childIds}
        shouldAddIndent={shouldAddIndent}
        parentInfo={parentInfo}
        globalInfo={globalInfo}
        firstChildRef={firstChildRef}
      />
    );
  }, []);

  // Initialize render utils context value
  // Note: currentSegId is intentionally NOT included - it would cause all segments to re-render on every click
  const renderUtilsContextValue = useMemo(() => 
    createRenderUtilsContextValue({ 
      registerNodeRef, 
      renderChildNodes,
      isEditable,
      docId: docId,
      docStore: useDocStore,
      setCurrentSegId,
      cancelCurrentSegId,
      onCreate,
      onDelete
    }), 
    [registerNodeRef, renderChildNodes, isEditable, docId, setCurrentSegId, cancelCurrentSegId, onCreate, onDelete]
  );

  // Handle keyboard events at root level
  const handleKeyDown = useCallback((e) => {
    // Handle Tab/Shift+Tab at root level for indent/outdent (node-level operation)
    // This is more appropriate than forwarding to segments since indent/outdent affects node structure
    if (e.key === 'Tab' && isEditable && currentSegId) {
      e.preventDefault();
      
      // Get the node ID from the current segment
      const segmentData = docsData.getAtomValue(docsData.getNodeData(docId, currentSegId));
      const nodeId = segmentData?.parentId;
      
      if (nodeId) {
        if (e.shiftKey) {
          console.log(`🔙 YamdDoc: Tab+Shift pressed - outdenting node ${nodeId}`);
          renderUtilsContextValue.outdentNode?.(nodeId);
        } else {
          console.log(`➡️ YamdDoc: Tab pressed - indenting node ${nodeId}`);
          renderUtilsContextValue.indentNode?.(nodeId);
        }
      }
      return;
    }
    
    // Forward other keyboard events to focused segment
    handleRootKeyDown(e, isEditable, currentSegId, docId);
  }, [isEditable, currentSegId, docId, renderUtilsContextValue]);

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
        onBlur={handleBlur}
        onMouseDown={handleMouseDown}
        onClick={(e) => handleClick(e, rootNodeId)}
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
 * @param {string|null} currentSegId - Currently focused segment ID
 * @param {string} docId - Document ID
 * @returns {void}
 */
const handleRootKeyDown = (e, isEditable, currentSegId, docId) => {
  if (!isEditable || !currentSegId) return;

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
  
  // if (!hasModifier && !isArrowKey && !isEnterOrEscape) {
  //   // Let browser handle regular character input naturally
  //   return;
  // }
  
  // Note: We don't call preventDefault() here for arrow keys
  // Browser moves cursor in contentEditable before this handler runs
  // Segments will preventDefault only when triggering unfocus
  
  // Extract important event attributes and pass real preventDefault
  const eventData = {
    key: e.key,
    ctrlKey: e.ctrlKey,
    shiftKey: e.shiftKey,
    metaKey: e.metaKey,
    altKey: e.altKey,
    preventDefault: () => e.preventDefault(), // Allow segments to prevent default
    stopPropagation: () => {} // No-op (event already at root)
  };
  
  // Forward to currently focused segment
  docsState.triggerKeyboard(docId, currentSegId, eventData);
};