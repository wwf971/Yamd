import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { useRenderUtilsContext } from '@/core/RenderUtils.ts';
import { docsState } from '@/core/DocStore.js';
import './SegmentRef.css';

/**
 * Segment component for asset references (images, videos, latex blocks, etc)
 * Handles \ref{linkText}{linkId} patterns with inline editing support
 * Supports focus/unfocus protocol for navigation between segments
 */
const SegmentRef = ({ segmentId, parentNodeId, globalInfo }) => {
  // Get render utils from context
  const renderUtils = useRenderUtilsContext();

  const isLogicallyFocused = useRef(false);
  const [isEditing, setIsEditing] = useState(false);
  const pendingFocusTypeRef = useRef(null); // Track what type of focus is pending
  
  // Subscribe to segment node data for reactive updates
  const segmentData = renderUtils.useNodeData(segmentId);
  
  // Subscribe ONLY to counters to avoid unnecessary re-renders
  const focusCounter = renderUtils.useNodeFocusCounter(segmentId);
  const unfocusCounter = renderUtils.useNodeUnfocusCounter(segmentId);
  const keyboardCounter = renderUtils.useNodeKeyboardCounter(segmentId);
  

  
  // Refs for editable spans and link element
  const linkTextRef = useRef(null);
  const linkIdRef = useRef(null);
  const linkRef = useRef(null);

  
  // Backup state for cancel
  const [editBackup, setEditBackup] = useState(null);

  if (!segmentData || segmentData.selfDisplay !== 'ref-asset') {
    return <span className="yamd-error">Invalid reference segment: {segmentId}</span>;
  }

  const { refId, targetId, linkText } = segmentData;
  
  // Debug: log render with isEditing state
  console.log(`🔄 SegmentRef [${segmentId}] rendering: isEditing=${isEditing}`);
  
  // Clear backup when exiting edit mode
  useEffect(() => {
    if (!isEditing && editBackup) {
      setEditBackup(null);
    }
  }, [isEditing, editBackup]);
  
  // Handle unfocus requests (from clicking other segments)
  useEffect(() => {
    // Skip if counter is 0 (initial state)
    if (unfocusCounter === 0) return;
    
    // Fetch the full state non-reactively to get the type
    const state = renderUtils.getNodeStateById?.(segmentId);
    if (!state?.unfocus) return;
    
    const { type } = state.unfocus;
    
    console.log(`🔕 SegmentRef [${segmentId}] received unfocus:`, { counter: unfocusCounter, type, isEditing });
    
    // Exit edit mode and mark as not focused (always call handleUnfocus, let it handle the state)
    handleUnfocus(true, false); // Save changes but don't blur (might not be in DOM)
    
  }, [unfocusCounter, segmentId, handleUnfocus, renderUtils]);
  // Note: isEditing removed from deps to avoid re-processing when exiting edit mode
  
  // Handle keyboard events forwarded from YamdDoc
  useEffect(() => {
    // Skip if counter is 0 (initial state) or not editing
    if (keyboardCounter === 0 || !isEditing) return;
    
    // Skip if not actually focused (prevent handling stale events after unfocus)
    if (!isLogicallyFocused.current) return;
    
    // Fetch the full state non-reactively to get the event
    const state = renderUtils.getNodeStateById?.(segmentId);
    if (!state?.keyboard?.event) return;
    
    const event = state.keyboard.event;
    
    console.log(`⌨️ SegmentRef [${segmentId}] received keyboard event:`, event);
    
    // Determine which field contains the cursor using selection API
    const selection = window.getSelection();
    let field = 'linkText'; // default
    
    if (selection && selection.anchorNode) {
      // Check if cursor is inside linkIdRef
      if (linkIdRef.current && linkIdRef.current.contains(selection.anchorNode)) {
        field = 'linkId';
      } else if (linkTextRef.current && linkTextRef.current.contains(selection.anchorNode)) {
        field = 'linkText';
      }
    }
    
    console.log(`⌨️ SegmentRef [${segmentId}] determined field: ${field}`);
    
    handleKeyDown(event, field);
    
  }, [keyboardCounter, segmentId, renderUtils, handleKeyDown]);
  
  // Handle focus requests
  useEffect(() => {
    // Skip if counter is 0 (initial state)
    if (focusCounter === 0) return;
    
    // Fetch the full state non-reactively to get the type
    const state = renderUtils.getNodeStateById?.(segmentId);
    if (!state?.focus) return;
    
    const { type } = state.focus;
    
    console.log(`🎯 SegmentRef [${segmentId}] received focus:`, { counter: focusCounter, type });
    
    // Check if this is a navigation focus (fromLeft, fromRight, fromUp, fromDown)
    const isNavigationFocus = ['fromLeft', 'fromRight', 'fromUp', 'fromDown'].includes(type);
    
    if (isNavigationFocus || type === 'mouseClick') {
      // Auto-enter edit mode for keyboard navigation and mouse clicks
      console.log(`✏️ SegmentRef [${segmentId}] entering edit mode from ${type}`);
      
      // Report to YamdDoc that this segment is now focused
      renderUtils.setCurrentSegId?.(segmentId);
      
      // Store the focus type for the layout effect to handle
      pendingFocusTypeRef.current = type;
      
      // Enter edit mode only if not already editing
      if (!isEditing) {
        setIsEditing(true);
      }
      
      // Mark as focused IMMEDIATELY when entering edit mode
      isLogicallyFocused.current = true;
      
      // Store backup for cancel (only if not already set)
      if (!editBackup) {
        setEditBackup({
          linkText: segmentData?.linkText || '',
          targetId: segmentData?.targetId || ''
        });
      }
      
      // Field focusing is handled by useLayoutEffect that runs after DOM updates
      return;
    }
    
    // Other focus types - just focus the link element (non-editing)
    if (!isEditing) {
      if (linkRef.current) {
        linkRef.current.focus();
      }
    }
    
  }, [focusCounter, segmentId, renderUtils]);
  
  // Handle focusing fields when entering edit mode - runs synchronously after DOM updates
  useLayoutEffect(() => {
    if (!isEditing || !pendingFocusTypeRef.current) return;
    
    const type = pendingFocusTypeRef.current;
    const isNavigationFocus = ['fromLeft', 'fromRight', 'fromUp', 'fromDown'].includes(type);
    const isClickFocus = type === 'mouseClick';
    
    if (!isNavigationFocus && !isClickFocus) {
      // Clear pending focus for unhandled types
      pendingFocusTypeRef.current = null;
      return;
    }
    
    // Focus appropriate field based on focus type
    // fromRight -> focus linkId at end
    // fromLeft, fromUp, fromDown, mouseClick -> focus linkText at beginning
    const shouldFocusLinkId = (type === 'fromRight');
    
    if (shouldFocusLinkId && linkIdRef.current) {
      console.log(`📍 SegmentRef [${segmentId}] (useLayoutEffect) focusing linkId (last field)`);
      linkIdRef.current.focus();
      // Move cursor to end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(linkIdRef.current);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } else if (linkTextRef.current) {
      console.log(`📍 SegmentRef [${segmentId}] (useLayoutEffect) focusing linkText (first field)`);
      linkTextRef.current.focus();
      // Move cursor to beginning
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(linkTextRef.current);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    
    // Clear pending focus after handling
    pendingFocusTypeRef.current = null;
  }, [isEditing, segmentId]);
  
  // Unified unfocus handler
  const handleUnfocus = useCallback((saveChanges = true, shouldBlur = false) => {
    console.log(`🔌 SegmentRef [${segmentId}] handleUnfocus called: saveChanges=${saveChanges}, shouldBlur=${shouldBlur}, currentIsEditing=${isEditing}`);
    
    // Save content FIRST before any state changes
    if (saveChanges && isEditing) {
      const newLinkText = linkTextRef.current?.textContent || '';
      const newTargetId = linkIdRef.current?.textContent || '';
      
      console.log(`💾 SegmentRef [${segmentId}] saving: linkText="${newLinkText}", targetId="${newTargetId}"`);
      
      // Update segment node data
      const docId = globalInfo?.docId;
      if (docId && segmentId) {
        renderUtils.updateNodeData(segmentId, (draft) => {
          draft.linkText = newLinkText;
          draft.targetId = newTargetId;
          // Regenerate textRaw from core data
          draft.textRaw = newLinkText 
            ? `\\ref{${newLinkText}}{${newTargetId}}`
            : `\\ref{${newTargetId}}`;
        });
      }
    }
    
    // Mark as no longer focused
    isLogicallyFocused.current = false;
    
    // DON'T blur - not needed with single contentEditable root
    // The focus will naturally move away when another segment is focused
    
    // Exit edit mode
    console.log(`🚪 SegmentRef [${segmentId}] calling setIsEditing(false)`);
    setIsEditing(false);
  }, [segmentId, isEditing, globalInfo, renderUtils]);
  
  // Handle keyboard events in edit mode
  const handleKeyDown = useCallback((e, field) => {
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
          console.log(`⬅️ SegmentRef [${segmentId}] triggering unfocus: left`);
          renderUtils.triggerUnfocus(parentNodeId, segmentId, 'left');
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
      const isCollapsed = selection.isCollapsed;
      console.log(`➡️ SegmentRef [${segmentId}] ArrowRight in linkId: cursorPos=${cursorPos}, textLength=${textLength}, isCollapsed=${isCollapsed}`);
      
      // Only trigger unfocus if cursor is at end AND no text is selected
      if (isCollapsed && cursorPos === textLength) {
        e.preventDefault();
        // Save and unfocus before moving to next segment
        handleUnfocus(true, false); // Save but don't blur
        // Trigger unfocus to move to next segment
        if (parentNodeId) {
          console.log(`➡️ SegmentRef [${segmentId}] triggering unfocus: right`);
          renderUtils.triggerUnfocus(parentNodeId, segmentId, 'right');
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
        console.log(`⬆️ SegmentRef [${segmentId}] triggering unfocus: up`);
        renderUtils.triggerUnfocus(parentNodeId, segmentId, 'up', { cursorPageX: 0 });
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      // Save and unfocus before moving down
      handleUnfocus(true, true); // Save and blur
      if (parentNodeId) {
        console.log(`⬇️ SegmentRef [${segmentId}] triggering unfocus: down`);
        renderUtils.triggerUnfocus(parentNodeId, segmentId, 'down', { cursorPageX: 0 });
      }
    }
  }, [isEditing, segmentId, parentNodeId, linkTextRef, linkIdRef, handleUnfocus, renderUtils]);
  
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
    isLogicallyFocused.current = false;
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
    // (if isLogicallyFocused is false, it means we already handled unfocus via arrow keys)
    if (isLogicallyFocused.current) {
      console.log(`🔵 SegmentRef [${segmentId}] handleBlur: isFocused=true, calling handleUnfocus(true, false)`);
      handleUnfocus(true, false); // Save changes on blur, but don't call .blur() again (we're already in blur!)
    } else {
      console.log(`⚪ SegmentRef [${segmentId}] handleBlur: isFocused=false, skipping`);
    }
  };
  
  // Handle click to enter edit mode or navigate
  const handleClick = (e) => {
    // Don't trigger focus if already focused (check using ref, not state to avoid stale closure)
    if (isLogicallyFocused.current) {
      console.log(`⚠️ SegmentRef [${segmentId}] already focused, ignoring click`);
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    // Report to parent that this segment is now focused
    renderUtils.setCurrentSegId?.(segmentId);
    
    // Enter edit mode on click
    const docId = globalInfo?.docId;
    docsState.triggerFocus(docId, segmentId, 'mouseClick');
  };
  
  // Handle arrow key navigation in non-editing mode (display mode)
  const handleLinkKeyDown = (e) => {
    if (isEditing || !parentNodeId) return;
    
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      console.log(`⬅️ SegmentRef [${segmentId}] (display mode) triggering unfocus: left`);
      renderUtils.triggerUnfocus(parentNodeId, segmentId, 'left');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      console.log(`➡️ SegmentRef [${segmentId}] (display mode) triggering unfocus: right`);
      renderUtils.triggerUnfocus(parentNodeId, segmentId, 'right');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      console.log(`⬆️ SegmentRef [${segmentId}] (display mode) triggering unfocus: up`);
      renderUtils.triggerUnfocus(parentNodeId, segmentId, 'up', { cursorPageX: 0 });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      console.log(`⬇️ SegmentRef [${segmentId}] (display mode) triggering unfocus: down`);
      renderUtils.triggerUnfocus(parentNodeId, segmentId, 'down', { cursorPageX: 0 });
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      // Enter edit mode (treat keyboard enter like a click)
      const docId = globalInfo?.docId;
      docsState.triggerFocus(docId, segmentId, 'mouseClick');
    }
  };
  
  // Handle focus on the container - redirect to linkText
  const handleContainerFocus = useCallback((e) => {
    // If the container itself gets focused (not a child field), redirect to linkText
    if (e.target === e.currentTarget && linkTextRef.current) {
      console.log(`📍 SegmentRef [${segmentId}] container focused, redirecting to linkText`);
      e.preventDefault();
      // Use setTimeout to ensure it runs after the browser's default focus behavior
      setTimeout(() => {
        if (linkTextRef.current) {
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(linkTextRef.current);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }, 0);
    }
  }, [segmentId]);
  
  // Render edit mode
  if (isEditing) {
    return (
      <span 
        className="yamd-ref-editing" 
        contentEditable={true}
        suppressContentEditableWarning
        onFocus={handleContainerFocus}
      >
        <span
          className="yamd-ref-syntax"
          contentEditable={false}
          suppressContentEditableWarning
          style={{ userSelect: 'none' }}
        >\ref{'{'}</span>
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
        <span
          className="yamd-ref-syntax"
          contentEditable={false}
          suppressContentEditableWarning
          style={{ userSelect: 'none' }}
        >{'}{'}</span>
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
        <span
          className="yamd-ref-syntax"
          contentEditable={false}
          suppressContentEditableWarning
          style={{ userSelect: 'none' }}
        >{'}'}</span>
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
