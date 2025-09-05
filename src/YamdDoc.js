/**
 * YamdDoc utility functions for reference and bibliography handling
 * Extracted from YamdDoc.jsx for better code readability
 */

/**
 * Handle reference click from YamdRichTextRef components
 * @param {object} refData - Reference data containing refId, targetId, sourceElement
 * @param {object} containerRef - Reference to the container element
 * @param {function} setRefState - Function to update reference state
 */
export const handleRefClick = (refData, containerRef, setRefState) => {
  console.log('🔗 Reference clicked:', refData);
  
  const { refId, targetId } = refData;
  
  if (!targetId) {
    console.warn('🔗 No target ID provided for reference');
    return;
  }

  // Find the target element
  const targetEl = document.getElementById(targetId);
  if (!targetEl) {
    console.warn(`🔗 Target element not found: ${targetId}`);
    return;
  }

  // Calculate position for the "Go Back" button relative to the target
  setTimeout(() => {
    if (containerRef.current) {
      const targetRect = targetEl.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      
      // Position relative to the container, next to the destination
      const relativeY = targetRect.top - containerRect.top + (targetRect.height / 2);
      
      console.log('🔗 Position calc for destination:', {
        targetTop: targetRect.top,
        containerTop: containerRect.top,
        targetHeight: targetRect.height,
        relativeY: relativeY
      });
      
      setRefState({
        isVisible: true,
        type: 'ref',
        refSourceId: refId, // Use refId as the HTML id for the source element
        targetId: targetId,
        clickY: relativeY,
        sourceElement: refData.sourceElement
      });
    }
  }, 50); // Small delay to let scroll complete
};

/**
 * Handle bibliography click from YamdRichTextBib components
 * @param {object} bibData - Bibliography data containing bibId, sourceElement
 * @param {object} containerRef - Reference to the container element
 * @param {function} setRefState - Function to update reference state
 * @param {boolean} disableRefJump - Whether reference jumping is disabled
 * @param {boolean} disableBibsList - Whether bibliography list is disabled
 */
export const handleBibClick = (bibData, containerRef, setRefState, disableRefJump, disableBibsList) => {
  console.log('📚 Bibliography clicked:', bibData);
  
  if (disableRefJump || disableBibsList) {
    return; // Bibliography navigation disabled
  }

  const { bibId, sourceElement } = bibData;
  
  if (!bibId) {
    console.warn('📚 No bibliography ID provided');
    return;
  }

  const targetEl = document.getElementById(bibId);
  
  if (!targetEl) {
    console.warn(`📚 Bibliography element not found: ${bibId}`);
    return;
  }

  // Calculate position for the "Go Back" button relative to the target
  setTimeout(() => {
    if (containerRef.current) {
      const targetRect = targetEl.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      
      const relativeY = targetRect.top - containerRect.top + (targetRect.height / 2);
      
      console.log('📚 Position calc for bibliography:', {
        targetTop: targetRect.top,
        containerTop: containerRect.top,
        targetHeight: targetRect.height,
        relativeY: relativeY
      });
      
      setRefState({
        isVisible: true,
        type: 'bib',
        refSourceId: null, // No specific ref ID for bib clicks
        targetId: bibId,
        clickY: relativeY,
        sourceElement: sourceElement
      });
    }
  }, 50);
};

/**
 * Handle going back to source element
 * @param {function} setRefState - Function to update reference state
 */
export const handleBackToSource = (setRefState) => {
  setRefState({
    isVisible: false,
    type: null,
    refSourceId: null,
    targetId: null,
    clickY: 0,
    sourceElement: null
  });
};

/**
 * Create globalInfo object with utility functions
 * @param {object} flattenedData - Flattened document data
 * @param {function} handleRefClick - Reference click handler
 * @param {function} handleBibClick - Bibliography click handler
 * @param {function} registerNodeRef - Node reference registration function
 * @param {function} getNodeRefById - Node reference retrieval function
 * @returns {object} Global info object
 */
export const createGlobalInfo = (flattenedData, handleRefClick, handleBibClick, registerNodeRef, getNodeRefById) => {
  console.log('🔍 globalInfo re-created');
  return { 
    getNodeDataById: (nodeId) => flattenedData.nodes[nodeId],
    getAssetById: (assetId) => flattenedData.assets?.[assetId],
    getRefById: (refId) => flattenedData.refs?.[refId],
    onRefClick: handleRefClick, // Function for reference handling
    onBibClick: handleBibClick, // Function for bibliography handling
    registerNodeRef: registerNodeRef, // Function for registering node DOM references
    getNodeRefById: getNodeRefById, // Function for retrieving node DOM references
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
};
