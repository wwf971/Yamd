import React from 'react';
import { DocumentContent } from '../DocumentContent.jsx';

/**
 * List Component
 * Renders ordered, unordered, and plain lists
 */
function List({ node, projectData }) {
  const isOrdered = ['ordered-list', 'ol'].includes(node.type);
  const ListTag = isOrdered ? 'ol' : 'ul';
  const className = ['plain-list', 'pl'].includes(node.type) ? 'plain-list' : '';
  // console.log('🔍 List:', node.type, className);

  return (
    <ListTag id={node.id} className={className}>
      {node.children && node.children.map(childId => (
        <li key={childId}>
          <DocumentContent projectData={projectData} nodeId={childId} />
        </li>
      ))}
    </ListTag>
  );
}

export default List;
