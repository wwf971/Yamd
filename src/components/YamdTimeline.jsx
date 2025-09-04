import React, { useState, useEffect, useRef } from 'react';
import YamdNode from '../YamdNode.jsx';
import { AddTimelineBulletBeforeYamdNode } from '../YamdRenderUtils.js';
import { TIMELINE_BULLET_DIMENSIONS } from '../YamdRenderSettings.js';

/**
 * Component for rendering vertical lines between timeline bullets
 * @param {Array} lineHeights - Array of calculated line heights
 * @param {object} bulletRefs - Ref object containing bullet element references
 * @returns {JSX.Element} - Vertical lines component
 */
const TimelineVerticalLines = ({ lineHeights, bulletRefs }) => {
  return (
    <div className="yamd-timeline-lines">
      {lineHeights.map((height, index) => {
        const currentBullet = bulletRefs.current[index];
        if (!currentBullet) return null;
        
        return (
          <div 
            key={index}
            className="yamd-timeline-connect-line"
            style={{
              top: `calc(50% + ${parseInt(TIMELINE_BULLET_DIMENSIONS.bullet_height) / 2}px + ${TIMELINE_BULLET_DIMENSIONS.connect_line_gap})`,
              height: height ? `${height}px` : '20px'
            }}
          />
        );
      })}
    </div>
  );
};

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
  const calculateLineHeights = React.useCallback(() => {
    /*
      bullet 1
          <-- connect_line_gap
        |
        |
        |
          <-- connect_line_gap
      bullet 2
    */
    if (bulletRefs.current.length > 0) {
      const heights = [];
      for (let i = 0; i < bulletRefs.current.length - 1; i++) {
        const currentBullet = bulletRefs.current[i];
        const nextBullet = bulletRefs.current[i + 1];
        
        if (currentBullet && nextBullet) {
          // console.log(`Line ${i}: currentBullet=`, currentBullet, 'nextBullet=', nextBullet);
          const rectCurrent = currentBullet.getBoundingClientRect();
          const rectNext = nextBullet.getBoundingClientRect();
          // console.log(`Line ${i}: rectCurrent=`, rectCurrent, 'rectNext=', rectNext);
          
                      // Check if bounding rects are valid
            if (rectCurrent.width > 0 && rectNext.width > 0) {
              // Calculate the distance from bottom of current bullet + gap to top of next bullet - gap
              const connectLineGap = TIMELINE_BULLET_DIMENSIONS.connect_line_gap 
                ? parseFloat(TIMELINE_BULLET_DIMENSIONS.connect_line_gap) 
                : 2; // Fallback to 2px if undefined or NaN
              // console.log(`Line ${i}: connectLineGap=${connectLineGap}`);
              
              // Calculate bottom manually if it's NaN
              const currentBottom = isNaN(rectCurrent.bottom) ? rectCurrent.top + rectCurrent.height : rectCurrent.bottom;
              const nextTop = isNaN(rectNext.top) ? rectNext.top : rectNext.top;
              
              // console.log(`Line ${i}: currentBottom=${currentBottom}, nextTop=${nextTop}`);
              
              const lineStartY = currentBottom + connectLineGap;
              const lineEndY = nextTop - connectLineGap;
              const lineHeight = lineEndY - lineStartY;
              
              // Adjust line height to account for CSS positioning
              // CSS positions line from: bulletCenter + bullet_height/2 + gap
              // We want line to end at: nextBulletCenter - bullet_height/2 - gap
              const bulletCenterY = rectCurrent.top + (rectCurrent.height / 2);
              const nextBulletCenterY = rectNext.top + (rectNext.height / 2);
              const cssLineStartY = bulletCenterY + (parseInt(TIMELINE_BULLET_DIMENSIONS.bullet_height) / 2) + connectLineGap;
              const cssLineEndY = nextBulletCenterY - (parseInt(TIMELINE_BULLET_DIMENSIONS.bullet_height) / 2) - connectLineGap;
              const adjustedLineHeight = cssLineEndY - cssLineStartY;
              
              // console.log(`Line ${i}: lineHeight=${lineHeight}, adjustedLineHeight=${adjustedLineHeight}`);
              // console.log(`Line ${i}: cssLineStartY=${cssLineStartY}, cssLineEndY=${cssLineEndY}`);
              heights.push(Math.max(adjustedLineHeight, 8)); // Use same minimum as NodeRoot (8px)
            } else {
              // console.log(`Line ${i}: Invalid bounding rects - using fallback height`);
              heights.push(20); // Fallback height
            }
        } else {
          console.log(`Line ${i}: Missing refs - currentBullet=`, currentBullet, 'nextBullet=', nextBullet);
        }
      }
      setLineHeights(heights);
    }
  }, []); // Remove childIds dependency to prevent infinite re-renders

  useEffect(() => {
    // Use setTimeout to ensure DOM has updated
    setTimeout(calculateLineHeights, 100);
    
    // Recalculate on window resize
    window.addEventListener('resize', calculateLineHeights);
    return () => window.removeEventListener('resize', calculateLineHeights);
  }, [childIds, calculateLineHeights]);

  if (!childIds || !Array.isArray(childIds)) {
    return null;
  }

  // Render children similar to YamdChildrenNodes but with timeline bullets
  const renderChildList = () => (
    <div className="yamd-timeline">
      {childIds.map((childId, index) => {
        const isLast = index === childIds.length - 1;
        
        // create the child node
        // override childDisplay to prevent nested timelines
        const childNode = (
          <YamdNode
            nodeId={childId} 
            parentInfo={{ 
              ...parentInfo, 
              childDisplay: 'timeline' // Force plain list to prevent nested timeline
            }}
            globalInfo={globalInfo}
          />
        );

        // wrap with timeline bullet
        return (
          <AddTimelineBulletBeforeYamdNode
            key={childId}
            childNode={childNode}
            globalInfo={globalInfo}
            itemIndex={index}
            isLast={isLast}
            bulletRefs={bulletRefs}
            lineHeights={lineHeights}
            onBulletPositionChange={calculateLineHeights}
          />
        );
      })}
      
    </div>
  );

  return renderChildList();
};

export default YamdTimeline;