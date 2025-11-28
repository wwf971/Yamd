import React from 'react';
import { TIMELINE_BULLET_SETTINGS, BULLET_DIMENSIONS } from '@/config/RenderConfig.js';
import { useRenderUtilsContext } from '@/core/RenderUtils.ts';
import { formatYPos } from '@/core/RenderUtils.ts';
import { docsBulletState, nodeBulletState } from '@/core/DocStore.js';

/**
 * Bullet component registry for timeline
 */
export const TIMELINE_BULLET_COMPONENTS = {
  'Check': () => (
    <div 
      className="yamd-timeline-bullet-check yamd-timeline-bullet-svg-container"
      style={{
        width: TIMELINE_BULLET_SETTINGS.bullet_width,
        height: TIMELINE_BULLET_SETTINGS.bullet_height,
        transform: `translate(-50%, -50%) scale(${parseInt(TIMELINE_BULLET_SETTINGS.bullet_width) / 12}, ${parseInt(TIMELINE_BULLET_SETTINGS.bullet_height) / 12})`
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
        width: TIMELINE_BULLET_SETTINGS.bullet_width,
        height: TIMELINE_BULLET_SETTINGS.bullet_height,
        transform: `translate(-50%, -50%) scale(${parseInt(TIMELINE_BULLET_SETTINGS.bullet_width) / 12}, ${parseInt(TIMELINE_BULLET_SETTINGS.bullet_height) / 12})`
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
        width: TIMELINE_BULLET_SETTINGS.bullet_width,
        height: TIMELINE_BULLET_SETTINGS.bullet_height,
        transform: `translate(-50%, -50%) scale(${parseInt(TIMELINE_BULLET_SETTINGS.bullet_width) / 12}, ${parseInt(TIMELINE_BULLET_SETTINGS.bullet_height) / 12})`
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
        width: TIMELINE_BULLET_SETTINGS.bullet_width,
        height: TIMELINE_BULLET_SETTINGS.bullet_height,
        transform: `translate(-50%, -50%) scale(${parseInt(TIMELINE_BULLET_SETTINGS.bullet_width) / 12}, ${parseInt(TIMELINE_BULLET_SETTINGS.bullet_height) / 12})`
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
        width: TIMELINE_BULLET_SETTINGS.bullet_width,
        height: TIMELINE_BULLET_SETTINGS.bullet_height,
        transform: `translate(-50%, -50%) scale(${parseInt(TIMELINE_BULLET_SETTINGS.bullet_width) / 12}, ${parseInt(TIMELINE_BULLET_SETTINGS.bullet_height) / 12})`
      }}
    >
      <svg
        className="yamd-timeline-bullet-svg"
        width="12px"
        height="12px"
        viewBox="0 0 12 12"
        fill="none"
        stroke="#555"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* background circle */}
        <circle cx="6" cy="6" r="5.5" fill="#93c5fd" stroke="none" />

        {/* foreground path */}
        <path d="M6 1.8 L2.4 5.4 L4.2 5.4 L4.2 10.2 L7.8 10.2 L7.8 5.4 L9.6 5.4 Z" fill="#ffffff"/>
      </svg>
    </div>
  ),
  'default': () => (
    <div className="yamd-timeline-bullet-default"></div>
  )
};

/**
 * Render timeline bullet with given type
 * @param {string} bulletType - Type of bullet to render
 * @returns {JSX.Element} - Bullet element
 */
export const renderYamdTimelineBullet = (bulletType = 'default') => {
  const BulletComponent = TIMELINE_BULLET_COMPONENTS[bulletType] || TIMELINE_BULLET_COMPONENTS['default'];
  
  return (
    <div style={{
      width: TIMELINE_BULLET_SETTINGS.container_width,
      height: TIMELINE_BULLET_SETTINGS.container_height,
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
 * Calculate line heights for timeline connecting lines
 * @param {React.RefObject} bulletRefs - Ref object containing bullet element references
 * @returns {Array} Array of calculated line heights
 */
export const calcConnectLineHeights = (bulletRefs) => {
  if (bulletRefs.current.length === 0) return [];
  
  const heights = [];
  const connectLineGap = parseInt(TIMELINE_BULLET_SETTINGS.connect_line_gap) || 2;
  
  for (let i = 0; i < bulletRefs.current.length - 1; i++) {
    const currentBulletSvg = bulletRefs.current[i]; // Current SVG element
    const nextBulletSvg = bulletRefs.current[i + 1]; // Next SVG element
    
    if (currentBulletSvg && nextBulletSvg) {
      const currentSvgRect = currentBulletSvg.getBoundingClientRect();
      const nextSvgRect = nextBulletSvg.getBoundingClientRect();
      
      if (!isNaN(currentSvgRect.bottom) && !isNaN(nextSvgRect.top) && 
          currentSvgRect.bottom !== 0 && nextSvgRect.top !== 0) {
        
        // Line starts from bottom of current SVG + gap
        // Line ends at top of next SVG - gap
        const lineStartY = currentSvgRect.bottom + connectLineGap;
        const lineEndY = nextSvgRect.top - connectLineGap;
        const lineHeight = lineEndY - lineStartY;
        
        // console.log(`Line ${i}: currentSvgBottom=${currentSvgRect.bottom}, nextSvgTop=${nextSvgRect.top}, lineHeight=${lineHeight}`);
        heights.push(Math.max(lineHeight, 8)); // Use minimum height of 8px
      } else {
        // console.log(`Line ${i}: Invalid SVG bounding rects - using fallback height`);
        heights.push(20); // Fallback height
      }
    } else {
      // console.log(`Line ${i}: Missing current or next bullet SVG - using fallback height`);
      heights.push(20); // Fallback for missing bullets
    }
  }
  
  return heights;
};

/**
 * Component to add timeline bullet before a YamdNode using Zustand positioning
 * @param {React.ReactNode} childNode - The single YamdNode component to wrap
 * @param {string} bulletType - Type of bullet to render
 * @param {object} globalInfo - Global context information
 * @param {number} itemIndex - Index of this item in the timeline
 * @param {boolean} isLast - Whether this is the last item
 * @param {object} bulletRefs - Ref object to store bullet element references
 * @param {Array} lineHeights - Array of calculated line heights
 * @param {function} onBulletYPosChange - Callback to trigger line recalculation
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
  onBulletYPosChange,
  onContentHeightChange
}) => {
  // Get render utils from context
  const renderUtils = useRenderUtilsContext();
  const docStore = renderUtils.docStore;
  const docId = renderUtils.docId;
  
  // Extract parentInfo from childNode props
  const parentInfo = childNode.props.parentInfo;
  const nodeId = childNode.props.nodeId;
  const containerClassName = '.yamd-timeline-item';
  
  // Get bullet type and width from child node data if not specified
  let actualBulletType = bulletType;
  let timelineWidth = 'max'; // default value
  if (childNode.props.nodeId) {
    const childNodeData = renderUtils.getNodeDataById(childNode.props.nodeId);
    if (childNodeData?.attr?.bullet) {
      actualBulletType = childNodeData.attr.bullet;
    }
    if (childNodeData?.attr?.width) {
      timelineWidth = childNodeData.attr.width;
    }
  }

  // ===== JOTAI LOGIC =====
  // Set up request when component mounts
  React.useEffect(() => {
    if (!nodeId || !docId) {
      console.warn('nodeId:', nodeId, 'docId:', docId, 'AddTimelineBulletBeforeYamdNode useEffect skipped');
      return; 
    }
    // Register and request initial calculation using Jotai
    docsBulletState.registerBulletYPosReq(docId, nodeId, containerClassName);
    docsBulletState.reqCalcBulletYPos(docId, nodeId, containerClassName);
  }, [nodeId, docId, containerClassName]);

  // Subscribe to child bullet Y position result changes using Jotai
  const results = docsBulletState.useResults(docId, nodeId);
  
  // Extract result for this specific container
  const childBulletYPosResult = results?.[containerClassName];
  
  // Trigger timeline replot when child bullet position changes
  React.useEffect(() => {
    if (childBulletYPosResult && onBulletYPosChange) {
      console.log('Timeline item bullet position changed, triggering replot for:', childNode.props.nodeId);
      onBulletYPosChange();
    }
  }, [childBulletYPosResult, onBulletYPosChange]);
  // ===== END ZUSTAND LOGIC =====

  // ===== RESIZE OBSERVER LOGIC =====
  const contentRef = React.useRef(null);
  
  React.useEffect(() => {
    if (!contentRef.current || !onContentHeightChange) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newHeight = entry.contentRect.height;
        console.log(`Timeline item ${itemIndex} height changed:`, newHeight);
        
        // Notify parent timeline to recalculate lines
        onContentHeightChange(itemIndex, newHeight);
      }
    });
    
    resizeObserver.observe(contentRef.current);
    
    return () => resizeObserver.disconnect();
  }, [itemIndex, onContentHeightChange]);
  // ===== END RESIZE OBSERVER LOGIC =====

  // Create enhanced parentInfo for child node (without bullet notification callback)
  const childParentInfo = React.useMemo(() => ({
    ...parentInfo,
    hasBulletToLeft: true,
    bulletContainerClassName: containerClassName
  }), [parentInfo, containerClassName]);

  // Clone childNode and inject enhanced parentInfo
  const enhancedChildNode = React.cloneElement(childNode, {
    parentInfo: childParentInfo
  });

  // Use Zustand child bullet Y position result for positioning, fallback to default if no result
  const hasResult = childBulletYPosResult?.code === 0;
  const preferredYPosFinal = hasResult ? childBulletYPosResult.data : TIMELINE_BULLET_SETTINGS.bullet_y_pos_default;

  // Always use positioned rendering - simplified single branch
  console.log('childId:', childNode.props.nodeId);
  console.log('preferredYPosFinal', preferredYPosFinal);
  console.log('hasResult:', hasResult);
  
  return (
    <div className="yamd-timeline-item" style={{position: 'relative'}}>
      
      {/* bullet container */}
      <div className="yamd-timeline-bullet-container">
        <div 
          ref={el => {
            // Find the SVG element inside this wrapper and use it as the bullet ref
            if (el) {
              const svgElement = el.querySelector('.yamd-timeline-bullet-svg');
              if (svgElement) {
                bulletRefs.current[itemIndex] = svgElement;
              }
            }
          }}
          className="yamd-timeline-bullet-wrapper"
          style={{ 
            position: 'relative',
            width: TIMELINE_BULLET_SETTINGS.container_width,
            height: TIMELINE_BULLET_SETTINGS.container_height,
            display: 'flex',
            flexShrink: 0,
            justifyContent: 'center',
          }}
        >
          <div style={{
            position: 'absolute',
            top: formatYPos(preferredYPosFinal),
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}>
            {renderYamdTimelineBullet(actualBulletType)}
          </div>
        </div>
      </div>

      {/* content container */}
      <div className="yamd-timeline-content" ref={contentRef}>
        <div style={{ 
          marginLeft: BULLET_DIMENSIONS.content_offset_x,
          ...(timelineWidth === 'max' ? { width: '100%' } : {}),
          ...(timelineWidth === 'min' ? { width: 'fit-content' } : {})
        }}>
          {enhancedChildNode}
        </div>
      </div>
    </div>
  );
});
