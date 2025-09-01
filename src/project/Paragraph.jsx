import React from 'react';
import { DocumentContent } from './DocumentContent.jsx';

/**
 * Paragraph Component
 * Renders multiple paragraphs with two spaces at the beginning of each paragraph's text
 * Similar to List component but wraps each item in a paragraph with indentation
 */
function Paragraph({ node, projectData }) {
  // Primary case: node has children (parsed content items)
  if (node.children && node.children.length > 0) {
    return (
      <div id={node.id} className="paragraph-container">
        {node.children.map(childId => {
          const childNode = projectData.projectDataParsed[childId];
          
          // For text nodes, we want to add indentation and wrap in paragraph
          if (childNode && childNode.type === 'text') {
            const content = childNode.text_processed || childNode.text_raw;
            const formattedText = `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${content}`;
            
            return (
              <p 
                key={childId} 
                id={childNode.id}
                className="paragraph-item"
                dangerouslySetInnerHTML={{ __html: formattedText }}
              />
            );
          } else {
            // For non-text nodes, check if they need indentation
            // LaTeX, images, and other block elements should not have manual indentation
            const needsIndentation = childNode && !['latex', 'image', 'video', 'pdf'].includes(childNode.type);
            
            if (needsIndentation) {
              return (
                <div key={childId} className="paragraph-item">
                  <span className="paragraph-indent">&nbsp;&nbsp;</span>
                  <DocumentContent projectData={projectData} nodeId={childId} />
                </div>
              );
            } else {
              // Block-level elements (LaTeX, images, etc.) render without manual indentation
              return (
                <div key={childId} className="paragraph-item">
                  <DocumentContent projectData={projectData} nodeId={childId} />
                </div>
              );
            }
          }
        })}
      </div>
    );
  }

  // Fallback case: node has raw content array (should not happen with proper parsing)
  if (node.content && Array.isArray(node.content)) {
    console.warn('Paragraph component received raw content array, this suggests parsing issue:', node);
    return (
      <div id={node.id} className="paragraph-container">
        {node.content.map((item, index) => {
          if (typeof item === 'string') {
            const formattedText = `&nbsp;&nbsp;${item}`;
            return (
              <p 
                key={index} 
                className="paragraph-item"
                dangerouslySetInnerHTML={{ __html: formattedText }}
              />
            );
          } else {
            return (
              <div key={index} className="paragraph-item">
                <span className="paragraph-indent">&nbsp;&nbsp;</span>
                <div>Unparsed content: {JSON.stringify(item)}</div>
              </div>
            );
          }
        })}
      </div>
    );
  }

  // Fallback case: node has direct text content
  if (node.text_processed || node.text_raw) {
    const content = node.text_processed || node.text_raw;
    const formattedText = `&nbsp;&nbsp;${content}`;
    return (
      <p 
        id={node.id}
        className="paragraph-item"
        dangerouslySetInnerHTML={{ __html: formattedText }}
      />
    );
  }

  // Empty content fallback
  return <div id={node.id} className="paragraph-container">No content</div>;
}

export default Paragraph;
