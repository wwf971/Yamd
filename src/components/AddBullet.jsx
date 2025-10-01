import React from 'react';
import { useYamdDocStore } from '../YamdDocStore.js';
import { BULLET_DIMENSIONS, LIST_SETTINGS } from '../YamdRenderSettings.js';
import { formatYPosition } from '../YamdRenderUtils.js';

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
    // AddTimelineBulletBeforeYamdNode --> YamdNodeText (now wrapped by AddListBulletBeforeYamdNode in YamdNode.jsx)
    shouldRenderBullet = false; // already rendered by AddTimelineBulletBeforeYamdNode
    // for timeline children, just pass through without adding list bullets
    // the timeline bullet is already handled by AddTimelineBulletBeforeYamdNode
    return childNode; // Just render childNode without bullet
  }

  if (!shouldRenderBullet) {
    return childNode; // Just render childNode without bullet
  }

  // Get docId from globalInfo (not parentInfo)
  const docId = globalInfo?.docId;
  const nodeId = childId;
  const containerClassName = '.yamd-bullet-container';
  
  // set up request when component mounts
  React.useEffect(() => {
    // console.log('noteId:', nodeId, 'AddListBulletBeforeYamdNode useEffect docId:', docId);
    if (!nodeId || !docId) {
      console.warn('noteId:', nodeId, 'docId:', docId, 'AddListBulletBeforeYamdNode useEffect skipped');
      return; 
    }
    const store = useYamdDocStore.getState();
    // add request to store
    store.addBulletPreferredYPosRequest(docId, nodeId, containerClassName);
    // console.log('noteId:', nodeId, 'AddListBulletBeforeYamdNode useEffect addBulletPreferredYPosRequest');
    // increment request counter to notify the node
    store.incRequestCounter(docId, nodeId, containerClassName);
    // console.log('noteId:', nodeId, 'AddListBincRequestCounter request:', store.getPreferredYPosRequests(docId, nodeId)[containerClassName]);
  }, [nodeId, docId, containerClassName]);

  // subscribe to result changes with custom equality function
  const [result, setResult] = React.useState(null);
  
  React.useEffect(() => {
    if (!nodeId || !docId) return;
    // subscribe to changes in the result with proper equality function
    const unsubscribe = useYamdDocStore.subscribe(
      (state) => state.bulletPreferredYPosRequests[docId]?.[nodeId]?.[containerClassName]?.responseCounter,
      (responseCounter) => {
        const result = store.getPreferredYPosRequests(docId, nodeId)[containerClassName];
        console.log('noteId:', nodeId, 'AddListBulletBeforeYamdNode useEffect responseCounter:', responseCounter, 'result:', result);
        setResult(result);
      }
    );

    // get initial value
    const store = useYamdDocStore.getState();
    const initialRequests = store.getPreferredYPosRequests(docId, nodeId);
    const initialRequest = initialRequests[containerClassName];
    setResult(initialRequest?.result || null);
    
    return unsubscribe;
  }, [nodeId, docId, containerClassName]);

  // create enhanced parentInfo with bullet info (no callback needed for Zustand-only approach)
  const childParentInfo = React.useMemo(() => injectIntoParentInfo(parentInfo, {
    hasBulletToLeft: true,
    bulletContainerClassName: '.yamd-bullet-container'
  }), [parentInfo]);

  // clone childNode with enhanced parentInfo
  const enhancedChildNode = React.cloneElement(childNode, {
    ...childNode.props,
    parentInfo: childParentInfo,
  });

  // Use Zustand result for positioning, fallback to default if no result
  const hasResult = result?.code === 0;
  const finalPreferredYPos = hasResult ? result.data : LIST_SETTINGS.bullet_y_pos_default;

  // Always use positioned rendering - simplified single branch
  const bulletElement = renderYamdListBullet({parentInfo, alignBullet: 'flex-start'});
  
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
          top: formatYPosition(finalPreferredYPos),
          left: '50%',
          transform: 'translate(-50%, -50%)' // center both horizontally and vertically on preferred position
        }}>
          {bulletElement}
        </div>
      </div>
      <div
        style={{ flex: 1, display: 'flex', maxWidth: '100%'}}
      >
        <div style={{ marginLeft: BULLET_DIMENSIONS.content_offset_x }}>
          {enhancedChildNode}
        </div>
      </div>
    </div>
  );
});

