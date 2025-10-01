import React, { useRef, useEffect, useState } from 'react';
import { getNodeClass } from '../YamdNode.jsx';
import YamdChildrenNodes from '../YamdChildrenNodes.jsx';
import { getChildrenDisplay } from '../YamdRenderUtils.js';
import YamdRichText from './YamdRichText.jsx';
import YamdPlainText from './YamdPlainText.jsx';
import { useYamdDocStore } from '../YamdDocStore.js';
import { createBulletEqualityFn } from '../YamdRenderUtils.js';

/**
 * render a text node, and then render its children nodes.
 */
const YamdNodeText = React.memo(({ nodeId, parentInfo, globalInfo }) => {
  const nodeRef = useRef(null);

  // Register the node reference after the component finishes rendering
  useEffect(() => {
    if (nodeRef.current) {
      globalInfo?.registerNodeRef?.(nodeId, nodeRef.current);
    }
  }, [nodeId, globalInfo]);
  // ref to access YamdRichText methods
  const richTextRef = useRef(null);
  
  // ===== ZUSTAND LOGIC =====
  // get docId from globalInfo or use default
  const docId = globalInfo?.docId

  

  // console.log('noteId:', nodeId, 'YamdNodeText docId:', docId);
  // Subscribe to request counter changes with custom equality function
  useEffect(() => {
    if (!nodeId || !docId){
      console.warn('noteId:', nodeId, 'docId:', docId, 'YamdNodeText useEffect subscribe skipped');
      return;
    }
    console.log('noteId:', nodeId, 'docId:', docId, 'YamdNodeText useEffect subscribe');
    const unsubscribe = useYamdDocStore.subscribe(
      (state) => state.bulletPreferredYPosRequests[docId]?.[nodeId] || {},
      (requests) => {
        console.log('noteId:', nodeId, 'YamdNodeText useEffect subscribe triggered with requests:', requests);
        // This will only fire if equalityFn returns false
        calcPreferredBulletYPos(nodeId, docId, nodeRef, richTextRef);
      },
      {
        equalityFn: createBulletEqualityFn(nodeId, 'YamdNodeText'),
      }
    );
    
    // immediately check for existing requests
    calcPreferredBulletYPos(nodeId, docId, nodeRef, richTextRef);
    return unsubscribe;
  }, [nodeId, docId, richTextRef]);
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
  // console.log("selfRichText:", selfRichText);

  return (
    <div ref={nodeRef} className="yamd-node-text">
      {/* self content */}
      {selfPlainText && !selfRichText && (
        <YamdPlainText 
          text={selfPlainText}
          className={nodeClass}
          parentInfo={parentInfo}
        />
      )}
      {selfRichText && (
        <YamdRichText 
          ref={richTextRef}
          text={selfPlainText}
          textRich={selfRichText}
          className={nodeClass}
          parentInfo={parentInfo}
          globalInfo={globalInfo}
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



  // function to calculate and provide preferred Y position
const calcPreferredBulletYPos = (nodeId, docId, nodeRef, richTextRef) => {
  if (!nodeRef.current || !richTextRef.current?.calcPreferredBulletYPose) return;
  const store = useYamdDocStore.getState();
  // get all requests for this node
  const requests = store.getPreferredYPosRequests(docId, nodeId);
  console.log('noteId:', nodeId, 'YamdNodeText calcPreferredBulletYPos requests:', requests);
  // update result for each requesting container
  Object.keys(requests).forEach(containerClassName => {
    // get preferred Y position from YamdRichText
    const result = richTextRef.current.calcPreferredBulletYPose(containerClassName);
    
    // update result in the Zustand store
    store.updateRequestResult(docId, nodeId, containerClassName, result);
    // increment response counter in store
    store.incResponseCounter(docId, nodeId, containerClassName);
  });
};


export default YamdNodeText;
