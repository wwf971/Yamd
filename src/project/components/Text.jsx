import React from 'react';

/**
 * Text Component
 * Renders processed text content
 */
function Text({ node }) {
  const content = node.text_processed || node.text_raw;
  
  return (
    <p 
      id={node.id}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}

export default Text;
