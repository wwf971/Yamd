import React from 'react';

/**
 * Centralized bullet dimensions configuration
 * These values are used directly in inline styles for guaranteed consistency
 */
import { BULLET_DIMENSIONS, LIST_SETTINGS, TIMELINE_BULLET_SETTINGS } from './YamdRenderSettings.js';

// Re-export for backward compatibility
export { BULLET_DIMENSIONS, LIST_SETTINGS };
export {
  AddListBulletBeforeYamdNode,
  renderYamdListBullet,
} from './components/AddBullet.jsx';

/**
 * Get children display mode for a node
 * @param {object} nodeData - The node data
 * @param {boolean} isRoot - Whether this is the root node
 * @returns {string} - Children display mode
 */
export const getChildrenDisplay = (nodeData, isRoot = false, parentInfo = {}) => {
  // If node explicitly specifies childDisplay, use it
  if (nodeData.attr?.childDisplay) {
    return nodeData.attr.childDisplay;
  }
  
  // Otherwise use default based on node type and context
  return getChildrenDefaultDisplay(nodeData, isRoot, parentInfo);
};

/**
 * Get default children display mode based on node type and context
 * @param {object} nodeData - The node data
 * @param {boolean} isRoot - Whether this is the root node
 * @param {object} parentInfo - Parent context information
 * @returns {string} - Default children display mode
 */
export const getChildrenDefaultDisplay = (nodeData, isRoot = false, parentInfo = {}) => {
  // Special handling for root node
  if (isRoot) {
    return 'ul';  // Root nodes default to unordered list
  }
  
  // Inherit from parent if parent has childDisplay set to ul
  if (parentInfo?.childDisplay === 'ul' || parentInfo?.childDisplay === 'unordered-list') {
    return 'ul';
  }
  if (parentInfo?.childDisplay === 'ol' || parentInfo?.childDisplay === 'ordered-list') {
    return 'ol';
  }
  if (parentInfo?.childDisplay === 'p' || parentInfo?.childDisplay === 'paragraph-list') {
    return 'p';
  }
  
  // Default based on selfDisplay type
  const selfDisplay = nodeData.attr?.selfDisplay;
  switch (selfDisplay) {
    case 'timeline':
      return 'ul';  // Timeline children default to ul instead of pl
    case 'divider':
      return 'ul';  // Divider children commonly use lists
    case 'panel':
      return 'ul';  // Panel children default to unordered list
    case 'key':
      return 'pl';  // Key children default to plain list
    default:
      return 'pl';  // General default is plain list
  }
};


/**
 * Get horizontal alignment strategy for content blocks (LaTeX, images, videos)
 * @param {object} nodeData - The node data containing attributes
 * @param {object} parentInfo - Parent context information
 * @returns {string} - CSS alignment value ('center', 'flex-start', 'flex-end')
 */
export const getAlignmentStrategy = (nodeData, parentInfo) => {
  // User-specified alignX takes highest priority
  if (nodeData.attr?.alignX === 'center') {
    return 'center';
  }
  if (nodeData.attr?.alignX === 'left') {
    return 'flex-start';
  }
  if (nodeData.attr?.alignX === 'right') {
    return 'flex-end';
  }
  
  // Context-based alignment strategy
  const parentChildDisplay = parentInfo?.childDisplay;
  if (parentChildDisplay === 'pl' || parentChildDisplay === 'plain-list' || parentChildDisplay === 'plain_list') {
    return 'center';  // Plain lists center their content
  }
  if (parentChildDisplay === 'ul' || parentChildDisplay === 'ol' || 
      parentChildDisplay === 'unordered-list' || parentChildDisplay === 'ordered-list') {
    return 'flex-start';  // Bulleted/numbered lists align to start
  }
  
  // Default to center
  return 'center';
};


/**
 * Format Y position value for CSS - handles both numbers and CSS values with units
 * @param {number|string} value - Y position value (number or CSS string like '1.2rem')
 * @returns {string} - Properly formatted CSS value
 */
export const formatYPosition = (value) => {
  // If it's a number, append 'px'
  if (typeof value === 'number') {
    return `${value}px`;
  }
  // If it's already a string with units, use as-is
  if (typeof value === 'string') {
    return value;
  }
  // Fallback
  return '0px';
};

/**
 * Equality function for Zustand subscriptions that only triggers when requestCounter increases
 * @param {string} nodeId - Node ID for debugging
 * @param {string} componentName - Component name for debugging
 * @returns {function} Equality function for Zustand subscribe
 */
export const createBulletEqualityFn = (nodeId, componentName) => {
  return (prev, next) => {
    // console.log(`noteId: ${nodeId} ${componentName} equalityFn prev:`, prev, "next:", next);

    // Only trigger if requestCounter has increased (ignore responseCounter changes)
    const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
    const hasNewRequests = Array.from(keys).some((key) => 
      (next[key]?.requestCounter || 0) > (prev[key]?.requestCounter || 0)
    );
    
    const shouldSkip = !hasNewRequests; // skip if no new requests
    // console.log(`noteId: ${nodeId} ${componentName} equalityFn hasNewRequests:`, hasNewRequests, "shouldSkip:", shouldSkip);
    
    return shouldSkip;
  };
};
