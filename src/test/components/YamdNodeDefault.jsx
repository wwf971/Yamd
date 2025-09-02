import React from 'react';
import { YamdChildrenRenderer, getNodeClass } from '../YamdNode.jsx';
import { renderYamdListBullet, getChildrenDisplay } from '../YamdRenderUtils.js';

/**
 * Default node renderer - displays title and children in vertical layout
 */
const YamdNodeDefault = ({ nodeId, getNodeDataById, parentInfo }) => {
  const nodeData = getNodeDataById(nodeId);
  
  if (!nodeData) {
    return <div className="yamd-error">Node not found: {nodeId}</div>;
  }

  const title = nodeData.textRaw || nodeData.textOriginal || '';
  const childDisplay = getChildrenDisplay(nodeData);
  const childClass = nodeData.attr?.childClass;
  
  // Use the utility function to get appropriate CSS class
  const nodeClass = getNodeClass(nodeData, parentInfo) || 'yamd-title-default';

  return (
    <div className="yamd-node-default">
      {title && (
        <div className={nodeClass} style={{ display: 'flex', alignItems: 'flex-start' }}>
          {(parentInfo?.childDisplay === 'ul' || parentInfo?.childDisplay === 'ol') && renderYamdListBullet({parentInfo})}
          <span>{title}</span>
        </div>
      )}
      {nodeData.children && nodeData.children.length > 0 && (
        <YamdChildrenRenderer
          childIds={nodeData.children}
          getNodeDataById={getNodeDataById}
          parentInfo={{ 
            ...parentInfo, 
            ...(childDisplay && { childDisplay }),
            ...(childClass && { childClass })
          }}
        />
      )}
    </div>
  );
};

export default YamdNodeDefault;
