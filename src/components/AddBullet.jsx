import React from 'react';
import { useYamdDocStore } from '../YamdDocStore.js';
import { BULLET_DIMENSIONS } from '../YamdRenderSettings.js';

/**
 * Utility function to render bullet inline for components that need precise control
 * @param {object} parentInfo - Parent context information
 * @returns {JSX.Element|null} - Bullet element or null
 */
export const renderYamdListBullet = ({parentInfo, alignBullet = 'center'}) => {
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
export const AddListBulletBeforeYamdNode = React.memo(({ childNode, alignBullet = 'center' }) => {
  // Extract props from childNode
  const parentInfo = childNode?.props?.parentInfo;
  const globalInfo = childNode?.props?.globalInfo;
  const childId = childNode?.props?.nodeId;
  // Check if we should render bullet
  let shouldRenderBullet = parentInfo?.childDisplay === 'ul' || parentInfo?.childDisplay === 'ol';
  
  if(parentInfo?.childDisplay === 'timeline') {
    // AddTimelineBulletBeforeYamdNode --> YamdNodeText --> AddListBulletBeforeYamdText --> YamdRichText
    shouldRenderBullet = false; // already rendered by AddTimelineBulletBeforeYamdNode
    // For timeline children, just pass through without adding list bullets
    // The timeline bullet is already handled by AddTimelineBulletBeforeYamdNode
    return childNode; // Just render childNode without bullet
  }

  if (!shouldRenderBullet) {
    return childNode; // Just render childNode without bullet
  }

  // Get docId from parentInfo or container
  const docId = parentInfo?.docId || document.querySelector('[data-doc-id]')?.getAttribute('data-doc-id');
  const nodeId = childId;
  const containerClassName = '.yamd-bullet-container';
  
  // Set up request when component mounts
  React.useEffect(() => {
    if (nodeId && docId) {
      const store = useYamdDocStore.getState();
      // Add request to store
      store.addListBulletPreferredYPosRequest(docId, nodeId, containerClassName);
      
      // Increment request counter to notify the node
      store.incrementRequestCounter(docId, nodeId, containerClassName);
    }
  }, [nodeId, docId, containerClassName]);

  // Subscribe to result changes with custom equality function
  const [result, setResult] = React.useState(null);
  
  React.useEffect(() => {
    if (!nodeId || !docId) return;
    
    // subscribe to changes in the result with proper equality function
    const unsubscribe = useYamdDocStore.subscribe(
      (state) => state.listBulletPreferredYPosRequests[docId]?.[nodeId]?.[containerClassName]?.result,
      (newResult) => {
        if (newResult !== undefined) {
          setResult(newResult);
        }
      }
    );
    
    // Get initial value
    const store = useYamdDocStore.getState();
    const initialRequests = store.getPreferredYPosRequests(docId, nodeId);
    const initialRequest = initialRequests[containerClassName];
    setResult(initialRequest?.result || null);
    
    return unsubscribe;
  }, [nodeId, docId, containerClassName]);

  // State to track if child has notified preferred bullet Y position
  const [hasFirstChildNotifiedPreferredBulletYPos, setHasFirstChildNotifiedPreferredBulletYPos] = React.useState(false);
  const [preferredBulletYPos, setPreferredBulletYPos] = React.useState(0);

  // Callback function for child to notify preferred bullet Y position
  const notifyPreferredBulletYPos = React.useCallback((yPos) => {
    setPreferredBulletYPos(yPos);
    setHasFirstChildNotifiedPreferredBulletYPos(true);
  }, []);

  // Create enhanced parentInfo with bullet notification callback
  const childParentInfo = React.useMemo(() => injectIntoParentInfo(parentInfo, {
    hasBulletToLeft: true,
    notifyPreferredBulletYPos,
    bulletContainerClassName: '.yamd-bullet-container'
  }), [parentInfo, notifyPreferredBulletYPos]);

  // Clone childNode with enhanced parentInfo
  const enhancedChildNode = React.cloneElement(childNode, {
    ...childNode.props,
    parentInfo: childParentInfo,
  });

  // Use result from Zustand store if available, otherwise fall back to prop drilling
  const finalPreferredYPos = result?.data || preferredBulletYPos;
  const hasResult = result?.code === 0;

  // Default positioning branch (put first)
  if (!hasFirstChildNotifiedPreferredBulletYPos && !hasResult) {
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
    // Allow child node to notify its preferred bullet Y position
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
            top: `${finalPreferredYPos}px`,
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
});

/**
 * Component to add bullet before YamdRichText if required by parentInfo
 * Alias for AddListBulletBeforeYamdNode with text-appropriate defaults
 * @param {React.ReactElement} childNode - The child node component to render
 * @returns {JSX.Element} - Wrapped component with bullet if needed
 */
export const AddListBulletBeforeYamdText = React.memo(({ childNode }) => {
  // Text content typically aligns better with flex-start
  return <AddListBulletBeforeYamdNode childNode={childNode} alignBullet="flex-start" />;
});
