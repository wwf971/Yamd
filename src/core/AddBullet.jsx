import React from 'react';
import { BULLET_DIMENSIONS, LIST_SETTINGS } from '@/config/RenderConfig.js';
import { formatYPos, useRenderUtilsContext } from './RenderUtils.ts';
import { docsBulletState, nodeBulletState } from './DocStore.js';

/**
 * Utility function to render bullet inline for components that need precise control
 * @param {object} parentInfo - Parent context information
 * @returns {JSX.Element|null} - Bullet element or null
 */
export const renderListBullet = ({parentInfo}) => {
  const childDisplay = parentInfo?.childDisplay;
  const childIndex = parentInfo?.childIndex;
  
  if (childDisplay === 'ul') {
    return (
      <div 
        contentEditable={false}
        style={{ 
          flexShrink: 0,
          width: BULLET_DIMENSIONS.width,
          height: BULLET_DIMENSIONS.height,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: '0px'
        }}
      >
        <div className="yamd-bullet-disc"></div>
      </div>
    );
  } else if (childDisplay === 'ol') {
    return (
      <div 
        contentEditable={false}
        style={{ 
          flexShrink: 0,
          width: BULLET_DIMENSIONS.width,
          height: BULLET_DIMENSIONS.height,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: '0px'
        }}
      >
        <span className="yamd-bullet-number">{(childIndex || 0) + 1}.</span>
      </div>
    );
  }
  
  return null;
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
 * @param {React.ReactElement} childNode - The child node component to render
 * @param {string} alignBullet - Bullet alignment ('center', 'flex-start', etc.)
 * @returns {JSX.Element} - Wrapped component with bullet if needed
 */
export const AddListBulletBeforeNode = React.memo(({ childNode, children }) => {
  const resolvedChild = childNode ?? (React.Children.count(children) === 1 ? React.Children.only(children) : null);
  if (!React.isValidElement(resolvedChild)) {
    return null;
  }
  
  // Extract props from child node
  const parentInfo = resolvedChild?.props?.parentInfo;
  const globalInfo = resolvedChild?.props?.globalInfo;
  const childId = resolvedChild?.props?.nodeId;
  
  // Check if we should render bullet
  let shouldRenderBullet = parentInfo?.childDisplay === 'ul' || parentInfo?.childDisplay === 'ol';
  
  // Timeline check
  const isTimeline = parentInfo?.childDisplay === 'timeline';
  if(isTimeline) {
    shouldRenderBullet = false;
  }

  // Get docId from globalInfo (not parentInfo)
  const docId = globalInfo?.docId;
  const nodeId = childId;
  const containerClassName = '.yamd-bullet-container';
  // Get render utils from context
  const renderUtils = useRenderUtilsContext();
  // Get width attribute from child node data
  let listItemWidth = 'max'; // default value
  if (nodeId) {
    const childNodeData = renderUtils.getNodeDataById(nodeId);
    if (childNodeData?.attr?.width) {
      listItemWidth = childNodeData.attr.width;
    }
  }
  
  // Add bullet positioning request when component mounts
  // Use useLayoutEffect to ensure request is added before sibling useEffect hooks run
  React.useLayoutEffect(() => {
    if (!shouldRenderBullet || !nodeId || !docId) return;
    
    // Register and request initial calculation using Jotai
    nodeBulletState.registerBulletYPosReq(docId, nodeId, containerClassName);
    nodeBulletState.reqCalcBulletYPos(docId, nodeId, containerClassName);
  }, [shouldRenderBullet, nodeId, docId, containerClassName]);

  // Subscribe to results (only changes when result changes, not reqCounter)
  // IMPORTANT: Always call the hook (Rules of Hooks), but only use result if shouldRenderBullet
  const results = docsBulletState.useResults(docId, nodeId);
  
  // Extract result for this specific container (only use if shouldRenderBullet)
  const result = (shouldRenderBullet && nodeId && docId) ? results?.[containerClassName] : undefined;

  // create enhanced parentInfo with bullet info (no callback needed for Zustand-only approach)
  const childParentInfo = React.useMemo(() => injectIntoParentInfo(parentInfo, {
    hasBulletToLeft: true,
    bulletContainerClassName: '.yamd-bullet-container'
  }), [parentInfo]);

  // clone childNode with enhanced parentInfo
  const enhancedChildNode = React.cloneElement(resolvedChild, {
    ...resolvedChild.props,
    parentInfo: childParentInfo,
  });

  // AFTER all hooks, check if we should render bullet
  if (!shouldRenderBullet) {
    return resolvedChild; // Just render child node without bullet
  }

  // Use Jotai result for positioning, fallback to default if no result
  const hasResult = result?.code === 0;
  const finalPreferredYPos = hasResult ? result.data : LIST_SETTINGS.bullet_y_pos_default;


  // Always use positioned rendering - simplified single branch
  const bulletEl = renderListBullet({parentInfo});
  
  return (
    <div className="yamd-bullet-container" style={{ display: 'flex', alignItems: 'flex-start' }}>
      <div style={{ 
        position: 'relative',
        width: BULLET_DIMENSIONS.width, // same width as normal bullet
        height: BULLET_DIMENSIONS.height, // same height as normal bullet for layout calculation
        display: 'flex',
        flexShrink: 0,
        justifyContent: 'center',
      }}>
        <div style={{
          position: 'absolute',
          top: formatYPos(finalPreferredYPos),
          left: '50%',
          transform: 'translate(-50%, -50%)' // center both horizontally and vertically on preferred position
        }}>
          {bulletEl}
        </div>
      </div>
      <div
        style={{ flex: 1, display: 'flex', maxWidth: '100%'}}
      >
        <div style={{ 
          marginLeft: BULLET_DIMENSIONS.content_offset_x,
          ...(listItemWidth === 'max' ? { width: '100%' } : {}),
          ...(listItemWidth === 'min' ? { width: 'fit-content' } : {})
        }}>
          {enhancedChildNode}
        </div>
      </div>
    </div>
  );
});

