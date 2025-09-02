import React from 'react';
import { YamdChildrenRenderer, getNodeClass } from '../YamdNode.jsx';
import { getChildrenDisplay, AddListBulletBeforeYamdText } from '../YamdRenderUtils.js';
import YamdRichText from './YamdRichText.jsx';

/**
 * Text node renderer - displays plain text content and children in vertical layout
 */
const YamdNodeText = ({ nodeId, getNodeDataById, parentInfo }) => {
  const nodeData = getNodeDataById(nodeId);
  
  if (!nodeData) {
    return <div className="yamd-error">Node not found: {nodeId}</div>;
  }

  const selfPlainText = nodeData.textRaw || nodeData.textOriginal || '';
  const childDisplay = getChildrenDisplay(nodeData);
  const childClass = nodeData.attr?.childClass;
  const shouldRenderBullet = parentInfo?.childDisplay === 'ul' || parentInfo?.childDisplay === 'ol';
  
  // Use the utility function to get appropriate CSS class
  const nodeClass = getNodeClass(nodeData, parentInfo) || 'yamd-title-default';

  return (
    <div className="yamd-node-text">
      {selfPlainText && (
        <AddListBulletBeforeYamdText
          childNode={
            <YamdRichText 
              text={selfPlainText}
              className={nodeClass}
              parentInfo={parentInfo}
            />
          }
        />
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

export default YamdNodeText;
