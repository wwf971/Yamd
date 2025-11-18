import React from 'react';
import NodeVideo from './NodeVideo.jsx';
import { getAlignmentStrategy } from '../YamdRenderUtils.js';
import { VIDEO_LIST_SETTINGS } from '@/config/RenderConfig.js';

/**
 * Component for rendering a list of videos in a single row
 * Supports subindex for custom video numbering (e.g., 1a, 1b, 1c)
 * @param {string} nodeId - The video-list node ID
 * @param {object} globalInfo - Global parsing information
 * @param {object} parentInfo - Parent component information
 * @returns {JSX.Element} - Video list component
 */
function YamdVideoList({ nodeId, globalInfo, parentInfo }) {

  /*
    yamd-video-list-item <-- fixed to height of YamdVideoList
    video/caption inside yamd-video-list-item grows proportionally to fit it
    if all yamd-video-list-item exceeds viewport width, show horizontal scrollbar
  */

  const nodeData = globalInfo.getNodeDataById(nodeId);
  if (!nodeData) {
    return <div className="yamd-error">Video-list node not found: {nodeId}</div>;
  }
  
  const { attr = {}, children = [] } = nodeData;
  
  // Extract attributes
  const alignX = attr.alignX || 'center';
  const subindex = attr.subindex || 'abc';
  const height = attr.height || VIDEO_LIST_SETTINGS.height_default;
  
  // Get alignment strategy
  const alignmentStrategy = getAlignmentStrategy(nodeData, parentInfo);
  
  // Calculate subindex for each video
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
  
  // Process children to ensure they are video nodes
  const processVideoChild = (childId, index) => {
    const childData = globalInfo.getNodeDataById(childId);
    if (!childData) {
      return (
        <div key={childId || `missing-${index}`} className="yamd-error">
          Video child not found: {childId}
        </div>
      );
    }
    
    // Force node type to be video if it's not already
    if (childData.type !== 'video' && childData.type !== 'node') {
      // Note: subindex is now handled during parsing, not rendering
    }

    
    // Pass forcedHeight to child videos for fixed height calculation
    const enhancedParentInfo = {
      ...parentInfo,
      forcedHeight: parseFloat(height) || 200 // Use video-list height as forced height
    };

    // Calculate item style with fixed height only
    const itemStyle = {
      height: height,
      minHeight: height,
      maxHeight: height,
      flexShrink: 0 // Prevent height from changing
      // Width is determined naturally by video aspect ratio and container
    };

    return (
      <div key={childId} className="yamd-video-list-item" style={itemStyle}>
        <NodeVideo 
          nodeId={childId}
          globalInfo={globalInfo}
          parentInfo={enhancedParentInfo}
        />
      </div>
    );
  };
  
  return (
    <div className="yamd-video-list-scroll-container">
      <div 
        className="yamd-video-list"
        style={{
          justifyContent: alignmentStrategy,
          height: height,
        }}
      >
        {children.map((childId, index) => processVideoChild(childId, index))}
      </div>
    </div>
  );
  
}

export default YamdVideoList;
