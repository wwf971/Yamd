import React, { useState, useRef, useEffect } from 'react';
import { YamdChildrenRenderer, getNodeClass } from '../YamdNode.jsx';
import { getChildrenDisplay } from '../YamdRenderUtils.js';

/**
 * Panel node renderer - displays collapsible panel with show/hide functionality
 */
const YamdNodePanel = ({ nodeId, parentInfo, globalInfo }) => {
  if (!globalInfo?.getNodeDataById) {
    return <div className="yamd-error">Missing globalInfo.getNodeDataById</div>;
  }
  
  const nodeData = globalInfo.getNodeDataById(nodeId);
  
  if (!nodeData) {
    return <div className="yamd-error">Node not found: {nodeId}</div>;
  }

  const title = nodeData.textRaw || nodeData.textOriginal || '';
  const childDisplay = getChildrenDisplay(nodeData, false, parentInfo);
  const childClass = nodeData.attr?.childClass;
  
  // use the utility function to get appropriate CSS class
  const nodeClass = getNodeClass(nodeData, parentInfo) || 'yamd-panel-title';
  
  // Compute initial state only once and cache it
  const [isExpanded, setIsExpanded] = useState(() => {
    return nodeData.attr?.panelDefault?.toLowerCase() === 'collapse' ? false : 
           nodeData.attr?.panelDefault?.toLowerCase() === 'expand' ? true :
           true;
  });

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // ref to measure button position for bullet positioning
  const buttonRef = useRef(null);

  // notify parent about preferred bullet Y position if there's a bullet to the left
  useEffect(() => {
    if (parentInfo?.hasBulletToLeft && parentInfo?.notifyPreferredBulletYPos && buttonRef.current) {
      // Calculate the Y position of the button's midline relative to the panel's top
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const panelRect = buttonRef.current.closest('.yamd-panel').getBoundingClientRect();
      const buttonRelativeTop = buttonRect.top - panelRect.top;
      const preferredBulletYPos = buttonRelativeTop + (buttonRect.height / 2);
      parentInfo.notifyPreferredBulletYPos(preferredBulletYPos);
    }
  }, [parentInfo, title, isExpanded]); // Re-calculate when content might change

  return (
    <div className="yamd-panel">
      <div 
        className="yamd-panel-header" 
        onClick={toggleExpanded}
      >
        <span className={nodeClass}>{title}</span>
        <button 
          ref={buttonRef}
          className="yamd-panel-toggle" 
          type="button"
        >
          {isExpanded ? 'hide' : 'show'}
        </button>
      </div>
      {isExpanded && (
        <div className="yamd-panel-content">
          {nodeData.children && nodeData.children.length > 0 && (
          <YamdChildrenRenderer
            childIds={nodeData.children}
            shouldAddIndent={false}
            parentInfo={{ 
              ...parentInfo, 
              ...(childDisplay && { childDisplay }),
              ...(childClass && { childClass })
            }}
            globalInfo={globalInfo}
          />
          )}
        </div>
      )}
    </div>
  );
};

export default YamdNodePanel;
