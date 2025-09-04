import React from 'react';
import YamdNodeImage from './YamdNodeImage.jsx';
import { getAlignmentStrategy } from '../YamdRenderUtils.js';
import { IMAGE_LIST_SETTINGS } from '../YamdRenderSettings.js';

/**
 * Component for rendering a list of images in a single row
 * Supports subindex for custom image numbering (e.g., 1a, 1b, 1c)
 * @param {string} nodeId - The image-list node ID
 * @param {object} globalInfo - Global parsing information
 * @param {object} parentInfo - Parent component information
 * @returns {JSX.Element} - Image list component
 */
function YamdImageList({ nodeId, globalInfo, parentInfo }) {


  /*
    yamd-image-list-item <-- fixed to height of YamdImageList
    imaeg/caption inside yamd-image-list-item grows proportionally to fit it
    if all yamd-image-list-item exceeds viewport width, show horizontal scrollbar
  */

  const nodeData = globalInfo.getNodeDataById(nodeId);
  if (!nodeData) {
    return <div className="yamd-error">Image-list node not found: {nodeId}</div>;
  }
  
  const { attr = {}, children = [] } = nodeData;
  
  // Extract attributes
  const alignX = attr.alignX || 'center';
  const subindex = attr.subindex || 'abc';
  const height = attr.height || IMAGE_LIST_SETTINGS.defaultHeight;
  
  // Get alignment strategy
  const alignmentStrategy = getAlignmentStrategy(nodeData, parentInfo);
  
  // Calculate subindex for each image
  const getSubindex = (index, total) => {
    if (subindex === 'LR' && total === 2) {
      return index === 0 ? 'L' : 'R';
    } else if (subindex === 'abc') {
      return String.fromCharCode(97 + index); // a, b, c, ...
    } else if (subindex === 'ABC') {
      return String.fromCharCode(65 + index); // A, B, C, ...
    } else if (subindex === '123') {
      return String(index + 1); // 1, 2, 3, ...
    } else {
      // Custom subindex pattern
      return subindex[index] || String(index + 1);
    }
  };
  
  // Process children to ensure they are image nodes
  const processImageChild = (childId, index) => {
    const childData = globalInfo.getNodeDataById(childId);
    if (!childData) {
      return (
        <div key={childId || `missing-${index}`} className="yamd-error">
          Image child not found: {childId}
        </div>
      );
    }
    
    // Force node type to be image if it's not already
    if (childData.type !== 'image' && childData.type !== 'node') {
      // Note: subindex is now handled during parsing, not rendering
    }

    
    // Pass forcedHeight to child images for fixed height calculation
    const enhancedParentInfo = {
      ...parentInfo,
      forcedHeight: parseFloat(height) || 200 // Use image-list height as forced height
    };

    // Calculate item style with fixed height only
    const itemStyle = {
      height: height,
      minHeight: height,
      maxHeight: height,
      flexShrink: 0 // Prevent height from changing
      // Width is determined naturally by image aspect ratio and container
    };

    return (
      <div key={childId} className="yamd-image-list-item" style={itemStyle}>
        <YamdNodeImage 
          nodeId={childId}
          globalInfo={globalInfo}
          parentInfo={enhancedParentInfo}
        />
      </div>
    );
  };
  
  return (
    <div className="yamd-image-list-scroll-container">
      <div 
        className="yamd-image-list"
        style={{
          justifyContent: alignmentStrategy,
          height: height,
        }}
      >
        {children.map((childId, index) => processImageChild(childId, index))}
      </div>
    </div>
  );
  
}

export default YamdImageList;
