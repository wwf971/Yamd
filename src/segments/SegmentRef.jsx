import React, { useRef, useState, useEffect } from 'react';
import { useRenderUtilsContext } from '@/core/RenderUtils.ts';
import { docsState } from '@/core/DocStore.js';
import './SegmentRef.css';

/**
 * Segment component for asset references (images, videos, latex blocks, etc)
 * Handles \ref{linkText}{linkId} patterns with inline editing support
 * Supports focus/unfocus protocol for navigation between segments
 */
const SegmentRef = ({ segment, segmentId: segmentIdProp, parentNodeId, globalInfo }) => {
  // Get render utils from context
  const renderUtils = useRenderUtilsContext();

  const isFocusedRef = useRef(false);
  const [isEditing, setIsEditing] = useState(false);

  // Use segmentId from props if provided, otherwise use segment.id
  const effectiveSegmentId = segmentIdProp || segment?.id;
  
  // Subscribe to segment node data for reactive updates
  const segmentData = renderUtils.useNodeData(effectiveSegmentId);
  
  // Subscribe to segment node state for focus/edit management
  const segmentState = renderUtils.useNodeState ? renderUtils.useNodeState(effectiveSegmentId) : {};
  

  
  // Refs for editable spans and link element
  const linkTextRef = useRef(null);
  const linkIdRef = useRef(null);
  const linkRef = useRef(null);

  
  // Backup state for cancel
  const [editBackup, setEditBackup] = useState(null);

  // Use reactive segment data if available, fallback to prop
  const currentSegment = segmentData || segment;

  if (!currentSegment || currentSegment.selfDisplay !== 'ref-asset') {
    return <span className="yamd-error">Invalid reference segment</span>;
  }

  const { id: segmentId, refId, targetId, linkText } = currentSegment;
  
  // Debug: log render with isEditing state
  console.log(`🔄 SegmentRef [${effectiveSegmentId}] rendering: isEditing=${isEditing}`);
  
  // Handle entering edit mode
  useEffect(() => {
    if (isEditing && !editBackup) {
      // Store backup when entering edit mode
      setEditBackup({
        linkText: linkText || '',
        targetId: targetId || ''
      });
      
      // Focus the linkText span
      setTimeout(() => {
        if (linkTextRef.current) {
          linkTextRef.current.focus();
          // Select all text
          const range = document.createRange();
          range.selectNodeContents(linkTextRef.current);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }, 0);
    } else if (!isEditing && editBackup) {
      // Clear backup when exiting edit mode
      setEditBackup(null);
    }
  }, [isEditing, editBackup, linkText, targetId]);
  
  // Handle focus requests
  useEffect(() => {
    if (!segmentState?.focus) return;
    
    const { counter, type } = segmentState.focus;
    
    // Skip if counter is 0 (initial state)
    if (counter === 0) return;
    
    console.log(`🎯 SegmentRef [${effectiveSegmentId}] received focus:`, { counter, type });
    
    // Check if this is a navigation focus (fromLeft, fromRight, fromUp, fromDown)
    const isNavigationFocus = ['fromLeft', 'fromRight', 'fromUp', 'fromDown'].includes(type);
    
    if (isNavigationFocus) {
      // Auto-enter edit mode for keyboard navigation
      console.log(`✏️ SegmentRef [${effectiveSegmentId}] entering edit mode from ${type}`);
      
      if (!isEditing) {
        setIsEditing(true);
        
        // Store backup for cancel
        setEditBackup({
          linkText: segmentData?.linkText || '',
          targetId: segmentData?.targetId || ''
        });
      }
      
      // Field focusing is handled by separate useEffect that watches isEditing
      return;
    }
    
    // Handle 'editing' focus type - enter edit mode (for explicit edit requests)
    if (type === 'editing') {
      if (!isEditing) {
        console.log(`✏️ SegmentRef [${effectiveSegmentId}] entering edit mode`);
        setIsEditing(true);
        
        // Mark as focused when entering edit mode
        isFocusedRef.current = true;
        
        // Store backup for cancel
        setEditBackup({
          linkText: segmentData?.linkText || '',
          targetId: segmentData?.targetId || ''
        });
        
        // Focus the first field by default
        setTimeout(() => {
          if (linkTextRef.current) {
            linkTextRef.current.focus();
            // Select all text
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(linkTextRef.current);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }, 0);
      }
      return;
    }
    
    // Other focus types - just focus the link element (non-editing)
    if (!isEditing) {
      if (linkRef.current) {
        linkRef.current.focus();
      }
    }
    
  }, [segmentState?.focus?.counter, effectiveSegmentId]);
  
  // Handle focusing fields when entering edit mode
  useEffect(() => {
    if (!isEditing) return;
    if (!segmentState?.focus) return;
    
    const { type } = segmentState.focus;
    const isNavigationFocus = ['fromLeft', 'fromRight', 'fromUp', 'fromDown'].includes(type);
    
    if (!isNavigationFocus) return;
    
    // Mark as focused when entering edit mode
    isFocusedRef.current = true;
    
    // Focus appropriate field based on navigation direction
    const shouldFocusLinkId = (type === 'fromRight');
    
    if (shouldFocusLinkId && linkIdRef.current) {
      console.log(`📍 SegmentRef [${effectiveSegmentId}] (useEffect) focusing linkId (last field)`);
      linkIdRef.current.focus();
      // Move cursor to end - use textContent length for reliable positioning
      const textLength = linkIdRef.current.textContent?.length || 0;
      const range = document.createRange();
      const sel = window.getSelection();
      const textNode = linkIdRef.current.firstChild;
      
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        // Position at end of text node
        range.setStart(textNode, textLength);
        range.collapse(true);
      } else {
        // Empty or no text node - position at end of element
        range.selectNodeContents(linkIdRef.current);
        range.collapse(false);
      }
      
      sel.removeAllRanges();
      sel.addRange(range);
    } else if (linkTextRef.current) {
      console.log(`📍 SegmentRef [${effectiveSegmentId}] (useEffect) focusing linkText (first field)`);
      linkTextRef.current.focus();
      // Move cursor to beginning - use textContent length for reliable positioning
      const range = document.createRange();
      const sel = window.getSelection();
      const textNode = linkTextRef.current.firstChild;
      
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        // Position at start of text node
        range.setStart(textNode, 0);
        range.collapse(true);
      } else {
        // Empty or no text node - position at start of element
        range.selectNodeContents(linkTextRef.current);
        range.collapse(true);
      }
      
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, [isEditing, effectiveSegmentId, segmentState?.focus]);
  
  // Unified unfocus handler
  const handleUnfocus = (saveChanges = true, shouldBlur = false) => {
    console.log(`🔌 SegmentRef [${effectiveSegmentId}] handleUnfocus called: saveChanges=${saveChanges}, shouldBlur=${shouldBlur}, currentIsEditing=${isEditing}`);
    
    // Mark as no longer focused
    isFocusedRef.current = false;
    
    if (saveChanges && isEditing) {
      // Save changes
      const newLinkText = linkTextRef.current?.textContent || '';
      const newTargetId = linkIdRef.current?.textContent || '';
      
      console.log(`💾 SegmentRef [${effectiveSegmentId}] saving: linkText="${newLinkText}", targetId="${newTargetId}"`);
      
      // Update segment node data
      const docId = globalInfo?.docId;
      if (docId && effectiveSegmentId) {
        renderUtils.updateNodeData(effectiveSegmentId, (draft) => {
          draft.linkText = newLinkText;
          draft.targetId = newTargetId;
          // Regenerate textRaw from core data
          draft.textRaw = newLinkText 
            ? `\\ref{${newLinkText}}{${newTargetId}}`
            : `\\ref{${newTargetId}}`;
        });
      }
    }
    
    // Explicitly blur any focused field if requested (only for arrow keys, not for blur events)
    if (shouldBlur) {
      if (document.activeElement === linkTextRef.current) {
        linkTextRef.current.blur();
      }
      if (document.activeElement === linkIdRef.current) {
        linkIdRef.current.blur();
      }
    }
    
    // Exit edit mode
    console.log(`🚪 SegmentRef [${effectiveSegmentId}] calling setIsEditing(false)`);
    setIsEditing(false);
  };
  
  // Handle keyboard events in edit mode
  const handleKeyDown = (e, field) => {
    if (!isEditing) return;
    
    if (e.key === 'Enter') {
      e.preventDefault();
      handleUnfocus(true, true); // Save on Enter and blur
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    } else if (e.key === 'ArrowLeft' && field === 'linkText') {
      // Check if cursor is at the beginning of linkText (first field)
      const selection = window.getSelection();
      if (selection.anchorOffset === 0) {
        e.preventDefault();
        // Save and unfocus before moving to previous segment
        handleUnfocus(true, true); // Save and blur
        // Trigger unfocus to move to previous segment
        if (parentNodeId) {
          console.log(`⬅️ SegmentRef [${effectiveSegmentId}] triggering unfocus: left`);
          renderUtils.triggerUnfocus(parentNodeId, effectiveSegmentId, 'left');
        }
      }
    } else if (e.key === 'ArrowLeft' && field === 'linkId') {
      // Check if cursor is at the beginning of linkId
      const selection = window.getSelection();
      if (selection.anchorOffset === 0) {
        e.preventDefault();
        linkTextRef.current?.focus();
        // Move cursor to end of linkText
        const range = document.createRange();
        range.selectNodeContents(linkTextRef.current);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } else if (e.key === 'ArrowRight' && field === 'linkId') {
      // Check if cursor is at the end of linkId (last field)
      const selection = window.getSelection();
      const textLength = linkIdRef.current?.textContent?.length || 0;
      const cursorPos = selection.anchorOffset;
      console.log(`➡️ SegmentRef [${effectiveSegmentId}] ArrowRight in linkId: cursorPos=${cursorPos}, textLength=${textLength}`);
      if (cursorPos === textLength) {
        e.preventDefault();
        // Save and unfocus before moving to next segment
        handleUnfocus(true, true); // Save and blur
        // Trigger unfocus to move to next segment
        if (parentNodeId) {
          console.log(`➡️ SegmentRef [${effectiveSegmentId}] triggering unfocus: right`);
          renderUtils.triggerUnfocus(parentNodeId, effectiveSegmentId, 'right');
        }
      }
    } else if (e.key === 'ArrowRight' && field === 'linkText') {
      // Check if cursor is at the end of linkText
      const selection = window.getSelection();
      const textLength = linkTextRef.current?.textContent?.length || 0;
      if (selection.anchorOffset === textLength) {
        e.preventDefault();
        linkIdRef.current?.focus();
        // Move cursor to beginning of linkId
        const range = document.createRange();
        range.setStart(linkIdRef.current.firstChild || linkIdRef.current, 0);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      // Save and unfocus before moving up
      handleUnfocus(true, true); // Save and blur
      if (parentNodeId) {
        console.log(`⬆️ SegmentRef [${effectiveSegmentId}] triggering unfocus: up`);
        renderUtils.triggerUnfocus(parentNodeId, effectiveSegmentId, 'up', { cursorPageX: 0 });
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      // Save and unfocus before moving down
      handleUnfocus(true, true); // Save and blur
      if (parentNodeId) {
        console.log(`⬇️ SegmentRef [${effectiveSegmentId}] triggering unfocus: down`);
        renderUtils.triggerUnfocus(parentNodeId, effectiveSegmentId, 'down', { cursorPageX: 0 });
      }
    }
  };
  
  // Cancel edit and restore backup
  const cancelEdit = () => {
    if (editBackup) {
      // Restore backup values
      if (linkTextRef.current) {
        linkTextRef.current.textContent = editBackup.linkText;
      }
      if (linkIdRef.current) {
        linkIdRef.current.textContent = editBackup.targetId;
      }
    }
    
    // Mark as no longer focused and exit edit mode without saving
    isFocusedRef.current = false;
    setIsEditing(false);
  };
  
  // Handle blur (only save if still marked as focused)
  const handleBlur = (e) => {
    // Check if focus moved to another editable span within this ref
    const relatedTarget = e.relatedTarget;
    if (relatedTarget === linkTextRef.current || relatedTarget === linkIdRef.current) {
      return; // Don't save yet, still editing within this ref
    }
    
    // Only call handleUnfocus if we're still marked as focused
    // (if isFocusedRef is false, it means we already handled unfocus via arrow keys)
    if (isFocusedRef.current) {
      console.log(`🔵 SegmentRef [${effectiveSegmentId}] handleBlur: isFocused=true, calling handleUnfocus(true, false)`);
      handleUnfocus(true, false); // Save changes on blur, but don't call .blur() again (we're already in blur!)
    } else {
      console.log(`⚪ SegmentRef [${effectiveSegmentId}] handleBlur: isFocused=false, skipping`);
    }
  };
  
  // Handle click to enter edit mode or navigate
  const handleClick = (e) => {
    if (isEditing) {
      return; // Already editing
    }
    
    e.preventDefault();
    
    // TEMPORARY: Always enter edit mode on click for debugging
    const docId = globalInfo?.docId;
    docsState.triggerFocus(docId, effectiveSegmentId, 'editing');
    
    // TODO: Restore navigation logic after debugging
    // Check if we should enter edit mode (e.g., double-click or Ctrl+click)
    // if (e.detail === 2 || e.ctrlKey || e.metaKey) {
    //   // Enter edit mode
    //   const docId = globalInfo?.docId;
    //   docsState.triggerFocus(docId, segmentId, 'editing');
    // } else if (globalInfo?.onRefClick) {
    //   // Normal click - navigate to target
    //   globalInfo.onRefClick({
    //     refId: refId,
    //     targetId: targetId,
    //     sourceElement: e.target
    //   });
    // }
  };
  
  // Handle arrow key navigation in non-editing mode (display mode)
  const handleLinkKeyDown = (e) => {
    if (isEditing || !parentNodeId) return;
    
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      console.log(`⬅️ SegmentRef [${effectiveSegmentId}] (display mode) triggering unfocus: left`);
      renderUtils.triggerUnfocus(parentNodeId, effectiveSegmentId, 'left');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      console.log(`➡️ SegmentRef [${effectiveSegmentId}] (display mode) triggering unfocus: right`);
      renderUtils.triggerUnfocus(parentNodeId, effectiveSegmentId, 'right');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      console.log(`⬆️ SegmentRef [${effectiveSegmentId}] (display mode) triggering unfocus: up`);
      renderUtils.triggerUnfocus(parentNodeId, effectiveSegmentId, 'up', { cursorPageX: 0 });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      console.log(`⬇️ SegmentRef [${effectiveSegmentId}] (display mode) triggering unfocus: down`);
      renderUtils.triggerUnfocus(parentNodeId, effectiveSegmentId, 'down', { cursorPageX: 0 });
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      // Enter edit mode
      const docId = globalInfo?.docId;
      docsState.triggerFocus(docId, effectiveSegmentId, 'editing');
    }
  };
  
  // Render edit mode
  if (isEditing) {
    return (
      <span className="yamd-ref-editing">
        <span className="yamd-ref-syntax">\ref{'{'}</span>
        <span
          ref={linkTextRef}
          contentEditable
          suppressContentEditableWarning
          className="yamd-ref-editable yamd-ref-linktext"
          onKeyDown={(e) => handleKeyDown(e, 'linkText')}
          onBlur={handleBlur}
        >
          {linkText || ''}
        </span>
        <span className="yamd-ref-syntax">{'}{'}</span>
        <span
          ref={linkIdRef}
          contentEditable
          suppressContentEditableWarning
          className="yamd-ref-editable yamd-ref-linkid"
          onKeyDown={(e) => handleKeyDown(e, 'linkId')}
          onBlur={handleBlur}
        >
          {targetId || ''}
        </span>
        <span className="yamd-ref-syntax">{'}'}</span>
      </span>
    );
  }
  
  // Render display mode
  // Get reference data
  const refData = renderUtils.getRefById(refId);
  if (!refData) {
    // Fallback: display original reference syntax
    return <span className="yamd-ref-fallback">{segment.textRaw}</span>;
  }

  // Auto-generate link text if not provided
  let displayText = linkText;
  if (!displayText || displayText.trim() === '') {
    // Try to find the reference to get the target node
    const ref = renderUtils.getRefById(targetId);
    const targetNode = ref?.nodeId ? renderUtils.getNodeDataById(ref.nodeId) : null;
    
    if (targetNode) {
      if (targetNode.type === 'latex') {
        // For LaTeX nodes, try to get asset info for numbering
        const asset = targetNode.assetId ? renderUtils.getAssetById(targetNode.assetId) : null;
        if (asset && asset.indexOfSameType && !asset.no_index) {
          const captionTitle = asset.captionTitle || 'Eq';
          displayText = `${captionTitle} ${asset.indexOfSameType}`;
        } else {
          displayText = 'Equation';
        }
      } else if (targetNode.type === 'image') {
        displayText = 'Figure';
      } else if (targetNode.type === 'video') {
        displayText = 'Video';
      } else {
        displayText = targetId;
      }
    } else {
      displayText = targetId;
    }
  }

  return (
    <a 
      ref={linkRef}
      id={refId}
      href={`#${targetId}`}
      className="yamd-ref-link"
      data-ref-target={targetId}
      data-ref-id={refId}
      title={`Reference to ${targetId} (Double-click to edit)`}
      onClick={handleClick}
      onKeyDown={handleLinkKeyDown}
      tabIndex={0}
      style={{ outline: 'none', cursor: 'pointer' }}
    >
      {displayText}
    </a>
  );
};

export default SegmentRef;
