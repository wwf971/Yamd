import React from 'react';
import './YamdNode.css';
import YamdPanel from './components/YamdPanel.jsx';
import YamdNodeDivider from './components/YamdNodeDivider.jsx';
import YamdNodeKey from './components/YamdNodeKey.jsx';
import YamdNodeTopRight from './components/YamdNodeTopRight.jsx';
import YamdNodeAnonym from './components/YamdNodeAnonym.jsx';
import YamdNodeText from './components/YamdNodeText.jsx';
import YamdNodeLaTeX from './components/YamdNodeLaTeX.jsx';
import YamdNodeImage from './components/YamdNodeImage.jsx';
import YamdNodeVideo from './components/YamdNodeVideo.jsx';
import YamdImageList from './components/YamdImageList.jsx';
import YamdVideoList from './components/YamdVideoList.jsx';
import YamdChildrenNodes from './YamdChildrenNodes.jsx';
import { AddListBulletBeforeYamdNode } from './components/AddBullet.jsx';
import { getChildrenDisplay } from './YamdRenderUtils.js';

/**
 * Main YamdNode component for rendering flattened Yamd data
 * @param {string} nodeId - The ID of the node to render
 * @param {object} parentInfo - Parent context information (default: null)
 * @param {object} globalInfo - Global context with getNodeDataById, getAssetById, getRefById, and fetchExternalData methods (default: null)
 */
const YamdNode = React.memo(({ nodeId, parentInfo = null, globalInfo = null }) => {

  // console.log('🔍 YamdNode rendering node:', nodeId);
  if (!globalInfo?.getNodeDataById) {
    return <div className="yamd-error">Missing globalInfo.getNodeDataById</div>;
  }
  
  const nodeData = globalInfo.getNodeDataById(nodeId);
  
  if (!nodeData) {
    return <div className="yamd-error">Node not found: {nodeId}</div>;
  }

  // assign default values if missing
  const selfDisplay = nodeData.attr?.selfDisplay || 
    (nodeData.textRaw && nodeData.textRaw !== '' ? 'default' : 'none');
  const childDisplay = getChildrenDisplay(nodeData, false, parentInfo);
  console.log('YamdNode rendering node:', nodeId, 'nodeData.type:', nodeData.type, 'selfDisplay:', selfDisplay, 'childDisplay:', childDisplay);
  const getNodeContent = () => {
    // Handle special leaf node types first
    if (nodeData.type === 'latex') {
      return (
        <AddListBulletBeforeYamdNode 
          childNode={
            <YamdNodeLaTeX
              nodeId={nodeId}
              parentInfo={parentInfo}
              globalInfo={globalInfo}
            />
          }
          alignBullet='flex-start'
        />
      );
    }
    
    if (nodeData.type === 'image') {
      return (
        <AddListBulletBeforeYamdNode 
          childNode={
            <YamdNodeImage
              nodeId={nodeId}
              parentInfo={parentInfo}
              globalInfo={globalInfo}
            />
          }
          alignBullet='flex-start'
        />
      );
    }
    
    if (nodeData.type === 'video') {
      return (
        <AddListBulletBeforeYamdNode 
          childNode={
            <YamdNodeVideo
              nodeId={nodeId}
              parentInfo={parentInfo}
              globalInfo={globalInfo}
            />
          }
          alignBullet='flex-start'
        />
      );
    }
    
    if (nodeData.type === 'image-list') {
      return (
        <AddListBulletBeforeYamdNode 
          childNode={
            <YamdImageList
              nodeId={nodeId}
              parentInfo={parentInfo}
              globalInfo={globalInfo}
            />
          }
          alignBullet='flex-start'
        />
      );
    }
    
    if (nodeData.type === 'video-list') {
      return (
        <AddListBulletBeforeYamdNode 
          childNode={
            <YamdVideoList
              nodeId={nodeId}
              parentInfo={parentInfo}
              globalInfo={globalInfo}
            />
          }
          alignBullet='flex-start'
        />
      );
    }
    
    switch (selfDisplay) {
    case 'panel':
      return (
        <AddListBulletBeforeYamdNode
          childNode={
            <YamdPanel 
              nodeId={nodeId} 
              parentInfo={parentInfo}
              globalInfo={globalInfo} 
            />
          }
          alignBullet='flex-start'
        />
      );
    
    case 'divider':
      return (
        <AddListBulletBeforeYamdNode 
          childNode={
            <YamdNodeDivider 
              nodeId={nodeId} 
              parentInfo={parentInfo}
              globalInfo={globalInfo} 
            />
          }
          alignBullet='flex-start'
        />
      );
    
    case 'key':
      return (
        <YamdNodeKey 
          nodeId={nodeId} 
          parentInfo={parentInfo}
          globalInfo={globalInfo} 
        />
      );
    
    case 'top-right':
      return (
        <YamdNodeTopRight 
          nodeId={nodeId} 
          parentInfo={parentInfo}
          globalInfo={globalInfo} 
        />
      );
    
    case 'none':
      return (
        <YamdNodeAnonym 
          nodeId={nodeId} 
          parentInfo={parentInfo}
          globalInfo={globalInfo} 
        />
      );
    
    default:
      return (
        /*
        - aa[child=ul]
          - bb
          - cc
        */
        <AddListBulletBeforeYamdNode
          childNode={
            <YamdNodeText 
              nodeId={nodeId} 
              parentInfo={parentInfo}
              globalInfo={globalInfo} 
            />
          }
          alignBullet='flex-start'
        />
      );
    }
  };
  
  return getNodeContent();
});

/**
 * Component for rendering children based on childDisplay style from parentInfo
 * @param {Array} childIds - Array of child node IDs
 * @param {function} getNodeDataById - Function to get node data by ID
 * @param {function} getAssetById - Function to get asset data by ID
 * @param {object} parentInfo - Parent context information containing childDisplay and childClass
 * @param {boolean} shouldAddIndent - Whether to add indentation to children (controlled by parent component type)
 */

/**
 * Utility function to get the appropriate CSS class for a node
 * @param {object} nodeData - The node data
 * @param {object} parentInfo - Parent context information
 * @returns {string} - CSS class to use
 */
export const getNodeClass = (nodeData, parentInfo) => {
  // If parent specifies a childClass, use it
  if (parentInfo?.childClass) {
    return parentInfo.childClass;
  }
  
  // If node has its own selfClass, use it
  if (nodeData?.selfClass) {
    return nodeData.selfClass;
  }
  
  // Generate default class based on parent's childDisplay and node's selfDisplay
  return getNodeDefaultClass(nodeData, parentInfo);
};

/**
 * Get default CSS class based on parent context and node type
 * @param {object} nodeData - The node data
 * @param {object} parentInfo - Parent context information
 * @returns {string} - Default CSS class
 */
const getNodeDefaultClass = (nodeData, parentInfo) => {
  const parentChildDisplay = parentInfo?.childDisplay;
  const nodeSelfDisplay = nodeData?.selfDisplay;
  const nodeType = nodeData?.type;
  
  // Check if it's a text node in a specific parent context
  if (nodeType === 'text') {
    switch (parentChildDisplay) {
      case 'unordered-list':
      case 'unordered_list':
      case 'ul':
      case 'ordered-list':
      case 'ordered_list':
      case 'ol':
      case 'plain-list':
      case 'plain_list':
        return 'yamd-list-content';
      case 'pl':
        return 'yamd-plain-content';
      case 'paragraph-list':
      case 'paragraphs':
      case 'paragraph':
      case 'p':
        return 'yamd-paragraph-content';
      case 'timeline':
        return 'yamd-timeline-content';
      default:
        return 'yamd-tag';
    }
  }
  
  // for nodes with selfDisplay, use appropriate default
  switch (nodeSelfDisplay) {
    case 'panel':
      return 'yamd-panel-title';
    case 'divider':
      return 'yamd-divider-text';
    case 'key':
      return 'yamd-key-title';
    case 'top-right':
      return 'yamd-top-right-title';
    default:
      return 'yamd-title-default';
  }
};

export default YamdNode;
