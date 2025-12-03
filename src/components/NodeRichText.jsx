import React, { useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import SegmentText from '@/segments/SegmentText.jsx';
import SegmentLaTeX from '@/segments/SegmentLaTeX.jsx';
import SegmentRef from '@/segments/SegmentRef.jsx';
import NodeTextRichBib from './NodeRichTextBib.jsx';
import { calcBulletYPos as _calcBulletYPos} from './NodeRichText.js';
import { useRenderUtilsContext } from '@/core/RenderUtils.ts';
import { getMoveUpTargetId, getMoveDownTargetId } from '@/core/EditUtils.js';
import { getClosestSegmentIndex } from './TextUtils.js';

/**
 * Rich text renderer with inline LaTeX math support
 * Renders segmented text content using segment nodes
 * Also handles bullet positioning like NodeTextPlain
 */
const NodeTextRich = forwardRef(({ nodeId, className, parentInfo, globalInfo = null }, ref) => {
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
  // Delegate to appropriate segment based on focus type and cursorPageX
  useEffect(() => {
    if (!nodeState?.focus) return;
    
    const { counter, type, cursorPageX } = nodeState.focus;
    
    // Skip if counter is 0 (initial state)
    if (counter === 0) return;
    
    console.log(`🎯 NodeRichText [${nodeId}] received focus request:`, { counter, type, cursorPageX });
    
    if (segments.length === 0) return;
    
    let targetSegmentId;
    let segmentFocusType = type;
    
    // Determine which segment to focus based on focus type
    if (type === 'arrowUp' || type === 'arrowUpFromFirstChild') {
      // Moving UP from below → focus LAST segment (entering from bottom)
      segmentFocusType = 'fromDown';
      
      if (cursorPageX !== undefined) {
        console.log(`⬆️ cursorPageX=${cursorPageX}, searching for closest segment...`);
        // Use cursorPageX to find closest segment
        const segmentElements = segments.map(segId => 
          document.querySelector(`[data-segment-id="${segId}"]`)
        ).filter(el => el !== null);
        
        console.log(`⬆️ Found ${segmentElements.length} segment elements`);
        
        if (segmentElements.length > 0) {
          const segmentIndex = getClosestSegmentIndex(segmentElements, cursorPageX, null, 'backward');
          targetSegmentId = segments[segmentIndex];
          console.log(`⬆️ Using cursorPageX to focus segment at index ${segmentIndex}: ${targetSegmentId}`);
        } else {
          // Fallback to last segment
          targetSegmentId = segments[segments.length - 1];
          console.log(`⬆️ No segment elements found, focusing last segment: ${targetSegmentId}`);
        }
      } else {
        // No cursorPageX → focus last segment
        targetSegmentId = segments[segments.length - 1];
        console.log(`⬆️ No cursorPageX, focusing last segment: ${targetSegmentId}`);
      }
      
    } else if (type === 'arrowDown' || type === 'arrowDownFromLastChild') {
      // Moving DOWN from above → focus FIRST segment (entering from top)
      segmentFocusType = 'fromUp';
      
      if (cursorPageX !== undefined) {
        console.log(`⬇️ cursorPageX=${cursorPageX}, searching for closest segment...`);
        // Use cursorPageX to find closest segment
        const segmentElements = segments.map(segId => 
          document.querySelector(`[data-segment-id="${segId}"]`)
        ).filter(el => el !== null);
        
        console.log(`⬇️ Found ${segmentElements.length} segment elements`);
        
        if (segmentElements.length > 0) {
          const segmentIndex = getClosestSegmentIndex(segmentElements, cursorPageX, null, 'forward');
          targetSegmentId = segments[segmentIndex];
          console.log(`⬇️ Using cursorPageX to focus segment at index ${segmentIndex}: ${targetSegmentId}`);
        } else {
          // Fallback to first segment
          targetSegmentId = segments[0];
          console.log(`⬇️ No segment elements found, focusing first segment: ${targetSegmentId}`);
        }
      } else {
        // No cursorPageX → focus first segment
        targetSegmentId = segments[0];
        console.log(`⬇️ No cursorPageX, focusing first segment: ${targetSegmentId}`);
      }
      
    } else if (type === 'fromRight' || type === 'fromLeft') {
      // Horizontal navigation from adjacent node
      if (type === 'fromRight') {
        // Coming from right → focus LAST segment
        segmentFocusType = 'fromRight';
        targetSegmentId = segments[segments.length - 1];
        console.log(`⬅️ fromRight: focusing last segment: ${targetSegmentId}`);
      } else {
        // Coming from left → focus FIRST segment
        segmentFocusType = 'fromLeft';
        targetSegmentId = segments[0];
        console.log(`➡️ fromLeft: focusing first segment: ${targetSegmentId}`);
      }
      
    } else {
      // Other focus types → default to first segment
      targetSegmentId = segments[0];
      console.log(`➡️ Default focus to first segment: ${targetSegmentId}`);
    }
    
    console.log(`🎯 Triggering focus on segment ${targetSegmentId} with type=${segmentFocusType}, cursorPageX=${cursorPageX}`);
    renderUtils.triggerFocus(targetSegmentId, segmentFocusType, { cursorPageX });
    
  }, [nodeState?.focus?.counter, nodeId, renderUtils]);

  // Handle unfocus requests from segments (via nodeState.unfocus)
  useEffect(() => {
    if (!nodeState?.unfocus) return;
    
    const { counter, from, type, cursorPageX } = nodeState.unfocus;
    
    // Skip if counter is 0 (initial state)
    if (counter === 0) return;
    
    console.log(`🎯 NodeRichText [${nodeId}] received unfocus request from segment:`, { from, type, counter, cursorPageX });
    
    // Handle segment unfocus requests
    const segmentIndex = segments.indexOf(from);
    
    if (segmentIndex === -1) {
      console.warn(`⚠️ Segment ${from} not found in segments array`);
      return;
    }
    
    switch (type) {
      case 'left':
        if (segmentIndex > 0) {
          // Move to previous segment - trigger focus on it
          const prevSegmentId = segments[segmentIndex - 1];
          console.log(`⬅️ Moving focus to previous segment: ${prevSegmentId}`);
          renderUtils.setCurrentSegmentId?.(prevSegmentId); // Update current segment in YamdDoc
          renderUtils.triggerFocus(prevSegmentId, 'fromRight');
        } else {
          // Leftmost segment - try to move to previous node
          console.log(`⬅️ Leftmost segment, checking for previous node`);
          
          // Move to previous node in tree order
          const upTargetId = getMoveUpTargetId(nodeId, renderUtils.getNodeDataById);
          if (upTargetId) {
            // Clear current segment before moving to previous node
            renderUtils.cancelCurrentSegmentId?.();
            console.log(`⬅️ Triggering focus on previous node: ${upTargetId}`);
            renderUtils.triggerFocus(upTargetId, 'fromRight');
          } else {
            // No previous node - stay on current segment (don't cancel current segment)
            console.log(`⬅️ No previous node, staying on segment: ${from}`);
            // Trigger focus with fromLeft to position cursor at beginning
            renderUtils.triggerFocus(from, 'fromLeft');
          }
        }
        break;
        
      case 'right':
        if (segmentIndex < segments.length - 1) {
          // Move to next segment - trigger focus on it
          const nextSegmentId = segments[segmentIndex + 1];
          console.log(`➡️ Moving focus to next segment: ${nextSegmentId}`);
          renderUtils.setCurrentSegmentId?.(nextSegmentId); // Update current segment in YamdDoc
          renderUtils.triggerFocus(nextSegmentId, 'fromLeft');
        } else {
          // Rightmost segment - try to move to next node
          console.log(`➡️ Rightmost segment, checking for next node`);
          
          // Move to next node in tree order
          const downTargetId = getMoveDownTargetId(nodeId, renderUtils.getNodeDataById);
          if (downTargetId) {
            // Clear current segment before moving to next node
            renderUtils.cancelCurrentSegmentId?.();
            console.log(`➡️ Triggering focus on next node: ${downTargetId}`);
            renderUtils.triggerFocus(downTargetId, 'fromLeft');
          } else {
            // No next node - stay on current segment (don't cancel current segment)
            console.log(`➡️ No next node, staying on segment: ${from}`);
            // Trigger focus with fromRight to position cursor at end
            renderUtils.triggerFocus(from, 'fromRight');
          }
        }
        break;
        
      case 'up':
        // TODO: Move to previous node (same as plain text up arrow)
        // Check if there is segment of same node above current sgement
        // If so, focus on that segment
        // Otherwise, move to previous node in tree order
        
        console.log(`⬆️ Checking for previous node, cursorPageX=${cursorPageX}`);
        
        const upTargetId = getMoveUpTargetId(nodeId, renderUtils.getNodeDataById);
        if (upTargetId) {
          // Clear current segment before moving to previous node
          renderUtils.cancelCurrentSegmentId?.();
          
          // Determine focus type based on whether target is parent
          const currentNode = renderUtils.getNodeDataById(nodeId);
          const isMovingToParent = upTargetId === currentNode?.parentId;
          const focusType = isMovingToParent ? 'arrowUpFromFirstChild' : 'arrowUp';
          
          console.log(`⬆️ Triggering focus on ${upTargetId} with cursorPageX=${cursorPageX}`);
          renderUtils.triggerFocus(upTargetId, focusType, { cursorPageX });
        } else {
          // No previous node - stay on current segment (don't cancel current segment)
          console.log(`⬆️ No previous node, staying on segment: ${from}`);
          // Just trigger focus again to ensure cursor is positioned correctly
          renderUtils.triggerFocus(from, 'fromUp', { cursorPageX });
        }
        
        break;
        
      case 'down':
        // TODO: Move to next node (same as plain text down arrow)
        console.log(`⬇️ Checking for next node, cursorPageX=${cursorPageX}`);
        
        const downTargetId = getMoveDownTargetId(nodeId, renderUtils.getNodeDataById);
        if (downTargetId) {
          // Clear current segment before moving to next node
          renderUtils.cancelCurrentSegmentId?.();
          console.log(`⬇️ Triggering focus on ${downTargetId} with cursorPageX=${cursorPageX}`);
          renderUtils.triggerFocus(downTargetId, 'arrowDown', { cursorPageX });
        } else {
          // No next node - stay on current segment (don't cancel current segment)
          console.log(`⬇️ No next node, staying on segment: ${from}`);
          // Just trigger focus again to ensure cursor is positioned correctly
          renderUtils.triggerFocus(from, 'fromDown', { cursorPageX });
        }
        break;
        
      default:
        console.warn(`⚠️ Unknown unfocus type: ${type}`);
    }
    
  }, [nodeState?.unfocus?.counter, nodeId, renderUtils]);

  // Note: Bullet positioning is now handled entirely by Zustand store in YamdNodeText
  // All positioning logic moved to calcBulletYPos in NodeRichText.js
  
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
            <NodeTextRichBib
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

NodeTextRich.displayName = 'NodeTextRich';

export default NodeTextRich;
