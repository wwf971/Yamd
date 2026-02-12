import React, { useRef, useEffect, useState } from 'react';
import { useAtomValue, atom } from 'jotai';
import { docsData } from '@/core/DocStore.js';
import { RefreshIcon } from '@wwf971/react-comp-misc';

/**
 * NodeDataDisplay - Component to display a single node's data with real-time Jotai updates
 * Used in test/dev components to show flattened node data with automatic reactivity
 */
export const NodeDataDisplay = ({ docId, nodeId, onUpdate, refreshTrigger }) => {
  const elementRef = useRef(null);
  const prevDataRef = useRef(null);
  const [isHighlighted, setIsHighlighted] = useState(false);
  
  // Get node atom - returns null atom if doc/node doesn't exist
  let nodeAtom;
  try {
    nodeAtom = docId && nodeId ? docsData.getNodeData(docId, nodeId) : null;
  } catch (error) {
    nodeAtom = null;
  }
  
  // Always call useAtomValue (Rules of Hooks - must be unconditional)
  // Use a fallback null atom if nodeAtom is invalid
  const nodeData = useAtomValue(nodeAtom || atom(null));
  
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
  
  // Handle manual refresh - always highlight when refresh is triggered
  useEffect(() => {
    if (refreshTrigger > 0) {
      setIsHighlighted(true);
      setTimeout(() => setIsHighlighted(false), 800);
    }
  }, [refreshTrigger]);
  
  // Skip rendering if nodeData doesn't exist (cleaned up or not loaded yet)
  // IMPORTANT: This check must come AFTER all hooks to avoid Rules of Hooks violation
  if (!nodeData || !docId || !nodeId) {
    return null;
  }
  
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
        {nodeId} {isHighlighted && (
          <RefreshIcon
            width={12}
            height={12}
            style={{ marginLeft: '4px', verticalAlign: 'middle' }}
          />
        )}
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
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Check if doc exists by trying to get its atom (without creating warnings)
  // If nodeIds is empty or undefined, the doc probably doesn't exist yet
  const hasValidData = docId && nodeIds && nodeIds.length > 0;
  
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
      style={{ 
        height: '100%',
        backgroundColor: '#fff',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}
    >
      {hasValidData ? (
        <>
          <div style={{
            padding: '8px 8px',
            borderBottom: '2px solid #ddd',
            fontSize: '12px',
            color: '#666',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>{nodeIds.length} nodes • Real-time updates enabled</span>
            <button
              onClick={() => setRefreshTrigger(prev => prev + 1)}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#45a049'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#4CAF50'}
            >
              <RefreshIcon width={12} height={12} />
              Refresh
            </button>
          </div>
          <div
            ref={containerRef}
            style={{ 
              flex: 1,
              overflowY: 'auto',
              padding: '6px 8px'
            }}
          >
            {nodeIds.map(nodeId => (
              <NodeDataDisplay 
                key={`${docId}-${nodeId}`}
                docId={docId} 
                nodeId={nodeId}
                onUpdate={handleNodeUpdate}
                refreshTrigger={refreshTrigger}
              />
            ))}
          </div>
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

