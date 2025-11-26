import React, { useRef, useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import { docsData } from '@/core/DocStore.js';

/**
 * NodeDataDisplay - Component to display a single node's data with real-time Jotai updates
 * Used in test/dev components to show flattened node data with automatic reactivity
 */
export const NodeDataDisplay = ({ docId, nodeId, onUpdate }) => {
  const nodeAtom = docsData.getNodeData(docId, nodeId);
  const nodeData = useAtomValue(nodeAtom);
  const elementRef = useRef(null);
  const prevDataRef = useRef(nodeData);
  const [isHighlighted, setIsHighlighted] = useState(false);
  
  // Detect when nodeData changes and notify parent
  useEffect(() => {
    if (prevDataRef.current !== nodeData) {
      prevDataRef.current = nodeData;
      
      // Highlight this node briefly
      setIsHighlighted(true);
      setTimeout(() => setIsHighlighted(false), 1000);
      
      // Notify parent with the element ref for scrolling
      if (onUpdate && elementRef.current) {
        onUpdate(nodeId, elementRef.current);
      }
    }
  }, [nodeData, nodeId, onUpdate]);
  
  return (
    <div 
      ref={elementRef}
      data-node-id={nodeId}
      style={{ 
        marginBottom: '12px', 
        padding: '8px', 
        border: '1px solid #ddd',
        borderColor: isHighlighted ? '#4CAF50' : '#ddd',
        borderRadius: '4px',
        backgroundColor: isHighlighted ? '#E8F5E9' : '#f9f9f9',
        transition: 'background-color 0.3s ease, border-color 0.3s ease'
      }}
    >
      <div style={{ 
        fontWeight: 'bold', 
        marginBottom: '4px',
        color: isHighlighted ? '#2E7D32' : '#333',
        fontSize: '12px',
        transition: 'color 0.3s ease'
      }}>
        {nodeId} {isHighlighted && '🔄'}
      </div>
      <pre style={{ 
        margin: 0, 
        fontSize: '11px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }}>
        {JSON.stringify(nodeData, null, 2)}
      </pre>
    </div>
  );
};

/**
 * DocDataDisplay - Smart container that displays all nodes and auto-scrolls to updated ones
 * Manages the list of node displays and handles scroll-to-updated behavior
 */
export const DocDataDisplay = ({ docId, nodeIds, isLoading }) => {
  const containerRef = useRef(null);
  const updateQueueRef = useRef([]);
  const scrollTimeoutRef = useRef(null);
  
  // Handle node update notifications
  const handleNodeUpdate = (nodeId, element) => {
    // Add to update queue
    updateQueueRef.current.push({ nodeId, element, timestamp: Date.now() });
    
    // Debounce scroll to avoid too many scroll actions
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      // Get the most recent update
      if (updateQueueRef.current.length > 0) {
        const latestUpdate = updateQueueRef.current[updateQueueRef.current.length - 1];
        
        // Scroll to the updated element
        if (latestUpdate.element && containerRef.current) {
          latestUpdate.element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }
        
        // Clear the queue
        updateQueueRef.current = [];
      }
    }, 200); // Wait 200ms after last update before scrolling
  };
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);
  
  return (
    <div 
      ref={containerRef}
      style={{ 
        height: '100%',
        overflowY: 'auto',
        padding: '12px',
        backgroundColor: '#fff',
        position: 'relative'
      }}
    >
      {docId && nodeIds && nodeIds.length > 0 ? (
        <>
          <div style={{
            position: 'sticky',
            top: 0,
            backgroundColor: '#fff',
            padding: '8px 0',
            marginBottom: '8px',
            borderBottom: '2px solid #ddd',
            zIndex: 10,
            fontSize: '12px',
            color: '#666'
          }}>
            {nodeIds.length} nodes • Real-time updates enabled
          </div>
          {nodeIds.map(nodeId => (
            <NodeDataDisplay 
              key={nodeId} 
              docId={docId} 
              nodeId={nodeId}
              onUpdate={handleNodeUpdate}
            />
          ))}
        </>
      ) : (
        <div style={{ 
          color: '#999', 
          textAlign: 'center', 
          padding: '20px' 
        }}>
          {isLoading ? 'Processing...' : 'Awaiting data'}
        </div>
      )}
    </div>
  );
};

