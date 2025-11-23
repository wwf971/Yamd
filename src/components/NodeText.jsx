import React, { useRef, useEffect, useState } from 'react';
import { getNodeClass } from '@/core/YamdNode.jsx';
import { useRenderUtilsContext } from '@/core/RenderUtils.js';
import NodeTextRich from './NodeRichText.jsx';
import NodeTextPlain from './NodePlainText.jsx';
import { createBulletEqualityFn } from '@/core/RenderUtils.js';

/**
 * render a text node, and then render its children nodes.
 */
const YamdNodeText = React.memo(({ nodeId, parentInfo, globalInfo }) => {
  const nodeRef = useRef(null);

  // Get render utils from context
  const renderUtils = useRenderUtilsContext();

  // Register the node reference after the component finishes rendering
  useEffect(() => {
    if (nodeRef.current) {
      renderUtils.registerNodeRef?.(nodeId, nodeRef.current);
    }
  }, [nodeId, renderUtils.registerNodeRef]);
  
  // ref to access NodeTextRich or NodeTextPlain methods
  const textContentRef = useRef(null);
  
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
    const unsubscribe = globalInfo.getDocStore().subscribe(
      (state) => state.bulletYPosReq[docId]?.[nodeId] || {},
      (requests) => {
        console.log('noteId:', nodeId, 'YamdNodeText useEffect subscribe triggered with requests:', requests);
        // This will only fire if equalityFn returns false
        calcBulletYPos(nodeId, docId, nodeRef, textContentRef, globalInfo);
      },
      {
        equalityFn: createBulletEqualityFn(nodeId, 'YamdNodeText'),
      }
    );
    
    // Retry logic to handle ref not being ready immediately
    let attempts = 0;
    const maxAttempts = 10;
    const tryCalculate = () => {
      console.log(`noteId: ${nodeId} tryCalculate attempt ${attempts}, ref ready:`, !!textContentRef.current);
      calcBulletYPos(nodeId, docId, nodeRef, textContentRef, globalInfo);
      attempts++;
      
      // If ref still isn't ready and we haven't exceeded max attempts, retry
      if (!textContentRef.current && attempts < maxAttempts) {
        console.log(`noteId: ${nodeId} scheduling retry ${attempts}/${maxAttempts}`);
        setTimeout(tryCalculate, 5);
      }
    };
    
    // Start trying
    tryCalculate();
    
    return unsubscribe;
  }, [nodeId, docId, globalInfo]);
  // ===== END ZUSTAND LOGIC =====

  // Get node data from store via renderUtils
  const nodeData = renderUtils.getNodeDataById(nodeId);
  
  if (!nodeData) {
    return <div className="yamd-error">Node not found: {nodeId}</div>;
  }

  const selfText = nodeData.textRaw || nodeData.textOriginal || '';
  const textRich = nodeData.textRich; // Rich text segments if LaTeX was processed
  
  // Determine if this is plain text (no textRich, or textRich with only one text segment)
  const isPlainText = !textRich || 
    (Array.isArray(textRich) && textRich.length === 1 && textRich[0].type === 'text');
  
  const childDisplay = renderUtils.getChildDisplay(nodeData, false, parentInfo);
  const childClass = nodeData.attr?.childClass;
  const shouldRenderBullet = parentInfo?.childDisplay === 'ul' || parentInfo?.childDisplay === 'ol';
  
  // Use the utility function to get appropriate CSS class
  const nodeClass = getNodeClass(nodeData, parentInfo) || 'yamd-title-default';
  // console.log("textRich:", textRich, "isPlainText:", isPlainText);

  return (
    <div ref={nodeRef} className="yamd-node-text">
      {/* self content */}
      {selfText && isPlainText && (
        <NodeTextPlain 
          ref={textContentRef}
          nodeId={nodeId}
          className={nodeClass}
          parentInfo={parentInfo}
          globalInfo={globalInfo}
        />
      )}
      {selfText && !isPlainText && (
        <NodeTextRich 
          ref={textContentRef}
          text={selfText}
          textRich={textRich}
          className={nodeClass}
          parentInfo={parentInfo}
          globalInfo={globalInfo}
        />
      )}

      {/* children content */}
      {nodeData.children && nodeData.children.length > 0 && (
        renderUtils.renderChildNodes({
          childIds: nodeData.children,
          shouldAddIndent: true,
          parentInfo: { 
            ...parentInfo, 
            ...(childDisplay && { childDisplay }),
            ...(childClass && { childClass })
          },
          globalInfo: globalInfo,
          firstChildRef: null
        })
      )}
    </div>
  );
});


// function to calculate and provide preferred Y position
const calcBulletYPos = (nodeId, docId, nodeRef, textContentRef, globalInfo) => {
  // guard for nodeRef or textContentRef not ready
  if (!nodeRef.current || !textContentRef.current?.calcBulletYPos) {
    console.log(`noteId: ${nodeId} calcBulletYPos guard failed - nodeRef:`, !!nodeRef.current, 'textContentRef:', !!textContentRef.current, 'calcBulletYPos:', !!textContentRef.current?.calcBulletYPos);
    return;
  }

  const store = globalInfo.getDocStore().getState();
  // get all requests for this node
  const requests = store.getBulletYPosReqs(docId, nodeId);
  console.log('noteId:', nodeId, 'YamdNodeText calcBulletYPos requests:', requests);
  
  const requestKeys = Object.keys(requests);
  console.log('noteId:', nodeId, 'YamdNodeText calcBulletYPos requestKeys:', requestKeys);
  
  // update result for each requesting container
  requestKeys.forEach(containerClassName => {
    console.log('noteId:', nodeId, 'YamdNodeText calculating for container:', containerClassName);
    // get preferred Y position from NodeTextRich or NodeTextPlain
    const result = textContentRef.current.calcBulletYPos(containerClassName);
    console.log('noteId:', nodeId, 'YamdNodeText got result:', result);
    
    // update result in the Zustand store
    store.updateReqResult(docId, nodeId, containerClassName, result);
    console.log('noteId:', nodeId, 'YamdNodeText updated result in store');
    
    // increment response counter in store
    store.incRespCounter(docId, nodeId, containerClassName);
    console.log('noteId:', nodeId, 'YamdNodeText incremented response counter');
  });
};


export default YamdNodeText;
