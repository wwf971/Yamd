import React, { useRef, useEffect, forwardRef } from 'react';
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
  
  // Subscribe to segment's focus state
  const segmentState = renderUtils.useNodeState(segmentId);
  
  // Get text from segmentData
  const text = segmentData?.textRaw ?? '';
  
  // Ref for the contentEditable span
  const textElRef = useRef(null);
  
  // Track if user is currently editing
  const isEditingRef = useRef(false);
  
  // Update DOM content when text prop changes externally (but not while user is editing)
  useEffect(() => {
    if (textElRef.current && !isEditingRef.current) {
      textElRef.current.textContent = text;
    }
  }, [text]);

  // Handle focus requests from parent NodeRichText
  useEffect(() => {
    if (!segmentState?.focus || !textElRef.current) return;
    
    const { counter, type, cursorPageX } = segmentState.focus;
    
    // Skip if counter is 0 (initial state)
    if (counter === 0) return;
    
    console.log(`🎯 SegmentText [${segmentId}] received focus:`, { counter, type });
    
    // Focus the element
    textElRef.current.focus();
    
    // Set cursor position based on focus type
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
    
  }, [segmentState?.focus?.counter, segmentId]);

  // Handle key events - trigger unfocus for navigation
  const handleKeyDown = (e) => {
    // Navigate left with Left arrow (at beginning)
    if (e.key === 'ArrowLeft') {
      const isAtBeginning = isCursorAtBeginning(textElRef.current);
      console.log(`⬅️ SegmentText [${segmentId}] ArrowLeft: isAtBeginning=${isAtBeginning}`);
      if (isAtBeginning) {
        e.preventDefault();
        console.log(`⬅️ SegmentText [${segmentId}] triggering unfocus: left`);
        renderUtils.triggerUnfocus(parentNodeId, segmentId, 'left');
        return;
      }
    }
    
    // Navigate right with Right arrow (at end)
    if (e.key === 'ArrowRight') {
      const isAtEnd = isCursorAtEnd(textElRef.current);
      console.log(`➡️ SegmentText [${segmentId}] ArrowRight: isAtEnd=${isAtEnd}, textContent="${textElRef.current?.textContent}"`);
      if (isAtEnd) {
        e.preventDefault();
        console.log(`➡️ SegmentText [${segmentId}] triggering unfocus: right`);
        renderUtils.triggerUnfocus(parentNodeId, segmentId, 'right');
        return;
      }
    }
    
    // Navigate up with Up arrow
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const cursorPageX = getCursorPageX(textElRef.current);
      console.log(`⬆️ SegmentText [${segmentId}] triggering unfocus: up, cursorPageX=${cursorPageX}`);
      renderUtils.triggerUnfocus(parentNodeId, segmentId, 'up', { cursorPageX });
      return;
    }
    
    // Navigate down with Down arrow
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const cursorPageX = getCursorPageX(textElRef.current);
      console.log(`⬇️ SegmentText [${segmentId}] triggering unfocus: down, cursorPageX=${cursorPageX}`);
      renderUtils.triggerUnfocus(parentNodeId, segmentId, 'down', { cursorPageX });
      return;
    }
    
    // Blur on Escape
    if (e.key === 'Escape') {
      e.preventDefault();
      textElRef.current?.blur();
    }
  };

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
   
  // Handle blur to end editing
  const handleBlur = (e) => {
    isEditingRef.current = false;
    
    // Apply blur styles
    e.target.style.backgroundColor = 'transparent';
    e.target.style.border = '1px solid transparent';
  };
  
  const handleFocus = (e) => {
    isEditingRef.current = true;
    e.target.style.backgroundColor = '#f0f8ff';
    e.target.style.border = '1px solid #4CAF50';
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
  
  // Check if text is empty
  const isEmpty = text === '';
  
  console.log(`📝 SegmentText [${segmentId}] rendering: text="${text}"`);
  
  // Single contentEditable span
  return (
    <span
      ref={textElRef}
      contentEditable={true}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      suppressContentEditableWarning={true}
      className={`${className} yamd-text-segment`}
      style={{
        display: 'inline',
        outline: 'none',
        cursor: 'text',
        padding: '0px 2px',
        borderRadius: '2px',
        transition: 'background-color 0.2s, border 0.2s',
        userSelect: 'text',
        WebkitUserSelect: 'text',
        MozUserSelect: 'text',
        msUserSelect: 'text',
        border: '1px solid transparent',
      }}
      onFocus={handleFocus}
      onBlur={handleBlur}
      title="Text segment (editable)"
      spellCheck={false}
    />
  );
});

SegmentText.displayName = 'SegmentText';

export default SegmentText;
