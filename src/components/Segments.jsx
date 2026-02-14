import React, { useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import SegmentText from '@/segments/SegmentText.jsx';
import SegmentLaTeX from '@/segments/SegmentLaTeX.jsx';
import SegmentRef from '@/segments/SegmentRef.jsx';
import NodeRichTextBib from './NodeRichTextBib.jsx';
import { 
  calcBulletYPos as _calcBulletYPos, 
  handleUnfocus,
  handleSplitChildEvent,
  handleDeleteChildEvent,
  handleCreateChildEvent,
  handleIndentChildEvent,
  handleOutdentChildEvent
} from './Segments.js';
import { useRenderUtilsContext } from '@/core/RenderUtils.ts';
import { getMoveUpTargetId, getMoveDownTargetId } from '@/core/EditUtils.js';
import { getClosestSegmentIndex, getClosestSegmentForClick, findSegIdFromNode } from './TextUtils.js';

/**
 * Rich text renderer with inline LaTeX math support
 * Renders segmented text content using segment nodes
 * Also handles bullet positioning like NodeTextPlain
 */
const Segments = forwardRef(({ nodeId, className, parentInfo, globalInfo = null }, ref) => {
  // ref to measure text for bullet positioning (used by Zustand system)
  const textRef = useRef(null);

  // Get render utils from context
  const renderUtils = useRenderUtilsContext();
  
  // Get node data to access segments
  const nodeData = renderUtils.useNodeData(nodeId);
  const segments = nodeData?.segments || [];
  
  // Subscribe to node state for unfocus requests from segments
  const nodeState = renderUtils.useNodeState(nodeId);

  // expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    calcBulletYPos: (containerClassName) => {
      return _calcBulletYPos(textRef.current, segments, containerClassName);
    }
  }), [segments]);

  // Handle focus requests on the rich text node itself
  // Delegate to appropriate segment based on focus type and cursorPageX/cursorPageY
  useEffect(() => {
    if (!nodeState?.focus) return;
    
    const { counter, type, cursorPageX, cursorPageY } = nodeState.focus;
    
    // Skip if counter is 0 (initial state)
    if (counter === 0) return;
    
    // console.log(`🎯 Segments [${nodeId}] received focus request:`, { counter, type, cursorPageX, cursorPageY });
    
    if (segments.length === 0) return;
    
    let targetSegmentId;
    let segmentFocusType = type;
    
    // Determine which segment to focus based on focus type
    if (type === 'arrowUp' || type === 'arrowUpFromFirstChild') {
      // Moving UP from below → focus LAST segment (entering from bottom)
      segmentFocusType = 'fromDown';
      
      if (cursorPageX !== undefined) {
        // console.log(`⬆️ cursorPageX=${cursorPageX}, searching for closest segment...`);
        // Use cursorPageX to find closest segment
        const segElements = segments.map(segId => 
          document.querySelector(`[data-segment-id="${segId}"]`)
        ).filter(el => el !== null);
        
        // console.log(`⬆️ Found ${segElements.length} segment elements`);
        
        if (segElements.length > 0) {
          const segmentIndex = getClosestSegmentIndex(segElements, cursorPageX, null, 'backward');
          targetSegmentId = segments[segmentIndex];
          // console.log(`⬆️ Using cursorPageX to focus segment at index ${segmentIndex}: ${targetSegmentId}`);
        } else {
          // Fallback to last segment
          targetSegmentId = segments[segments.length - 1];
          // console.log(`⬆️ No segment elements found, focusing last segment: ${targetSegmentId}`);
        }
      } else {
        // No cursorPageX → focus last segment
        targetSegmentId = segments[segments.length - 1];
        // console.log(`⬆️ No cursorPageX, focusing last segment: ${targetSegmentId}`);
      }
      
    } else if (type === 'arrowDown' || type === 'arrowDownFromLastChild') {
      // Moving DOWN from above → focus FIRST segment (entering from top)
      segmentFocusType = 'fromUp';
      
      if (cursorPageX !== undefined) {
        // console.log(`⬇️ cursorPageX=${cursorPageX}, searching for closest segment...`);
        // Use cursorPageX to find closest segment
        const segElements = segments.map(segId => 
          document.querySelector(`[data-segment-id="${segId}"]`)
        ).filter(el => el !== null);
        
        // console.log(`⬇️ Found ${segElements.length} segment elements`);
        
        if (segElements.length > 0) {
          const segmentIndex = getClosestSegmentIndex(segElements, cursorPageX, null, 'forward');
          targetSegmentId = segments[segmentIndex];
          // console.log(`⬇️ Using cursorPageX to focus segment at index ${segmentIndex}: ${targetSegmentId}`);
        } else {
          // Fallback to first segment
          targetSegmentId = segments[0];
          // console.log(`⬇️ No segment elements found, focusing first segment: ${targetSegmentId}`);
        }
      } else {
        // No cursorPageX → focus first segment
        targetSegmentId = segments[0];
        // console.log(`⬇️ No cursorPageX, focusing first segment: ${targetSegmentId}`);
      }
      
    } else if (type === 'fromRight' || type === 'fromLeft' || type === 'prevSiblingDeleted') {
      // Horizontal navigation from adjacent node or after deletion
      if (type === 'fromRight' || type === 'prevSiblingDeleted') {
        // Coming from right OR previous sibling was deleted → focus LAST segment
        segmentFocusType = 'fromRight';
        targetSegmentId = segments[segments.length - 1];
        // console.log(`⬅️ ${type}: focusing last segment: ${targetSegmentId}`);
      } else {
        // Coming from left → focus FIRST segment
        segmentFocusType = 'fromLeft';
        targetSegmentId = segments[0];
        // console.log(`➡️ fromLeft: focusing first segment: ${targetSegmentId}`);
      }
      
    } else if (type === 'parentClick') {
      // Click on parent list item wrapper - find nearest segment using both X and Y coordinates
      // console.log(`🖱️ parentClick: cursorPageX=${cursorPageX}, cursorPageY=${cursorPageY}`);
      
      // Convert pageX/Y back to clientX/Y for getClosestSegmentForClick
      const clientX = cursorPageX - window.scrollX;
      const clientY = cursorPageY !== undefined ? (cursorPageY - window.scrollY) : null;
      
      // Get all segment elements
      const segElements = segments.map(segId => 
        textRef.current?.querySelector(`[data-segment-id="${segId}"]`)
      ).filter(el => el !== null);
      
      if (segElements.length > 0) {
        const { index, focusType } = getClosestSegmentForClick(segElements, clientX, clientY);
        targetSegmentId = segments[index];
        segmentFocusType = focusType;
        // console.log(`🖱️ parentClick: focusing segment at index ${index}: ${targetSegmentId} with type=${focusType}`);
      } else {
        // Fallback to first segment
        targetSegmentId = segments[0];
        segmentFocusType = 'fromLeft';
        // console.log(`🖱️ parentClick: no segment elements found, focusing first segment: ${targetSegmentId}`);
      }
      
    } else {
      // Other focus types → default to first segment
      targetSegmentId = segments[0];
      // console.log(`➡️ Default focus to first segment: ${targetSegmentId}`);
    }
    
    // console.log(`🎯 Triggering focus on segment ${targetSegmentId} with type=${segmentFocusType}, cursorPageX=${cursorPageX}`);
    renderUtils.triggerFocus(targetSegmentId, segmentFocusType, { cursorPageX });
    
  }, [nodeState?.focus?.counter, nodeId, renderUtils]);

  // Handle unfocus requests from segments (via nodeState.unfocus)
  useEffect(() => {
    // Delegate logic to pure function for testability
    const action = handleUnfocus({
      unfocusState: nodeState?.unfocus,
      segments,
      nodeId,
      getNodeDataById: renderUtils.getNodeDataById
    });
    
    if (!action) return;
    
    // Execute the action returned by pure function
    if (action.type === 'focusSegment') {
      // Focus another segment in this node
      renderUtils.setCurrentSegId?.(action.targetId); // Update current segment in YamdDoc
      renderUtils.triggerFocus(action.targetId, action.focusType);
    } else if (action.type === 'focusNode') {
      // Focus a different node
      if (action.clearCurrentSegment) {
        renderUtils.cancelCurrentSegId?.();
      }
      renderUtils.triggerFocus(action.targetId, action.focusType, action.extraData);
    }
  }, [nodeState?.unfocus?.counter, nodeId, segments, renderUtils]);

  // Handle child events from segments (via nodeState.childEvent)
  useEffect(() => {
    if (!nodeState?.childEvent) return;

    const { counter, from, type, cursorLoc, cursorPos, additionalData } = nodeState.childEvent;

    // Skip if counter is 0 (initial state)
    if (counter === 0) return;
    
    // Get node data to check last processed counter
    const nodeDataForCounter = renderUtils.getNodeDataById?.(nodeId);
    const lastProcessedChildEventCounter = nodeDataForCounter?.lastProcessedChildEventCounter || 0;
    
    // Skip if we've already processed this counter (prevent duplicate processing)
    if (counter === lastProcessedChildEventCounter) {
      console.log(`⏭️ Segments [${nodeId}] skipping duplicate childEvent counter: ${counter}, type: ${type}`);
      return;
    }
    
    // Update last processed counter in atom (persists across remounts)
    renderUtils.updateNodeData(nodeId, (draft) => {
      draft.lastProcessedChildEventCounter = counter;
    });

    console.log(`📨 Segments [${nodeId}] received childEvent from ${from}: type=${type}, cursorLoc=${cursorLoc}`, additionalData);

    // Get fresh segments array and node data
    const currentNodeData = renderUtils.getNodeDataById?.(nodeId);
    const currentSegments = currentNodeData?.segments || [];
    const segmentIndex = currentSegments.indexOf(from);
    
    if (segmentIndex === -1) {
      console.warn(`⚠️ Segment ${from} not found in segments array`);
      return;
    }
    
    // Delegate to handler functions based on event type
    const handlerParams = {
      nodeId,
      from,
      segmentIndex,
      cursorLoc,
      cursorPos,
      additionalData,
      currentSegments,
      currentNodeData,
      renderUtils
    };
    
    if (type === 'split') {
      handleSplitChildEvent(handlerParams);
      return;
    }
    
    if (type === 'delete') {
      handleDeleteChildEvent(handlerParams);
      return;
    }
    
    if (type === 'create') {
      handleCreateChildEvent(handlerParams);
      return;
    }
    
    if (type === 'indent') {
      handleIndentChildEvent(handlerParams);
      return;
    }
    
    if (type === 'outdent') {
      handleOutdentChildEvent(handlerParams);
      return;
    }
    
  }, [nodeState?.childEvent?.counter, nodeId, renderUtils]);

  // Note: Bullet positioning is now handled entirely by Zustand store in NodeText
  // All positioning logic moved to calcBulletYPos in Segments.js
  
  // Check if editable mode is enabled
  const isEditable = renderUtils.isEditable;
  
  // Track if user is currently dragging to select text
  const isDraggingRef = React.useRef(false);
  
  // Handle mousedown - detect start of drag selection
  const handleMouseDown = (e) => {
    if (!isEditable) return;
    isDraggingRef.current = false;
    
    // Track mousemove to detect dragging
    const handleMouseMove = () => {
      isDraggingRef.current = true;
      document.removeEventListener('mousemove', handleMouseMove);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // Reset drag flag after a short delay
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 10);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle click - focus nearest segment if click lands between segments
  const handleClick = (e) => {
    // console.log(`[🖱️CLICK EVENT] Segments [${nodeId}] click, target:`, e.target, 'textRef:', textRef.current);
    if (!isEditable) return;
    
    // Check selection synchronously before any async operations
    // If selection spans multiple segments, focus on the end segment but preserve selection
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      
      // Find segments for start and end - search across component boundaries
      // Segment IDs are unique across the entire document
      const segStartId = findSegIdFromNode(range.startContainer);
      const segEndId = findSegIdFromNode(range.endContainer);
      
      // If selection spans multiple segments, focus on the end segment (preserves selection)
      if (segStartId && segEndId && segStartId !== segEndId) {
        e.preventDefault();
        e.stopPropagation();
        // Focus on the end segment - the focus handler will preserve the selection
        renderUtils.triggerFocus(segEndId, 'fromLeft');
        return;
      }
    }
    
    // If user was dragging to select text, don't interfere
    if (isDraggingRef.current) {
      console.log(`[🖱️CLICK] Segments [${nodeId}] click: user was dragging, ignoring`);
      return;
    }
    
    // Check if click landed directly on the rich text wrapper (between segments)
    // e.currentTarget is the element the handler is attached to
    // e.target is the actual element that was clicked
    if (e.target !== e.currentTarget) {
      // console.log(`[🖱️CLICK] Segments [${nodeId}] click inside segment (target is child element)`);
      // Click is inside a segment, let the segment handle it
      return;
    }
    
    // Click landed on the wrapper between segments, find nearest one
    console.log(`[🖱️CLICK]Segments [${nodeId}] click between segments, finding nearest`);
    
    // Use requestAnimationFrame to ensure we can work with the selection after browser updates
    requestAnimationFrame(() => {
      // Double-check: if selection is not collapsed, verify it doesn't span multiple segments
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        
        // Find segments for start and end - search across component boundaries
        const segStartId = findSegIdFromNode(range.startContainer);
        const segEndId = findSegIdFromNode(range.endContainer);
        
        // If selection spans multiple segments, focus on the end segment (preserves selection)
        if (segStartId && segEndId && segStartId !== segEndId) {
          renderUtils.triggerFocus(segEndId, 'fromLeft');
          return;
        }
      }
      
      // Get all segment elements
      const segElements = segments.map(segId => 
        textRef.current?.querySelector(`[data-segment-id="${segId}"]`)
      ).filter(el => el !== null);
      
      if (segElements.length === 0) return;
      
      // Use utility function to find nearest segment and determine focus direction
      const { index, focusType } = getClosestSegmentForClick(segElements, e.clientX, e.clientY);
      const nearestSegment = segments[index];
      
      if (nearestSegment) {
        console.log(`[🎯TRIGGER FOCUS] Segments [${nodeId}] focusing nearest segment: ${nearestSegment} (index ${index}) with type=${focusType}`);
        renderUtils.triggerFocus(nearestSegment, focusType);
      }
    });
  };
  
  // If no segments, show error
  if (!segments || segments.length === 0) {
    console.log("ERROR: segments is missing or empty:", segments);
    return (
      <span ref={textRef} className={`${className} yamd-error`} style={{color: 'red', border: '1px solid red'}}>
        ERROR: segments missing or empty. nodeId="{nodeId}", segments={JSON.stringify(segments)}
      </span>
    );
  }
  
  // Render segments using segment node IDs
  // In editable mode, this inherits contentEditable from YamdDoc container
  // Do NOT set contentEditable here - it would create a nested contentEditable boundary
  return (
    <span
      ref={textRef} 
      className={className}
      style={isEditable ? {
        outline: 'none',
        userSelect: 'text',
        WebkitUserSelect: 'text',
        MozUserSelect: 'text',
        msUserSelect: 'text',
      } : undefined}
      onMouseDown={isEditable ? handleMouseDown : undefined}
      onClick={isEditable ? handleClick : undefined}
    >
      {segments.map((segmentId) => {
        const segmentNode = renderUtils.getNodeDataById(segmentId);
        
        if (!segmentNode) {
          return (
            <span key={segmentId} className="yamd-error" style={{color: 'red'}}>
              [Segment {segmentId} not found]
            </span>
          );
        }
        
        const segmentType = segmentNode.selfDisplay;
        
        // Wrap each segment with a span that has data-segment-id for getClosestSegmentIndex
        let segmentComponent;
        
        if (segmentType === 'latex_inline') {
          // Use dedicated LaTeX segment component with focus/unfocus support
          segmentComponent = (
            <SegmentLaTeX
              segmentId={segmentId}
              parentNodeId={nodeId}
              globalInfo={globalInfo}
            />
          );
        } else if (segmentType === 'ref-asset') {
          // Use dedicated reference component
          segmentComponent = (
            <SegmentRef
              segmentId={segmentId}
              parentNodeId={nodeId}
              globalInfo={globalInfo}
            />
          );
        } else if (segmentType === 'ref-bib') {
          // Use dedicated bibliography component
          segmentComponent = (
            <NodeRichTextBib
              segment={segmentNode}
              segmentId={segmentId}
              parentNodeId={nodeId}
              globalInfo={globalInfo}
            />
          );
        } else {
          // Regular text segment - use SegmentText component
          segmentComponent = (
            <SegmentText
              segmentId={segmentId}
              parentNodeId={nodeId}
              className=""
              globalInfo={globalInfo}
            />
          );
        }
        
        // Wrap with span for measurement
        return (
          <span key={segmentId} data-segment-id={segmentId} style={{display: 'inline'}}>
            {segmentComponent}
          </span>
        );
      })}
    </span>
  );
});

Segments.displayName = 'Segments';

export default Segments;
