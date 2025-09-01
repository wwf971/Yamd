import React, { useState, useRef, useEffect } from 'react';
import './Text.css';

const Text = ({ children, isDebug = false }) => {
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

  const handleInput = (e) => {
    // contentEditable handles text updates automatically
    // No need to setState which would cause re-render and cursor jump
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
      contentEditable={isEditing} // essential for text selection across multiple components
      suppressContentEditableWarning={true}
      onClick={handleClick}
      onBlur={handleBlur}
      onInput={handleInput}
      onKeyUp={handleKeyUp}
      onMouseUp={handleMouseUp}
      onFocus={() => {
        setTimeout(() => {
          handleSelectionChange(true);
        }, 10);
      }}
      style={getStyle()}
    >
      {text}
    </span>
  );
};

export default Text;