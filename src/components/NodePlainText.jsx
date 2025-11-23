import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useRenderUtilsContext } from '@/core/RenderUtils.js';

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
  const nodeData = renderUtils.getNodeDataById(nodeId);
  
  // Get text from nodeData
  const text = nodeData?.textRaw || nodeData?.textOriginal || '';
  
  // State for the editable content
  const [content, setContent] = useState(text);
  
  // Ref for the contentEditable div (this is the text element)
  const editableRef = useRef(null);
  
  // Expose calcBulletYPos method to parent via ref
  useImperativeHandle(ref, () => {
    console.log('NodeTextPlain useImperativeHandle called for nodeId:', nodeId);
    return {
    calcBulletYPos: (containerClassName) => {
      // Calculate bullet position for plain text
      try {
        if (!editableRef.current) {
          return { code: -1, message: 'Text element not found', data: null };
        }
        
        const textEl = editableRef.current;
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
  };
  }, []);
  
  // Update content when text prop changes (e.g., when nodeData is updated externally)
  useEffect(() => {
    setContent(text);
  }, [text]);

  // Handle key events
  const handleKeyDown = (e) => {
    // Prevent Enter from creating new lines (optional - remove if you want multi-line)
    if (e.key === 'Enter') {
      e.preventDefault();
        // --> input event will not be triggered
      editableRef.current?.blur();
    }
    // Allow Escape to blur without saving
    else if (e.key === 'Escape') {
      e.preventDefault();
        // --> input event will not be triggered
      // Revert to original text
      setContent(text);
      if (editableRef.current) {
        editableRef.current.innerHTML = text;
      }
      editableRef.current?.blur();
    }
  };

  // Handle input changes in contentEditable div
  const handleInput = (e) => {
    const newText = e.target.innerHTML;
    setContent(newText);
    
    // Update node data via Zustand store (only on blur, not on every keystroke)
    // This will be called in handleBlur instead
  };
  
  // Handle blur to save changes
  const handleBlur = (e) => {
    const newText = e.target.innerHTML;
    
    // Update via Zustand store using convenience method
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
      
      console.log('✅ Node text updated via Zustand:', { nodeId, newText });
    }
    
    // Apply blur styles
    e.target.style.backgroundColor = 'transparent';
    e.target.style.border = '1px solid transparent';
  };

  
  if (!finalIsEditable) {
    // Non-editable mode: just render as span
    return (
      <span ref={editableRef} className={className}>
        {text}
      </span>
    );
  }
  
  // Editable mode: render as contentEditable span (inline element works better)
  return (
    <span
      ref={editableRef}
      contentEditable={true}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      dangerouslySetInnerHTML={{ __html: content }}
      suppressContentEditableWarning={true}
      className={className}
      style={{
        display: 'inline',
        minWidth: '50px',
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
      onFocus={(e) => {
        e.target.style.backgroundColor = '#f0f8ff';
        e.target.style.border = '1px solid #4CAF50';
      }}
      onBlur={handleBlur}
      title="Click to edit"
      spellCheck={false}
    />
  );
});

export default NodeTextPlain;
