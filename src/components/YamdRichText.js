/**
 * YamdRichText utility functions for bullet positioning
 * Extracted from YamdRichText.jsx to keep component clean
 */

/**
 * Calculate preferred Y position for bullet alignment
 * @param {HTMLElement} textElement - The text element to measure
 * @param {Array} textRich - Rich text segments array
 * @param {string} containerClassName - CSS class name of the requesting container
 * @param {object} parentInfo - Parent context information
 * @returns {object} Result object with {code, message, data}
 */
export const calculatePreferredYPosition = (textElement, textRich, containerClassName) => {
  try {
    if (!textElement) {
      return { code: -1, message: 'Text element not found', data: null };
    }

    // Use textRich data to determine the first segment type and get its element
    if (textRich && Array.isArray(textRich) && textRich.length > 0) {
      const firstSegment = textRich[0];

      // Skip if not the first child (only first child should provide position)
      // if (parentInfo?.childIndex !== 0) {
      //   return { code: 1, message: 'Not first child, skipping', data: null };
      // }

      // Handle different segment types
      if (firstSegment.type === 'text') {
        // For plain text segments, find the first text node
        const textNodes = Array.from(textElement.childNodes).filter(node => 
          node.nodeType === Node.TEXT_NODE && node.textContent.trim()
        );
        
        if (textNodes.length > 0) {
          const firstTextNode = textNodes[0];
          const range = document.createRange();
          range.selectNodeContents(firstTextNode);
          const rect = range.getBoundingClientRect();
          const containerRect = textElement.getBoundingClientRect();
          
          // Calculate relative position within the container
          const relativeY = rect.top - containerRect.top;
          return { code: 0, message: 'Success', data: relativeY };
        }
      } else if (firstSegment.type === 'latex-inline') {
        // For LaTeX segments, find the first LaTeX element
        const latexElements = textElement.querySelectorAll('.yamd-latex-inline');
        if (latexElements.length > 0) {
          const firstLatexElement = latexElements[0];
          const rect = firstLatexElement.getBoundingClientRect();
          const containerRect = textElement.getBoundingClientRect();
          
          const relativeY = rect.top - containerRect.top + (rect.height / 2);
          return { code: 0, message: 'Success', data: relativeY };
        }
      } else if (firstSegment.type === 'ref') {
        // For reference segments, find the first ref element
        const refElements = textElement.querySelectorAll('.yamd-ref');
        if (refElements.length > 0) {
          const firstRefElement = refElements[0];
          const rect = firstRefElement.getBoundingClientRect();
          const containerRect = textElement.getBoundingClientRect();
          
          const relativeY = rect.top - containerRect.top + (rect.height / 2);
          return { code: 0, message: 'Success', data: relativeY };
        }
      } else if (firstSegment.type === 'ref-bib') {
        // For bibliography segments, find the first bib element
        const bibElements = textElement.querySelectorAll('.yamd-bib');
        if (bibElements.length > 0) {
          const firstBibElement = bibElements[0];
          const rect = firstBibElement.getBoundingClientRect();
          const containerRect = textElement.getBoundingClientRect();
          
          const relativeY = rect.top - containerRect.top + (rect.height / 2);
          return { code: 0, message: 'Success', data: relativeY };
        }
      }
    }

    // Fallback: use first line height estimation
    const computedStyle = window.getComputedStyle(textElement);
    const lineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(computedStyle.fontSize) * 1.2;
    const firstLineY = lineHeight / 2;
    
    return { code: 0, message: 'Success (fallback)', data: firstLineY };

  } catch (error) {
    return { code: -1, message: `Error calculating position: ${error.message}`, data: null };
  }
};

/**
 * Get the appropriate container class name for bullet positioning
 * @param {string} containerClassName - The requesting container class name
 * @returns {string} The appropriate class name to use
 */
export const getContainerClassName = (containerClassName) => {
  // Map container class names to appropriate positioning strategies
  const containerMap = {
    '.yamd-bullet-container': 'bullet',
    '.yamd-timeline-item': 'timeline',
    '.yamd-list-item': 'list'
  };
  
  return containerMap[containerClassName] || 'default';
};
