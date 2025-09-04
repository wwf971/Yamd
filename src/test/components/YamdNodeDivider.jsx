import React, { useRef, useEffect } from 'react';
import { YamdChildrenRenderer, getNodeClass } from '../YamdNode.jsx';
import { getChildrenDisplay } from '../YamdRenderUtils.js';

/**
 * Divider node renderer - displays title as a divider line with text
 */
const YamdNodeDivider = ({ nodeId, parentInfo, globalInfo }) => {
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
  
  // Use the utility function to get appropriate CSS class
  const nodeClass = getNodeClass(nodeData, parentInfo) || 'yamd-divider-text';

  // Ref to measure divider line height for bullet positioning
  const dividerRef = useRef(null);

  // Notify parent about preferred bullet Y position if there's a bullet to the left
  useEffect(() => {
    if (parentInfo?.hasBulletToLeft && parentInfo?.notifyPreferredBulletYPos && dividerRef.current) {
      // Calculate the Y position of the divider line's midline relative to the divider's top
      const dividerHeight = dividerRef.current.offsetHeight;
      const preferredBulletYPos = dividerHeight / 2;
      parentInfo.notifyPreferredBulletYPos(preferredBulletYPos);
    }
  }, [parentInfo, title]);

  return (
    <div className="yamd-node-divider yamd-full-width">
      <div ref={dividerRef} className="yamd-divider-line">
        <span className={nodeClass}>{title}</span>
      </div>
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
  );
};

export default YamdNodeDivider;
