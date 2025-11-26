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
  // Case 1: anchorNode is the contentEditable element itself (empty or at end)
  // Case 2: cursor is at the end of the text node
  // Case 3: fallback - cursor position >= total text length
  const isAtEnd = 
    anchorNode === element || 
    (anchorNode?.nodeType === Node.TEXT_NODE && cursorPos >= (anchorNode.textContent?.length || 0)) ||
    cursorPos >= textLength;
  
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
  
  const cursorPos = selection.anchorOffset || 0;
  
  return cursorPos === 0;
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
export const setCursorPosition = (element, position) => {
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
export const getClosestCursorPos = (element, targetPageX, direction = 'forward') => {
  if (!element) return 0;
  
  const textLength = element.textContent?.length || 0;
  if (textLength === 0) return 0;
  
  const range = document.createRange();
  const sel = window.getSelection();
  const textNode = element.firstChild;
  
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return 0;
  
  let closestPos = direction === 'forward' ? 0 : textLength;
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
        closestPos = pos;
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
  
  return closestPos;
};
