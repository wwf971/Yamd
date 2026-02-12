import React from 'react';
import './YamdNode.css';
import NodePanel from '@/components/NodePanel.jsx';
import NodeDivider from '@/components/NodeDivider.jsx';
import YamdNodeKey from '@/components/NodeKey.jsx';
import YamdNodeTopRight from '@/components/NodeTopRight.jsx';
import YamdNodeAnonym from '@/components/NodeAnonym.jsx';
import ListItem from '@/components/ListItem.jsx';
import SegmentLaTeX from '@/segments/SegmentLaTeX.jsx';
import NodeImage from '@/components/NodeImage.jsx';
import NodeVideo from '@/components/NodeVideo.jsx';
import YamdImageList from '@/components/NodeImageList.jsx';
import YamdVideoList from '@/components/NodeVideoList.jsx';
import { AddListBulletBeforeNode } from '@/core/AddBullet.jsx';
import { useRenderUtilsContext } from '@/core/RenderUtils.ts';



/**
 * Main YamdNode component for rendering flattened Yamd data
 * @param {string} nodeId - The ID of the node to render
 * @param {object} parentInfo - Parent context information (default: null)
 * @param {object} globalInfo - Global context with getNodeDataById, getAssetById, getRefById, and fetchExternalData methods (default: null)
 */
const YamdNode = React.memo(({ nodeId, parentInfo = null, globalInfo = null }) => {
  // console.log('🔍 YamdNode rendering node:', nodeId);
  
  // Get render utils from context
  const renderUtils = useRenderUtilsContext();
  
  // Get node data reactively from Jotai store
  const nodeData = renderUtils.useNodeData(nodeId);
  if (!nodeData) {
    return <div className="yamd-error">Node not found. nodeId: {nodeId}</div>;
  }

  // assign default values if missing
  // Only use 'none' if explicitly specified in attr.selfDisplay
  // Otherwise default to 'default' for text nodes, or infer from content
  const selfDisplay = nodeData.attr?.selfDisplay || 
    (nodeData.textRaw !== undefined ? 'default' : 'default');
  const childDisplay = renderUtils.getChildDisplay(nodeData, false, parentInfo);
  // console.log('YamdNode rendering node:', nodeId, 'nodeData.type:', nodeData.type, 'selfDisplay:', selfDisplay, 'childDisplay:', childDisplay);
  const getNodeContent = () => {
    // Handle special leaf node types first
    if (nodeData.type === 'latex') {
      return (
        <AddListBulletBeforeNode>
          <SegmentLaTeX
            nodeId={nodeId}
            parentInfo={parentInfo}
            globalInfo={globalInfo}
          />
        </AddListBulletBeforeNode>
      );
    }
    
    if (nodeData.type === 'image') {
      return (
        <AddListBulletBeforeNode>
          <NodeImage
            nodeId={nodeId}
            parentInfo={parentInfo}
            globalInfo={globalInfo}
          />
        </AddListBulletBeforeNode>
      );
    }
    
    if (nodeData.type === 'video') {
      return (
        <AddListBulletBeforeNode>
          <NodeVideo
            nodeId={nodeId}
            parentInfo={parentInfo}
            globalInfo={globalInfo}
          />
        </AddListBulletBeforeNode>
      );
    }
    
    if (nodeData.type === 'image-list') {
      return (
        <AddListBulletBeforeNode>
          <YamdImageList
            nodeId={nodeId}
            parentInfo={parentInfo}
            globalInfo={globalInfo}
          />
        </AddListBulletBeforeNode>
      );
    }
    
    if (nodeData.type === 'video-list') {
      return (
        <AddListBulletBeforeNode>
          <YamdVideoList
            nodeId={nodeId}
            parentInfo={parentInfo}
            globalInfo={globalInfo}
          />
        </AddListBulletBeforeNode>
      );
    }

    if (nodeData.type === 'custom') {
      return (
        <AddListBulletBeforeNode>
          {globalInfo.renderCustomNode(nodeData, parentInfo, globalInfo)}
        </AddListBulletBeforeNode>
      );
    }
    
    switch (selfDisplay) {
      case 'panel':
        return (
          <AddListBulletBeforeNode>
            <NodePanel 
              nodeId={nodeId} 
              parentInfo={parentInfo}
              globalInfo={globalInfo} 
            />
          </AddListBulletBeforeNode>
        );
      
      case 'divider':
        return (
          <AddListBulletBeforeNode>
            <NodeDivider 
              nodeId={nodeId} 
              parentInfo={parentInfo}
              globalInfo={globalInfo} 
            />
          </AddListBulletBeforeNode>
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
          <AddListBulletBeforeNode>
            <ListItem 
              nodeId={nodeId} 
              parentInfo={parentInfo}
              globalInfo={globalInfo} 
            />
          </AddListBulletBeforeNode>
        );
    }
  };
  
  return getNodeContent();
}, shouldRerender);


/**
 * Custom equality function for YamdNode React.memo
 * Only re-render if nodeId, parentInfo values, or globalInfo reference changes
 * @param {object} prevProps - Previous props
 * @param {object} nextProps - Next props
 * @returns {boolean} - True if props are equal (skip re-render), false otherwise
 */
function shouldRerender(prevProps, nextProps) {
  // Always re-render if nodeId changes
  if (prevProps.nodeId !== nextProps.nodeId) {
    return false;
  }
  
  // Always re-render if globalInfo reference changes
  if (prevProps.globalInfo !== nextProps.globalInfo) {
    return false;
  }
  
  // Check parentInfo values (not reference)
  const prevParentInfo = prevProps.parentInfo || {};
  const nextParentInfo = nextProps.parentInfo || {};
  
  // Check if childDisplay value changed
  if (prevParentInfo.childDisplay !== nextParentInfo.childDisplay) {
    return false;
  }
  
  // Check if childClass value changed
  if (prevParentInfo.childClass !== nextParentInfo.childClass) {
    return false;
  }
  
  // Check if childIndex value changed (used for ordered lists)
  if (prevParentInfo.childIndex !== nextParentInfo.childIndex) {
    return false;
  }
  
  // Props are equal, skip re-render
  return true;
}

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
