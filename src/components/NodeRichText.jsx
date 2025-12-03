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
      
    } else if (type === 'fromRight' || type === 'fromLeft' || type === 'prevSiblingDeleted') {
      // Horizontal navigation from adjacent node or after deletion
      if (type === 'fromRight' || type === 'prevSiblingDeleted') {
        // Coming from right OR previous sibling was deleted → focus LAST segment
        segmentFocusType = 'fromRight';
        targetSegmentId = segments[segments.length - 1];
        console.log(`⬅️ ${type}: focusing last segment: ${targetSegmentId}`);
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

  // Handle child delete requests from segments (via nodeState.childDelete)
  useEffect(() => {
    if (!nodeState?.childDelete) return;
    
    const { counter, from, reason } = nodeState.childDelete;
    
    // Skip if counter is 0 (initial state)
    if (counter === 0) return;
    
    console.log(`🗑️ NodeRichText [${nodeId}] received childDelete request from ${from}, reason: ${reason}`);
    
    // Get fresh segments array from node data
    const currentNodeData = renderUtils.getNodeDataById?.(nodeId);
    const currentSegments = currentNodeData?.segments || [];
    
    // Find the segment to delete
    const segmentIndex = currentSegments.indexOf(from);
    
    if (segmentIndex === -1) {
      console.warn(`⚠️ Segment ${from} not found in segments array`);
      return;
    }
    
    // If this is the only segment, delete the entire node instead
    if (currentSegments.length === 1) {
      console.log(`🗑️ Only one segment, deleting entire node ${nodeId}`);
      
      // Use existing deleteNode logic from renderUtils
      const result = renderUtils.deleteNode?.(nodeId);
      console.log(`🗑️ Delete node result:`, result);
      return;
    }
    
    // Multiple segments - delete this segment and focus appropriate one
    console.log(`🗑️ Deleting segment ${from} (${segmentIndex + 1}/${currentSegments.length}), reason: ${reason}`);
    
    // Determine which segment to focus after deletion
    let targetSegmentId;
    let focusType;
    
    if (reason === 'pseudoAbandoned') {
      // Pseudo segment abandoned - focus the segment that created it (previous segment)
      // The pseudo segment is always created to the right, so previous is the creator
      targetSegmentId = segmentIndex > 0 ? currentSegments[segmentIndex - 1] : currentSegments[segmentIndex + 1];
      focusType = 'fromRight'; // Position at end of creator segment
      console.log(`🎭 Pseudo segment abandoned, returning to creator: ${targetSegmentId}`);
    } else {
      // Regular deletion - focus previous segment (or next if first)
      targetSegmentId = segmentIndex > 0 
        ? currentSegments[segmentIndex - 1]  // Focus previous segment
        : currentSegments[segmentIndex + 1];  // Or next if deleting first
      focusType = 'fromRight'; // Position at end
      console.log(`🗑️ Regular deletion, will focus: ${targetSegmentId}`);
    }
    
    // Get segment data before deletion for callback
    const segmentData = renderUtils.getNodeDataById?.(from);
    
    // Call onDelete callback before actual deletion
    if (renderUtils.onDelete) {
      renderUtils.onDelete(from, segmentData);
    }
    
    // Delete the segment from the segments array
    renderUtils.updateNodeData(nodeId, (draft) => {
      if (draft.segments) {
        draft.segments = draft.segments.filter(id => id !== from);
      }
    });
    
    // Focus the target segment
    renderUtils.triggerFocus?.(targetSegmentId, focusType);
    
  }, [nodeState?.childDelete?.counter, nodeId, renderUtils]);

  // Handle child create requests from segments (via nodeState.childCreate)
  useEffect(() => {
    if (!nodeState?.childCreate) return;
    
    const { counter, from, type, isPseudo } = nodeState.childCreate;
    
    // Skip if counter is 0 (initial state)
    if (counter === 0) return;
    
    console.log(`➕ NodeRichText [${nodeId}] received childCreate request from ${from}, type: ${type}, isPseudo: ${isPseudo}`);
    
    // Get fresh segments array from node data
    const currentNodeData = renderUtils.getNodeDataById?.(nodeId);
    const currentSegments = currentNodeData?.segments || [];
    
    // Find the requesting segment
    const segmentIndex = currentSegments.indexOf(from);
    
    if (segmentIndex === -1) {
      console.warn(`⚠️ Segment ${from} not found in segments array`);
      return;
    }
    
    // Generate new segment ID
    const newSegmentId = `seg_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`➕ Creating new segment: ${newSegmentId} ${type} of ${from}`);
    
    // Create the new empty text segment
    const newSegment = {
      type: 'segment',
      textRaw: '',
      id: newSegmentId,
      selfDisplay: 'text',
      parentId: nodeId
    };
    
    // Add the new segment to docsData
    renderUtils.updateNodeData(newSegmentId, () => newSegment);
    
    // Insert into segments array at the appropriate position
    const insertIndex = type === 'toRight' ? segmentIndex + 1 : segmentIndex;
    
    renderUtils.updateNodeData(nodeId, (draft) => {
      if (draft.segments) {
        draft.segments.splice(insertIndex, 0, newSegmentId);
      }
    });
    
    console.log(`➕ Inserted ${newSegmentId} at index ${insertIndex}, total segments: ${currentSegments.length + 1}`);
    
    // Call onCreate callback
    if (renderUtils.onCreate) {
      renderUtils.onCreate(newSegmentId, newSegment);
    }
    
    // Focus the new segment with isPseudo flag
    renderUtils.triggerFocus?.(newSegmentId, 'fromLeft', { isPseudo });
    
  }, [nodeState?.childCreate?.counter, nodeId, renderUtils]);

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
