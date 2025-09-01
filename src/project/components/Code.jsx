import React from 'react';

/**
 * Code Component
 * Renders code blocks with syntax highlighting
 */

// Utility function to remove leading spaces
function removeLeadingSpace(str) {
  if (!str) return '';
  
  const lines = str.split('\n');
  let start = 0;
  let end = lines.length - 1;
  
  // Find first non-empty line
  while (start <= end && lines[start].trim() === '') {
    start++;
  }
  
  // Find last non-empty line
  while (end >= start && lines[end].trim() === '') {
    end--;
  }
  
  if (start > end) {
    return '';
  }
  
  const relevantLines = lines.slice(start, end + 1);
  let minLeadingSpaces = Infinity;
  
  for (const line of relevantLines) {
    if (line.trim() !== '') {
      let leadingSpaces = 0;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === ' ') {
          leadingSpaces++;
        } else {
          break;
        }
      }
      minLeadingSpaces = Math.min(minLeadingSpaces, leadingSpaces);
    }
  }
  
  if (minLeadingSpaces === Infinity) {
    return '';
  }
  
  const processedLines = relevantLines.map(line => {
    if (line.trim() === '') {
      return '';
    } else {
      return line.slice(minLeadingSpaces);
    }
  });
  
  return processedLines.join('\n');
}

// TODO: Implement syntax highlighting with highlight.js
function highlightCode(code, lang = "python") {
  return code; // Placeholder - integrate highlight.js later
}

function Code({ node }) {
  return (
    <div 
      id={node.id} 
      className="code-block language-python"
      dangerouslySetInnerHTML={{ 
        __html: highlightCode(removeLeadingSpace(node.content)) 
      }}
    />
  );
}

export default Code;
