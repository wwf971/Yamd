import React from 'react';
import DocumentContent from '../DocumentContent.jsx';

/**
 * Array Component
 * Renders array of child nodes
 */
function Array({ node, projectData }) {
  return (
    <>
      {node.children && node.children.map(childId => (
        <DocumentContent 
          key={childId} 
          projectData={projectData} 
          nodeId={childId} 
        />
      ))}
    </>
  );
}

export default Array;
