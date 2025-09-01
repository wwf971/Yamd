import React from 'react';
import { DocumentContent } from '../DocumentContent.jsx';

/**
 * Section Component
 * Renders a section with title and nested content
 * Supports isHtml parameter to control whether title should be rendered as HTML
 */
function Section({ node, projectData }) {
  const title = node.title_processed || node.title;
  
  return (
    <div className="section">
      {title && (
        <div className={node.selfClass || ''}>
          {node.isHtml === false ? (
            <span>{title}</span>
          ) : (
            <span 
              className={title.includes('\\(') ? 'contains-inline-math' : ''}
              data-mathjax={title.includes('\\(') ? 'true' : undefined}
              dangerouslySetInnerHTML={{ __html: title }} 
            />
          )}
        </div>
      )}
      {node.children && node.children.map(childId => (
        <DocumentContent 
          key={childId} 
          projectData={projectData} 
          nodeId={childId} 
        />
      ))}
    </div>
  );
}

export default Section;
