import React, { useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import SegmentText from '@/segments/SegmentText.jsx';
import SegmentLaTeX from '@/segments/SegmentLaTeX.jsx';
import SegmentRef from '@/segments/SegmentRef.jsx';
import NodeRichTextBib from './NodeRichTextBib.jsx';
import { calcBulletYPos as _calcBulletYPos} from './Segments.js';
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
    if (!nodeState?.unfocus) return;
    
    const { counter, from, type, cursorPageX } = nodeState.unfocus;
    
    // Skip if counter is 0 (initial state)
    if (counter === 0) return;
    
    // console.log(`🎯 Segments [${nodeId}] received unfocus request from segment:`, { from, type, counter, cursorPageX });
    
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
          // console.log(`⬅️ Moving focus to previous segment: ${prevSegmentId}`);
          renderUtils.setCurrentSegId?.(prevSegmentId); // Update current segment in YamdDoc
          renderUtils.triggerFocus(prevSegmentId, 'fromRight');
        } else {
          // Leftmost segment - try to move to previous node
          // console.log(`⬅️ Leftmost segment, checking for previous node`);
          
          // Move to previous node in tree order
          const upTargetId = getMoveUpTargetId(nodeId, renderUtils.getNodeDataById);
          if (upTargetId) {
            // Clear current segment before moving to previous node
            renderUtils.cancelCurrentSegId?.();
            // console.log(`⬅️ Triggering focus on previous node: ${upTargetId}`);
            renderUtils.triggerFocus(upTargetId, 'fromRight');
          } else {
            // No previous node - stay on current segment (don't cancel current segment)
            // console.log(`⬅️ No previous node, staying on segment: ${from}`);
            // Trigger focus with fromLeft to position cursor at beginning
            renderUtils.triggerFocus(from, 'fromLeft');
          }
        }
        break;
        
      case 'right':
        if (segmentIndex < segments.length - 1) {
          // Move to next segment - trigger focus on it
          const nextSegmentId = segments[segmentIndex + 1];
          // console.log(`➡️ Moving focus to next segment: ${nextSegmentId}`);
          renderUtils.setCurrentSegId?.(nextSegmentId); // Update current segment in YamdDoc
          renderUtils.triggerFocus(nextSegmentId, 'fromLeft');
        } else {
          // Rightmost segment - try to move to next node
          // console.log(`➡️ Rightmost segment, checking for next node`);
          
          // Move to next node in tree order
          const downTargetId = getMoveDownTargetId(nodeId, renderUtils.getNodeDataById);
          if (downTargetId) {
            // Clear current segment before moving to next node
            renderUtils.cancelCurrentSegId?.();
            // console.log(`➡️ Triggering focus on next node: ${downTargetId}`);
            renderUtils.triggerFocus(downTargetId, 'fromLeft');
          } else {
            // No next node - stay on current segment (don't cancel current segment)
            // console.log(`➡️ No next node, staying on segment: ${from}`);
            // Trigger focus with fromRight to position cursor at end
            renderUtils.triggerFocus(from, 'fromRight');
          }
        }
        break;
        
      case 'up':
        // Move to previous node (same as plain text up arrow)
        console.log(`⬆️ Checking for previous node, cursorPageX=${cursorPageX}`);
        
        const upTargetId = getMoveUpTargetId(nodeId, renderUtils.getNodeDataById);
        if (upTargetId) {
          // Check if target node has segments (is a focusable rich text node)
          const upTargetNode = renderUtils.getNodeDataById(upTargetId);
          const hasSegments = upTargetNode?.segments && upTargetNode.segments.length > 0;
          
          if (hasSegments) {
            // Target node has segments, move to it
            // Clear current segment before moving to previous node
            renderUtils.cancelCurrentSegId?.();
            
            // Determine focus type based on whether target is parent
            const currentNode = renderUtils.getNodeDataById(nodeId);
            const isMovingToParent = upTargetId === currentNode?.parentId;
            const focusType = isMovingToParent ? 'arrowUpFromFirstChild' : 'arrowUp';
            
            // console.log(`⬆️ Triggering focus on ${upTargetId} with cursorPageX=${cursorPageX}`);
            renderUtils.triggerFocus(upTargetId, focusType, { cursorPageX });
          } else {
            // Target node has no segments - stay on current segment and move cursor to beginning
            // console.log(`⬆️ Previous node ${upTargetId} has no segments, staying on segment: ${from}, moving cursor to beginning`);
            renderUtils.triggerFocus(from, 'fromLeft');
          }
        } else {
          // No previous node - stay on current segment and move cursor to beginning
          // console.log(`⬆️ No previous node, staying on segment: ${from}, moving cursor to beginning`);
          // Trigger focus with fromLeft to position cursor at beginning
          renderUtils.triggerFocus(from, 'fromLeft');
        }
        
        break;
        
      case 'down':
        // Move to next node (same as plain text down arrow)
        // console.log(`⬇️ Checking for next node, cursorPageX=${cursorPageX}`);
        
        const downTargetId = getMoveDownTargetId(nodeId, renderUtils.getNodeDataById);
        if (downTargetId) {
          // Check if target node has segments (is a focusable rich text node)
          const downTargetNode = renderUtils.getNodeDataById(downTargetId);
          const hasSegments = downTargetNode?.segments && downTargetNode.segments.length > 0;
          
          if (hasSegments) {
            // Target node has segments, move to it
            // Clear current segment before moving to next node
            renderUtils.cancelCurrentSegId?.();
            // console.log(`⬇️ Triggering focus on ${downTargetId} with cursorPageX=${cursorPageX}`);
            renderUtils.triggerFocus(downTargetId, 'arrowDown', { cursorPageX });
          } else {
            // Target node has no segments - stay on current segment and move cursor to end
            // console.log(`⬇️ Next node ${downTargetId} has no segments, staying on segment: ${from}, moving cursor to end`);
            renderUtils.triggerFocus(from, 'fromRight');
          }
        } else {
          // No next node - stay on current segment and move cursor to end
          // console.log(`⬇️ No next node, staying on segment: ${from}, moving cursor to end`);
          // Trigger focus with fromRight to position cursor at end
          renderUtils.triggerFocus(from, 'fromRight');
        }
        break;
        
      default:
        // console.warn(`⚠️ Unknown unfocus type: ${type}`);
    }
    
  }, [nodeState?.unfocus?.counter, nodeId, renderUtils]);

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
    
    // Handle split event
    if (type === 'split') {
      const isLastSegment = segmentIndex === currentSegments.length - 1;
      
      // Case 1: Cursor at end
      if (cursorLoc === 'end') {
        if (isLastSegment) {
          // At end of last segment - create new pseudo segment to right
          console.log(`↩️ Creating new pseudo segment to right`);
          renderUtils.triggerChildEvent?.(nodeId, from, 'create', null, null, { createType: 'toRight', isChildPseudo: true });
        } else {
          // At end but not last segment - focus next segment
          console.log(`↩️ Focusing next segment`);
          renderUtils.triggerUnfocus?.(nodeId, from, 'right');
        }
        return;
      }
      
      // Case 2: Cursor at beginning
      if (cursorLoc === 'begin') {
        // Create new empty rich text node above and focus it
        console.log(`↩️ Creating new rich text node above (cursor at beginning)`);
        const grandparentId = currentNodeData?.parentId;
        if (grandparentId) {
          // Create empty segment for new node
          const newSegmentId = `seg_${Math.random().toString(36).substr(2, 9)}`;
          
          // Create new rich text node data
          const newNodeId = `yamd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const newNodeData = {
            id: newNodeId,
            type: 'richtext',
            parentId: grandparentId,
            segments: [newSegmentId],
            children: [],
            // Include segment data for createNodeAbove to process
            segmentsData: {
              [newSegmentId]: {
                type: 'segment',
                textRaw: '',
                id: newSegmentId,
                selfDisplay: 'text',
                parentId: newNodeId,
              }
            }
          };
          
          // Use createNodeAbove to insert the node
          renderUtils.createNodeAbove?.(nodeId, newNodeData);
        }
        return;
      }
      
      // Case 3: Cursor in middle
      if (cursorLoc === 'middle') {
        const rightSegId = additionalData?.rightSegId;
        
        if (!rightSegId) {
          console.error(`⚠️ No rightSegId provided for middle split from ${from}`);
          return;
        }
        
        // Get all segments after the current segment
        const segmentsAfter = currentSegments.slice(segmentIndex + 1);
        
        // Create new node segments: [rightSegId, ...segmentsAfter]
        const newNodeSegments = [rightSegId, ...segmentsAfter];
        
        // If no segments, create empty segment
        if (newNodeSegments.length === 0) {
          const emptySegId = `seg_${Math.random().toString(36).substr(2, 9)}`;
          renderUtils.createNode(emptySegId, {
            type: 'segment',
            textRaw: '',
            id: emptySegId,
            selfDisplay: 'text',
            parentId: null,
          });
          newNodeSegments.push(emptySegId);
        }
        
        // Create new rich text node
        const newNodeId = `yamd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const grandparentId = currentNodeData?.parentId;
        
        if (!grandparentId) {
          console.error(`⚠️ Cannot split - parent node has no grandparent`);
          return;
        }
        
        // Create new node with all fields from current node as template
        const currentNodeFull = renderUtils.getNodeDataById(nodeId);
        const newNodeData = {
          ...currentNodeFull,
          id: newNodeId,
          parentId: grandparentId,
          segments: newNodeSegments,
          children: [],
        };
        
        renderUtils.createNode(newNodeId, newNodeData);
        
        // Update parent for all moved segments
        newNodeSegments.forEach(segId => {
          renderUtils.updateNodeData(segId, (draft) => {
            draft.parentId = newNodeId;
          });
          
          // Reset focus/unfocus counters to prevent segments from re-processing
          // stale events when they remount in the new parent (especially seg_007 and seg_008)
          renderUtils.resetFocusState?.(segId);
        });
        
        // Remove moved segments from current node
        renderUtils.updateNodeData(nodeId, (draft) => {
          if (draft.segments) {
            draft.segments = draft.segments.slice(0, segmentIndex + 1);
          }
        });
        
        // Insert new node into grandparent's children
        renderUtils.updateNodeData(grandparentId, (draft) => {
          if (draft.children) {
            const currentNodeIndex = draft.children.indexOf(nodeId);
            if (currentNodeIndex !== -1) {
              draft.children.splice(currentNodeIndex + 1, 0, newNodeId);
            }
          }
        });
        
        // Call onCreate callbacks
        if (renderUtils.onCreate) {
          const completeNewNodeData = renderUtils.getNodeDataById(newNodeId);
          renderUtils.onCreate(newNodeId, completeNewNodeData);
          
          // Also notify for new segments
          newNodeSegments.forEach(segId => {
            const segData = renderUtils.getNodeDataById(segId);
            renderUtils.onCreate(segId, segData);
          });
        }
        
        // Focus first segment of new node (the right segment)
        renderUtils.triggerFocus?.(newNodeSegments[0], 'fromLeft');
        
        // Trigger bullet position recalculation for both nodes
        renderUtils.triggerBulletYPosCalc?.(nodeId); // Current node (segments changed)
        renderUtils.triggerBulletYPosCalc?.(newNodeId); // New node (just created)
        
        console.log(`✂️ Split complete: created node ${newNodeId} with ${newNodeSegments.length} segments`);
        
        return;
      }
    }
    
    // Handle delete event
    if (type === 'delete') {
      const reason = additionalData?.reason;
      const isFirstSegment = segmentIndex === 0;
      
      // Case 1: Delete with cursorLoc='begin' (backspace at beginning of first segment)
      if (cursorLoc === 'begin' && isFirstSegment) {
        console.log(`⌫ Backspace at beginning of first segment - attempting merge with prev sibling`);
        
        // Get previous sibling rich text node
        const grandparentId = currentNodeData?.parentId;
        if (!grandparentId) {
          console.log(`⚠️ No grandparent - cannot merge`);
          return;
        }
        
        const grandparentData = renderUtils.getNodeDataById(grandparentId);
        const siblings = grandparentData?.children || [];
        const currentNodeIndex = siblings.indexOf(nodeId);
        
        if (currentNodeIndex <= 0) {
          console.log(`⚠️ No previous sibling - keeping focus`);
          return;
        }
        
        const prevSiblingId = siblings[currentNodeIndex - 1];
        const prevSiblingData = renderUtils.getNodeDataById(prevSiblingId);
        
        // Check if previous sibling is a rich text node (has segments array)
        if (!prevSiblingData?.segments || !Array.isArray(prevSiblingData.segments)) {
          console.log(`⚠️ Previous sibling is not richtext (no segments array) - cannot merge`);
          return;
        }
        
        const prevSegments = prevSiblingData?.segments || [];
        
        // Check if we can merge text segments
        const lastPrevSegId = prevSegments[prevSegments.length - 1];
        const firstCurrentSegId = currentSegments[0];
        const lastPrevSegData = lastPrevSegId ? renderUtils.getNodeDataById(lastPrevSegId) : null;
        const firstCurrentSegData = firstCurrentSegId ? renderUtils.getNodeDataById(firstCurrentSegId) : null;
        
        const canMergeTextSegments = 
          lastPrevSegData?.selfDisplay === 'text' && 
          firstCurrentSegData?.selfDisplay === 'text';
        
        if (canMergeTextSegments) {
          const lastPrevText = lastPrevSegData?.textRaw || '';
          const firstCurrentText = firstCurrentSegData?.textRaw || '';
          
          // If first current segment is not empty, merge the texts
          if (firstCurrentText !== '') {
            console.log(`🔗 Merging text segments: ${lastPrevSegId} ("${lastPrevText}") + ${firstCurrentSegId} ("${firstCurrentText}")`);
            
            const mergedText = lastPrevText + firstCurrentText;
            const cursorPosInMerged = lastPrevText.length; // Cursor at boundary
            
            // Update last prev segment with merged text
            renderUtils.updateNodeData(lastPrevSegId, (draft) => {
              draft.textRaw = mergedText;
            });
            
            // Delete first current segment (its text is now merged into last prev segment)
            if (renderUtils.onDelete) {
              renderUtils.onDelete(firstCurrentSegId, firstCurrentSegData);
            }
            
            // Update remaining segments' parentId
            const remainingSegments = currentSegments.slice(1); // Skip first (merged/deleted) segment
            remainingSegments.forEach(segId => {
              renderUtils.updateNodeData(segId, (draft) => {
                draft.parentId = prevSiblingId;
              });
            });
            
            // Append remaining segments to prev sibling
            renderUtils.updateNodeData(prevSiblingId, (draft) => {
              if (draft.segments) {
                remainingSegments.forEach(segId => {
                  draft.segments.push(segId);
                });
              }
            });
            
            // Delete current node
            renderUtils.updateNodeData(grandparentId, (draft) => {
              if (draft.children) {
                draft.children = draft.children.filter(id => id !== nodeId);
              }
            });
            
            // Call onDelete callback for current node
            if (renderUtils.onDelete) {
              renderUtils.onDelete(nodeId, currentNodeData);
            }
            
            // Focus the merged segment with cursor at merge point
            setTimeout(() => {
              console.log(`🔄 Restoring focus to merged segment ${lastPrevSegId} at position ${cursorPosInMerged}`);
              renderUtils.triggerFocus?.(lastPrevSegId, 'fromLeft', { cursorPos: cursorPosInMerged });
            }, 0);
            
            // Trigger bullet recalc
            renderUtils.triggerBulletYPosCalc?.(prevSiblingId);
            
            console.log(`✅ Text segments merged successfully`);
            return;
          } else {
            // First current segment is empty - just delete it and append remaining segments
            console.log(`🔗 Deleting empty text segment ${firstCurrentSegId}, appending remaining to prev sibling`);
            
            // Delete first current segment
            if (renderUtils.onDelete) {
              renderUtils.onDelete(firstCurrentSegId, firstCurrentSegData);
            }
            
            // Update remaining segments' parentId
            const remainingSegments = currentSegments.slice(1); // Skip first (deleted) segment
            remainingSegments.forEach(segId => {
              renderUtils.updateNodeData(segId, (draft) => {
                draft.parentId = prevSiblingId;
              });
            });
            
            // Append remaining segments to prev sibling
            renderUtils.updateNodeData(prevSiblingId, (draft) => {
              if (draft.segments) {
                remainingSegments.forEach(segId => {
                  draft.segments.push(segId);
                });
              }
            });
            
            // Delete current node
            renderUtils.updateNodeData(grandparentId, (draft) => {
              if (draft.children) {
                draft.children = draft.children.filter(id => id !== nodeId);
              }
            });
            
            // Call onDelete callback for current node
            if (renderUtils.onDelete) {
              renderUtils.onDelete(nodeId, currentNodeData);
            }
            
            // Focus the last prev segment at the end
            setTimeout(() => {
              console.log(`🔄 Restoring focus to last prev segment ${lastPrevSegId} at end`);
              renderUtils.triggerFocus?.(lastPrevSegId, 'fromRight');
            }, 0);
            
            // Trigger bullet recalc
            renderUtils.triggerBulletYPosCalc?.(prevSiblingId);
            
            console.log(`✅ Empty segment deleted, remaining segments appended`);
            return;
          }
        }
        
        // Normal merge: append all segments without merging
        currentSegments.forEach(segId => {
          renderUtils.updateNodeData(segId, (draft) => {
            draft.parentId = prevSiblingId;
          });
        });
        
        // Update previous sibling's segments array (use push for Immer mutation)
        renderUtils.updateNodeData(prevSiblingId, (draft) => {
          if (draft.segments) {
            currentSegments.forEach(segId => {
              draft.segments.push(segId);
            });
          }
        });
        
        // Delete current node
        renderUtils.updateNodeData(grandparentId, (draft) => {
          if (draft.children) {
            draft.children = draft.children.filter(id => id !== nodeId);
          }
        });
        
        // Call onDelete callback
        if (renderUtils.onDelete) {
          renderUtils.onDelete(nodeId, currentNodeData);
        }
        
        console.log(`✅ Node merged into prev sibling`);
        
        // Restore focus after a short delay
        setTimeout(() => {
          renderUtils.triggerFocus?.(from, 'fromLeft');
        }, 0);
        
        // Trigger bullet recalc for prev sibling
        renderUtils.triggerBulletYPosCalc?.(prevSiblingId);
        
        return;
      }
      
      // Case 2: Regular segment deletion (not at beginning of first segment)
      // If this is the only segment, delete the entire node instead
      if (currentSegments.length === 1) {
        console.log(`🗑️ Only one segment, deleting entire node ${nodeId}`);
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
      
      return;
    }
    
    // Handle create event
    if (type === 'create') {
      const { createType, isChildPseudo } = additionalData || {};
      
      console.log(`➕ Creating new segment ${createType} of ${from}, isChildPseudo: ${isChildPseudo}`);
      
      // Generate new segment ID
      const newSegmentId = `seg_${Math.random().toString(36).substr(2, 9)}`;
      
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
      const insertIndex = createType === 'toRight' ? segmentIndex + 1 : segmentIndex;
      
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
      
      // Focus the new segment with isChildPseudo flag
      renderUtils.triggerFocus?.(newSegmentId, 'fromLeft', { isChildPseudo });
      
      return;
    }
    
    // Handle indent event
    if (type === 'indent') {
      console.log(`➡️ Segments [${nodeId}] received indent event from segment ${from}`);
      const result = renderUtils.indentNode?.(nodeId);
      if (result?.code === 0) {
        console.log(`✅ Indent successful: ${result.message}`);
      } else {
        // Only log as warning if result exists and has a message (avoid logging undefined/null errors)
        if (result && result.message) {
          console.warn(`⚠️ Indent failed: ${result.message}`);
        } else {
          console.warn(`⚠️ Indent failed: Unknown error`, result);
        }
      }
      return;
    }
    
    // Handle outdent event
    if (type === 'outdent') {
      console.log(`🔙 Segments [${nodeId}] received outdent event from segment ${from}`);
      const result = renderUtils.outdentNode?.(nodeId);
      if (result?.code === 0) {
        console.log(`✅ Outdent successful: ${result.message}`);
      } else {
        console.warn(`⚠️ Outdent failed: ${result?.message || 'Unknown error'}`);
      }
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
      console.log(`🖱️ Segments [${nodeId}] click: user was dragging, ignoring`);
      return;
    }
    
    // Check if click landed directly on the rich text wrapper (between segments)
    // e.currentTarget is the element the handler is attached to
    // e.target is the actual element that was clicked
    if (e.target !== e.currentTarget) {
      console.log(`🖱️ Segments [${nodeId}] click inside segment (target is child element)`);
      // Click is inside a segment, let the segment handle it
      return;
    }
    
    // Click landed on the wrapper between segments, find nearest one
    console.log(`🖱️ Segments [${nodeId}] click between segments, finding nearest`);
    
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
        console.log(`🎯 Segments [${nodeId}] focusing nearest segment: ${nearestSegment} (index ${index}) with type=${focusType}`);
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
