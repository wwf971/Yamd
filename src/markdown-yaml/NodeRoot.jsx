import React, { useState, useEffect, useRef } from 'react';
import { Node, NodeErrorBoundary } from './Node.jsx';
import { parseNodeStyle } from './ParseUtils.js';
import './Node.css';

function NodeRoot({ 
  data, 
  title = null,
  parseCategoryStyle = null,
  lineAboveFirstRoot = null,
  lineBelowLastRoot = null,
  addDividerLine = true
}) {
  const [processedData, setProcessedData] = useState(null);
  const [lineHeights, setLineHeights] = useState([]);
  const tagRefs = useRef([]);

  useEffect(() => {
    if (data) {
      setProcessedData(data);
      console.log('Root data loaded:', data);
    }
  }, [data]);

  // Calculate connecting line heights after data loads and DOM updates
  useEffect(() => {
    if (processedData && tagRefs.current.length > 0) {
      const calculateLineHeights = () => {
        const heights = [];
        for (let i = 0; i < tagRefs.current.length - 1; i++) {
          const tagCurrent = tagRefs.current[i];
          const nextTag = tagRefs.current[i + 1];
          
          if (tagCurrent && nextTag) {
            const rectCurrent = tagCurrent.getBoundingClientRect();
            const rectNext = nextTag.getBoundingClientRect();
            
            // Calculate the distance from bottom of current tag to top of next tag
            const lineHeight = rectNext.top - rectCurrent.bottom;
            heights.push(Math.max(lineHeight, 8)); // Minimum 8px height
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
  }, [processedData]);

  if (!processedData) {
    return (
      <div className="node-root-loading">
        Loading data...
      </div>
    );
  }

  // Default category style parser (can be overridden)
  const parseCategoryStyleDefault = (categoryName) => {
    const styleMatch = categoryName.match(/^(.+?)\[(.+?)\]$/);
    if (styleMatch) {
      const name = styleMatch[1];
      const styleString = styleMatch[2];
      
      // Parse comma-separated style attributes
      const styles = { self: 'default', child: 'default' };
      styleString.split(',').forEach(attr => {
        const [key, value] = attr.split('=').map(s => s.trim());
        if (key === 'self' || key === 'child') {
          styles[key] = value;
        }
        // Legacy support: treat bare "style=ul" as "child=ul"
        if (key === 'style' && value === 'ul') {
          styles.child = 'ul';
        }
      });
      
      return {
        name,
        selfStyle: styles.self,
        childStyle: styles.child
      };
    }
    return {
      name: categoryName,
      selfStyle: 'default',
      childStyle: 'default'
    };
  };

  const categoryParser = parseCategoryStyle || parseCategoryStyleDefault;

  // Process the array of objects while preserving order
  const rootCategoriesList = processedData.map(item => {
    const [categoryName, categoryData] = Object.entries(item)[0];
    return { categoryName, categoryData };
  });

  return (
    <NodeErrorBoundary>
      <div className="node-root">
        {title && <h3 className="node-root-title" style={{marginBottom: '4px'}}>{title}</h3>}
        <div className="node-root-container">
        {rootCategoriesList.map(({ categoryName, categoryData }, index) => {
          const isLast = index === rootCategoriesList.length - 1;
          const isFirst = index === 0;
          const { name: displayName, childStyle } = categoryParser(categoryName);
          
          // Check if first child has self=divider
          const isFirstChildDisplayAsDivider = Array.isArray(categoryData) && categoryData.length > 0 && 
            typeof categoryData[0] === 'object' && categoryData[0] !== null &&
            Object.keys(categoryData[0]).some(key => {
              const { selfStyle } = parseNodeStyle(key);
              return selfStyle === 'divider';
            });
          
          return (
            <div key={categoryName} className="node-category-wrapper">
              <div className="node-category-row">
                {/* Root category tag */}
                <div 
                  ref={el => tagRefs.current[index] = el}
                  className="node-root-tag expanded" 
                  style={{position: 'relative'}}
                >
                  {/* Connecting line to next category */}
                  {!isLast && (
                    <div 
                      className="node-connect-line"
                      style={{
                        height: lineHeights[index] ? `${lineHeights[index]}px` : '10px'
                      }}
                    ></div>
                  )}
                  {}
                  {isFirst && lineAboveFirstRoot && (
                    <>
                      <div 
                        className="node-connect-line-above-first"
                        style={{
                          height: lineAboveFirstRoot.height,
                          ...lineAboveFirstRoot.lineStyle ? lineAboveFirstRoot.lineStyle : {}
                        }}
                      >
                        <div style={{
                          position: 'absolute', bottom: '100%', right: '0px', transform: 'translateX(50%)',
                          ...lineAboveFirstRoot.textStyle ? lineAboveFirstRoot.textStyle : {}
                        }}>{lineAboveFirstRoot.text}</div>
                      </div>
                    </>
                  )}
                  {isLast && lineBelowLastRoot && (
                    <>
                      <div 
                        className="node-connect-line"
                        style={{
                          height: lineBelowLastRoot.height,
                          ...lineBelowLastRoot.lineStyle ? lineBelowLastRoot.lineStyle : {}
                        }}
                      >
                        <div style={{
                          position: 'absolute', top: '100%', right: '0px', transform: 'translateX(50%)',
                          ...lineBelowLastRoot.textStyle ? lineBelowLastRoot.textStyle : {}
                        }}>{lineBelowLastRoot.text}</div>
                      </div>
                    </>
                  )}

                  <div style={{overflow: 'hidden'}}>
                    <span className="node-root-tag-text">{displayName}</span>
                  </div>
                </div>
                {addDividerLine && (
                  <div className="node-details-area-wrapper" style={{
                    borderTop: isFirstChildDisplayAsDivider ? 'none' : '1px solid #d1d5db',
                    paddingTop: isFirstChildDisplayAsDivider ? '0px' : '6px'
                  }}>
                    {/* Details area - always shown */}
                    <div 
                      className="node-details-area"
                      style={{ marginTop: isFirstChildDisplayAsDivider ? '6px' : '0px' }}
                    >
                      <NodeErrorBoundary>
                        <Node data={categoryData} rootStyle={childStyle} />
                      </NodeErrorBoundary>
                    </div>
                  </div>
                )}
                {!addDividerLine && (
                    <div className="node-details-area" style={{ marginTop: '0' }}>
                      <NodeErrorBoundary>
                        <Node data={categoryData} rootStyle={childStyle} />
                      </NodeErrorBoundary>
                    </div>  
                )}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </NodeErrorBoundary>
  );
}

export default NodeRoot;
