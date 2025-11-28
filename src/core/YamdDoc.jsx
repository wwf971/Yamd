import React, { useState, useRef, useCallback, useMemo, useEffect, useLayoutEffect } from 'react';
import { useAtom } from 'jotai';
import YamdNode from '@/core/YamdNode.jsx';
import YamdChildNodes from '@/core/YamdChildNodes.jsx';
import YamdRefHandler from '@/components/NodeRefHandler.jsx';
import YamdBibsList from '@/components/NodeBibsList.jsx';
import NodeWrapper from '@/custom/NodeWrapper.jsx';
import { handleRefClick, handleBibClick, handleBackToSource } from '@/core/YamdDoc.js';
import { useDocStore, generateDocId, docsData, docsState, nodeBulletState } from '@/core/DocStore.js';
// Import RenderUtils context for direct usage
import { RenderUtilsContext, createRenderUtilsContextValue } from '@/core/RenderUtils.ts';

/**
 * YamdDoc - Document container that manages global reference handling
 * Renders the root YamdNode and provides reference navigation functionality
 */
const YamdDoc = ({
  docId,
  disableRefJump = false,
  disableBibsList = false,
  customNodeRenderer = null,
  isEditable = false,
}) => {
  if (!docId) {
    console.error('YamdDoc: docId is required');
    return <div className="yamd-error">Error: docId is required</div>;
  }
  
  // Clean up all Jotai atoms when component unmounts
  // No cleanup here - TestRender cleans up old atoms before creating new document

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

  // handle reference click from NodeTextRichRef components
  const handleRefClickCallback = useCallback((refData) => {
    handleRefClick(refData, containerRef, setRefState);
  }, []);

  // handle bibliography click from NodeTextRichBib components
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
  }, [nodeRefsMap]);

  // Get node reference by ID
  const getNodeRefById = useCallback((nodeId) => {
    return nodeRefsMap.current.get(nodeId);
  }, []);

  // Create stable globalInfo object to prevent infinite re-renders
  const globalInfo = useMemo(() => {
    // Create the globalInfo object (will be used recursively)
    const globalInfo = { 
      docId: docId, // Include docId for Zustand positioning
      docStore: useDocStore, // Direct reference to Zustand store
      
      onRefClick: handleRefClickCallback, // Function for reference handling
      onBibClick: handleBibClickCallback, // Function for bibliography handling
      registerNodeRef: registerNodeRef, // Function for registering node DOM references
      getNodeRefById: getNodeRefById, // Function for retrieving node DOM references
      getDocStore: () => useDocStore, // Function to get Zustand document store (backwards compat)
      
      
      /**
       * Render custom node - calls user-provided custom node renderer wrapped in NodeWrapper
       * @param {object} nodeData - The node data with type='custom' and customType
       * @param {object} parentInfo - Parent context information
       * @returns {React.Element} Rendered custom node component
       */
      renderCustomNode: (nodeData, parentInfo) => {
        if (!customNodeRenderer) {
          return <div className="yamd-error">No custom node renderer provided</div>;
        }
        
        const customType = nodeData.attr?.customType;
        if (!customType) {
          return <div className="yamd-error">Custom node missing customType attribute</div>;
        }
        
        const CustomComponent = customNodeRenderer[customType];
        if (!CustomComponent) {
          return <div className="yamd-error">Unknown custom type: {customType}</div>;
        }
        
        // Wrap the custom component with NodeWrapper to handle bullet positioning
        return <NodeWrapper 
          nodeId={nodeData.id}
          nodeData={nodeData}
          parentInfo={parentInfo}
          globalInfo={globalInfo}
          CustomComponent={CustomComponent}
        />;
      },
      
      getBibText: (bibKey) => {
        // For now, always return fallback (user can override this)
        return {
          code: -1,
          message: 'Bibliography text fetching not implemented',
          data: null
        };
      },
      
      fetchExternalData: (nodeData) => {
        console.log('🌐 fetchExternalData called with:', nodeData);
        return {
          code: 1, // Component should handle data fetching itself
          message: 'Component should handle data fetching directly',
          data: null
        };
      }
    };
    
    return globalInfo;
  }, [handleRefClickCallback, handleBibClickCallback,
      registerNodeRef, getNodeRefById, docId, customNodeRenderer
    ]
  );

  // Create renderChildNodes function
  const renderChildNodes = useCallback(({
    childIds, 
    shouldAddIndent = false, 
    parentInfo = null, 
    globalInfo, 
    firstChildRef = null
  }) => {
    return (
      <YamdChildNodes
        childIds={childIds}
        shouldAddIndent={shouldAddIndent}
        parentInfo={parentInfo}
        globalInfo={globalInfo}
        firstChildRef={firstChildRef}
      />
    );
  }, []);

  // Initialize render utils context value
  const renderUtilsContextValue = useMemo(() => 
    createRenderUtilsContextValue({ 
      registerNodeRef, 
      renderChildNodes,
      isEditable,
      docId: docId,
      docStore: useDocStore
    }), 
    [registerNodeRef, renderChildNodes, isEditable, docId]
  );

  // Get document data from Jotai atoms
  const [rootNodeId] = useAtom(docsData.getRootNodeId(docId));
  const [bibs] = useAtom(docsData.getBibs(docId));

  // If no rootNodeId yet, document hasn't been loaded
  if (!rootNodeId) {
    return <div className="yamd-loading">Loading document...</div>;
  }

  return (
    <RenderUtilsContext.Provider value={renderUtilsContextValue}>
      <div ref={containerRef} style={{ position: 'relative' }} data-doc-id={docId}>
        
        {/* main document, rendering start from root node*/}
        <YamdNode
          nodeId={rootNodeId}
          parentInfo={null}
          globalInfo={globalInfo}
        />

        {/* bibliography list at the end of document */}
        {!disableBibsList && (
          <YamdBibsList 
            bibs={bibs}
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
    </RenderUtilsContext.Provider>
  );
};

export default YamdDoc;
