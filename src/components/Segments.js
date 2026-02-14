/**
 * Segments utility functions
 * Extracted from Segments.jsx to keep component clean
 */

import { getMoveUpTargetId, getMoveDownTargetId } from '@/core/EditUtils.js';

/**
 * Handle segment unfocus requests - pure function
 * @param {object} params - Parameters object
 * @returns {object|null} Action object with {type, targetId, focusType, extraData} or null if no action
 */
export const handleUnfocus = ({ 
  unfocusState, 
  segments, 
  nodeId, 
  getNodeDataById 
}) => {
  if (!unfocusState) return null;
  
  const { counter, from, type, cursorPageX } = unfocusState;
  
  // Skip if counter is 0 (initial state)
  if (counter === 0) return null;
  
  // console.log(`🎯 Segments [${nodeId}] received unfocus request from segment:`, { from, type, counter, cursorPageX });
  
  // Handle segment unfocus requests
  const segmentIndex = segments.indexOf(from);
  
  if (segmentIndex === -1) {
    console.warn(`⚠️ Segment ${from} not found in segments array`);
    return null;
  }
  
  switch (type) {
    case 'left':
      if (segmentIndex > 0) {
        // Move to previous segment - trigger focus on it
        const prevSegmentId = segments[segmentIndex - 1];
        // console.log(`⬅️ Moving focus to previous segment: ${prevSegmentId}`);
        return {
          type: 'focusSegment',
          targetId: prevSegmentId,
          focusType: 'fromRight'
        };
      } else {
        // Leftmost segment - try to move to previous node
        // console.log(`⬅️ Leftmost segment, checking for previous node`);
        
        // Move to previous node in tree order
        const upTargetId = getMoveUpTargetId(nodeId, getNodeDataById);
        if (upTargetId) {
          // Clear current segment before moving to previous node
          // console.log(`⬅️ Triggering focus on previous node: ${upTargetId}`);
          return {
            type: 'focusNode',
            targetId: upTargetId,
            focusType: 'fromRight',
            clearCurrentSegment: true
          };
        } else {
          // No previous node - stay on current segment (don't cancel current segment)
          // console.log(`⬅️ No previous node, staying on segment: ${from}`);
          // Trigger focus with fromLeft to position cursor at beginning
          return {
            type: 'focusSegment',
            targetId: from,
            focusType: 'fromLeft'
          };
        }
      }
      
    case 'right':
      if (segmentIndex < segments.length - 1) {
        // Move to next segment - trigger focus on it
        const nextSegmentId = segments[segmentIndex + 1];
        // console.log(`➡️ Moving focus to next segment: ${nextSegmentId}`);
        return {
          type: 'focusSegment',
          targetId: nextSegmentId,
          focusType: 'fromLeft'
        };
      } else {
        // Rightmost segment - try to move to next node
        // console.log(`➡️ Rightmost segment, checking for next node`);
        
        // Move to next node in tree order
        const downTargetId = getMoveDownTargetId(nodeId, getNodeDataById);
        if (downTargetId) {
          // Clear current segment before moving to next node
          // console.log(`➡️ Triggering focus on next node: ${downTargetId}`);
          return {
            type: 'focusNode',
            targetId: downTargetId,
            focusType: 'fromLeft',
            clearCurrentSegment: true
          };
        } else {
          // No next node - stay on current segment (don't cancel current segment)
          // console.log(`➡️ No next node, staying on segment: ${from}`);
          // Trigger focus with fromRight to position cursor at end
          return {
            type: 'focusSegment',
            targetId: from,
            focusType: 'fromRight'
          };
        }
      }
      
    case 'up': {
      // Move to previous node (same as plain text up arrow)
      console.log(`⬆️ Checking for previous node, cursorPageX=${cursorPageX}`);
      
      const upTargetId = getMoveUpTargetId(nodeId, getNodeDataById);
      if (upTargetId) {
        // Check if target node is focusable (has segments OR is a custom node)
        const upTargetNode = getNodeDataById(upTargetId);
        const hasSegments = upTargetNode?.segments && upTargetNode.segments.length > 0;
        // Custom nodes have types that are not built-in types
        const builtInTypes = ['text', 'array', 'object', 'node', 'latex', 'image', 'video', 'image-list', 'video-list', 'richtext'];
        const isCustomNode = upTargetNode?.type && !builtInTypes.includes(upTargetNode.type);
        const isFocusable = hasSegments || isCustomNode;
        
        if (isFocusable) {
          // Target node is focusable, move to it
          // Clear current segment before moving to previous node
          
          // Determine focus type based on whether target is parent
          const currentNode = getNodeDataById(nodeId);
          const isMovingToParent = upTargetId === currentNode?.parentId;
          const focusType = isMovingToParent ? 'arrowUpFromFirstChild' : 'arrowUp';
          
          // console.log(`⬆️ Triggering focus on ${upTargetId} with cursorPageX=${cursorPageX}`);
          return {
            type: 'focusNode',
            targetId: upTargetId,
            focusType,
            extraData: { cursorPageX },
            clearCurrentSegment: true
          };
        } else {
          // Target node is not focusable - stay on current segment and move cursor to beginning
          // console.log(`⬆️ Previous node ${upTargetId} is not focusable, staying on segment: ${from}, moving cursor to beginning`);
          return {
            type: 'focusSegment',
            targetId: from,
            focusType: 'fromLeft'
          };
        }
      } else {
        // No previous node - stay on current segment and move cursor to beginning
        // console.log(`⬆️ No previous node, staying on segment: ${from}, moving cursor to beginning`);
        // Trigger focus with fromLeft to position cursor at beginning
        return {
          type: 'focusSegment',
          targetId: from,
          focusType: 'fromLeft'
        };
      }
    }
      
    case 'down': {
      // Move to next node (same as plain text down arrow)
      // console.log(`⬇️ Checking for next node, cursorPageX=${cursorPageX}`);
      
      const downTargetId = getMoveDownTargetId(nodeId, getNodeDataById);
      if (downTargetId) {
        // Check if target node is focusable (has segments OR is a custom node)
        const downTargetNode = getNodeDataById(downTargetId);
        const hasSegments = downTargetNode?.segments && downTargetNode.segments.length > 0;
        // Custom nodes have types that are not built-in types
        const builtInTypes = ['text', 'array', 'object', 'node', 'latex', 'image', 'video', 'image-list', 'video-list', 'richtext'];
        const isCustomNode = downTargetNode?.type && !builtInTypes.includes(downTargetNode.type);
        const isFocusable = hasSegments || isCustomNode;
        
        if (isFocusable) {
          // Target node is focusable, move to it
          // Clear current segment before moving to next node
          // console.log(`⬇️ Triggering focus on ${downTargetId} with cursorPageX=${cursorPageX}`);
          return {
            type: 'focusNode',
            targetId: downTargetId,
            focusType: 'arrowDown',
            extraData: { cursorPageX },
            clearCurrentSegment: true
          };
        } else {
          // Target node is not focusable - stay on current segment and move cursor to end
          // console.log(`⬇️ Next node ${downTargetId} is not focusable, staying on segment: ${from}, moving cursor to end`);
          return {
            type: 'focusSegment',
            targetId: from,
            focusType: 'fromRight'
          };
        }
      } else {
        // No next node - stay on current segment and move cursor to end
        // console.log(`⬇️ No next node, staying on segment: ${from}, moving cursor to end`);
        // Trigger focus with fromRight to position cursor at end
        return {
          type: 'focusSegment',
          targetId: from,
          focusType: 'fromRight'
        };
      }
    }
      
    default:
      // console.warn(`⚠️ Unknown unfocus type: ${type}`);
      return null;
  }
};

/**
 * Handle split child event from segment
 * @param {object} params - Parameters object
 */
export const handleSplitChildEvent = ({
  nodeId,
  from,
  segmentIndex,
  cursorLoc,
  cursorPos,
  additionalData,
  currentSegments,
  currentNodeData,
  renderUtils
}) => {
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
      // stale events when they remount in the new parent
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
    
    console.log(`[✂️SPLIT]Segments.jsx: Split complete: created node ${newNodeId} with ${newNodeSegments.length} segments`);
    
    return;
  }
};

/**
 * Handle delete child event from segment
 * @param {object} params - Parameters object
 */
export const handleDeleteChildEvent = ({
  nodeId,
  from,
  segmentIndex,
  cursorLoc,
  additionalData,
  currentSegments,
  currentNodeData,
  renderUtils
}) => {
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
};

/**
 * Handle create child event from segment
 * @param {object} params - Parameters object
 */
export const handleCreateChildEvent = ({
  nodeId,
  from,
  segmentIndex,
  additionalData,
  renderUtils
}) => {
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
  
  // Call onCreate callback
  if (renderUtils.onCreate) {
    renderUtils.onCreate(newSegmentId, newSegment);
  }
  
  // Focus the new segment with isChildPseudo flag
  renderUtils.triggerFocus?.(newSegmentId, 'fromLeft', { isChildPseudo });
};

/**
 * Handle indent child event from segment
 * @param {object} params - Parameters object
 */
export const handleIndentChildEvent = ({ nodeId, from, renderUtils }) => {
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
};

/**
 * Handle outdent child event from segment
 * @param {object} params - Parameters object
 */
export const handleOutdentChildEvent = ({ nodeId, from, renderUtils }) => {
  console.log(`🔙 Segments [${nodeId}] received outdent event from segment ${from}`);
  const result = renderUtils.outdentNode?.(nodeId);
  if (result?.code === 0) {
    console.log(`✅ Outdent successful: ${result.message}`);
  } else {
    console.warn(`⚠️ Outdent failed: ${result?.message || 'Unknown error'}`);
  }
};

/**
 * Calculate preferred Y position for bullet alignment
 * @param {HTMLElement} textEl - The text element to measure
 * @param {Array} textRich - Rich text segments array
 * @param {string} containerClassName - CSS class name of the requesting container
 * @returns {object} Result object with {code, message, data}
 */
export const calcBulletYPos = (textEl, segments, containerClassName) => {
  try {
    if (!textEl) {
      return { code: -1, message: 'Text element not found', data: null };
    }

    // For rich text, find the first text segment span
    // segments is now an array of segment IDs, so we just query the DOM
      const textSegments = textEl.querySelectorAll('.yamd-text-segment');
    
      if (textSegments.length > 0) {
        const firstTextSegment = textSegments[0];
        const rect = firstTextSegment.getBoundingClientRect();

        const bulletContainer = textEl.closest(containerClassName);
        if (!bulletContainer) {
        return { code: -1, message: `Bullet container ${containerClassName} not found`, data: null };
        }
        const containerRect = bulletContainer.getBoundingClientRect();
        
      // Calculate vertical middle of first text segment
        const relativeY = rect.top - containerRect.top + (rect.height * 0.55);
        return { code: 0, message: 'Success', data: relativeY };
    }
    
    // Fallback: use line height estimation
    const computedStyle = window.getComputedStyle(textEl);
    const lineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(computedStyle.fontSize) * 1.2;
    const firstLineY = lineHeight / 2;
    return { code: 0, message: 'Success (fallback)', data: firstLineY };
  } catch (error) {
    return { code: -1, message: `Error calculating position: ${error.message}`, data: null };
  }
};
