import React, { useState, useRef, useCallback, useMemo, useEffect, useLayoutEffect } from 'react';
import YamdNode from '@/core/YamdNode.jsx';
import YamdChildrenNodes from '@/core/YamdChildrenNodes.jsx';
import YamdRefHandler from '@/components/NodeRefHandler.jsx';
import YamdBibsList from '@/components/NodeBibsList.jsx';
import { handleRefClick, handleBibClick, handleBackToSource, createGlobalInfo } from '@/core/YamdDoc.js';
import { useYamdDocStore, generateDocId } from '@/core/YamdDocStore.js';

/**
 * YamdDoc - Document container that manages global reference handling
 * Renders the root YamdNode and provides reference navigation functionality
 */
const YamdDoc = ({
  docData,
  disableRefJump = false,
  disableBibsList = false,
  docId = null,
  customNodeRenderer = null,
}) => {
  // Generate docId if not provided
  const actualDocId = useMemo(() => docId || generateDocId(), [docId]);
  
  // Clear bullet position data when docData changes (synchronously during render)
  // This must happen in render phase, BEFORE children mount
  const prevDocDataRef = useRef(null);
  if (prevDocDataRef.current !== null && prevDocDataRef.current !== docData) {
    // Clear any old bullet position data for this docId when docData changes
    // This ensures children start with clean state when they mount
    useYamdDocStore.getState().clearPreferredYPosRequestsForDoc(actualDocId);
  }
  prevDocDataRef.current = docData;
  
  // return <div>Hello</div>;
  // initialize document data in store (example usage)
  useEffect(() => {
    useYamdDocStore.getState().setDocData(actualDocId, {
      docId: actualDocId,
      createdAt: new Date().toISOString(),
      docData: docData,
      // add any other document-specific data here
      // examples:
      // userPreferences: { theme: 'light', fontSize: 'medium' },
      // viewState: { scrollPosition: 0, expandedPanels: [] },
      // annotations: [],
      // bookmarks: []
    });
  }, [actualDocId, docData]);

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

  // Create render function for children
  const renderChildNodes = useCallback((childIds, shouldAddIndent, parentInfo, globalInfo, firstChildRef) => {
    return (
      <YamdChildrenNodes
        childIds={childIds}
        shouldAddIndent={shouldAddIndent}
        parentInfo={parentInfo}
        globalInfo={globalInfo}
        firstChildRef={firstChildRef}
      />
    );
  }, []);

  // Create stable globalInfo object to prevent infinite re-renders
  const globalInfo = useMemo(() => 
    createGlobalInfo(
      docData,
      handleRefClickCallback,
      handleBibClickCallback,
      registerNodeRef,
      getNodeRefById,
      actualDocId,
      useYamdDocStore,
      renderChildNodes,
      customNodeRenderer),
    [docData, handleRefClickCallback, handleBibClickCallback,
      registerNodeRef, getNodeRefById, actualDocId, renderChildNodes, customNodeRenderer
    ]
  );

  if (!docData || !docData.rootNodeId) {
    return <div className="yamd-error">No document data provided</div>;
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }} data-doc-id={actualDocId}>
      
      {/* main document, rendering start from root node*/}
      <YamdNode
        nodeId={docData.rootNodeId}
        parentInfo={null}
        globalInfo={globalInfo}
      />

      {/* bibliography list at the end of document */}
      {!disableBibsList && (
        <YamdBibsList 
          bibs={docData.bibs || {}}
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
