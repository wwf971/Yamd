import React, { useRef, useEffect, useCallback, forwardRef } from 'react';
import { useRenderUtilsContext } from '@/core/RenderUtils.ts';
import {
  isCursorAtEnd, isCursorAtBeginning,
  getCursorPageX, getClosestCharIndex,
  setCursorPos, setCursorToEnd, setCursorToBeginning
} from '@/components/TextUtils.js';

/**
 * Text segment renderer for rich text nodes
 * This is a segment component that lives within a NodeRichText parent
 * Supports inline editing and triggers unfocus requests for navigation
 */
const SegmentText = forwardRef(({ segmentId, parentNodeId, className, globalInfo, isEditable = null}, ref) => {
  // Get render utils from context
  const renderUtils = useRenderUtilsContext();

  const contextIsEditable = renderUtils.isEditable;
  // If isEditable prop is not null, it overwrites the value from context
  const finalIsEditable = isEditable !== null ? isEditable : contextIsEditable;
  
  // Get segment data from store
  const segmentData = renderUtils.useNodeData(segmentId);
  
  // Subscribe ONLY to counters to avoid unnecessary re-renders
  const focusCounter = renderUtils.useNodeFocusCounter(segmentId);
  const unfocusCounter = renderUtils.useNodeUnfocusCounter(segmentId);
  const keyboardCounter = renderUtils.useNodeKeyboardCounter(segmentId);
  
  // Get text from segmentData
  const text = segmentData?.textRaw ?? '';
  
  // Ref for the contentEditable span
  const textElRef = useRef(null);
  
  // Track if this segment is theoretically focused (for styling)
  const isLogicallyFocused = useRef(false);
  
  // Update DOM content when text prop changes externally (but not while user is focused)
  useEffect(() => {
    if (textElRef.current && !isLogicallyFocused.current) {
      textElRef.current.textContent = text;
    }
  }, [text]);

  // Handle focus requests from parent NodeRichText
  useEffect(() => {
    if (!textElRef.current) return;
    
    // Skip if counter is 0 (initial state)
    if (focusCounter === 0) return;
    
    // Fetch the full state non-reactively to get the type and cursorPageX
    const state = renderUtils.getNodeStateById?.(segmentId);
    if (!state?.focus) return;
    
    const { type, cursorPageX } = state.focus;
    
    console.log(`🎯 SegmentText [${segmentId}] received FOCUS from ${type}`);
    
    // Mark as logically focused
    isLogicallyFocused.current = true;
    
    // Apply focus styles
    textElRef.current.style.backgroundColor = '#fff3cd';
    textElRef.current.style.border = '1px solid #ffc107';
    
    // Report to parent that this segment is now focused
    renderUtils.setCurrentSegmentId?.(segmentId);
    
    // Set cursor position based on focus type (theoretical focus - no .focus() call)
    if (type === 'fromLeft') {
      // Coming from left segment - position at beginning
      setCursorToBeginning(textElRef.current);
    } else if (type === 'fromRight') {
      // Coming from right segment - position at end
      setCursorToEnd(textElRef.current);
    } else if (type === 'fromUp' && cursorPageX !== undefined) {
      // Coming from above - find closest horizontal position
      const closestPos = getClosestCharIndex(textElRef.current, cursorPageX, 'backward');
      setCursorPos(textElRef.current, closestPos);
    } else if (type === 'fromDown' && cursorPageX !== undefined) {
      // Coming from below - find closest horizontal position
      const closestPos = getClosestCharIndex(textElRef.current, cursorPageX, 'forward');
      setCursorPos(textElRef.current, closestPos);
    } else {
      // Default - position at beginning
      setCursorToBeginning(textElRef.current);
    }
    
  }, [focusCounter, segmentId, renderUtils]);
  
  // Handle unfocus requests (from clicking other segments)
  useEffect(() => {
    // Skip if counter is 0 (initial state)
    if (unfocusCounter === 0) return;
    
    // Fetch the full state non-reactively to get the type
    const state = renderUtils.getNodeStateById?.(segmentId);
    if (!state?.unfocus) return;
    
    const { type } = state.unfocus;
    
    console.log(`🔕 SegmentText [${segmentId}] received UNFOCUS (${type})`);
    
    // Mark as not focused
    isLogicallyFocused.current = false;
    
    // Remove focus styles
    if (textElRef.current) {
      textElRef.current.style.backgroundColor = 'transparent';
      textElRef.current.style.border = '1px solid transparent';
    }
    
  }, [unfocusCounter, segmentId, renderUtils]);
  
  // Handle keyboard events forwarded from YamdDoc (for backward compatibility)
  useEffect(() => {
    if (keyboardCounter === 0) return;
    
    const state = renderUtils.getNodeStateById?.(segmentId);
    if (!state?.keyboard?.event) return;
    
    const { event } = state.keyboard;
    
    // Call handleKeyDown with synthetic event
    handleKeyDown(event);
    
  }, [keyboardCounter, segmentId, renderUtils, handleKeyDown]);

  // Handle key events forwarded from YamdDoc (theoretical focus model)
  const handleKeyDown = useCallback((e) => {
    // Navigate left with Left arrow (at beginning)
    if (e.key === 'ArrowLeft') {
      const isAtBeginning = isCursorAtBeginning(textElRef.current);
      if (isAtBeginning) {
        console.log(`🔔 SegmentText [${segmentId}] triggering unfocus LEFT`);
        renderUtils.triggerUnfocus(parentNodeId, segmentId, 'left');
      }
      return;
    }
    
    // Navigate right with Right arrow (at end)
    if (e.key === 'ArrowRight') {
      const isAtEnd = isCursorAtEnd(textElRef.current);
      if (isAtEnd) {
        console.log(`🔔 SegmentText [${segmentId}] triggering unfocus RIGHT`);
        renderUtils.triggerUnfocus(parentNodeId, segmentId, 'right');
      }
      return;
    }
    
    // Navigate up with Up arrow
    if (e.key === 'ArrowUp') {
      const cursorPageX = getCursorPageX(textElRef.current);
      console.log(`🔔 SegmentText [${segmentId}] triggering unfocus UP`);
      renderUtils.triggerUnfocus(parentNodeId, segmentId, 'up', { cursorPageX });
      return;
    }
    
    // Navigate down with Down arrow
    if (e.key === 'ArrowDown') {
      const cursorPageX = getCursorPageX(textElRef.current);
      console.log(`🔔 SegmentText [${segmentId}] triggering unfocus DOWN`);
      renderUtils.triggerUnfocus(parentNodeId, segmentId, 'down', { cursorPageX });
      return;
    }
    
    // Blur on Escape
    if (e.key === 'Escape') {
      textElRef.current?.blur();
    }
  }, [segmentId, parentNodeId, renderUtils]);

  // Handle input changes in contentEditable span
  const handleInput = (e) => {
    const newText = e.target.textContent || '';
    
    // Update segment data in Jotai store
    if (segmentId) {
      renderUtils.updateNodeData(segmentId, (segment) => {
        segment.textRaw = newText;
      });
      
      // TODO: Also need to regenerate parent node's textRaw from all segments
      // This will be handled by the parent NodeRichText component
    }
  };
   
   // Handle mouse down/click to report theoretical focus
  const handleMouseDown = (e) => {
    if (!finalIsEditable) return;
    
    console.log(`🖱️ SegmentText [${segmentId}] mouseDown`);
    
    // Mark as theoretically focused
    isLogicallyFocused.current = true;
    
    // Report to parent
    renderUtils.setCurrentSegmentId(segmentId);
    
    // Apply focus styles immediately
    if (textElRef.current) {
      textElRef.current.style.backgroundColor = '#f0f8ff';
      textElRef.current.style.border = '1px solid #4CAF50';
    }
  };

  
  if (!finalIsEditable) {
    // Non-editable mode: just render as span
    return (
      <span ref={textElRef} className={`${className} yamd-text-segment`}>
        {text}
      </span>
    );
  }
  
  // Set initial content on mount only
  useEffect(() => {
    if (textElRef.current && textElRef.current.textContent !== text) {
      textElRef.current.textContent = text;
    }
  }, []);
  
  // Editable mode: theoretical focus (allows cross-segment selection)
  // No nested contentEditable - part of parent YamdDoc's contentEditable context
  return (
    <span
      ref={textElRef}
      onInput={handleInput}
      onMouseDown={handleMouseDown}
      suppressContentEditableWarning={true}
      className={`${className} yamd-text-segment`}
      style={{
        display: 'inline',
        outline: 'none',
        cursor: 'text',
        padding: '0px 0px',
        borderRadius: '2px',
        transition: 'background-color 0.2s, border 0.2s',
        userSelect: 'text',
        WebkitUserSelect: 'text',
        MozUserSelect: 'text',
        msUserSelect: 'text',
        border: '1px solid transparent',
      }}
      title="Text segment (editable)"
      spellCheck={false}
    />
  );
});

SegmentText.displayName = 'SegmentText';

export default SegmentText;
