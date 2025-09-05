import React from 'react';

/**
 * Centralized bullet dimensions configuration
 * These values are used directly in inline styles for guaranteed consistency
 */
import { BULLET_DIMENSIONS, LIST_INDENT, TIMELINE_BULLET_DIMENSIONS } from './YamdRenderSettings.js';

// Re-export for backward compatibility
export { BULLET_DIMENSIONS, LIST_INDENT };
export {
  AddListBulletBeforeYamdNode,
  AddListBulletBeforeYamdText,
  renderYamdListBullet,
} from './components/AddBullet.jsx';

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
        height: TIMELINE_BULLET_DIMENSIONS.bullet_height,
        transform: `translate(-50%, -50%) scale(${parseInt(TIMELINE_BULLET_DIMENSIONS.bullet_width) / 12}, ${parseInt(TIMELINE_BULLET_DIMENSIONS.bullet_height) / 12})`
      }}
    >
      <svg className="yamd-timeline-bullet-svg" width="12px" height="12px"
        viewBox="0 0 12 12" fill="none">

        <circle cx="6" cy="6" r="5" fill="#4CAF50" stroke="#388E3C" strokeWidth="1"/>
        

        <path d="M3.5 6 L5.2 7.7 L8.5 4.2" 
              stroke="white" 
              strokeWidth="1.2" 
              strokeLinecap="round" 
              strokeLinejoin="round"/>
      </svg>
    </div>
  ),
  'Question': () => (
    <div 
      className="yamd-timeline-bullet-question yamd-timeline-bullet-svg-container"
      style={{
        width: TIMELINE_BULLET_DIMENSIONS.bullet_width,
        height: TIMELINE_BULLET_DIMENSIONS.bullet_height,
        transform: `translate(-50%, -50%) scale(${parseInt(TIMELINE_BULLET_DIMENSIONS.bullet_width) / 12}, ${parseInt(TIMELINE_BULLET_DIMENSIONS.bullet_height) / 12})`
      }}
    >
      <svg className="yamd-timeline-bullet-svg" width="12px" height="12px"
      viewBox="0 0 12 12" fill="none">
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
        height: TIMELINE_BULLET_DIMENSIONS.bullet_height,
        transform: `translate(-50%, -50%) scale(${parseInt(TIMELINE_BULLET_DIMENSIONS.bullet_width) / 12}, ${parseInt(TIMELINE_BULLET_DIMENSIONS.bullet_height) / 12})`
      }}
    >
      <svg className="yamd-timeline-bullet-svg" width="12px" height="12px"
      viewBox="0 0 12 12" fill="none">
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
        height: TIMELINE_BULLET_DIMENSIONS.bullet_height,
        transform: `translate(-50%, -50%) scale(${parseInt(TIMELINE_BULLET_DIMENSIONS.bullet_width) / 12}, ${parseInt(TIMELINE_BULLET_DIMENSIONS.bullet_height) / 12})`
      }}
    >
      <svg className="yamd-timeline-bullet-svg" width="12px" height="12px"
      viewBox="0 0 12 12" fill="none" stroke="#555" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7.35 3.15a0.5 0.5 0 0 0 0 0.7l0.8 0.8a0.5 0.5 0 0 0 0.7 0l1.885-1.885a3 3 0 0 1-3.97 3.97l-3.455 3.455a1.06 1.06 0 0 1-1.5-1.5l3.455-3.455a3 3 0 0 1 3.97-3.97l-1.88 1.88z"/>
      </svg>
    </div>
  ),
  'UpArrow': () => (
    <div 
      className="yamd-timeline-bullet-up-arrow yamd-timeline-bullet-svg-container"
      style={{
        width: TIMELINE_BULLET_DIMENSIONS.bullet_width,
        height: TIMELINE_BULLET_DIMENSIONS.bullet_height,
        transform: `translate(-50%, -50%) scale(${parseInt(TIMELINE_BULLET_DIMENSIONS.bullet_width) / 12}, ${parseInt(TIMELINE_BULLET_DIMENSIONS.bullet_height) / 12})`
      }}
    >
      <svg className="yamd-timeline-bullet-svg" width="12px" height="12px" viewBox="0 0 12 12" fill="none" stroke="#555" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 1.8 L2.4 5.4 L4.2 5.4 L4.2 10.2 L7.8 10.2 L7.8 5.4 L9.6 5.4 Z"/>
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
export const AddTimelineBulletBeforeYamdNode = React.memo(({ 
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
    setPreferredBulletYPos(prev => {
      // Only update if the value actually changed to prevent unnecessary re-renders
      if (prev !== yPos) {
        setHasFirstChildNotifiedPreferredBulletYPos(true);
        return yPos;
      }
      return prev;
    });
  }, []); // Empty dependency array is correct - we use functional updates

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
            style={{
              position: 'relative',
            }}
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
    console.log('childId:', childNode.props.nodeId);
    console.log('preferredBulletYPos', preferredBulletYPos);
    console.log('TIMELINE_BULLET_DIMENSIONS.container_height', TIMELINE_BULLET_DIMENSIONS.container_height);
    // Custom positioning branch - allow child node to notify its preferred bullet Y position
    return (
      <div className="yamd-timeline-item" style={{position: 'relative'}}>
        
        {/* bullet container */}
        <div className="yamd-timeline-bullet-container"
          style={{
          }}
        >
          <div 
            ref={el => bulletRefs.current[itemIndex] = el}
            className="yamd-timeline-bullet-wrapper"
            style={{ 
              position: 'relative',
              width: TIMELINE_BULLET_DIMENSIONS.container_width,
              height: TIMELINE_BULLET_DIMENSIONS.container_height,
              // top: `${preferredBulletYPos - (parseInt(TIMELINE_BULLET_DIMENSIONS.container_height) / 2)}px`,
              top: `${preferredBulletYPos - (parseInt(TIMELINE_BULLET_DIMENSIONS.container_height) / 2)}px`,
              display: 'flex',
              flexShrink: 0,
              justifyContent: 'center',
            }}
          >
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              // transform: 'translateX(-50%)' // Only center horizontally
              transform: 'translate(-50%, -50%)'
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
});
