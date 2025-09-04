import React, { useState, useRef, useCallback, useMemo } from 'react';
import YamdNode from './YamdNode.jsx';
import YamdRefHandler from './components/YamdRefHandler.jsx';
import YamdBibsList from './components/YamdBibsList.jsx';
import { handleRefClick, handleBibClick, handleBackToSource, createGlobalInfo } from './YamdDoc.js';

/**
 * YamdDoc - Document container that manages global reference handling
 * Renders the root YamdNode and provides reference navigation functionality
 */
const YamdDoc = ({ flattenedData, disableRefJump = false, disableBibsList = false }) => {
  const containerRef = useRef(null);
  const [refState, setRefState] = useState({
    isVisible: false,
    type: null, // 'ref' or 'bib'
    refSourceId: null,
    targetId: null,
    clickY: 0,
    sourceElement: null
  });

  // Handle reference click from YamdRichTextRef components
  const handleRefClickCallback = useCallback((refData) => {
    handleRefClick(refData, containerRef, setRefState);
  }, []);

  // Handle bibliography click from YamdRichTextBib components
  const handleBibClickCallback = useCallback((bibData) => {
    handleBibClick(bibData, containerRef, setRefState, disableRefJump, disableBibsList);
  }, [disableRefJump, disableBibsList]);

  // Handle going back to source
  const handleBackToSourceCallback = useCallback(() => {
    handleBackToSource(setRefState);
  }, []);

  // Create stable globalInfo object to prevent infinite re-renders
  const globalInfo = useMemo(() => 
    createGlobalInfo(flattenedData, handleRefClickCallback, handleBibClickCallback),
    [flattenedData, handleRefClickCallback, handleBibClickCallback]
  );

  if (!flattenedData || !flattenedData.rootNodeId) {
    return <div className="yamd-error">No document data provided</div>;
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      
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
