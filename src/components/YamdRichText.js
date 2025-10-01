/**
 * YamdRichText utility functions for bullet positioning
 * Extracted from YamdRichText.jsx to keep component clean
 */

/**
 * Calculate preferred Y position for bullet alignment
 * @param {HTMLElement} textEl - The text element to measure
 * @param {Array} textRich - Rich text segments array
 * @param {string} containerClassName - CSS class name of the requesting container
 * @returns {object} Result object with {code, message, data}
 */
export const calcPreferredBulletYPose = (textEl, textRich, containerClassName) => {
  console.log('calcPreferredBulletYPose called:', { textEl, textRich, containerClassName });
  try {
    if (!textEl) {
      console.log('ERROR: Text element not found');
      return { code: -1, message: 'Text element not found', data: null };
    }

    // Use textRich data to determine the first segment type and get its element
    if (!(textRich && Array.isArray(textRich) && textRich.length > 0)) {
      // fallback: use first line height estimation
      console.log('FALLBACK: Using line height estimation because no segments were processed');
      const computedStyle = window.getComputedStyle(textEl);
      const lineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(computedStyle.fontSize) * 1.2;
      const firstLineY = lineHeight / 2;
      console.log('Fallback calculation:', { lineHeight, firstLineY });
      
      return { code: 0, message: 'Success (fallback)', data: firstLineY };
    }
    const firstSegment = textRich[0];
  
    // first segment is text segment
    if (firstSegment.type === 'text') {
      console.log('calcPreferredBulletYPose: Processing text segment, textEl:', textEl);
      // For plain text segments, first try to find yamd-text-segment spans
      const textSegments = textEl.querySelectorAll('.yamd-text-segment');
      // console.log('Found textSegments:', textSegments.length, textSegments);
      if (textSegments.length > 0) {
        const firstTextSegment = textSegments[0];
        const rect = firstTextSegment.getBoundingClientRect();
        console.log('calcPreferredBulletYPose: Text segment measurement:', { firstTextSegment, rect });

        const bulletContainer = textEl.closest(containerClassName);
        // console.log('bulletContainer search result:', { containerClassName, bulletContainer });
        if (!bulletContainer) {
          // console.log('ERROR: bullet container not found');
          return { code: -1, message: `Text: bullet container ${containerClassName} not found`, data: null };
        }
        const containerRect = bulletContainer.getBoundingClientRect();
        
        // calculate relative position within the bullet container element
        const relativeY = rect.top - containerRect.top + (rect.height * 0.55);
        // console.log('position calculation result:', { relativeY, rectTop: rect.top, containerTop: containerRect.top });
        return { code: 0, message: 'Success', data: relativeY };
      } else {
        console.warn('calcPreferredBulletYPose: ERROR: No .yamd-text-segment elements found for text segment');
        return { code: -1, message: 'ERROR: No .yamd-text-segment elements found for text segment', data: null };
      }
    }


    // first segment is LaTeX inline segment
    else if (firstSegment.type === 'latex-inline') {
      // For LaTeX segments, find the first LaTeX element
      const latexElList = textEl.querySelectorAll('.yamd-latex-inline');
      if (latexElList.length > 0) {
        const firstLatexElement = latexElList[0];
        const rect = firstLatexElement.getBoundingClientRect();
        
        // CORRECT: Find bullet container using containerClassName
        const bulletContainer = textEl.closest(containerClassName);
        if (!bulletContainer) {
          return { code: -1, message: `LaTeX: bullet container ${containerClassName} not found`, data: null };
        }
        
        const containerRect = bulletContainer.getBoundingClientRect();
        
        const relativeY = rect.top - containerRect.top + (rect.height / 2);
        return { code: 0, message: 'Success', data: relativeY };
      }
    } else if (firstSegment.type === 'ref') {
      // For reference segments, find the first ref element
      const refElements = textEl.querySelectorAll('.yamd-ref');
      if (refElements.length > 0) {
        const firstRefElement = refElements[0];
        const rect = firstRefElement.getBoundingClientRect();
        
        // CORRECT: Find bullet container using containerClassName
        const bulletContainer = textEl.closest(containerClassName);
        if (!bulletContainer) {
          return { code: -1, message: `Ref: bullet container ${containerClassName} not found`, data: null };
        }
        
        const containerRect = bulletContainer.getBoundingClientRect();
        
        const relativeY = rect.top - containerRect.top + (rect.height / 2);
        return { code: 0, message: 'Success', data: relativeY };
      }
    } else if (firstSegment.type === 'ref-bib') {
      // For bibliography segments, find the first bib element
      const bibElements = textEl.querySelectorAll('.yamd-bib');
      if (bibElements.length > 0) {
        const firstBibElement = bibElements[0];
        const rect = firstBibElement.getBoundingClientRect();
        
        // CORRECT: Find bullet container using containerClassName
        const bulletContainer = textEl.closest(containerClassName);
        if (!bulletContainer) {
          return { code: -1, message: `Bib: bullet container ${containerClassName} not found`, data: null };
        }
        
        const containerRect = bulletContainer.getBoundingClientRect();
        
        const relativeY = rect.top - containerRect.top + (rect.height / 2);
        return { code: 0, message: 'Success', data: relativeY };
      }
    }
  } catch (error) {
    return { code: -1, message: `Error calculating position: ${error.message}`, data: null };
  }
};
