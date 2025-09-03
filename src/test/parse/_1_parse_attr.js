/**
 * parse square bracket attributes from text
 * example:
 *   xxx[a=b,c=d]
 *   xxx[yy]
 *   [a=b,c=d]xxx
 */

/**
 * Extract and parse square bracket attributes from a string
 * @param {string} nodeStr - The string that may contain square bracket attributes
 * @returns {object} - {textRaw, attr, textOriginal}
 */
export function extractSquareBracketAttr(nodeStr) {
  if (!nodeStr || typeof nodeStr !== 'string') {
    return { textRaw: null, attr: {}, textOriginal: nodeStr || '' };
  }

  const trimmed = nodeStr.trim();
  if (!trimmed) {
    return { textRaw: null, attr: {}, textOriginal: trimmed };
  }

  // Find all potential square bracket matches
  const regex = /\[([^\[\]]*)\]/g;
  const matches = [];
  let match;
  
  while ((match = regex.exec(trimmed)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      content: match[1],
      fullMatch: match[0]
    });
  }

  if (matches.length === 0) {
    // No square brackets found
    return { textRaw: trimmed, attr: {}, textOriginal: trimmed };
  }

  // Find the first non-empty bracket (priority: start > end > middle)
  let selectedMatch = null;
  
  // Priority 1: Bracket at the very start
  if (matches[0].start === 0 && matches[0].content.trim()) {
    selectedMatch = matches[0];
  }
  
  // Priority 2: Bracket at the very end (if no start bracket found)
  if (!selectedMatch) {
    const lastMatch = matches[matches.length - 1];
    if (lastMatch.end === trimmed.length && lastMatch.content.trim()) {
      selectedMatch = lastMatch;
    }
  }
  
  // Priority 3: Any other non-empty bracket
  if (!selectedMatch) {
    for (let i = 0; i < matches.length; i++) {
      if (matches[i].content.trim()) {
        selectedMatch = matches[i];
        break;
      }
    }
  }

  if (!selectedMatch) {
    // All brackets are empty, handle corner cases
    if (matches.length === 1) {
      // Single empty bracket: []a or a[]
      const bracket = matches[0];
      const textRaw = (trimmed.substring(0, bracket.start) + trimmed.substring(bracket.end)).trim();
      return { textRaw: textRaw || null, attr: {}, textOriginal: trimmed };
    } else {
      // Multiple empty brackets: [][] -> textRaw: '[]' (only one bracket pair should remain)
      const firstBracket = matches[0];
      const secondBracket = matches[1];
      
      // If it's exactly "[][]", return textRaw as "[]"
      if (trimmed === '[][]') {
        return { textRaw: '[]', attr: {}, textOriginal: trimmed };
      }
      
      // For other cases like "a[][]b", remove one pair of brackets
      let textRaw = trimmed;
      if (matches.length >= 2) {
        // Remove the last empty bracket pair
        const lastEmptyBracket = matches[matches.length - 1];
        textRaw = trimmed.substring(0, lastEmptyBracket.start) + trimmed.substring(lastEmptyBracket.end);
      }
      return { textRaw: textRaw.trim(), attr: {}, textOriginal: trimmed };
    }
  }

  // Extract text content (everything except the selected bracket)
  const textRaw = (trimmed.substring(0, selectedMatch.start) + trimmed.substring(selectedMatch.end)).trim() || null;

  // Parse attributes from bracket content
  const attrString = selectedMatch.content.trim();
  if (!attrString) {
    return { textRaw, attr: {}, textOriginal: trimmed };
  }

  // Check if it's a shorthand attribute (no = sign)
  if (!attrString.includes('=')) {
    const shorthandAttr = parseShorthandAttribute(attrString);
    return { textRaw, attr: shorthandAttr, textOriginal: trimmed };
  }

  // Parse key=value pairs
  const attr = {};
  const pairs = attrString.split(',').map(pair => pair.trim()).filter(Boolean);
  
  for (const pair of pairs) {
    if (pair.includes('=')) {
      const [key, ...valueParts] = pair.split('=');
      const rawKey = key.trim();
      const rawValue = valueParts.join('=').trim();
      
      if (rawKey) {
        // Normalize key and value
        const normalizedKey = normalizeAttrKey(rawKey);
        const normalizedValue = normalizeAttributeValue(normalizedKey, rawValue);
        
        // Handle quoted values
        const cleanValue = normalizedValue.replace(/^["']|["']$/g, '');
        
        // Handle numeric values
        if (normalizedKey === 'valueNum' && !isNaN(cleanValue)) {
          attr[normalizedKey] = parseInt(cleanValue, 10);
        } else {
          attr[normalizedKey] = cleanValue;
        }
      }
    } else {
      // Handle shorthand mixed with key=value pairs
      const shorthandAttr = parseShorthandAttribute(pair);
      Object.assign(attr, shorthandAttr);
    }
  }

  return { textRaw, attr, textOriginal: trimmed };
}

/**
 * Normalize attribute keys to canonical form
 * @param {string} key - The attribute key
 * @returns {string} - Normalized key
 */
export function normalizeAttrKey(key) {
  const lowerKey = key.toLowerCase().trim();
  
  // Map synonyms to canonical keys
  const keyMappings = {
    'style': 'selfDisplay',
    'self': 'selfDisplay',
    'display': 'selfDisplay',
    'selfdisplay': 'selfDisplay',
    'self_display': 'selfDisplay',
    'selfstyle': 'selfDisplay',
    'self_style': 'selfDisplay',
    
    'child': 'childDisplay', 
    'childstyle': 'childDisplay',
    'child_style': 'childDisplay',
    'childdisplay': 'childDisplay',
    'child_display': 'childDisplay',
    
    'class': 'selfClass',
    'selfclass': 'selfClass',
    'self_class': 'selfClass',
    
    'childclass': 'childClass',
    'child_class': 'childClass',
    
    'valuenum': 'valueNum',
    'value_num': 'valueNum',
    
    'paneldefault': 'panelDefault',
    'panel_default': 'panelDefault'
  };
  
  return keyMappings[lowerKey] || key;
}

/**
 * Normalize attribute values, especially for childDisplay
 * @param {string} key - The attribute key  
 * @param {string} value - The attribute value
 * @returns {string} - Normalized value
 */
export function normalizeAttributeValue(key, value) {
  if (key === 'childDisplay') {
    const lowerValue = value.toLowerCase().trim();
    const childDisplayMappings = {
      'unordered-list': 'ul',
      'unordered_list': 'ul',
      'bullet-list': 'ul',
      'bullet_list': 'ul',
      'ordered-list': 'ol', 
      'ordered_list': 'ol',
      'numbered-list': 'ol',
      'numbered_list': 'ol',
      'paragraph': 'p',
      'paragraphs': 'p',
      'paragraph-list': 'p',
      'paragraph_list': 'p'
    };
    return childDisplayMappings[lowerValue] || value;
  }
  return value;
}

/**
 * Parse shorthand attribute (no = sign)
 * @param {string} shorthand - The shorthand value
 * @returns {object} - Attribute object
 */
export function parseShorthandAttribute(shorthand) {
  const trimmed = shorthand.trim().toLowerCase();
  
  // Handle special node types
  if (trimmed === 'latex') {
    return { type: 'latex', selfDisplay: 'latex' };
  } else if (trimmed === 'image' || trimmed === 'img') {
    return { type: 'image', selfDisplay: 'image' };
  } else if (trimmed === 'video' || trimmed === 'vid') {
    return { type: 'video', selfDisplay: 'video' };
  }
  
  // Determine if it's selfDisplay or childDisplay based on the value
  const childDisplayValues = ['ul', 'ol', 'p', 'timeline', 'plain-list', 'plain_list', 'unordered-list', 'ordered-list', 'paragraph'];
  
  if (childDisplayValues.includes(trimmed)) {
    return { childDisplay: normalizeAttributeValue('childDisplay', trimmed) };
  } else {
    return { selfDisplay: trimmed };
  }
}
