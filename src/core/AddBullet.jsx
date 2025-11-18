import React from 'react';
import { BULLET_DIMENSIONS, LIST_SETTINGS } from '@/config/RenderConfig.js';
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
  
  console.log('🔍 AddBullet rendering nodeId:', childId, 'parentInfo.childDisplay:', parentInfo?.childDisplay);
  
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
  
  // Get width attribute from child node data
  let listItemWidth = 'max'; // default value
  if (globalInfo?.getNodeDataById && nodeId) {
    const childNodeData = globalInfo.getNodeDataById(nodeId);
    if (childNodeData?.attr?.width) {
      listItemWidth = childNodeData.attr.width;
    }
  }
  
  // IMPORTANT: All hooks must be called before any conditional returns!
  // Set up request when component mounts
  // Use useLayoutEffect to ensure request is added before sibling useEffect hooks run
  React.useLayoutEffect(() => {
    console.log('🔍 AddBullet useLayoutEffect nodeId:', nodeId, 'shouldRenderBullet:', shouldRenderBullet, 'docId:', docId);
    // Only add request if we should render bullet
    if (!shouldRenderBullet) return;
    // console.log('noteId:', nodeId, 'AddListBulletBeforeYamdNode useLayoutEffect docId:', docId);
    if (!nodeId || !docId) {
      console.warn('noteId:', nodeId, 'docId:', docId, 'AddListBulletBeforeYamdNode useLayoutEffect skipped');
      return; 
    }
    console.log('✅ AddBullet ADDING REQUEST nodeId:', nodeId);
    const store = globalInfo.getDocStore().getState();
    // add request to store
    store.addBulletYPosReq(docId, nodeId, containerClassName);
    // console.log('noteId:', nodeId, 'AddListBulletBeforeYamdNode useLayoutEffect addBulletYPosReq');
    // increment request counter to notify the node
    store.incReqCounter(docId, nodeId, containerClassName);
    // console.log('noteId:', nodeId, 'AddListBincReqCounter request:', store.getBulletYPosReqs(docId, nodeId)[containerClassName]);
  }, [shouldRenderBullet, nodeId, docId, containerClassName, globalInfo]);

  // subscribe to result changes with custom equality function
  const [result, setResult] = React.useState(null);
  
  React.useEffect(() => {
    // Only subscribe if we should render bullet
    if (!shouldRenderBullet || !nodeId || !docId) return;
    // subscribe to changes in the result with proper equality function
    const unsubscribe = globalInfo.getDocStore().subscribe(
      (state) => state.bulletPreferredYPosReq[docId]?.[nodeId]?.[containerClassName]?.responseCounter,
      (responseCounter) => {
        const store = globalInfo.getDocStore().getState();
        const result = store.getBulletYPosReqs(docId, nodeId)[containerClassName];
        console.log('noteId:', nodeId, 'AddListBulletBeforeYamdNode useEffect responseCounter:', responseCounter, 'result:', result);
        setResult(result);
      }
    );

    // get initial value
    const store = globalInfo.getDocStore().getState();
    const initialRequests = store.getBulletYPosReqs(docId, nodeId);
    const initialRequest = initialRequests[containerClassName];
    setResult(initialRequest?.result || null);
    
    return unsubscribe;
  }, [shouldRenderBullet, nodeId, docId, containerClassName, globalInfo]);

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

  // AFTER all hooks, check if we should render bullet
  if (!shouldRenderBullet) {
    return childNode; // Just render childNode without bullet
  }

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

