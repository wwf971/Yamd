import React, { useRef, useEffect, useCallback, forwardRef } from 'react';
import { useRenderUtilsContext } from '@/core/RenderUtils.ts';
import {
  isCursorAtEnd, isCursorAtBeginning,
  getCursorPageX, getClosestCharIndex,
  setCursorPos, setCursorToEnd, setCursorToBegin,
  getCursorPosition
} from '@/components/TextUtils.js';

/**
 * Text segment renderer for rich text nodes
 * This is a segment component that lives within a NodeRichText parent
 * Supports inline editing and triggers unfocus requests for navigation
 */
const SegmentText = forwardRef(({ segmentId, parentNodeId, className, globalInfo, isEditable = null}, ref) => {
  // Get render utils from context
  const renderUtils = useRenderUtilsContext();
  const hintText = 'empty_text_segment'
  const isEmpty = useRef(null);
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
  const textEl = useRef(null);
  
  // Track if this segment is theoretically focused (for styling)
  const isLogicallyFocused = useRef(false);
  
  // Debug: log every render
  console.log(`🔄 SegmentText [${segmentId}] render: text="${text}", isEmpty=${isEmpty.current}, isLogicallyFocused=${isLogicallyFocused.current}`);
  
  // Update isEmpty when text changes
  useEffect(() => {
    isEmpty.current = text === '';
  }, [text]);
  
  // Update DOM content when text prop changes externally (but not while user is focused)
  useEffect(() => {
    if (textEl.current && !isLogicallyFocused.current) {
      if (text === '') {
        // Show hint text
        console.log(`💭 SegmentText [${segmentId}] updating DOM with hint text (text is empty, not focused)`);
        textEl.current.textContent = hintText;
        textEl.current.style.color = '#ccc';
        textEl.current.style.fontStyle = 'italic';
        isEmpty.current = true;
      } else {
        // Show actual text
        console.log(`💭 SegmentText [${segmentId}] updating DOM with actual text: "${text}"`);
        textEl.current.textContent = text;
        textEl.current.style.color = '';
        textEl.current.style.fontStyle = '';
        isEmpty.current = false;
      }
    }
  }, [text, hintText, segmentId]);

  // Handle focus requests from parent NodeRichText
  useEffect(() => {
    if (!textEl.current) return;
    
    // Skip if counter is 0 (initial state)
    if (focusCounter === 0) return;
    
    // Fetch the full state non-reactively to get the type and cursorPageX
    const state = renderUtils.getNodeStateById?.(segmentId);
    if (!state?.focus) return;
    
    const { type, cursorPageX } = state.focus;
    
    console.log(`🎯 SegmentText [${segmentId}] received FOCUS from ${type}`);
    console.log(`🎯 Current DOM content before focus: "${textEl.current?.textContent}", isEmpty=${isEmpty.current}`);
    
    // Mark as logically focused
    isLogicallyFocused.current = true;
    
    // Apply focus styles
    textEl.current.style.backgroundColor = '#fff3cd';
    textEl.current.style.border = '1px solid #ffc107';
    
    // Report to parent that this segment is now focused
    renderUtils.setCurrentSegmentId?.(segmentId);
    
    // Keep hint text visible when focused on empty segment (acts as placeholder)
    // It will be cleared when user starts typing
    
    if(isEmpty.current) {
      setCursorToBegin(textEl.current);
      return;
    }

    // Set cursor position based on focus type (theoretical focus - no .focus() call)
    // For empty segments, position based on focus type (beginning or end of hint text)
    if (type === 'fromLeft') {
      // Coming from left segment - position at beginning
      setCursorToBegin(textEl.current);
    } else if (type === 'fromRight') {
      // Coming from right segment - position at end
      setCursorToEnd(textEl.current)
    } else if (type === 'fromUp' && cursorPageX !== undefined) {
      // Coming from above - find closest horizontal position
      const closestPos = getClosestCharIndex(textEl.current, cursorPageX, 'backward');
      setCursorPos(textEl.current, closestPos);
    } else if (type === 'fromDown' && cursorPageX !== undefined) {
      // Coming from below - find closest horizontal position
      const closestPos = getClosestCharIndex(textEl.current, cursorPageX, 'forward');
      setCursorPos(textEl.current, closestPos);
    } else {
      // Default - position at beginning
      setCursorToBegin(textEl.current);
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
    if (textEl.current) {
      textEl.current.style.backgroundColor = 'transparent';
      textEl.current.style.border = '1px solid transparent';
      
      // Restore hint text if segment is empty
      const currentText = textEl.current.textContent || '';
      if (currentText === '' || currentText === ' ') {
        textEl.current.textContent = hintText;
        textEl.current.style.color = '#ccc';
        textEl.current.style.fontStyle = 'italic';
        isEmpty.current = true;
      }
    }
    
  }, [unfocusCounter, segmentId, renderUtils, hintText]);
  
  // Handle keyboard events forwarded from YamdDoc (for backward compatibility)
  useEffect(() => {
    if (keyboardCounter === 0) return;
    
    const state = renderUtils.getNodeStateById?.(segmentId);
    if (!state?.keyboard?.event) return;
    
    const { event } = state.keyboard;
    
    console.log(`⌨️ SegmentText [${segmentId}] received keyboard event: ${event.key}, counter: ${keyboardCounter}`);
    
    // Call handleKeyDown with synthetic event
    handleKeyDown(event);
    
  }, [keyboardCounter, segmentId, renderUtils, handleKeyDown]);

  // Handle key events forwarded from YamdDoc (theoretical focus model)
  const handleKeyDown = useCallback((e) => {
    // Check if this is a modifier key combination or special key
    const hasModifier = e.ctrlKey || e.altKey || e.metaKey;
    const isArrowKey = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key);
    const isSpecialKey = ['Enter', 'Escape', 'Tab', 'Backspace', 'Delete'].includes(e.key);
    
    // If it's a regular character key (not modifier combo, not arrow, not special)
    // Let browser insert it, then update the store
    if (!hasModifier && !isArrowKey && !isSpecialKey && e.key.length === 1) {
      // If showing hint text, clear it first before letting browser insert the character
      if (isEmpty.current && textEl.current?.textContent === hintText) {
        e.preventDefault(); // Prevent default to manually handle the input
        textEl.current.textContent = e.key; // Insert the typed character
        textEl.current.style.color = '';
        textEl.current.style.fontStyle = '';
        
        // Move cursor to end
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(textEl.current);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
        
        isEmpty.current = false;
        console.log(`📝 SegmentText [${segmentId}] first character typed: "${e.key}"`);
        renderUtils.updateNodeData(segmentId, (draft) => {
          draft.textRaw = e.key;
        });
        return;
      }
      
      // Normal case: let browser insert character, then update store
      requestAnimationFrame(() => {
        if (textEl.current) {
          let newText = textEl.current.textContent || '';
          // Don't save hint text
          if (newText === hintText) {
            newText = '';
          }
          console.log(`📝 SegmentText [${segmentId}] updating text: "${newText}"`);
          isEmpty.current = newText === '';
          renderUtils.updateNodeData(segmentId, (draft) => {
            draft.textRaw = newText;
          });
        }
      });
      return;
    }
    
    // Handle Backspace/Delete - also need to update after character is removed
    if (e.key === 'Backspace' || e.key === 'Delete') {
      let currentText = textEl.current?.textContent || '';
      
      // Don't count hint text as real content
      if (currentText === hintText) {
        currentText = '';
      }
      
      // If segment is already empty (showing hint), request deletion from parent
      if (isEmpty.current && currentText === '') {
        e.preventDefault();
        console.log(`🗑️ SegmentText [${segmentId}] requesting deletion from parent`);
        
        // Notify parent to delete this segment
        renderUtils.triggerChildDelete?.(parentNodeId, segmentId, 'backspaceOnEmpty');
        return;
      }
      
      // If deleting the last character, manually clear and show hint
      // Prevent default to stop browser from deleting the entire span
      if (currentText.length === 1) {
        e.preventDefault(); // Prevent browser from deleting the empty span
        console.log(`📝 SegmentText [${segmentId}] deleting last character, showing hint`);
        textEl.current.textContent = hintText;
        textEl.current.style.color = '#ccc';
        textEl.current.style.fontStyle = 'italic';
        isEmpty.current = true;
        renderUtils.updateNodeData(segmentId, (draft) => {
          draft.textRaw = '';
        });
        return;
      }
      
      // Otherwise, let browser handle deletion and read result
      requestAnimationFrame(() => {
        if (textEl.current) {
          let newText = textEl.current.textContent || '';
          // Don't save hint text
          if (newText === hintText) {
            newText = '';
          }
          console.log(`📝 SegmentText [${segmentId}] updating text after delete: "${newText}"`);
          
          // If text becomes empty, show hint
          if (newText === '') {
            textEl.current.textContent = hintText;
            textEl.current.style.color = '#ccc';
            textEl.current.style.fontStyle = 'italic';
            isEmpty.current = true;
          } else {
            isEmpty.current = false;
          }
          
          renderUtils.updateNodeData(segmentId, (draft) => {
            draft.textRaw = newText;
          });
        }
      });
      return;
    }
    
    // Navigate left with Left arrow (at beginning or empty)
    if (e.key === 'ArrowLeft') {
      // If segment is empty (showing hint text), prevent default and unfocus
      if (isEmpty.current) {
        e.preventDefault(); // Prevent cursor from moving in hint text
        console.log(`🔔 SegmentText [${segmentId}] triggering unfocus LEFT (empty)`);
        renderUtils.triggerUnfocus(parentNodeId, segmentId, 'left');
        return;
      }
      
      // Check cursor position before browser moves it
      const currentPos = getCursorPosition(textEl.current);
      const sel = window.getSelection();
      const isOutside = !textEl.current?.contains(sel.anchorNode);
      
      // Trigger unfocus if:
      // 1. Cursor is at position 0 (at beginning)
      // 2. Cursor is outside our element (already jumped out)
      const shouldUnfocus = currentPos === 0 || isOutside;
      
      console.log(`⬅️ SegmentText [${segmentId}] ArrowLeft: pos=${currentPos}, shouldUnfocus=${shouldUnfocus}`);
      
      if (shouldUnfocus) {
        e.preventDefault(); // Prevent cursor from moving outside
        console.log(`🔔 SegmentText [${segmentId}] triggering unfocus LEFT`);
        renderUtils.triggerUnfocus(parentNodeId, segmentId, 'left');
        return;
      }
      
      // Not at beginning - let browser move cursor naturally
      return;
    }
    
    // Navigate right with Right arrow (at end or empty)
    if (e.key === 'ArrowRight') {
      // If segment is empty (showing hint text), prevent default and unfocus
      if (isEmpty.current) {
        e.preventDefault(); // Prevent cursor from moving in hint text
        console.log(`🔔 SegmentText [${segmentId}] triggering unfocus RIGHT (empty)`);
        renderUtils.triggerUnfocus(parentNodeId, segmentId, 'right');
        return;
      }
      
      // Check cursor position before browser moves it
      const currentPos = getCursorPosition(textEl.current);
      const text = textEl.current?.textContent || '';
      const textLength = text.length;
      const sel = window.getSelection();
      const isOutside = !textEl.current?.contains(sel.anchorNode);
      const textToRight = currentPos < textLength ? text.substring(currentPos) : '(end)';
      
      // Trigger unfocus if:
      // 1. Cursor is at the last position (at end)
      // 2. Cursor is outside our element (already jumped out)
      const shouldUnfocus = currentPos >= textLength || isOutside;
      
      console.log(`➡️ SegmentText [${segmentId}] ArrowRight: pos=${currentPos}/${textLength}, text to right: "${textToRight}", shouldUnfocus=${shouldUnfocus}`);
      
      if (shouldUnfocus) {
        e.preventDefault(); // Prevent cursor from moving outside
        console.log(`🔔 SegmentText [${segmentId}] triggering unfocus RIGHT`);
        renderUtils.triggerUnfocus(parentNodeId, segmentId, 'right');
        return;
      }
      
      // Not at end - let browser move cursor naturally
      return;
    }
    
    // Navigate up with Up arrow (always unfocus)
    if (e.key === 'ArrowUp') {
      const cursorPageX = getCursorPageX(textEl.current);
      console.log(`🔔 SegmentText [${segmentId}] triggering unfocus UP`);
      renderUtils.triggerUnfocus(parentNodeId, segmentId, 'up', { cursorPageX });
      return;
    }
    
    // Navigate down with Down arrow (always unfocus)
    if (e.key === 'ArrowDown') {
      const cursorPageX = getCursorPageX(textEl.current);
      console.log(`🔔 SegmentText [${segmentId}] triggering unfocus DOWN`);
      renderUtils.triggerUnfocus(parentNodeId, segmentId, 'down', { cursorPageX });
      return;
    }
    
    // Blur on Escape
    if (e.key === 'Escape') {
      textEl.current?.blur();
    }
  }, [segmentId, parentNodeId, renderUtils]);

  // Handle mouse down/click to report theoretical focus
  const handleMouseDown = (e) => {
    if (!finalIsEditable) return;
    
    // Log cursor position after click
    requestAnimationFrame(() => {
      const pos = getCursorPosition(textEl.current);
      const text = textEl.current?.textContent || '';
      const len = text.length;
      const textToRight = pos < len ? text.substring(pos) : '(end)';
      console.log(`🖱️ SegmentText [${segmentId}] mouseDown, cursor at ${pos}/${len}, text to right: "${textToRight}"`);
    });
    
    // Mark as theoretically focused
    isLogicallyFocused.current = true;
    
    // Keep hint text visible when focused (acts as placeholder)
    // It will be cleared when user starts typing
    
    // Report to parent
    renderUtils.setCurrentSegmentId(segmentId);
    
    // Apply focus styles immediately
    if (textEl.current) {
      textEl.current.style.backgroundColor = '#f0f8ff';
      textEl.current.style.border = '1px solid #4CAF50';
    }
  };

  
  if (!finalIsEditable) {
    // Non-editable mode: just render as span
    return (
      <span 
        ref={textEl} 
        className={`${className} yamd-text-segment`}
        data-segment-id={segmentId}
        style={{
          whiteSpace: 'pre-wrap' /* make the space displayed as a space */
        }}
      >
        {text}
      </span>
    );
  }
  
  // Set initial content on mount only
  useEffect(() => {
    if (textEl.current) {
      if (text === '') {
        // Show hint text for empty segments
        console.log(`🔧 SegmentText [${segmentId}] mounting with empty text, showing hint`);
        textEl.current.textContent = hintText;
        textEl.current.style.color = '#ccc';
        textEl.current.style.fontStyle = 'italic';
        isEmpty.current = true;
      } else {
        console.log(`🔧 SegmentText [${segmentId}] mounting with text: "${text}"`);
        textEl.current.textContent = text;
        isEmpty.current = false;
      }
    }
  }, []);
  
  // Editable mode: theoretical focus (allows cross-segment selection)
  // No nested contentEditable - part of parent YamdDoc's contentEditable context
  return (
    <span
      ref={textEl}
      data-segment-id={segmentId}
      onMouseDown={handleMouseDown}
      suppressContentEditableWarning={true}
      className={`${className} yamd-text-segment`}
      style={{
        display: 'inline-block',
        minWidth: '2ch',
        minHeight: '1em',
        whiteSpace: 'pre-wrap',
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
