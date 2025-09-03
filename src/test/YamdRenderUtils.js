import React from 'react';

/**
 * Centralized bullet dimensions configuration
 * These values are used directly in inline styles for guaranteed consistency
 */
import { BULLET_DIMENSIONS, LIST_INDENT } from './YamdRenderSettings.js';

// Re-export for backward compatibility
export { BULLET_DIMENSIONS, LIST_INDENT };

/**
 * Utility function to render bullet inline for components that need precise control
 * @param {object} parentInfo - Parent context information
 * @returns {JSX.Element|null} - Bullet element or null
 */
export const renderYamdListBullet = ({parentInfo, alignBullet = 'center'}) => {
  // used by AddListBulletBeforeYamdNode
  const childDisplay = parentInfo?.childDisplay;
  const childIndex = parentInfo?.childIndex;
  
  if (childDisplay === 'ul') {
    return (
      <div style={{ 
        flexShrink: 0,
        width: BULLET_DIMENSIONS.width,
        height: BULLET_DIMENSIONS.height,
        alignSelf: alignBullet,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: '0px'
      }}>
        <div className="yamd-bullet-disc"></div>
      </div>
    );
  } else if (childDisplay === 'ol') {
    return (
      <div style={{ 
        flexShrink: 0,
        width: BULLET_DIMENSIONS.width,
        height: BULLET_DIMENSIONS.height,
        alignSelf: alignBullet,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: '0px'
      }}>
        <span className="yamd-bullet-number">{(childIndex || 0) + 1}.</span>
      </div>
    );
  }
  
  return null;
};

/**
 * Get children display mode for a node
 * @param {object} nodeData - The node data
 * @param {boolean} isRoot - Whether this is the root node
 * @returns {string} - Children display mode
 */
export const getChildrenDisplay = (nodeData, isRoot = false, parentInfo = {}) => {
  // If node explicitly specifies childDisplay, use it
  if (nodeData.attr?.childDisplay) {
    return nodeData.attr.childDisplay;
  }
  
  // Otherwise use default based on node type and context
  return getChildrenDefaultDisplay(nodeData, isRoot, parentInfo);
};

/**
 * Get default children display mode based on node type and context
 * @param {object} nodeData - The node data
 * @param {boolean} isRoot - Whether this is the root node
 * @param {object} parentInfo - Parent context information
 * @returns {string} - Default children display mode
 */
export const getChildrenDefaultDisplay = (nodeData, isRoot = false, parentInfo = {}) => {
  // Special handling for root node
  if (isRoot) {
    return 'ul';  // Root nodes default to unordered list
  }
  
  // Inherit from parent if parent has childDisplay set to ul
  if (parentInfo?.childDisplay === 'ul' || parentInfo?.childDisplay === 'unordered-list') {
    return 'ul';
  }
  if (parentInfo?.childDisplay === 'ol' || parentInfo?.childDisplay === 'ordered-list') {
    return 'ol';
  }
  if (parentInfo?.childDisplay === 'p' || parentInfo?.childDisplay === 'paragraph-list') {
    return 'p';
  }
  
  // Default based on selfDisplay type
  const selfDisplay = nodeData.attr?.selfDisplay;
  switch (selfDisplay) {
    case 'timeline':
      return 'ul';  // Timeline children default to ul instead of pl
    case 'divider':
      return 'ul';  // Divider children commonly use lists
    case 'panel':
      return 'ul';  // Panel children default to plain list
    case 'key':
      return 'pl';  // Key children default to plain list
    default:
      return 'pl';  // General default is plain list
  }
};

/**
 * Inject additional properties into parentInfo object
 * @param {object} parentInfo - Original parent context information
 * @param {object} additionalProps - Additional properties to inject
 * @returns {object} - Enhanced parentInfo object
 */
const injectIntoParentInfo = (parentInfo, additionalProps) => {
  return {
    ...parentInfo,
    ...additionalProps
  };
};

/**
 * Component to add bullet before a YamdNode if required by parentInfo
 * @param {React.ReactNode} childNode - The single YamdNode component to wrap
 * @param {string} alignBullet - Bullet alignment ('center', 'flex-start', etc.)
 * @returns {JSX.Element} - Wrapped component with bullet if needed
 */
export const AddListBulletBeforeYamdNode = ({ childNode, alignBullet = 'center' }) => {
  // a wrapper for adding list bullet before the node, if it is an element of ul/ol
  // inject into childNode's parentInfo a callback function, to allow child node
  // to notify its preferred bullet Y position
  
  // extract parentInfo from childNode props
  const parentInfo = childNode.props.parentInfo;
  const shouldRenderBullet = parentInfo?.childDisplay === 'ul' || parentInfo?.childDisplay === 'ol';
  
  if (!shouldRenderBullet) {
    return childNode;
  }

  // state to track if child has notified preferred bullet Y position
  const [hasFirstChildNotifiedPreferredBulletYPos, setHasFirstChildNotifiedPreferredBulletYPos] = React.useState(false);
  const [preferredBulletYPos, setPreferredBulletYPos] = React.useState(0);

  // callback function for child to notify preferred bullet Y position
  const notifyPreferredBulletYPos = React.useCallback((yPos) => {
    setPreferredBulletYPos(yPos);
    setHasFirstChildNotifiedPreferredBulletYPos(true);
  }, []);

  // create enhanced parentInfo with bullet notification callback
  const childParentInfo = injectIntoParentInfo(parentInfo, {
    hasBulletToLeft: true,
    notifyPreferredBulletYPos
  });

  // Clone childNode and inject enhanced parentInfo - stable identity
  const enhancedChildNode = React.cloneElement(childNode, {
    parentInfo: childParentInfo
  });

  // Default positioning branch (put first)
  if (!hasFirstChildNotifiedPreferredBulletYPos) {
    const bulletElement = renderYamdListBullet({parentInfo, alignBullet});

    return (
      <div className="yamd-bullet-container" style={{ display: 'flex', alignItems: 'flex-start' }}>
        {bulletElement}
        <div style={{ flex: 1 }}>
          {enhancedChildNode}
        </div>
      </div>
    );
  } else {
    // Custom positioning branch
    // allow child node to notify its preffered bullet Y position
    const bulletElement = renderYamdListBullet({parentInfo, alignBullet: 'flex-start'});
    
    return (
      <div className="yamd-bullet-container" style={{ display: 'flex', alignItems: 'flex-start' }}>
        <div style={{ 
          position: 'relative',
          width: BULLET_DIMENSIONS.width, // Same width as normal bullet
          height: BULLET_DIMENSIONS.height, // Same height as normal bullet for layout calculation
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'center'
        }}>
          <div style={{
            position: 'absolute',
            top: `${preferredBulletYPos}px`,
            left: '50%',
            transform: 'translate(-50%, -50%)' // Center both horizontally and vertically on preferred position
          }}>
            {bulletElement}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          {enhancedChildNode}
        </div>
      </div>
    );
  }
};

/**
 * Component to add bullet before YamdRichText if required by parentInfo
 * Alias for AddListBulletBeforeYamdNode with text-appropriate defaults
 * @param {React.ReactNode} childNode - The YamdRichText component to wrap
 * @returns {JSX.Element} - Wrapped component with bullet if needed
 */
export const AddListBulletBeforeYamdText = ({ childNode }) => {
  // Text content typically aligns better with flex-start
  return AddListBulletBeforeYamdNode({ childNode, alignBullet: 'flex-start' });
};
