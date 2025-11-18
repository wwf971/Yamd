import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import './NodeCustomBox.css';

/**
 * Example custom node component - renders a box with custom styling
 * This demonstrates how to create custom node types for Yamd
 * 
 * Must be a forwardRef component that exposes calcBulletYPos method
 * 
 * @param {string} nodeId - The node ID
 * @param {object} nodeData - The node data from flattened structure
 * @param {object} parentInfo - Parent context information
 * @param {object} globalInfo - Global context with helper methods
 */
const NodeCustomBox = forwardRef(({ nodeId, nodeData, parentInfo, globalInfo }, ref) => {
  const boxRef = useRef(null);
  const headerRef = useRef(null);
  
  const textRaw = nodeData.textRaw || '';
  const children = nodeData.children || [];
  
  // Expose calcBulletYPos method for bullet positioning
  useImperativeHandle(ref, () => ({
    calcBulletYPos: (containerClassName) => {
      if (!boxRef.current || !headerRef.current) {
        return { code: -1, message: 'Refs not ready', data: null };
      }
      
      try {
        const bulletContainer = boxRef.current.closest(containerClassName);
        if (!bulletContainer) {
          return { code: -1, message: `Container ${containerClassName} not found`, data: null };
        }
        
        const headerRect = headerRef.current.getBoundingClientRect();
        const containerRect = bulletContainer.getBoundingClientRect();
        
        // Center bullet with the header
        const preferredYPos = (headerRect.top - containerRect.top) + (headerRect.height / 2);
        
        return { code: 0, message: 'Success', data: preferredYPos };
      } catch (error) {
        return { code: -1, message: error.message, data: null };
      }
    }
  }), []);
  
  return (
    <div ref={boxRef} className="yamd-custom-box">
      <div ref={headerRef} className="yamd-custom-box-header">
        <span className="yamd-custom-box-icon">📦</span>
        <span className="yamd-custom-box-title">{textRaw}</span>
      </div>
      
      {children.length > 0 && (
        <div className="yamd-custom-box-content">
          {globalInfo.renderChildNodes(children, {
            shouldAddIndent: true,
            parentInfo: {
              childDisplay: 'ul',
              childClass: 'yamd-custom-box-item'
            }
          })}
        </div>
      )}
    </div>
  );
});

NodeCustomBox.displayName = 'NodeCustomBox';

export default NodeCustomBox;
