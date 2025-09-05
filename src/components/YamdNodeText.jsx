import React, { useRef, useEffect, useState, useCallback } from 'react';
import { getNodeClass } from '../YamdNode.jsx';
import YamdChildrenNodes from '../YamdChildrenNodes.jsx';
import { getChildrenDisplay } from '../YamdRenderUtils.js';
import { AddListBulletBeforeYamdText } from './AddBullet.jsx';
import YamdRichText from './YamdRichText.jsx';
import YamdPlainText from './YamdPlainText.jsx';
import { useYamdDocStore } from '../YamdDocStore.js';

/**
 * Text node renderer - displays plain text content and children in vertical layout
 */
const YamdNodeText = React.memo(({ nodeId, parentInfo, globalInfo }) => {
  const nodeRef = useRef(null);

  // Register the node reference after the component finishes rendering
  useEffect(() => {
    if (nodeRef.current) {
      globalInfo?.registerNodeRef?.(nodeId, nodeRef.current);
    }
  }, [nodeId, globalInfo]);

  // Ref to access YamdRichText methods
  const richTextRef = useRef(null);
  
  // ===== ZUSTAND LOGIC =====
  // get docId from globalInfo or use default
  const docId = globalInfo?.docId
  
  // function to calculate and provide preferred Y position
  const providePreferredYPosition = useCallback(() => {
    if (!nodeRef.current || !richTextRef.current?.getPreferredYPosition) return;
    
    const store = useYamdDocStore.getState();
    // Get all requests for this node
    const requests = store.getPreferredYPosRequests(docId, nodeId);
    
    // Update result for each requesting container
    Object.keys(requests).forEach(containerClassName => {
      // Get preferred Y position from YamdRichText
      const result = richTextRef.current.getPreferredYPosition(containerClassName);
      
      // Update result in the Zustand store
      store.updateRequestResult(docId, nodeId, containerClassName, result);
      // Increment response counter in store
      store.incResponseCounter(docId, nodeId, containerClassName);
    });
  }, [nodeId, docId]);
  
  // Subscribe to request counter changes with custom equality function
  useEffect(() => {
    if (!nodeId) return;
    
    const unsubscribe = useYamdDocStore.subscribe(
      (state) => state.listBulletPreferredYPosRequests[docId]?.[nodeId] || {},
      (requests) => {
        // This will only fire if equalityFn returns false
        providePreferredYPosition();
      },
      {
        equalityFn: (prev, next) => {
          // Only skip if all counters are the same or decreased
          const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
          return Array.from(keys).every((key) => (next[key]?.requestCounter || 0) <= (prev[key]?.requestCounter || 0));
        },
      }
    );
    
    return unsubscribe;
  }, [nodeId, docId, providePreferredYPosition]);
  // ===== END ZUSTAND LOGIC =====

  if (!globalInfo?.getNodeDataById) {
    return <div className="yamd-error">Missing globalInfo.getNodeDataById</div>;
  }
  
  const nodeData = globalInfo.getNodeDataById(nodeId);
  
  if (!nodeData) {
    return <div className="yamd-error">Node not found: {nodeId}</div>;
  }

  const selfPlainText = nodeData.textRaw || nodeData.textOriginal || '';
  const selfRichText = nodeData.textRich; // Rich text segments if LaTeX was processed
  const childDisplay = getChildrenDisplay(nodeData, false, parentInfo);
  const childClass = nodeData.attr?.childClass;
  const shouldRenderBullet = parentInfo?.childDisplay === 'ul' || parentInfo?.childDisplay === 'ol';
  
  // Use the utility function to get appropriate CSS class
  const nodeClass = getNodeClass(nodeData, parentInfo) || 'yamd-title-default';

  return (
    <div ref={nodeRef} className="yamd-node-text">
      {/* self content */}
      {selfPlainText && !selfRichText && (
        <AddListBulletBeforeYamdText
          childNode={
            <YamdPlainText 
              text={selfPlainText}
              className={nodeClass}
              parentInfo={parentInfo}
            />
          }
        />
      )}
      {selfRichText && (
        <AddListBulletBeforeYamdText
          childNode={
            <YamdRichText 
              ref={richTextRef}
              text={selfPlainText}
              textRich={selfRichText}
              className={nodeClass}
              parentInfo={parentInfo}
              globalInfo={globalInfo}
            />
          }
        />
      )}

      {/* children content */}
      {nodeData.children && nodeData.children.length > 0 && (
        <YamdChildrenNodes
          childIds={nodeData.children}
          shouldAddIndent={true}
          parentInfo={{ 
            ...parentInfo, 
            ...(childDisplay && { childDisplay }),
            ...(childClass && { childClass })
          }}
          globalInfo={globalInfo}
        />
      )}
    </div>
  );
});

export default YamdNodeText;
