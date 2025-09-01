import React, { useState, useRef, useEffect } from 'react';
import './Text.css';

const Text = ({ children, isDebug = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(children || '');
  const [cursorPos, setcursorPos] = useState('middle');
  const spanRef = useRef(null);
  
  // IME composition state
  const [isComposing, setIsComposing] = useState(false);
  const [compositionText, setCompositionText] = useState('');
  
  // Custom cursor state
  const [cursorOffset, setCursorOffset] = useState(0);
  const [showCursor, setShowCursor] = useState(false);

  const handleClick = (e) => {
    setIsEditing(true);
    setShowCursor(true);
    
    // Calculate cursor position from click
    if (spanRef.current) {
      const rect = spanRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const textContent = spanRef.current.textContent || '';
      
      // Simple approximation - could be improved with more sophisticated text measurement
      const charWidth = rect.width / Math.max(textContent.length, 1);
      const clickOffset = Math.round(clickX / charWidth);
      const newOffset = Math.max(0, Math.min(clickOffset, textContent.length));
      
      setCursorOffset(newOffset);
    }
    
    setTimeout(() => {
      spanRef.current?.focus();
      setTimeout(() => {
        handleSelectionChange(true);
      }, 10);
    }, 0);
  };

  const handleBlur = () => {
    setIsEditing(false);
    setShowCursor(false);
    setcursorPos('middle');
    setIsComposing(false);
    setCompositionText('');
  };

  // Insert text at current cursor position
  const insertTextAtCursor = (textToInsert) => {
    const beforeText = text.substring(0, cursorOffset);
    const afterText = text.substring(cursorOffset);
    const newText = beforeText + textToInsert + afterText;
    
    setText(newText);
    setCursorOffset(cursorOffset + textToInsert.length);
  };

  const handleKeyDown = (e) => {
    if (!isEditing || isComposing) return;

    // Handle special keys
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (cursorOffset > 0) {
        const beforeText = text.substring(0, cursorOffset - 1);
        const afterText = text.substring(cursorOffset);
        const newText = beforeText + afterText;
        setText(newText);
        setCursorOffset(cursorOffset - 1);
      }
      return;
    }

    if (e.key === 'Delete') {
      e.preventDefault();
      if (cursorOffset < text.length) {
        const beforeText = text.substring(0, cursorOffset);
        const afterText = text.substring(cursorOffset + 1);
        const newText = beforeText + afterText;
        setText(newText);
        // Cursor position stays the same
      }
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setCursorOffset(Math.max(0, cursorOffset - 1));
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setCursorOffset(Math.min(text.length, cursorOffset + 1));
      return;
    }

    if (e.key === 'Home') {
      e.preventDefault();
      setCursorOffset(0);
      return;
    }

    if (e.key === 'End') {
      e.preventDefault();
      setCursorOffset(text.length);
      return;
    }

    // Handle regular character input
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      insertTextAtCursor(e.key);
    }
  };

  // IME composition handlers
  const handleCompositionStart = (e) => {
    setIsComposing(true);
    setCompositionText('');
  };

  const handleCompositionUpdate = (e) => {
    setCompositionText(e.data || '');
  };

  const handleCompositionEnd = (e) => {
    setIsComposing(false);
    setCompositionText('');
    if (e.data) {
      insertTextAtCursor(e.data);
    }
  };

  // Calculate cursor position in pixels
  const getCursorPosition = () => {
    if (!spanRef.current || !showCursor) return { left: 0 };
    
    // Create a temporary span to measure text width
    const tempSpan = document.createElement('span');
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.position = 'absolute';
    tempSpan.style.whiteSpace = 'pre';
    tempSpan.style.font = window.getComputedStyle(spanRef.current).font;
    tempSpan.textContent = text.substring(0, cursorOffset);
    document.body.appendChild(tempSpan);
    
    const width = tempSpan.getBoundingClientRect().width;
    document.body.removeChild(tempSpan);
    
    return { left: width };
  };

  const handleSelectionChange = (forceCheck = false) => {
    if ((!isEditing && !forceCheck) || !spanRef.current) {
      return;
    }

    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    
    // Check if selection is within our element
    if (!spanRef.current.contains(range.commonAncestorContainer) && 
        range.commonAncestorContainer !== spanRef.current) {
      return;
    }

    // If there's a text selection (not just cursor), don't show blue borders
    if (range.startOffset !== range.endOffset) {
      setcursorPos('middle');
      return;
    }

    const cursorOffset = range.startOffset;
    const textLength = spanRef.current.textContent.length;

    if (cursorOffset === 0) {
      setcursorPos('left');
    } else if (cursorOffset === textLength) {
      setcursorPos('right');
    } else {
      setcursorPos('middle');
    }
  };

  const handleKeyUp = handleSelectionChange;
  const handleMouseUp = handleSelectionChange;

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [isEditing]);

  const getStyle = () => {
    if (isDebug && isEditing) {
      let borderLeft = '2px solid #d3d3d3';
      let borderRight = '2px solid #d3d3d3';

      if (cursorPos === 'left') {
        borderLeft = '2px solid #007acc';
      } else if (cursorPos === 'right') {
        borderRight = '2px solid #007acc';
      }

      return {
        borderLeft,
        borderRight,
      };
    }

    return {};
  };

  return (
    <span
      ref={spanRef}
      className="text-base"
      contentEditable={false} // Keep false to allow cross-component selection
      suppressContentEditableWarning={true}
      tabIndex={isEditing ? 0 : -1} // Make focusable when editing
      onClick={handleClick}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onMouseUp={handleMouseUp}
      onCompositionStart={handleCompositionStart}
      onCompositionUpdate={handleCompositionUpdate}
      onCompositionEnd={handleCompositionEnd}
      onFocus={() => {
        setTimeout(() => {
          handleSelectionChange(true);
        }, 10);
      }}
      style={getStyle()}
    >
      {text}{isComposing && compositionText && (
        <span style={{ backgroundColor: 'rgba(0, 122, 204, 0.2)' }}>
          {compositionText}
        </span>
      )}
      {showCursor && isEditing && (
        <span 
          className="text-cursor" 
          style={{ left: `${getCursorPosition().left}px` }}
        />
      )}
    </span>
  );
};

export default Text;