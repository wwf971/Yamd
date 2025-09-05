import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import YamdNode from './YamdNode.jsx';
import YamdRefHandler from './components/YamdRefHandler.jsx';
import YamdBibsList from './components/YamdBibsList.jsx';
import { handleRefClick, handleBibClick, handleBackToSource, createGlobalInfo } from './YamdDoc.js';
import { useYamdDocStore, generateDocId } from './YamdDocStore.js';

/**
 * YamdDoc - Document container that manages global reference handling
 * Renders the root YamdNode and provides reference navigation functionality
 */
const YamdDoc = ({ flattenedData, disableRefJump = false, disableBibsList = false, docId }) => {
  // Generate docId if not provided
  const actualDocId = useMemo(() => docId || generateDocId(), [docId]);
  
  // return <div>Hello</div>;
  // initialize document data in store (example usage)
  useEffect(() => {
    useYamdDocStore.getState().setDocData(actualDocId, {
      docId: actualDocId,
      createdAt: new Date().toISOString(),
      flattenedData: flattenedData,
      // add any other document-specific data here
      // examples:
      // userPreferences: { theme: 'light', fontSize: 'medium' },
      // viewState: { scrollPosition: 0, expandedPanels: [] },
      // annotations: [],
      // bookmarks: []
    });
  }, [actualDocId, flattenedData]);

  const containerRef = useRef(null);
  const nodeRefsMap = useRef(new Map()); // Map from nodeId to DOM element reference
  const [refState, setRefState] = useState({
    isVisible: false,
    type: null, // 'ref' or 'bib'
    refSourceId: null,
    targetId: null,
    clickY: 0,
    sourceElement: null
  });

  // handle reference click from YamdRichTextRef components
  const handleRefClickCallback = useCallback((refData) => {
    handleRefClick(refData, containerRef, setRefState);
  }, []);

  // handle bibliography click from YamdRichTextBib components
  const handleBibClickCallback = useCallback((bibData) => {
    handleBibClick(bibData, containerRef, setRefState, disableRefJump, disableBibsList);
  }, [disableRefJump, disableBibsList]);

  // handle going back to source
  const handleBackToSourceCallback = useCallback(() => {
    handleBackToSource(setRefState);
  }, []);

  // register node reference - called by components after they finish rendering
  const registerNodeRef = useCallback((nodeId, nodeRef) => {
    if (nodeId && nodeRef) {
      nodeRefsMap.current.set(nodeId, nodeRef);
      // console.log(`📌 Registered node ref for ${nodeId}:`, nodeRef);
    }
  }, []);

  // Get node reference by ID
  const getNodeRefById = useCallback((nodeId) => {
    const nodeRef = nodeRefsMap.current.get(nodeId);
    console.log(`🔍 Retrieved node ref for ${nodeId}:`, nodeRef);
    return nodeRef;
  }, []);

  // Create stable globalInfo object to prevent infinite re-renders
  const globalInfo = useMemo(() => 
    createGlobalInfo(
      flattenedData, handleRefClickCallback, handleBibClickCallback, registerNodeRef, getNodeRefById, actualDocId),
    [flattenedData, handleRefClickCallback, handleBibClickCallback, registerNodeRef, getNodeRefById, actualDocId]
  );

  if (!flattenedData || !flattenedData.rootNodeId) {
    return <div className="yamd-error">No document data provided</div>;
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }} data-doc-id={actualDocId}>
      
      {/* main document, rendering start from root node*/}
      <YamdNode
        nodeId={flattenedData.rootNodeId}
        parentInfo={null}
        globalInfo={globalInfo}
      />

      {/* bibliography list at the end of document */}
      {!disableBibsList && (
        <YamdBibsList 
          bibs={flattenedData.bibs || {}}
          globalInfo={globalInfo}
        />
      )}

      {/* deals with user click on refs and bibs*/}
      {!disableRefJump && (
        <YamdRefHandler
          refState={refState}
          onBackToSource={handleBackToSourceCallback}
          containerRef={containerRef}
        />
      )}
    </div>
  );
};

export default YamdDoc;
