import React from 'react';

/**
 * Centralized bullet dimensions configuration
 * These values are used directly in inline styles for guaranteed consistency
 */
import { BULLET_DIMENSIONS, LIST_INDENT, TIMELINE_BULLET_DIMENSIONS } from './YamdRenderSettings.js';

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
      return 'ul';  // Panel children default to unordered list
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
  let shouldRenderBullet = parentInfo?.childDisplay === 'ul' || parentInfo?.childDisplay === 'ol';
  
  if(parentInfo?.childDisplay === 'timeline') {
    // AddTimelineBulletBeforeYamdNode --> YamdNodeText --> AddListBulletBeforeYamdText --> YamdRichText
    shouldRenderBullet = false; // already rendered by AddTimelineBulletBeforeYamdNode
    // For timeline children, just pass through without adding list bullets
    // The timeline bullet is already handled by AddTimelineBulletBeforeYamdNode
    return childNode;
  }

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
  const childParentInfo = React.useMemo(() => injectIntoParentInfo(parentInfo, {
    hasBulletToLeft: true,
    notifyPreferredBulletYPos,
    bulletContainerClassName: '.yamd-bullet-container'
  }), [parentInfo, notifyPreferredBulletYPos]);

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
        <div className="yamd-child-container">
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
          display: 'flex',
          flexShrink: 0,
          justifyContent: 'center',
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
        <div
          style={{ flex: 1, display: 'flex', maxWidth: '100%'}}
        >
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

/**
 * Get horizontal alignment strategy for content blocks (LaTeX, images, videos)
 * @param {object} nodeData - The node data containing attributes
 * @param {object} parentInfo - Parent context information
 * @returns {string} - CSS alignment value ('center', 'flex-start', 'flex-end')
 */
export const getAlignmentStrategy = (nodeData, parentInfo) => {
  // User-specified alignX takes highest priority
  if (nodeData.attr?.alignX === 'center') {
    return 'center';
  }
  if (nodeData.attr?.alignX === 'left') {
    return 'flex-start';
  }
  if (nodeData.attr?.alignX === 'right') {
    return 'flex-end';
  }
  
  // Context-based alignment strategy
  const parentChildDisplay = parentInfo?.childDisplay;
  if (parentChildDisplay === 'pl' || parentChildDisplay === 'plain-list' || parentChildDisplay === 'plain_list') {
    return 'center';  // Plain lists center their content
  }
  if (parentChildDisplay === 'ul' || parentChildDisplay === 'ol' || 
      parentChildDisplay === 'unordered-list' || parentChildDisplay === 'ordered-list') {
    return 'flex-start';  // Bulleted/numbered lists align to start
  }
  
  // Default to center
  return 'center';
};

/**
 * Bullet component registry for timeline
 */
const TIMELINE_BULLET_COMPONENTS = {
  'Check': () => (
    <div 
      className="yamd-timeline-bullet-check yamd-timeline-bullet-svg-container"
      style={{
        width: TIMELINE_BULLET_DIMENSIONS.bullet_width,
        height: TIMELINE_BULLET_DIMENSIONS.bullet_height
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20,6 9,17 4,12"/>
      </svg>
    </div>
  ),
  'Question': () => (
    <div 
      className="yamd-timeline-bullet-question yamd-timeline-bullet-svg-container"
      style={{
        width: TIMELINE_BULLET_DIMENSIONS.bullet_width,
        height: TIMELINE_BULLET_DIMENSIONS.bullet_height
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 12 12" fill="none">
        <circle cx="6" cy="6" r="5" fill="#dc2626" stroke="#b91c1c" strokeWidth="1"/>
        <text x="6" y="8.5" fontSize="8" fontWeight="bold" textAnchor="middle" fill="white">?</text>
      </svg>
    </div>
  ),
  'Dash': () => (
    <div 
      className="yamd-timeline-bullet-dash yamd-timeline-bullet-svg-container"
      style={{
        width: TIMELINE_BULLET_DIMENSIONS.bullet_width,
        height: TIMELINE_BULLET_DIMENSIONS.bullet_height
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 12 12" fill="none">
        <circle cx="6" cy="6" r="5" fill="#666" stroke="#555" strokeWidth="1"/>
        <line x1="3" y1="6" x2="9" y2="6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </div>
  ),
  'Screw': () => (
    <div 
      className="yamd-timeline-bullet-screw yamd-timeline-bullet-svg-container"
      style={{
        width: TIMELINE_BULLET_DIMENSIONS.bullet_width,
        height: TIMELINE_BULLET_DIMENSIONS.bullet_height
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
    </div>
  ),
  'UpArrow': () => (
    <div 
      className="yamd-timeline-bullet-up-arrow yamd-timeline-bullet-svg-container"
      style={{
        width: TIMELINE_BULLET_DIMENSIONS.bullet_width,
        height: TIMELINE_BULLET_DIMENSIONS.bullet_height
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 20 20" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 3 L4 9 L7 9 L7 17 L13 17 L13 9 L16 9 Z"/>
      </svg>
    </div>
  ),
  'default': () => (
    <div className="yamd-timeline-bullet-default"></div>
  )
};

/**
 * Render timeline bullet with proper dimensions
 * @param {string} bulletType - Type of bullet to render
 * @returns {JSX.Element} - Bullet element
 */
export const renderYamdTimelineBullet = (bulletType = 'default') => {
  const BulletComponent = TIMELINE_BULLET_COMPONENTS[bulletType] || TIMELINE_BULLET_COMPONENTS['default'];
  
  return (
    <div style={{
      width: TIMELINE_BULLET_DIMENSIONS.container_width,
      height: TIMELINE_BULLET_DIMENSIONS.container_height,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0
    }}>
      <BulletComponent />
    </div>
  );
};

/**
 * Component to add timeline bullet before a YamdNode with vertical line drawing
 * @param {React.ReactNode} childNode - The single YamdNode component to wrap
 * @param {string} bulletType - Type of bullet to render
 * @param {object} globalInfo - Global context information
 * @param {number} itemIndex - Index of this item in the timeline
 * @param {boolean} isLast - Whether this is the last item
 * @param {object} bulletRefs - Ref object to store bullet element references
 * @param {Array} lineHeights - Array of calculated line heights
 * @param {function} onBulletPositionChange - Callback to trigger line recalculation
 * @returns {JSX.Element} - Wrapped component with timeline bullet and line
 */
export const AddTimelineBulletBeforeYamdNode = ({ 
  childNode, 
  bulletType = 'default', 
  globalInfo, 
  itemIndex, 
  isLast, 
  bulletRefs, 
  lineHeights,
  onBulletPositionChange
}) => {
  // Extract parentInfo from childNode props
  const parentInfo = childNode.props.parentInfo;
  
  // Get bullet type from child node data if not specified
  let actualBulletType = bulletType;
  if (globalInfo?.getNodeDataById && childNode.props.nodeId) {
    const childNodeData = globalInfo.getNodeDataById(childNode.props.nodeId);
    if (childNodeData?.attr?.bullet) {
      actualBulletType = childNodeData.attr.bullet;
    }
  }

  // State to track if child has notified preferred bullet Y position
  const [hasFirstChildNotifiedPreferredBulletYPos, setHasFirstChildNotifiedPreferredBulletYPos] = React.useState(false);
  const [preferredBulletYPos, setPreferredBulletYPos] = React.useState(0);

  // Callback function for child to notify preferred bullet Y position
  const notifyPreferredBulletYPos = React.useCallback((yPos) => {
    const bulletHeight = parseInt(TIMELINE_BULLET_DIMENSIONS.bullet_height);
    const calculatedTop = yPos - (bulletHeight / 2);
    console.warn('Timeline parent received bullet position notification:', yPos, 'from child:', childNode.props.nodeId);
    console.warn('Bullet height:', bulletHeight, 'px, calculated top position:', calculatedTop, 'px');
    setPreferredBulletYPos(yPos);
    setHasFirstChildNotifiedPreferredBulletYPos(true);
    // Trigger line recalculation when bullet position changes
    if (onBulletPositionChange) {
      onBulletPositionChange();
    }
  }, []); // Remove onBulletPositionChange dependency to prevent infinite loops

  // Create enhanced parentInfo with bullet notification callback
  const childParentInfo = React.useMemo(() => ({
    ...parentInfo,
    hasBulletToLeft: true,
    notifyPreferredBulletYPos,
    bulletContainerClassName: '.yamd-timeline-item' // don't forget beginning with a dot
  }), [parentInfo, notifyPreferredBulletYPos]);

  // Clone childNode and inject enhanced parentInfo
  const enhancedChildNode = React.cloneElement(childNode, {
    parentInfo: childParentInfo
  });

  // Default positioning branch (put first)
  if (!hasFirstChildNotifiedPreferredBulletYPos) {
    return (
      <div className="yamd-timeline-item">
        
        {/* bullet container */}
        <div className="yamd-timeline-bullet-container">
          <div 
            ref={el => bulletRefs.current[itemIndex] = el}
            className="yamd-timeline-bullet-wrapper"
          >
            {renderYamdTimelineBullet(actualBulletType)}
            {!isLast && (
              <div 
                className="yamd-timeline-connect-line"
                style={{
                  top: `calc(50% + ${parseInt(TIMELINE_BULLET_DIMENSIONS.bullet_height) / 2}px + ${TIMELINE_BULLET_DIMENSIONS.connect_line_gap})`,
                  height: lineHeights[itemIndex] ? `${lineHeights[itemIndex]}px` : '20px'
                }}
              ></div>
            )}
          </div>
        </div>

        {/* content container */}
        <div className="yamd-timeline-content">
          {enhancedChildNode}
        </div>
      </div>
    );
  } else {
    // Custom positioning branch - allow child node to notify its preferred bullet Y position
    return (
      <div className="yamd-timeline-item">
        
        {/* bullet container */}
        <div className="yamd-timeline-bullet-container">
          <div 
            ref={el => bulletRefs.current[itemIndex] = el}
            className="yamd-timeline-bullet-wrapper"
            style={{ 
              position: 'relative',
              width: TIMELINE_BULLET_DIMENSIONS.container_width,
              height: TIMELINE_BULLET_DIMENSIONS.container_height,
              display: 'flex',
              flexShrink: 0,
              justifyContent: 'center',
            }}
          >
            <div style={{
              position: 'absolute',
              top: `${preferredBulletYPos - (parseInt(TIMELINE_BULLET_DIMENSIONS.bullet_height) / 2)}px`,
              left: '50%',
              transform: 'translateX(-50%)' // Only center horizontally
            }}>
              {renderYamdTimelineBullet(actualBulletType)}
            </div>
            {!isLast && (
              <div 
                className="yamd-timeline-connect-line"
                style={{
                  top: `calc(50% + ${parseInt(TIMELINE_BULLET_DIMENSIONS.bullet_height) / 2}px + ${TIMELINE_BULLET_DIMENSIONS.connect_line_gap})`,
                  height: lineHeights[itemIndex] ? `${lineHeights[itemIndex]}px` : '20px'
                }}
              ></div>
            )}
          </div>
        </div>

        {/* content container */}
        <div className="yamd-timeline-content">
          {enhancedChildNode}
        </div>
      </div>
    );
  }
};
