import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useRenderUtilsContext } from '@/core/RenderUtils.ts';
import { docsState } from '@/core/DocStore.js';
import {
  isCursorAtEnd, isCursorAtBeginning,
  getCursorPosition, setCursorPosition,
  setCursorToEnd, setCursorToBeginning
} from './TextUtils.js';

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
  
  // Expose calcBulletYPos method to parent via ref
  useImperativeHandle(ref, () => ({
    calcBulletYPos: (containerClassName) => {
      // Calculate bullet position for plain text
      try {
        if (!textElRef.current) {
          return { code: -1, message: 'Text element not found', data: null };
        }
        
        const textEl = textElRef.current;
        const bulletContainer = textEl.closest(containerClassName);
        
        if (!bulletContainer) {
          return { code: -1, message: `Plain text: bullet container ${containerClassName} not found`, data: null };
        }
        
        const textRect = textEl.getBoundingClientRect();
        const containerRect = bulletContainer.getBoundingClientRect();
        
        // Calculate relative Y position (center of first line)
        const relativeY = textRect.top - containerRect.top + (textRect.height * 0.55);
        
        return { code: 0, message: 'Success (plain text)', data: relativeY };
      } catch (error) {
        return { code: -1, message: `Plain text positioning error: ${error.message}`, data: null };
      }
    }
  }), []);
  
  // Update DOM content when text prop changes externally (but not while user is editing)
  useEffect(() => {
    if (textElRef.current && !isEditingRef.current) {
      textElRef.current.textContent = text;
    }
  }, [text]);

  // Handle focus requests from state changes
  useEffect(() => {
    if (!nodeState?.focus || !textElRef.current) return;
    
    const { counter, type, cursorPosition } = nodeState.focus;
    
    // Skip if counter is 0 (initial state)
    if (counter === 0) return;
    
    // Focus the element
    textElRef.current.focus();
    
    // Set cursor position based on focus type
    if (type === 'prevSiblingDeleted' || type === 'arrowNavigation') {
      setCursorToEnd(textElRef.current);
    } else if (type === 'selfCreated') {
      setCursorToBeginning(textElRef.current);
    } else if (type === 'mergedFromNext' && cursorPosition !== undefined) {
      setCursorPosition(textElRef.current, cursorPosition);
    }
    
  }, [nodeState?.focus?.counter, nodeState?.focus?.type, nodeState?.focus?.cursorPosition, nodeId]);

  // Handle key events
  const handleKeyDown = (e) => {
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
    
    // Navigate to previous sibling with Up arrow
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const currentNode = renderUtils.getNodeDataById(nodeId);
      const parentId = currentNode?.parentId;
      
      if (parentId) {
        const parentNode = renderUtils.getNodeDataById(parentId);
        const siblings = parentNode?.children || [];
        const currentIndex = siblings.indexOf(nodeId);
        
        if (currentIndex > 0) {
          const prevSiblingId = siblings[currentIndex - 1];
          docsState.triggerFocus(globalInfo.docId, prevSiblingId, 'arrowNavigation');
        }
      }
      return;
    }
    
    // Navigate to next sibling with Down arrow
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const currentNode = renderUtils.getNodeDataById(nodeId);
      const parentId = currentNode?.parentId;
      
      if (parentId) {
        const parentNode = renderUtils.getNodeDataById(parentId);
        const siblings = parentNode?.children || [];
        const currentIndex = siblings.indexOf(nodeId);
        
        if (currentIndex < siblings.length - 1) {
          const nextSiblingId = siblings[currentIndex + 1];
          docsState.triggerFocus(globalInfo.docId, nextSiblingId, 'arrowNavigation');
        }
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
        padding: '2px 4px',
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
