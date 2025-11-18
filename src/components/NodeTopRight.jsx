import React, { useRef, useEffect } from 'react';
import { getNodeClass } from '@/core/YamdNode.jsx';
import { renderYamdListBullet, getChildrenDisplay } from '../YamdRenderUtils.js';

/**
 * Top-right node renderer - positions title in top-right corner
 */
const YamdNodeTopRight = ({ nodeId, parentInfo, globalInfo }) => {
  const nodeRef = useRef(null);

  // Register the node reference after the component finishes rendering
  useEffect(() => {
    if (nodeRef.current) {
      globalInfo?.registerNodeRef?.(nodeId, nodeRef.current);
    }
  }, [nodeId, globalInfo]);

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
  const nodeClass = getNodeClass(nodeData, parentInfo) || 'yamd-top-right-title';

  return (
    <div className="yamd-node-top-right-wrapper">
      {/* Title positioned at top-right */}
      {title && (
        <div className={`yamd-top-right-parent ${nodeClass}`} style={{ display: 'flex', alignItems: 'flex-start' }}>
          {(parentInfo?.childDisplay === 'ul' || parentInfo?.childDisplay === 'ol') && renderYamdListBullet({parentInfo})}
          <span>{title}</span>
        </div>
      )}
      
      {/* Children content in the main area */}
      <div className="yamd-top-right-content">
        {nodeData.children && nodeData.children.length > 0 && (
          globalInfo.renderChildNodes(nodeData.children, {
            shouldAddIndent: true,
            parentInfo: { 
              ...parentInfo, 
              ...(childDisplay && { childDisplay }),
              ...(childClass && { childClass })
            }
          })
        )}
      </div>
    </div>
  );
};

export default YamdNodeTopRight;
