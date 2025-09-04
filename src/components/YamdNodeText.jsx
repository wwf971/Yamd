import React from 'react';
import { getNodeClass } from '../YamdNode.jsx';
import YamdChildrenNodes from '../YamdChildrenNodes.jsx';
import { getChildrenDisplay, AddListBulletBeforeYamdText } from '../YamdRenderUtils.js';
import YamdRichText from './YamdRichText.jsx';
import YamdPlainText from './YamdPlainText.jsx';

/**
 * Text node renderer - displays plain text content and children in vertical layout
 */
const YamdNodeText = React.memo(({ nodeId, parentInfo, globalInfo }) => {
  if (!globalInfo?.getNodeDataById) {
    return <div className="yamd-error">Missing globalInfo.getNodeDataById</div>;
  }
  
  const nodeData = globalInfo.getNodeDataById(nodeId);
  
  if (!nodeData) {
    return <div className="yamd-error">Node not found: {nodeId}</div>;
  }

  const selfPlainText = nodeData.textRaw || nodeData.textOriginal || '';
  const selfRichText = nodeData.textRich; // Rich text segments if LaTeX was processed
  const childDisplay = getChildrenDisplay(nodeData, false, parentInfo);
  const childClass = nodeData.attr?.childClass;
  const shouldRenderBullet = parentInfo?.childDisplay === 'ul' || parentInfo?.childDisplay === 'ol';
  
  // Use the utility function to get appropriate CSS class
  const nodeClass = getNodeClass(nodeData, parentInfo) || 'yamd-title-default';

  return (
    <div className="yamd-node-text">
      {/* self content */}
      {selfPlainText && !selfRichText && (
        <AddListBulletBeforeYamdText
          childNode={
            <YamdPlainText 
              text={selfPlainText}
              className={nodeClass}
              parentInfo={parentInfo}
            />
          }
        />
      )}
      {selfRichText && (
        <AddListBulletBeforeYamdText
          childNode={
            <YamdRichText 
              text={selfPlainText}
              textRich={selfRichText}
              className={nodeClass}
              parentInfo={parentInfo}
              globalInfo={globalInfo}
            />
          }
        />
      )}

      {/* children content */}
      {nodeData.children && nodeData.children.length > 0 && (
        <YamdChildrenNodes
          childIds={nodeData.children}
          shouldAddIndent={true}
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
});

export default YamdNodeText;
