import React, { useRef, useEffect, useCallback } from 'react';
import { useNoteStore } from '@/Note.js';
import Text from './Text.jsx';

const ListItem = ({ noteId, itemId, item }) => {
  const containerRef = useRef(null);
  
  // Zustand actions
  const updateItemContent = useNoteStore((state) => state.updateItemContent);
  const updateItemIndent = useNoteStore((state) => state.updateItemIndent);
  const addItem = useNoteStore((state) => state.addItem);
  const deleteItem = useNoteStore((state) => state.deleteItem);

  if (!item) return null;

  // Memoized content change handler to prevent infinite re-renders
  const handleContentChange = useCallback((newContent) => {
    if (newContent !== item.content) {
      updateItemContent(noteId, itemId, newContent);
    }
  }, [noteId, itemId, item.content, updateItemContent]);

  // Markdown action handlers for Root.jsx event delegation
  const markdownHandlers = useCallback(() => ({
    createNewItem: () => {
      const newItemId = addItem(noteId, '', item.indent, itemId);
      console.log('Created new item:', newItemId);
    },
    increaseIndent: () => {
      updateItemIndent(noteId, itemId, item.indent + 1);
    },
    decreaseIndent: () => {
      updateItemIndent(noteId, itemId, item.indent - 1);
    },
    deleteItem: () => {
      deleteItem(noteId, itemId);
    }
  }), [noteId, itemId, item.indent, addItem, updateItemIndent, deleteItem]);

  return (
    <div 
      ref={containerRef}
      style={{
        display: 'flex', 
        alignItems: 'center', // Changed from 'flex-start' to 'center'
        minHeight: '1.2em',
        marginBottom: '0px',
        paddingLeft: `${item.indent * 12}px` // Indent the entire item
      }}
    >
      {/* Bullet point */}
      <span 
        style={{
          marginRight: '1px',
          fontSize: '14px',
          color: '#666',
          userSelect: 'none',
          lineHeight: 1, // Ensures bullet has consistent height
          pointerEvents: 'none', // Prevents any mouse interaction
        }}
        contentEditable={false}
        suppressContentEditableWarning={true}
      >•</span>
      
      {/* Content using Text.jsx component */}
      <Text 
        isDebug={true}
        onContentChange={handleContentChange}
        markdownHandlers={markdownHandlers}
      >
        {item.content}
      </Text>
    </div>
  );
};

// Memoize ListItem to prevent unnecessary re-renders when other items change
export default React.memo(ListItem, (prevProps, nextProps) => {
  // Custom comparison: only re-render if the item data actually changed
  return (
    prevProps.noteId === nextProps.noteId &&
    prevProps.itemId === nextProps.itemId &&
    prevProps.item === nextProps.item
  );
});