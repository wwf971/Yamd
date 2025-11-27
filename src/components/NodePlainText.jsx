import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useRenderUtilsContext } from '@/core/RenderUtils.ts';
import { docsState } from '@/core/DocStore.js';
import {
  isCursorAtEnd, isCursorAtBeginning,
  getCursorPosition, getCursorPageX, getClosestCursorPos,
  setCursorPosition, setCursorToEnd, setCursorToBeginning
} from './TextUtils.js';
import { getMoveUpTargetId, getMoveDownTargetId } from '@/core/EditUtils.js';

/**
 * Plain text renderer with bullet positioning support
 * Supports inline editing when isEditable is true
 * Updates node text via Zustand store
 */
const NodeTextPlain = forwardRef(({ nodeId, className, parentInfo, globalInfo, isEditable = null}, ref) => {
  // Get render utils from context
  const renderUtils = useRenderUtilsContext();

  const contextIsEditable = renderUtils.isEditable;
    // If isEditable prop is not null, it overwrites the value from context
  const finalIsEditable = isEditable !== null ? isEditable : contextIsEditable;
  
  // Get node data from store via convenience method
  const nodeData = renderUtils.useNodeData(nodeId);
  
  // Subscribe to node state for focus management
  const nodeState = renderUtils.useNodeState(nodeId);
  
  // Get text from nodeData (use ?? instead of || to handle empty strings correctly)
  const text = nodeData?.textRaw ?? nodeData?.textOriginal ?? '';
  
  // Ref for the contentEditable div (this is the text element)
  const textElRef = useRef(null);
  
  // Track if user is currently editing
  const isEditingRef = useRef(false);
  
  // Track last cursor horizontal position for smart up/down navigation
  const lastCursorPageXRef = useRef(null);
  
  // Expose calcBulletYPos method to parent via ref
  useImperativeHandle(ref, () => ({
    calcBulletYPos: (containerClassName) => {
      console.log(`📍 NodePlainText ${nodeId} calcBulletYPos called for container: ${containerClassName}`);
      
      // Calculate bullet position for plain text
      try {
        if (!textElRef.current) {
          console.log(`❌ NodePlainText ${nodeId} textElRef not ready`);
          return { code: -1, message: 'Text element not found', data: null };
        }
        
        const textEl = textElRef.current;
        const bulletContainer = textEl.closest(containerClassName);
        
        if (!bulletContainer) {
          console.log(`❌ NodePlainText ${nodeId} bullet container not found: ${containerClassName}`);
          return { code: -1, message: `Plain text: bullet container ${containerClassName} not found`, data: null };
        }
        
        const containerRect = bulletContainer.getBoundingClientRect();
        
        // Use Range API to measure actual text content position, not the span element
        const textNode = textEl.firstChild;
        if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
          // Fallback to span measurement if no text node
          const textRect = textEl.getBoundingClientRect();
          const relativeY = textRect.top - containerRect.top + (textRect.height * 0.55);
          console.log(`⚠️ NodePlainText ${nodeId} using fallback (no text node): ${relativeY.toFixed(2)}px`);
          return { code: 0, message: 'Success (fallback)', data: relativeY };
        }
        
        // Create a range for the first character to measure actual text position
        const range = document.createRange();
        range.setStart(textNode, 0);
        range.setEnd(textNode, Math.min(1, textNode.textContent?.length || 0));
        
        const textRect = range.getBoundingClientRect();
        
        // Calculate relative Y position (center of first line of actual text)
        // The 0.55 factor positions bullet slightly above center for better visual alignment
        const relativeY = textRect.top - containerRect.top + (textRect.height * 0.55);
        
        console.log(`✅ NodePlainText ${nodeId} bullet position: ${relativeY.toFixed(2)}px (textHeight: ${textRect.height.toFixed(2)}px, offset: ${(textRect.top - containerRect.top).toFixed(2)}px)`);
        
        return { code: 0, message: 'Success (plain text)', data: relativeY };
      } catch (error) {
        console.log(`❌ NodePlainText ${nodeId} positioning error:`, error);
        return { code: -1, message: `Plain text positioning error: ${error.message}`, data: null };
      }
    }
  }), [nodeId]);
  
  // Update DOM content when text prop changes externally (but not while user is editing)
  useEffect(() => {
    if (textElRef.current && !isEditingRef.current) {
      textElRef.current.textContent = text;
    }
  }, [text]);

  // Handle focus requests from state changes
  useEffect(() => {
    if (!nodeState?.focus || !textElRef.current) return;
    
    const { counter, type, cursorPosition, cursorPageX } = nodeState.focus;
    
    // Skip if counter is 0 (initial state)
    if (counter === 0) return;
    
    // Focus the element
    textElRef.current.focus();
    
    // Set cursor position based on focus type
    if (type === 'arrowUp' && cursorPageX !== undefined) {
      // Moving up: search backward (end to start) to find last match
      const closestPos = getClosestCursorPos(textElRef.current, cursorPageX, 'backward');
      setCursorPosition(textElRef.current, closestPos);
    } else if (type === 'arrowDown' && cursorPageX !== undefined) {
      // Moving down: search forward (start to end) to find first match
      const closestPos = getClosestCursorPos(textElRef.current, cursorPageX, 'forward');
      setCursorPosition(textElRef.current, closestPos);
    } else if (type === 'arrowUpFromFirstChild' && cursorPageX !== undefined) {
      // Coming from first child: position at end with smart horizontal positioning
      const closestPos = getClosestCursorPos(textElRef.current, cursorPageX, 'backward');
      setCursorPosition(textElRef.current, closestPos);
    } else if (type === 'arrowDownFromLastChild' && cursorPageX !== undefined) {
      // Coming from last child: position at beginning with smart horizontal positioning
      const closestPos = getClosestCursorPos(textElRef.current, cursorPageX, 'forward');
      setCursorPosition(textElRef.current, closestPos);
    } else if (type === 'prevSiblingDeleted') {
      setCursorToEnd(textElRef.current);
    } else if (type === 'selfCreated') {
      setCursorToBeginning(textElRef.current);
    } else if (type === 'mergedFromNext' && cursorPosition !== undefined) {
      setCursorPosition(textElRef.current, cursorPosition);
    } else if (type === 'indented' || type === 'outdented') {
      // Maintain current cursor position after indent/outdent
      textElRef.current.focus();
    }
    
  }, [nodeState?.focus?.counter, nodeState?.focus?.type, nodeState?.focus?.cursorPosition, nodeState?.focus?.cursorPageX, nodeId]);

  // Handle key events
  const handleKeyDown = (e) => {
    // Handle Tab - indent node under previous sibling
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const result = renderUtils.indentNode(nodeId);
      if (result.code !== 0) {
        console.log('⚠️ Indent failed:', result.message);
      }
      return;
    }
    
    // Handle Shift+Tab - outdent node to parent's level
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      const result = renderUtils.outdentNode(nodeId);
      if (result.code !== 0) {
        console.log('⚠️ Outdent failed:', result.message);
      }
      return;
    }
    
    // Handle Backspace
    if (e.key === 'Backspace') {
      // Case 1: Empty text - delete node
      if (text === '') {
        e.preventDefault();
        handleDeleteSelf();
        return;
      }
      
      // Case 2: Cursor at beginning - merge with previous sibling
      if (isCursorAtBeginning(textElRef.current)) {
        e.preventDefault();
        renderUtils.mergeWithPrevSibling(nodeId);
        return;
      }
    }
    
    // Create new node when Enter is pressed
    if (e.key === 'Enter') {
      e.preventDefault();
      
      if (isCursorAtEnd(textElRef.current)) {
        // At end - create empty node
        renderUtils.createNodeAfter(nodeId, {
          type: 'text',
          textRaw: '',
          textOriginal: '',
        });
      } else {
        // In middle - split text
        const cursorPos = getCursorPosition(textElRef.current);
        const currentText = textElRef.current.textContent || '';
        const leftText = currentText.substring(0, cursorPos);
        
        // Update DOM immediately (since we're uncontrolled)
        textElRef.current.textContent = leftText;
        
        // Update store
        renderUtils.splitToNextSibling(nodeId, cursorPos);
      }
      return;
    }
    
    // Navigate up with Up arrow
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      
      // Store current cursor horizontal position
      const cursorPageX = getCursorPageX(textElRef.current);
      lastCursorPageXRef.current = cursorPageX;
      
      const targetId = getMoveUpTargetId(nodeId, renderUtils.getNodeDataById);
      if (targetId) {
        // Determine focus type based on whether target is parent
        const currentNode = renderUtils.getNodeDataById(nodeId);
        const isMovingToParent = targetId === currentNode?.parentId;
        const focusType = isMovingToParent ? 'arrowUpFromFirstChild' : 'arrowUp';
        
        docsState.triggerFocus(globalInfo.docId, targetId, focusType, { cursorPageX });
      }
      return;
    }
    
    // Navigate down with Down arrow
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      
      // Store current cursor horizontal position
      const cursorPageX = getCursorPageX(textElRef.current);
      lastCursorPageXRef.current = cursorPageX;
      
      const targetId = getMoveDownTargetId(nodeId, renderUtils.getNodeDataById);
      if (targetId) {
        docsState.triggerFocus(globalInfo.docId, targetId, 'arrowDown', { cursorPageX });
      }
      return;
    }
    
    // Blur on Escape
    if (e.key === 'Escape') {
      e.preventDefault();
      textElRef.current?.blur();
    }
  };

  // Handle input changes in contentEditable div
  const handleInput = (e) => {
    const newText = e.target.textContent || '';
    
    // Update Jotai store immediately on every keystroke
    if (nodeId) {
      renderUtils.updateNodeData(nodeId, (node) => {
        node.textRaw = newText;
        node.textOriginal = newText;
        
        // Update textRich if it exists
        if (node.textRich && Array.isArray(node.textRich)) {
          node.textRich = [{
            type: 'text',
            textRaw: newText
          }];
        }
      });
    }
  };

  // Handle delete key when text is empty
  const handleDeleteSelf = () => {
    if (nodeId) {
      renderUtils.deleteNode(nodeId);
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
      <span ref={textElRef} className={className}>
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
  
  // Check if text is empty for visual debugging
  const isEmpty = text === '';
  
  console.log(`📝 NodePlainText [${nodeId}] rendering: isEmpty=${isEmpty}, text="${text}"`);
  
  // Auto-focus when text becomes empty (after deleting last character)
  useEffect(() => {
    if (isEmpty && textElRef.current && isEditingRef.current) {
      textElRef.current.focus();
    }
  }, [isEmpty, nodeId]);
  
  // Single contentEditable span for both empty and non-empty states
  return (
    <span
      ref={textElRef}
      contentEditable={true}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      suppressContentEditableWarning={true}
      className={className}
      style={{
        display: 'inline-block',
        minWidth: isEmpty ? '100%' : '1ch', // Full width when empty, min 1 char when not
        minHeight: '1.2em', // Always visible
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
      onFocus={handleFocus}
      onBlur={handleBlur}
      title={isEmpty ? "Empty text (press Backspace to delete)" : "Click to edit"}
      spellCheck={false}
    />
  );
});

export default NodeTextPlain;
