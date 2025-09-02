import React from 'react';
import './YamdNode.css';
import YamdNodePanel from './components/YamdNodePanel.jsx';
import YamdNodeDivider from './components/YamdNodeDivider.jsx';
import YamdNodeKey from './components/YamdNodeKey.jsx';
import YamdNodeTopRight from './components/YamdNodeTopRight.jsx';
import YamdNodeAnonym from './components/YamdNodeAnonym.jsx';
import YamdNodeDefault from './components/YamdNodeDefault.jsx';
import YamdChildrenNodes from './YamdChildrenNodes.jsx';
import { AddListBulletBeforeYamdNode, getChildrenDisplay } from './YamdRenderUtils.js';

/**
 * Main YamdNode component for rendering flattened Yamd data
 * @param {string} nodeId - The ID of the node to render
 * @param {function} getNodeDataById - Function to get node data by ID
 * @param {object} parentInfo - Parent context information (default: null)
 */
const YamdNode = ({ nodeId, getNodeDataById, parentInfo = null }) => {
  const nodeData = getNodeDataById(nodeId);
  
  if (!nodeData) {
    return <div className="yamd-error">Node not found: {nodeId}</div>;
  }

  // Simple and clear logic: assign default values if missing
  const selfDisplay = nodeData.attr?.selfDisplay || 
    (nodeData.textRaw ? 'default' : 'none');
  const childDisplay = getChildrenDisplay(nodeData);
  
  const getNodeContent = () => {
    switch (selfDisplay) {
    case 'panel':
      return (
        <AddListBulletBeforeYamdNode 
          childNode={
            <YamdNodePanel 
              nodeId={nodeId} 
              getNodeDataById={getNodeDataById} 
              parentInfo={parentInfo} 
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
              getNodeDataById={getNodeDataById} 
              parentInfo={parentInfo} 
            />
          }
          alignBullet='flex-start'
        />
      );
    
    case 'key':
      return (
        <YamdNodeKey 
          nodeId={nodeId} 
          getNodeDataById={getNodeDataById} 
          parentInfo={parentInfo} 
        />
      );
    
    case 'top-right':
      return (
        <YamdNodeTopRight 
          nodeId={nodeId} 
          getNodeDataById={getNodeDataById} 
          parentInfo={parentInfo} 
        />
      );
    
    case 'none':
      return (
        <YamdNodeAnonym 
          nodeId={nodeId} 
          getNodeDataById={getNodeDataById} 
          parentInfo={parentInfo} 
        />
      );
    
    default:
      return (
        /*
        - aa[child=ul]
          - bb
          - cc
        */
        <YamdNodeDefault 
          nodeId={nodeId} 
          getNodeDataById={getNodeDataById} 
          parentInfo={parentInfo} 
        />
      );
    }
  };
  
  return getNodeContent();
};

/**
 * Component for rendering children based on childDisplay style from parentInfo
 * @param {Array} childIds - Array of child node IDs
 * @param {function} getNodeDataById - Function to get node data by ID
 * @param {object} parentInfo - Parent context information containing childDisplay and childClass
 */
export const YamdChildrenRenderer = (props) => (
  <YamdChildrenNodes {...props} YamdNodeComponent={YamdNode} />
);

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
  
  // For nodes with selfDisplay, use appropriate default
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
