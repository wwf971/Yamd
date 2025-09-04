import React from 'react';
import YamdChildrenNodes from '../YamdChildrenNodes.jsx';

/**
 * Anonymous node renderer - skips title completely and renders only children (for nodes with empty textRaw)
 */
const YamdNodeAnonym = ({ nodeId, parentInfo, globalInfo }) => {
  if (!globalInfo?.getNodeDataById) {
    return <div className="yamd-error">Missing globalInfo.getNodeDataById</div>;
  }
  
  const nodeData = globalInfo.getNodeDataById(nodeId);
  
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
    <YamdChildrenNodes
      childIds={nodeData.children || []}
      shouldAddIndent={false}
      parentInfo={childrenParentInfo}
      globalInfo={globalInfo}
    />
  );
};

export default YamdNodeAnonym;
