import React, { useRef, useEffect, useCallback } from 'react';
import { useNote } from '@/Note.js';
import MarkdownItem from './ListItem.jsx';

const Root = ({ noteId, className = '', style = {}, children }) => {
  const rootRef = useRef(null);
  const { note, items } = useNote(noteId);

  // Find Text component by class name
  const findLeafComponent = useCallback((node) => {
    // Traverse up the DOM tree to find a Text component
    let current = node;
    while (current && current !== rootRef.current) {
      if (current.classList && current.classList.contains('markdown-leaf')) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  }, []);

  // Get all Text components in the root
  const getAllTextComponents = useCallback(() => {
    if (!rootRef.current) return [];
    return Array.from(rootRef.current.querySelectorAll('.markdown-leaf'));
  }, []);

  // Call Text component functions directly
  const callLeafFunction = useCallback((element, functionName) => {
    if (!element || !element._textHandlers) return;
    
    const handler = element._textHandlers[functionName];
    if (typeof handler === 'function') {
      handler();
    }
  }, []);

  // Handle click events
  const handleClick = useCallback((e) => {
    const textComponent = findLeafComponent(e.target);
    if (textComponent) {
      callLeafFunction(textComponent, 'onMouseClick');
    }
  }, [findLeafComponent, callLeafFunction]);

  // Handle selection changes (cursor movement)
  const handleSelectionChange = useCallback(() => {
    if (!rootRef.current) return;

    const selection = window.getSelection();
    if (selection.rangeCount === 0) {
      // No selection, call onCursorLeave on all components
      getAllTextComponents().forEach(element => {
        callLeafFunction(element, 'onCursorLeave');
      });
      return;
    }

    const range = selection.getRangeAt(0);
    
    // Check if selection is within our root element
    if (!rootRef.current.contains(range.commonAncestorContainer) && 
        range.commonAncestorContainer !== rootRef.current) {
      return;
    }

    // Find which Text component the cursor is currently in
    const currentTextComponent = findLeafComponent(range.commonAncestorContainer);
    
    // Call functions directly on all Text components about cursor enter/leave
    getAllTextComponents().forEach(element => {
      if (element === currentTextComponent) {
        callLeafFunction(element, 'onCursorEnter');
      } else {
        callLeafFunction(element, 'onCursorLeave');
      }
    });
  }, [findLeafComponent, getAllTextComponents, callLeafFunction]);

  // event delegation for keyboard events
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      // Delay selection change handling to let cursor move first
      setTimeout(() => {
        handleSelectionChange();
      }, 0);
    } else if (noteId && note) {
      // Handle markdown-specific keyboard shortcuts
      const selection = window.getSelection();
      if (selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      const leafComponentCurrent = findLeafComponent(range.commonAncestorContainer);
      
      if (leafComponentCurrent && leafComponentCurrent._markdownHandlers) {
        const handlers = leafComponentCurrent._markdownHandlers;
        
        if (e.key === 'Tab') {
          e.preventDefault();
          if (e.shiftKey) {
            handlers.decreaseIndent?.();
          } else {
            handlers.increaseIndent?.();
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handlers.createNewItem?.();
        } else if (e.key === 'Backspace') {
          // Check if we're at the start of an empty item
          if (range.startOffset === 0 && range.endOffset === 0) {
            const textContent = leafComponentCurrent.textContent || '';
            if (textContent.trim() === '') {
              e.preventDefault();
              handlers.deleteItem?.();
            }
          }
        }
      }
    }
  }, [handleSelectionChange, noteId, note, findLeafComponent]);

  useEffect(() => {
    const rootElement = rootRef.current;
    if (!rootElement) return;

    // Add event listeners
    document.addEventListener('selectionchange', handleSelectionChange);
    rootElement.addEventListener('click', handleClick);
    rootElement.addEventListener('keydown', handleKeyDown);

    return () => {
      // Cleanup event listeners
      document.removeEventListener('selectionchange', handleSelectionChange);
      rootElement.removeEventListener('click', handleClick);
      rootElement.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleSelectionChange, handleClick, handleKeyDown]);

  // Render markdown content if noteId is provided, otherwise render children
  const renderContent = () => {
    if (noteId && note) {
      return (
        <div 
          contentEditable={true}
          suppressContentEditableWarning={true}
          style={{ outline: 'none' }}
        >
          {items.map((item) => (
            <MarkdownItem
              key={item.id}
              noteId={noteId}
              itemId={item.id}
              item={item}
            />
          ))}
        </div>
      );
    }
    
    // Fallback to children for backward compatibility
    return children;
  };

  return (
    <div 
      ref={rootRef}
      className={className}
      style={style}
      data-markdown-root="true"
    >
      {renderContent()}
    </div>
  );
};

export default Root;
