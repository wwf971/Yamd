import React, { useState, useEffect, useRef } from 'react';
import YamdNode from '@/core/YamdNode.jsx';
import { TIMELINE_BULLET_SETTINGS } from '@/config/RenderConfig.js';
import { calcConnectLineHeights, AddTimelineBulletBeforeYamdNode } from '@/components/NodeTimeline.js';

/**
 * Main YamdTimeline component - renders timeline with bullets and vertical lines
 * Similar structure to YamdChildrenNodes but with timeline-specific bullet rendering
 */
const YamdTimeline = ({ childIds, globalInfo, parentInfo }) => {
  if (!globalInfo?.getNodeDataById) {
    return <div className="yamd-error">Missing globalInfo.getNodeDataById</div>;
  }

  const [lineHeights, setLineHeights] = useState([]);
  const bulletRefs = useRef([]);
  
  // calculate connecting line heights after DOM updates
  // Helper function to recalculate line heights
  const recalcConnectLineHeights = React.useCallback(() => {
    const heights = calcConnectLineHeights(bulletRefs);
    setLineHeights(heights);
  }, []); // Remove childIds dependency to prevent infinite re-renders

  // handle content height changes from individual timeline items
  const onContentHeightChange = React.useCallback((itemIndex, newHeight) => {
    // console.log(`Timeline container received height change for item ${itemIndex}:`, newHeight);
    
    // Debounce the line recalculation to avoid excessive updates
    setTimeout(recalcConnectLineHeights, 10);
  }, [recalcConnectLineHeights]);

  useEffect(() => {
    // Use setTimeout to ensure DOM has updated
    setTimeout(recalcConnectLineHeights, 100);
    
    // Recalculate on window resize
    window.addEventListener('resize', recalcConnectLineHeights);
    return () => window.removeEventListener('resize', recalcConnectLineHeights);
  }, [childIds, recalcConnectLineHeights]);

  if (!childIds || !Array.isArray(childIds)) {
    return null;
  }

  // Create explicit childrenNodes array for better readability
  const childrenNodes = childIds.map((childId, index) => {
    return (
      <YamdNode
        key={childId}
        nodeId={childId} 
        parentInfo={{ 
          ...parentInfo,
          // parentInfo.childDisplay is 'timeline' for YamdTimelineNode. we need to avoid further passing it down.
          childDisplay: 'plian-list'
        }}
        globalInfo={globalInfo}
      />
    );
  });

  // Render children similar to YamdChildrenNodes but with timeline bullets
  const renderChildNodes = () => (
    <div className="yamd-timeline" style={{ position: 'relative' }}>
      {/* Render timeline items */}
      {childrenNodes.map((childNode, index) => {
        const isLast = index === childIds.length - 1;

        // wrap with timeline bullet
        return (
          <AddTimelineBulletBeforeYamdNode
            key={childNode.props.nodeId}
            childNode={childNode}
            globalInfo={globalInfo}
            itemIndex={index}
            isLast={isLast}
            bulletRefs={bulletRefs}
            lineHeights={lineHeights}
            onBulletYPosChange={recalcConnectLineHeights}
            onContentHeightChange={onContentHeightChange}
          />
        );
      })}
      
      {/* Render vertical connecting lines using TimelineVerticalLines component */}
      <TimelineVerticalLines lineHeights={lineHeights} bulletRefs={bulletRefs} />
    </div>
  );

  return renderChildNodes();
};


/**
 * Component for rendering vertical lines between timeline bullets
 * @param {Array} lineHeights - Array of calculated line heights
 * @param {object} bulletRefs - Ref object containing bullet element references
 * @returns {JSX.Element} - Vertical lines component
 */
const TimelineVerticalLines = ({ lineHeights, bulletRefs }) => {
  return (
    <div className="yamd-timeline-lines" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      {lineHeights.map((height, index) => {
        const currentBulletSvg = bulletRefs.current[index]; // Now this is the SVG element
        if (!currentBulletSvg) return null;
        
        // Calculate absolute positioning for this line
        const svgRect = currentBulletSvg.getBoundingClientRect();
        const timelineContainer = currentBulletSvg.closest('.yamd-timeline');
        const timelineRect = timelineContainer?.getBoundingClientRect();
        
        if (!timelineRect) return null;
        
        // Position line relative to timeline container, starting from bottom of SVG
        const svgBottomY = svgRect.bottom - timelineRect.top;
        const lineStartY = svgBottomY + parseInt(TIMELINE_BULLET_SETTINGS.connect_line_gap);
        
        // Center line horizontally with the SVG
        const svgCenterX = svgRect.left + (svgRect.width / 2) - timelineRect.left;
        
        return (
          <div 
            key={index}
            className="yamd-timeline-connect-line"
            style={{
              position: 'absolute',
              top: `${lineStartY}px`,
              left: `${svgCenterX}px`,
              transform: 'translateX(-50%)',
              width: '2px',
              height: height ? `${height}px` : '20px',
              backgroundColor: '#ccc'
            }}
          />
        );
      })}
    </div>
  );
};

export default YamdTimeline;