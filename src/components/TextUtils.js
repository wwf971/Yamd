/**
 * Text editing utility functions for contentEditable elements
 */

/**
 * Check if cursor is at the end of a contentEditable element
 * @param {HTMLElement} element - The contentEditable element
 * @returns {boolean} - True if cursor is at the end
 */
export const isCursorAtEnd = (element) => {
  if (!element) return false;
  
  const selection = window.getSelection();
  if (!selection) return false;
  
  const anchorNode = selection.anchorNode;
  const cursorPos = selection.anchorOffset || 0;
  const textLength = element.textContent?.length || 0;
  
  // Check if cursor is at the end
  // Case 1: anchorNode is the contentEditable element itself - check if offset equals child count (at end)
  // Case 2: cursor is at the end of the text node
  // Case 3: fallback - cursor position >= total text length
  const isAtEnd = 
    (anchorNode === element && cursorPos >= element.childNodes.length) || 
    (anchorNode?.nodeType === Node.TEXT_NODE && cursorPos >= (anchorNode.textContent?.length || 0)) ||
    (anchorNode !== element && cursorPos >= textLength);
  
  return isAtEnd;
};

/**
 * Check if cursor is at the beginning of a contentEditable element
 * @param {HTMLElement} element - The contentEditable element
 * @returns {boolean} - True if cursor is at the beginning
 */
export const isCursorAtBeginning = (element) => {
  if (!element) return false;
  
  const selection = window.getSelection();
  if (!selection) return false;
  
  const anchorNode = selection.anchorNode;
  const cursorPos = selection.anchorOffset || 0;
  
  // Case 1: anchorNode is the contentEditable element itself - check if offset is 0
  // Case 2: anchorNode is a text node - check if offset is 0
  const isAtBeginning = 
    (anchorNode === element && cursorPos === 0) ||
    (anchorNode?.nodeType === Node.TEXT_NODE && cursorPos === 0 && anchorNode === element.firstChild);
  
  return isAtBeginning;
};

/**
 * Get the current cursor position in a contentEditable element
 * @param {HTMLElement} element - The contentEditable element
 * @returns {number} - The cursor position (0-based index)
 */
export const getCursorPosition = (element) => {
  if (!element) return 0;
  
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;
  
  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  
  return preCaretRange.toString().length;
};

/**
 * Set cursor position in a contentEditable element
 * @param {HTMLElement} element - The contentEditable element
 * @param {number} position - The position to set cursor at
 */
export const setCursorPos = (element, position) => {
  if (!element) return;
  
  const range = document.createRange();
  const sel = window.getSelection();
  
  const textNode = element.firstChild;
  if (textNode && textNode.nodeType === Node.TEXT_NODE) {
    const safePosition = Math.min(position, textNode.textContent?.length || 0);
    range.setStart(textNode, safePosition);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
};

/**
 * Set cursor to the end of a contentEditable element
 * @param {HTMLElement} element - The contentEditable element
 */
export const setCursorToEnd = (element) => {
  if (!element) return;
  
  const range = document.createRange();
  const sel = window.getSelection();
  
  range.selectNodeContents(element);
  range.collapse(false); // false = collapse to end
  sel?.removeAllRanges();
  sel?.addRange(range);
};

/**
 * Set cursor to the beginning of a contentEditable element
 * @param {HTMLElement} element - The contentEditable element
 */
export const setCursorToBeginning = (element) => {
  if (!element) return;
  
  const range = document.createRange();
  const sel = window.getSelection();
  
  range.setStart(element, 0);
  range.collapse(true); // true = collapse to start
  sel?.removeAllRanges();
  sel?.addRange(range);
};

/**
 * Get the current cursor's horizontal page coordinate
 * @param {HTMLElement} element - The contentEditable element
 * @returns {number} - The page X coordinate of the cursor
 */
export const getCursorPageX = (element) => {
  if (!element) return 0;
  
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;
  
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  return rect.left + window.scrollX;
};

/**
 * Find the cursor position closest to a target horizontal page coordinate
 * @param {HTMLElement} element - The contentEditable element
 * @param {number} targetPageX - The target horizontal page coordinate
 * @param {string} direction - Search direction: 'forward' (start to end) or 'backward' (end to start)
 * @returns {number} - The cursor position (0-based index) closest to targetPageX
 */
export const getClosestCharIndex = (element, targetPageX, direction = 'forward') => {
  if (!element) return 0;
  
  const textLength = element.textContent?.length || 0;
  if (textLength === 0) return 0;
  
  const range = document.createRange();
  const sel = window.getSelection();
  const textNode = element.firstChild;
  
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return 0;
  
  let closestIndex = direction === 'forward' ? 0 : textLength;
  let minDistance = Infinity;
  let prevDiff = null;
  
  // Determine iteration order based on direction
  const start = direction === 'forward' ? 0 : textLength;
  const end = direction === 'forward' ? textLength : 0;
  const step = direction === 'forward' ? 1 : -1;
  
  // Check each character position
  for (let pos = start; direction === 'forward' ? pos <= end : pos >= end; pos += step) {
    try {
      // Set cursor to this position temporarily
      range.setStart(textNode, pos);
      range.collapse(true);
      
      // Get the rect for this position
      const rect = range.getBoundingClientRect();
      const pageX = rect.left + window.scrollX;
      
      // Calculate distance and difference
      const diff = pageX - targetPageX;
      const distance = Math.abs(diff);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = pos;
      }
      
      // Early stop: if we've passed the target (sign change)
      // Forward: negative to positive (moving right past target)
      // Backward: positive to negative (moving left past target)
      if (prevDiff !== null) {
        const crossedTarget = direction === 'forward' 
          ? (prevDiff < 0 && diff > 0)  // Was before, now after
          : (prevDiff > 0 && diff < 0); // Was after, now before
        
        if (crossedTarget) {
          break;
        }
      }
      
      prevDiff = diff;
    } catch (e) {
      // If position is invalid, skip it
      continue;
    }
  }
  
  return closestIndex;
};

/**
 * Find the segment index closest to a target page coordinate (for rich text nodes with multiple segments)
 * Handles multi-row layouts by considering both vertical (Y) and horizontal (X) distances
 * @param {Array<HTMLElement>} segmentElements - Array of segment DOM elements (in order)
 * @param {number} targetPageX - The target horizontal page coordinate
 * @param {number} targetPageY - The target vertical page coordinate (optional, for multi-row)
 * @param {string} direction - Search direction: 'forward' (start to end) or 'backward' (end to start)
 * @returns {number} - The segment index (0-based) closest to the target coordinates
 */
export const getClosestSegmentIndex = (segmentElements, targetPageX, targetPageY = null, direction = 'forward') => {
  if (!segmentElements || segmentElements.length === 0) return 0;
  
  let closestIndex = direction === 'forward' ? 0 : segmentElements.length - 1;
  let minDistance = Infinity;
  
  // Determine iteration order based on direction
  const start = direction === 'forward' ? 0 : segmentElements.length - 1;
  const end = direction === 'forward' ? segmentElements.length - 1 : 0;
  const step = direction === 'forward' ? 1 : -1;
  
  // Iterate through segments to find the closest one
  for (let i = start; direction === 'forward' ? i <= end : i >= end; i += step) {
    const element = segmentElements[i];
    if (!element) continue;
    
    try {
      // Get segment's bounding rect and convert to page coordinates
      const rect = element.getBoundingClientRect();
      const pageX = rect.left + window.scrollX;
      const pageY = rect.top + window.scrollY;
      const pageXEnd = rect.right + window.scrollX;
      const pageYEnd = rect.bottom + window.scrollY;
      
      // Calculate distance based on whether we're considering vertical position
      let distance;
      
      if (targetPageY !== null) {
        // Multi-row mode: consider both X and Y distances
        // Priority: vertical distance first (which row), then horizontal distance (which segment in row)
        
        // Calculate vertical distance (Y)
        let distanceY = 0;
        if (targetPageY < pageY) {
          // Target is above this segment
          distanceY = pageY - targetPageY;
        } else if (targetPageY > pageYEnd) {
          // Target is below this segment
          distanceY = targetPageY - pageYEnd;
        }
        // If targetPageY is within segment's Y range, distanceY = 0
        
        // Calculate horizontal distance (X)
        let distanceX = 0;
        if (targetPageX < pageX) {
          // Target is to the left of this segment
          distanceX = pageX - targetPageX;
        } else if (targetPageX > pageXEnd) {
          // Target is to the right of this segment
          distanceX = targetPageX - pageXEnd;
        }
        // If targetPageX is within segment's X range, distanceX = 0
        
        // Combined distance: prioritize Y (row selection), then X (segment in row)
        // Weight Y distance more heavily to prefer same-row segments
        distance = (distanceY * 100) + distanceX;
        
      } else {
        // Horizontal-only mode: consider only X distance
        let distanceX = 0;
        if (targetPageX < pageX) {
          distanceX = pageX - targetPageX;
        } else if (targetPageX > pageXEnd) {
          distanceX = targetPageX - pageXEnd;
        }
        distance = distanceX;
      }
      
      // Update closest segment if this one is closer
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
      
      // Early stop optimization for horizontal-only mode
      // If we've moved past the target horizontally and we're on a single row, stop
      if (targetPageY === null && direction === 'forward' && pageX > targetPageX) {
        break;
      } else if (targetPageY === null && direction === 'backward' && pageXEnd < targetPageX) {
        break;
      }
      
    } catch (e) {
      // If element measurement fails, skip it
      continue;
    }
  }
  
  return closestIndex;
};

