import React from 'react';
import YamdNode, { getNodeClass } from '../YamdNode.jsx';
import YamdChildrenNodes from '../YamdChildrenNodes.jsx';
import { renderYamdListBullet, getChildrenDisplay } from '../YamdRenderUtils.js';

/**
 * Key node renderer - renders title and children as siblings, with optional valueNum support
 */
const YamdNodeKey = ({ nodeId, parentInfo, globalInfo }) => {
  if (!globalInfo?.getNodeDataById) {
    return <div className="yamd-error">Missing globalInfo.getNodeDataById</div>;
  }
  
  const nodeData = globalInfo.getNodeDataById(nodeId);
  
  if (!nodeData) {
    return <div className="yamd-error">Node not found: {nodeId}</div>;
  }

  const title = nodeData.textRaw || nodeData.textOriginal || '';
  const childDisplay = getChildrenDisplay(nodeData, false, parentInfo);
  const childClass = nodeData.attr?.childClass || 'yamd-tag';
  const valueNum = nodeData.attr?.valueNum;
  const children = nodeData.children || [];
  
  // Use the utility function to get appropriate CSS class
  const nodeClass = getNodeClass(nodeData, parentInfo) || 'yamd-key-title';

  // Handle valueNum logic
  if (valueNum !== null && valueNum !== undefined && valueNum > 0 && children.length > valueNum) {
    // Split children: first valueNum become siblings, rest become normal children
    const siblingChildIds = children.slice(0, valueNum);
    const remainingChildIds = children.slice(valueNum);
    
    return (
      <div className="yamd-node-key-with-valuenum">
        {/* Horizontal container for parent + first valueNum children */}
        <div className="yamd-key-siblings">
          {title && (
            <span className={nodeClass} style={{ display: 'flex', alignItems: 'flex-start' }}>
              {(parentInfo?.childDisplay === 'ul' || parentInfo?.childDisplay === 'ol') && renderYamdListBullet({parentInfo})}
              <span>{title}</span>
            </span>
          )}
          {siblingChildIds.map(childId => (
            <YamdNode
              key={childId}
              nodeId={childId}
              globalInfo={globalInfo}
              parentInfo={{ ...parentInfo, childClass }}
            />
          ))}
        </div>
        
        {/* Remaining children as normal children */}
        {remainingChildIds.length > 0 && (
          <div className="yamd-key-remaining">
            <YamdChildrenNodes
              childIds={remainingChildIds}
              shouldAddIndent={false}
              parentInfo={{ 
                ...parentInfo, 
                ...(childDisplay && { childDisplay }),
                ...(childClass && { childClass })
              }}
              globalInfo={globalInfo}
            />
          </div>
        )}
      </div>
    );
  } else {
    // Original flat sibling behavior for no valueNum or no remaining children
    return (
      <div className="yamd-node-key-flat">
        {title && (
          <span className={nodeClass} style={{ display: 'flex', alignItems: 'flex-start' }}>
            {(parentInfo?.childDisplay === 'ul' || parentInfo?.childDisplay === 'ol') && renderYamdListBullet({parentInfo})}
            <span>{title}</span>
          </span>
        )}
        {children.map(childId => (
          <YamdNode
            key={childId}
            nodeId={childId}
            globalInfo={globalInfo}
            parentInfo={{ ...parentInfo, childClass }}
          />
        ))}
      </div>
    );
  }
};

export default YamdNodeKey;
