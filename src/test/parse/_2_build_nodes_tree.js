import { extractSquareBracketAttr } from './_1_parse_attr.js';

/**
 * Process nodes - parse square bracket attributes and build nested structure
 * @param {any} jsonData - Raw JSON data from YAML parsing
 * @returns {any} - Processed nested structure with parsed attributes
 */
export function processNodes(jsonData) {
  // Handle single dictionary input by converting to array
  if (jsonData && typeof jsonData === 'object' && !Array.isArray(jsonData)) {
    jsonData = [jsonData];
  }
  
  if (!Array.isArray(jsonData)) {
    throw new Error('Expected array or object input for processing');
  }
  
  return jsonData.map(item => processNode(item));
}

/**
 * Process a single node (recursive)
 * @param {any} node - Node to process
 * @returns {any} - Processed node
 */
function processNode(node) {
  if (typeof node === 'string') {
    // Process string nodes - extract square bracket attributes
    const { textRaw, attr, textOriginal } = extractSquareBracketAttr(node);
    
    return {
      type: 'text',
      textRaw,
      textOriginal,
      attr
    };
  } else if (Array.isArray(node)) {
    // Process arrays recursively
    return node.map(item => processNode(item));
  } else if (node && typeof node === 'object') {
    // Process objects - handle keys with square bracket attributes
    const processedObj = {};
    
    for (const [key, value] of Object.entries(node)) {
      // Extract attributes from the key
      const { textRaw, attr, textOriginal } = extractSquareBracketAttr(key);
      
      // Determine node type based on attributes
      const nodeType = determineNodeType(attr);
      
      // Process the value recursively
      const processedValue = Array.isArray(value) ? value.map(item => processNode(item)) : processNode(value);
      
      // Create processed node
      const processedNode = {
        type: nodeType,
        textRaw,
        textOriginal, 
        attr,
        children: processedValue
      };
      
      // Use original key as the object key
      processedObj[textOriginal] = processedNode;
    }
    
    return processedObj;
  }
  
  return node;
}

/**
 * Determine node type based on attributes
 * @param {object} attr - Parsed attributes
 * @returns {string} - Node type
 */
function determineNodeType(attr) {
  if (attr.selfDisplay) {
    return 'node';
  } else if (attr.childDisplay || attr.childClass || attr.valueNum !== null) {
    return 'node';
  } else {
    return 'node'; // Default type
  }
}
