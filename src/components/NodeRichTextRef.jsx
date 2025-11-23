import React from 'react';

import { useRenderUtilsContext } from '@/core/RenderUtils.js';
/**
 * Component for referring to assets(images, videos, latex blocks, etc) in same document
 * this component is a kind of segments in YamdNodeText.jsx's selfTextRich
 * Handles \ref{linkText}{linkId} patterns
 */
const NodeTextRichRef = ({ segment, globalInfo }) => {
  const renderUtils = useRenderUtilsContext();
  if (!segment || segment.type !== 'ref-asset') {
    return <span className="yamd-error">Invalid reference segment</span>;
  }

  const { refId, targetId, linkText } = segment;
  

  // Get reference data
  const refData = renderUtils.getRefById(refId);
  if (!refData) {
    // Fallback: display original reference syntax
    return <span className="yamd-ref-fallback">{segment.textRaw}</span>;
  }

  // Auto-generate link text if not provided
  let displayText = linkText;
  if (!displayText || displayText.trim() === '') {
    // Try to find the target node to generate appropriate text
    const targetNode = renderUtils.getNodeDataById(targetId);
    
    if (targetNode) {
      if (targetNode.type === 'latex') {
        // For LaTeX nodes, try to get asset info for numbering
        const asset = targetNode.assetId ? renderUtils.getAssetById(targetNode.assetId) : null;
        if (asset && asset.indexOfSameType && !asset.no_index) {
          const captionTitle = asset.captionTitle || 'Eq';
          displayText = `${captionTitle} ${asset.indexOfSameType}`;
        } else {
          displayText = 'Equation';
        }
      } else if (targetNode.type === 'image') {
        // For image nodes, generate "Fig. X" format
        // Note: This would need to be enhanced with proper figure numbering in the future
        displayText = 'Figure';
      } else if (targetNode.type === 'video') {
        displayText = 'Video';
      } else {
        // For other nodes, use the targetId as fallback
        displayText = targetId;
      }
    } else {
      // Target not found, use targetId as fallback
      displayText = targetId;
    }
  }

  // Handle click to notify YamdDoc
  const handleClick = (e) => {
    console.log('🔍 NodeTextRichRef handleClick rendering');
    e.preventDefault();
    
    if (globalInfo?.onRefClick) {
      globalInfo.onRefClick({
        refId: refId,
        targetId: targetId,
        sourceElement: e.target
      });
    } else {
      console.warn('🔗 No onRefClick handler available in globalInfo');
    }
  };

  return (
    <a 
      id={refId} // Use refId as HTML element ID for easy back-navigation
      href={`#${targetId}`}
      className="yamd-ref-link"
      data-ref-target={targetId}
      data-ref-id={refId}
      title={`Reference to ${targetId}`}
      onClick={handleClick}
    >
      {displayText}
    </a>
  );
};

export default NodeTextRichRef;
