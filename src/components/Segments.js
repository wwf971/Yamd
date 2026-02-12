/**
 * Segments utility functions for bullet positioning
 * Extracted from Segments.jsx to keep component clean
 */

/**
 * Calculate preferred Y position for bullet alignment
 * @param {HTMLElement} textEl - The text element to measure
 * @param {Array} textRich - Rich text segments array
 * @param {string} containerClassName - CSS class name of the requesting container
 * @returns {object} Result object with {code, message, data}
 */
export const calcBulletYPos = (textEl, segments, containerClassName) => {
  try {
    if (!textEl) {
      return { code: -1, message: 'Text element not found', data: null };
    }

    // For rich text, find the first text segment span
    // segments is now an array of segment IDs, so we just query the DOM
      const textSegments = textEl.querySelectorAll('.yamd-text-segment');
    
      if (textSegments.length > 0) {
        const firstTextSegment = textSegments[0];
        const rect = firstTextSegment.getBoundingClientRect();

        const bulletContainer = textEl.closest(containerClassName);
        if (!bulletContainer) {
        return { code: -1, message: `Bullet container ${containerClassName} not found`, data: null };
        }
        const containerRect = bulletContainer.getBoundingClientRect();
        
      // Calculate vertical middle of first text segment
        const relativeY = rect.top - containerRect.top + (rect.height * 0.55);
        return { code: 0, message: 'Success', data: relativeY };
    }
    
    // Fallback: use line height estimation
    const computedStyle = window.getComputedStyle(textEl);
    const lineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(computedStyle.fontSize) * 1.2;
    const firstLineY = lineHeight / 2;
    return { code: 0, message: 'Success (fallback)', data: firstLineY };
  } catch (error) {
    return { code: -1, message: `Error calculating position: ${error.message}`, data: null };
  }
};
