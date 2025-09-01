import React, { useState, useEffect, useRef } from 'react';
import { NodeErrorBoundary, ChildrenRenderer, renderBySelfStyle } from './Node.jsx';
import { parseNodeStyle } from './ParseUtils.js';
import './Node.css';

// Default bullet component - white circle with black border
const DefaultBullet = () => (
  <div className="timeline-bullet-default"></div>
);

// Example Check bullet component
const CheckBullet = () => (
  <div className="timeline-bullet-check">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20,6 9,17 4,12"/>
    </svg>
  </div>
);

// Red question mark bullet component
const QuestionBullet = () => (
  <div className="timeline-bullet-question">
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="5" fill="#dc2626" stroke="#b91c1c" strokeWidth="1"/>
      <text x="6" y="8.5" fontSize="8" fontWeight="bold" textAnchor="middle" fill="white">?</text>
    </svg>
  </div>
);

// Dash bullet component (matches connect line color)
const DashBullet = () => (
  <div className="timeline-bullet-dash">
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="5" fill="#666" stroke="#555" strokeWidth="1"/>
      <line x1="3" y1="6" x2="9" y2="6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  </div>
);

// Screw drive bullet component (screwdriver icon)
const ScrewBullet = () => (
  <div className="timeline-bullet-screw">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  </div>
);

// Up arrow bullet component (larger arrow without line)
// Up arrow bullet component (空心设计，减少周边空白)
const UpArrowBullet = () => (
  <div className="timeline-bullet-up-arrow">
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
const TimelineItem = React.memo(({ item, itemIndex, isLast, bulletRefs, lineHeights }) => {
  if (typeof item === 'string') {
    const { name, selfClass } = parseNodeStyle(item);
    
    // Check for bullet component specification in string items
    let BulletComp = DefaultBullet;
    // console.log("item: " + item);
    const bulletMatch = item.match(/bullet=([^,\]]+)/);
    if (bulletMatch) {
      const bulletName = bulletMatch[1];
      BulletComp = BULLET_COMPONENTS[bulletName] || DefaultBullet;
    }
    
    return (
      <div className="timeline-item">
        <div className="timeline-bullet-container">
          <div 
            ref={el => bulletRefs.current[itemIndex] = el}
            className="timeline-bullet-wrapper"
          >
            <BulletComp />
            {!isLast && (
              <div 
                className="timeline-connect-line"
                style={{
                  height: lineHeights[itemIndex] ? `${lineHeights[itemIndex]}px` : '20px'
                }}
              ></div>
            )}
          </div>
        </div>
        <div className="timeline-content">
          <span className={selfClass || "timeline-item-text"}>{name}</span>
        </div>
      </div>
    );
  } else if (typeof item === 'object' && item !== null) {
    // Handle nested objects
    return Object.entries(item).map(([key, value]) => {
      if (typeof key !== 'string') return null;
      const { name, selfStyle, childStyle = 'default', selfClass, childClass, valueNum } = parseNodeStyle(key);
      
      // Check for bullet component specification
      let BulletComp = DefaultBullet;
      const bulletMatch = key.match(/bullet=([^,\]]+)/);
      if (bulletMatch) {
        const bulletName = bulletMatch[1];
        BulletComp = BULLET_COMPONENTS[bulletName] || DefaultBullet;
      }
      
      // Handle self=key specially
      if (selfStyle === 'key') {
        const keyContent = renderBySelfStyle(key, name, value, selfStyle, childStyle, selfClass, childClass, valueNum);
        
        return (
          <div key={key} className="timeline-item">
            <div className="timeline-bullet-container">
              <div 
                ref={el => bulletRefs.current[itemIndex] = el}
                className="timeline-bullet-wrapper"
              >
                <BulletComp />
                {!isLast && (
                  <div 
                    className="timeline-connect-line"
                    style={{
                      height: lineHeights[itemIndex] ? `${lineHeights[itemIndex]}px` : '20px'
                    }}
                  ></div>
                )}
              </div>
            </div>
            <div className="timeline-content">
              {keyContent}
            </div>
          </div>
        );
      }
      
      // Default timeline item handling for other selfStyles
      return (
        <div key={key} className="timeline-item">
          <div className="timeline-bullet-container">
            <div 
              ref={el => bulletRefs.current[itemIndex] = el}
              className="timeline-bullet-wrapper"
            >
              <BulletComp />
              {!isLast && (
                <div 
                  className="timeline-connect-line"
                  style={{
                    height: lineHeights[itemIndex] ? `${lineHeights[itemIndex]}px` : '20px'
                  }}
                ></div>
              )}
            </div>
          </div>
          <div className="timeline-content">
            <div className="timeline-title">
              <span className={selfClass || "timeline-item-title"}>{name}</span>
            </div>
            {Array.isArray(value) && value.length > 0 && (
              <div className="timeline-details">
                <ChildrenRenderer value={value} childStyle={childStyle} />
              </div>
            )}
            {typeof value === 'string' && (
              <div className="timeline-details">
                <span className="timeline-item-text">{parseNodeStyle(value).name}</span>
              </div>
            )}
          </div>
        </div>
      );
    }).filter(Boolean);
  }
  return null;
});

// Main NodeTimeline component
function NodeTimeline({ data }) {
  const [lineHeights, setLineHeights] = useState([]);
  const bulletRefs = useRef([]);
  
  // Calculate connecting line heights after DOM updates
  useEffect(() => {
    if (data && Array.isArray(data) && bulletRefs.current.length > 0) {
      const calculateLineHeights = () => {
        const heights = [];
        for (let i = 0; i < bulletRefs.current.length - 1; i++) {
          const currentBullet = bulletRefs.current[i];
          const nextBullet = bulletRefs.current[i + 1];
          
          if (currentBullet && nextBullet) {
            const rectCurrent = currentBullet.getBoundingClientRect();
            const rectNext = nextBullet.getBoundingClientRect();
            
            // Calculate the distance from bottom of current bullet wrapper to top of next bullet wrapper
            // This mimics the NodeRoot.jsx calculation logic exactly
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
  }, [data]);

  if (!data || !Array.isArray(data)) {
    return null;
  }

  return (
    <NodeErrorBoundary>
      <div className="node-timeline">
        {data.map((item, index) => {
          const isLast = index === data.length - 1;
          return (
            <TimelineItem 
              key={index}
              item={item}
              itemIndex={index}
              isLast={isLast}
              bulletRefs={bulletRefs}
              lineHeights={lineHeights}
            />
          );
        })}
      </div>
    </NodeErrorBoundary>
  );
}

export default NodeTimeline;
