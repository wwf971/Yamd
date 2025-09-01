import React, { useState, useRef, useEffect } from 'react';
import './Text.css';

const Text = ({ children, isDebug = false, onContentChange, markdownHandlers }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(children || '');
  const [cursorPos, setcursorPos] = useState('middle');
  const spanRef = useRef(null);

  const handleClick = () => {
    setIsEditing(true);
    setTimeout(() => {
      spanRef.current?.focus();
      setTimeout(() => {
        handleSelectionChange(true);
      }, 10);
    }, 0);
  };

  const handleBlur = () => {
    setIsEditing(false);
    setcursorPos('middle');
  };

  const handleSelectionChange = (forceCheck = false) => {
    if (!spanRef.current) {
      return;
    }

    const selection = window.getSelection();
    if (selection.rangeCount === 0) {
      // No selection, reset to middle
      if (isEditing) {
        setIsEditing(false);
        setcursorPos('middle');
      }
      return;
    }

    const range = selection.getRangeAt(0);
    
    // Check if selection is within our element
    const isWithinElement = spanRef.current.contains(range.commonAncestorContainer) || 
                            range.commonAncestorContainer === spanRef.current;
    
    if (!isWithinElement) {
      // Cursor moved out of this component, reset editing state
      if (isEditing) {
        setIsEditing(false);
        setcursorPos('middle');
      }
      return;
    }

    // Cursor is within this element
    if (!isEditing && !forceCheck) {return;}

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

  const onCursorEnter = () => {
    setIsEditing(true);
    setTimeout(() => {
      handleSelectionChange(true);
    }, 10);
  };

  const onCursorLeave = () => {
    setIsEditing(false);
    setcursorPos('middle');
  };

  const onMouseClick = () => {
    setIsEditing(true);
    setTimeout(() => {
      handleSelectionChange(true);
    }, 10);
  };

  const handleKeyUp = handleSelectionChange;
  const handleMouseUp = handleSelectionChange;

  // Sync text when children prop changes (but don't trigger callbacks)
  useEffect(() => {
    setText(children || '');
  }, [children]);

  // Attach functions directly to DOM element for Root.jsx to call
  useEffect(() => {
    const element = spanRef.current;
    if (!element) return;

    // Store functions on the DOM element so Root.jsx can call them directly
    element._textHandlers = {
      onCursorEnter,
      onCursorLeave,
      onMouseClick
    };

    // Store markdown handlers if provided
    if (markdownHandlers) {
      element._markdownHandlers = markdownHandlers();
    }

    return () => {
      // Cleanup
      delete element._textHandlers;
      delete element._markdownHandlers;
    };
  }, [onCursorEnter, onCursorLeave, onMouseClick, markdownHandlers]);

  // Test: Listen for native focus/blur events to see if they work for cursor detection
  useEffect(() => {
    const element = spanRef.current;
    if (!element) return;

    const handleFocus = (e) => {
      console.log('Text component focused:', e);
      // Could potentially use this for cursor enter detection
    };

    const handleBlur = (e) => {
      console.log('Text component blurred:', e);
      // Could potentially use this for cursor leave detection
    };

    element.addEventListener('focus', handleFocus);
    element.addEventListener('blur', handleBlur);

    return () => {
      element.removeEventListener('focus', handleFocus);
      element.removeEventListener('blur', handleBlur);
    };
  }, []);

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
      className="text-base markdown-leaf"
      tabIndex={0} // Make focusable to test focus/blur events
      // contentEditable={false} - commented out to allow parent contentEditable to work
      // onClick handled by Root.jsx event delegation
      onMouseUp={handleMouseUp}
      onInput={(e) => {
        const newContent = e.target.textContent || '';
        if (newContent !== text) {
          setText(newContent);
          if (onContentChange) {
            onContentChange(newContent);
          }
        }
      }}
      style={getStyle()}
    >
      {text}
    </span>
  );
};

// Memoize Text component to prevent unnecessary re-renders
export default React.memo(Text);