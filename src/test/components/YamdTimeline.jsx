import React, { useState, useEffect, useRef } from 'react';
import YamdNode from '../YamdNode.jsx';

// Default bullet component - white circle with black border
const DefaultBullet = () => (
  <div className="yamd-timeline-bullet-default"></div>
);

// Example Check bullet component
const CheckBullet = () => (
  <div className="yamd-timeline-bullet-check">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20,6 9,17 4,12"/>
    </svg>
  </div>
);

// Red question mark bullet component
const QuestionBullet = () => (
  <div className="yamd-timeline-bullet-question">
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="5" fill="#dc2626" stroke="#b91c1c" strokeWidth="1"/>
      <text x="6" y="8.5" fontSize="8" fontWeight="bold" textAnchor="middle" fill="white">?</text>
    </svg>
  </div>
);

// Dash bullet component (matches connect line color)
const DashBullet = () => (
  <div className="yamd-timeline-bullet-dash">
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="5" fill="#666" stroke="#555" strokeWidth="1"/>
      <line x1="3" y1="6" x2="9" y2="6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  </div>
);

// Screw drive bullet component (screwdriver icon)
const ScrewBullet = () => (
  <div className="yamd-timeline-bullet-screw">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  </div>
);

// Up arrow bullet component
const UpArrowBullet = () => (
  <div className="yamd-timeline-bullet-up-arrow">
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3 L4 9 L7 9 L7 17 L13 17 L13 9 L16 9 Z"/>
    </svg>
  </div>
);

// Bullet component registry
const BULLET_COMPONENTS = {
  'Check': CheckBullet,
  'Question': QuestionBullet,
  'Dash': DashBullet,
  'Screw': ScrewBullet,
  'UpArrow': UpArrowBullet,
  'default': DefaultBullet
};

// Timeline item component
const YamdTimelineItem = React.memo(({ nodeId, getNodeDataById, getAssetById, itemIndex, isLast, bulletRefs, lineHeights, parentInfo }) => {
  const nodeData = getNodeDataById(nodeId);
  
  if (!nodeData) {
    return <div className="yamd-error">Timeline item not found: {nodeId}</div>;
  }

  const title = nodeData.textRaw || nodeData.textOriginal || '';
  
  // Check for bullet component specification in node attributes
  let BulletComp = DefaultBullet;
  const bulletType = nodeData.attr?.bullet;
  if (bulletType) {
    BulletComp = BULLET_COMPONENTS[bulletType] || DefaultBullet;
  }
  
  return (
    <div className="yamd-timeline-item">
      <div className="yamd-timeline-bullet-container">
        <div 
          ref={el => bulletRefs.current[itemIndex] = el}
          className="yamd-timeline-bullet-wrapper"
        >
          <BulletComp />
          {!isLast && (
            <div 
              className="yamd-timeline-connect-line"
              style={{
                height: lineHeights[itemIndex] ? `${lineHeights[itemIndex]}px` : '20px'
              }}
            ></div>
          )}
        </div>
      </div>
      <div className="yamd-timeline-content">
        <div className="yamd-timeline-title">
          <span className="yamd-timeline-item-title">{title}</span>
        </div>
        {nodeData.children && nodeData.children.length > 0 && (
          <div className="yamd-timeline-details">
            {nodeData.children.map(childId => (
              <YamdNode
                key={childId}
                nodeId={childId}
                getNodeDataById={getNodeDataById}
                getAssetById={getAssetById}
                parentInfo={{ ...parentInfo, childClass: 'yamd-timeline-item-text' }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

// Main YamdTimeline component
const YamdTimeline = ({ childIds, getNodeDataById, getAssetById, parentInfo }) => {
  const [lineHeights, setLineHeights] = useState([]);
  const bulletRefs = useRef([]);
  
  // Calculate connecting line heights after DOM updates
  useEffect(() => {
    if (childIds && Array.isArray(childIds) && bulletRefs.current.length > 0) {
      const calculateLineHeights = () => {
        const heights = [];
        for (let i = 0; i < bulletRefs.current.length - 1; i++) {
          const currentBullet = bulletRefs.current[i];
          const nextBullet = bulletRefs.current[i + 1];
          
          if (currentBullet && nextBullet) {
            const rectCurrent = currentBullet.getBoundingClientRect();
            const rectNext = nextBullet.getBoundingClientRect();
            
            // Calculate the distance from bottom of current bullet wrapper to top of next bullet wrapper
            const lineHeight = rectNext.top - rectCurrent.bottom;
            heights.push(Math.max(lineHeight, 8)); // Use same minimum as NodeRoot (8px)
          }
        }
        setLineHeights(heights);
      };

      // Use setTimeout to ensure DOM has updated
      setTimeout(calculateLineHeights, 100);
      
      // Recalculate on window resize
      window.addEventListener('resize', calculateLineHeights);
      return () => window.removeEventListener('resize', calculateLineHeights);
    }
  }, [childIds]);

  if (!childIds || !Array.isArray(childIds)) {
    return null;
  }

  return (
    <div className="yamd-timeline">
      {childIds.map((childId, index) => {
        const isLast = index === childIds.length - 1;
        return (
          <YamdTimelineItem 
            key={childId}
            nodeId={childId}
            getNodeDataById={getNodeDataById}
            getAssetById={getAssetById}
            itemIndex={index}
            isLast={isLast}
            bulletRefs={bulletRefs}
            lineHeights={lineHeights}
            parentInfo={parentInfo}
          />
        );
      })}
    </div>
  );
};

export default YamdTimeline;
