import React from 'react';
import { Node } from './Node.jsx';

/**
 * YamlMarkdown Component
 * Renders yaml-markdown content using the Node.jsx system
 * 
 * Props:
 * - node: The yaml-markdown node from ProjectStore
 * - projectPath: The project path (for consistency with other components)
 */
function YamlMarkdown({ node, projectPath }) {
  if (!node || !node.content) {
    return <div>No yaml-markdown content available</div>;
  }

  console.log('🔍 YamlMarkdown rendering node:', node);

  // The content should be an array that can be directly passed to Node
  const transformedData = Array.isArray(node.content) ? node.content : [node.content];

  return (
    <div className="yaml-markdown">
      <Node 
        data={transformedData}
        rootStyle="default" // Use default rendering style
      />
    </div>
  );
}

export default YamlMarkdown;
