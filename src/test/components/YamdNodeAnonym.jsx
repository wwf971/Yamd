import React from 'react';
import { YamdChildrenRenderer } from '../YamdNode.jsx';

/**
 * Anonymous node renderer - skips title completely and renders only children (for nodes with empty textRaw)
 */
const YamdNodeAnonym = ({ nodeId, getNodeDataById, getAssetById, parentInfo }) => {
  const nodeData = getNodeDataById(nodeId);
  
  if (!nodeData) {
    return <div className="yamd-error">Node not found: {nodeId}</div>;
  }

  // For anonymous nodes, only override parentInfo if node has explicit attributes
  const childrenParentInfo = {
    ...parentInfo,
    ...(nodeData.attr?.childDisplay && { childDisplay: nodeData.attr.childDisplay }),
    ...(nodeData.attr?.childClass && { childClass: nodeData.attr.childClass })
  };

  // Render only children, no title
  return (
    <YamdChildrenRenderer
      childIds={nodeData.children || []}
      getNodeDataById={getNodeDataById}
      getAssetById={getAssetById}
      shouldAddIndent={false}
      parentInfo={childrenParentInfo}
    />
  );
};

export default YamdNodeAnonym;
