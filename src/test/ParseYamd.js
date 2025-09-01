import yaml from 'js-yaml';

/**
 * Parse YAML string to JSON object
 * @param {string} yamlString - The YAML string to parse
 * @returns {Object} - Parsed result with success status and data/error
 */
export const parseYamlToJson = (yamlString) => {
  try {
    if (!yamlString || yamlString.trim() === '') {
      return {
        success: false,
        error: 'Empty YAML input',
        data: null
      };
    }

    const jsonData = yaml.load(yamlString);
    
    return {
      success: true,
      error: null,
      data: jsonData
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
};

/**
 * Format JSON object for pretty display
 * @param {*} jsonData - The JSON data to format
 * @param {number} indent - Number of spaces for indentation
 * @returns {string} - Formatted JSON string
 */
export const formatJson = (jsonData, indent = 2) => {
  try {
    if (jsonData === null || jsonData === undefined) {
      return 'null';
    }
    return JSON.stringify(jsonData, null, indent);
  } catch (error) {
    return `Error formatting JSON: ${error.message}`;
  }
};

/**
 * Get sample YAML for testing
 * @returns {string} - Sample YAML string
 */
export const getSampleYaml = () => {
  return `# Sample Yamd Document
- Programming Languages[self=key]:
  - Python
  - JavaScript[selfClass=skill-tag-learning]
  - TypeScript

- Frameworks[self=divider,child=ul]:
  - React
  - Node.js
  - Backend[self=key]:
    - Express
    - FastAPI

- Project Info[self=panel,child=ul,panelDefault=expand]:
  - "Status: In Progress"
  - "Team: 5 members[selfClass=edu-tag]"

- "[self=none,child=plain-list]":
  - Item 1
  - "Item 2[selfClass=special-item]"`;
};



export const extractSquareBracketAttr = (nodeStr) => {
  /*
    - xxx[a=b,c=d] -> {textRaw: xxx, a:'b', c:'d', children: ...}
    - [a=b,c=d]xxx -> {textRaw: xxx, a:'b', c:'d', children: ...}
    
    corner cases:
      - [a=b,c=d] -> {textRaw: null, a:'b', c:'d', children: ...}
      - []a OR a[] -> {textRaw: 'a', children: ...}
      - [][a=b,c=d] -> {} -> {textRaw: '[]', a:'b', c:'d', children: ...}
      - [][] -> {} -> {textRaw: '[]', children: ...}
  
    */
  
  if (!nodeStr || typeof nodeStr !== 'string') {
    return { textRaw: nodeStr || '', attributes: {} };
  }

  const trimmed = nodeStr.trim();
  if (trimmed === '') {
    return { textRaw: '', attributes: {} };
  }

  // Find all bracket pairs
  const bracketRegex = /\[([^\]]*)\]/g;
  let matches = [];
  let match;
  
  while ((match = bracketRegex.exec(trimmed)) !== null) {
    matches.push({
      fullMatch: match[0],
      content: match[1],
      start: match.index,
      end: match.index + match[0].length
    });
  }

  if (matches.length === 0) {
    // No brackets found
    return { textRaw: trimmed, attributes: {} };
  }

  // Handle multiple brackets - use the last valid one with content
  let selectedMatch = null;
  for (let i = matches.length - 1; i >= 0; i--) {
    if (matches[i].content.trim()) {
      selectedMatch = matches[i];
      break;
    }
  }

  if (!selectedMatch) {
    // All brackets are empty, handle corner cases
    if (matches.length === 1) {
      // Single empty bracket: []a or a[]
      const bracket = matches[0];
      const textRaw = (trimmed.substring(0, bracket.start) + trimmed.substring(bracket.end)).trim();
      return { textRaw: textRaw || null, attributes: {} };
    } else {
      // Multiple empty brackets: [][] -> textRaw: '[]'
      const firstBracket = matches[0];
      const textRaw = trimmed.substring(0, firstBracket.start) + '[]' + trimmed.substring(firstBracket.end);
      return { textRaw: textRaw.trim(), attributes: {} };
    }
  }

  // Extract text content (everything except the selected bracket)
  const textRaw = (trimmed.substring(0, selectedMatch.start) + trimmed.substring(selectedMatch.end)).trim() || null;

  // Parse attributes from bracket content
  const attributes = {};
  const bracketContent = selectedMatch.content.trim();
  
  if (bracketContent) {
    // Split by comma, handling quoted values
    const attrPairs = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < bracketContent.length; i++) {
      const char = bracketContent[i];
      
      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
        current += char;
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
        current += char;
      } else if (!inQuotes && char === ',') {
        attrPairs.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      attrPairs.push(current.trim());
    }
    
    attrPairs.forEach(pair => {
      const equalIndex = pair.indexOf('=');
      if (equalIndex > 0) {
        const key = pair.substring(0, equalIndex).trim();
        let value = pair.substring(equalIndex + 1).trim();
        
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        // Convert special values
        if (key === 'valueNum') {
          const numValue = parseInt(value);
          attributes[key] = isNaN(numValue) ? null : numValue;
        } else {
          attributes[key] = value;
        }
      } else if (pair.trim()) {
        // Handle cases like just "panel" without equals
        attributes[pair.trim()] = true;
      }
    });
  }

  return { textRaw, attributes };
}


export const processNodes = (jsonData) => {
  // dealing with xxx[a=b,c=d] grammar
  // use extractSquareBracketAttr
  
  const processNode = (node) => {
    if (Array.isArray(node)) {
      // Process each item in array
      return node.map(item => processNode(item));
    } else if (node && typeof node === 'object') {
      // Process object - handle key-value pairs with potential square bracket syntax
      const processedNode = {};
      
      Object.entries(node).forEach(([key, value]) => {
        // Parse the key for square bracket attributes
        const { textRaw, attributes } = extractSquareBracketAttr(key);
        
        // Use textRaw as the key, or the original key if textRaw is null/empty
        const nodeKey = textRaw || key;
        
        // Create processed node structure
        processedNode[nodeKey] = {
          originalKey: key,
          textRaw: textRaw,
          attributes: attributes,
          type: determineNodeType(attributes),
          children: processNode(value) // Recursively process children
        };
        
        // Copy relevant attributes to top level for easy access
        if (attributes.self) processedNode[nodeKey].selfStyle = attributes.self;
        if (attributes.child) processedNode[nodeKey].childStyle = attributes.child;
        if (attributes.selfClass) processedNode[nodeKey].selfClass = attributes.selfClass;
        if (attributes.childClass) processedNode[nodeKey].childClass = attributes.childClass;
        if (attributes.valueNum !== undefined) processedNode[nodeKey].valueNum = attributes.valueNum;
        if (attributes.panelDefault) processedNode[nodeKey].panelDefault = attributes.panelDefault;
      });
      
      return processedNode;
    } else {
      // Handle primitive values (strings, numbers, etc.)
      if (typeof node === 'string') {
        const { textRaw, attributes } = extractSquareBracketAttr(node);
        return {
          type: 'text',
          content: textRaw || node,
          originalContent: node,
          attributes: attributes,
          selfClass: attributes.selfClass || null
        };
      }
      return {
        type: 'primitive',
        content: node,
        originalContent: node,
        attributes: {}
      };
    }
  };

  try {
    return processNode(jsonData);
  } catch (error) {
    console.error('Error processing nodes:', error);
    return { 
      type: 'error',
      error: error.message, 
      originalData: jsonData 
    };
  }
};

// Helper function to determine node type from attributes
const determineNodeType = (attributes) => {
  if (attributes.self === 'panel') return 'panel';
  if (attributes.self === 'divider') return 'divider';
  if (attributes.self === 'key') return 'key';
  if (attributes.self === 'top-right') return 'top-right';
  if (attributes.self === 'none') return 'none';
  return 'node'; // default
};

export const flattenJson = (processedData) => {
  // Convert processed nested structure to flattened dict with ID references
  const flattened = {};
  let idCounter = 0;
  
  const generateId = () => `yamd_${String(++idCounter).padStart(3, '0')}`;
  
  const flattenNode = (node, parentId = null) => {
    const nodeId = generateId();
    
    if (Array.isArray(node)) {
      // Handle arrays
      flattened[nodeId] = {
        id: nodeId,
        type: 'array',
        parentId,
        children: []
      };
      
      node.forEach(item => {
        const childId = flattenNode(item, nodeId);
        flattened[nodeId].children.push(childId);
      });
      
    } else if (node && typeof node === 'object' && node.type) {
      // Handle processed nodes with type
      flattened[nodeId] = {
        id: nodeId,
        type: node.type,
        parentId,
        children: []
      };
      
      // Copy all relevant properties
      if (node.textRaw !== undefined) flattened[nodeId].textRaw = node.textRaw;
      if (node.originalKey) flattened[nodeId].originalKey = node.originalKey;
      if (node.attributes) flattened[nodeId].attributes = node.attributes;
      if (node.selfStyle) flattened[nodeId].selfStyle = node.selfStyle;
      if (node.childStyle) flattened[nodeId].childStyle = node.childStyle;
      if (node.selfClass) flattened[nodeId].selfClass = node.selfClass;
      if (node.childClass) flattened[nodeId].childClass = node.childClass;
      if (node.valueNum !== undefined) flattened[nodeId].valueNum = node.valueNum;
      if (node.panelDefault) flattened[nodeId].panelDefault = node.panelDefault;
      if (node.content !== undefined) flattened[nodeId].content = node.content;
      if (node.originalContent) flattened[nodeId].originalContent = node.originalContent;
      if (node.error) flattened[nodeId].error = node.error;
      if (node.originalData) flattened[nodeId].originalData = node.originalData;
      
      // Process children
      if (node.children) {
        if (Array.isArray(node.children)) {
          node.children.forEach(child => {
            const childId = flattenNode(child, nodeId);
            flattened[nodeId].children.push(childId);
          });
        } else if (typeof node.children === 'object') {
          Object.entries(node.children).forEach(([key, child]) => {
            const childId = flattenNode(child, nodeId);
            flattened[nodeId].children.push(childId);
            // Store the original key relationship
            if (!flattened[nodeId].childKeys) flattened[nodeId].childKeys = {};
            flattened[nodeId].childKeys[childId] = key;
          });
        }
      }
      
    } else if (node && typeof node === 'object') {
      // Handle regular objects without type
      flattened[nodeId] = {
        id: nodeId,
        type: 'container',
        parentId,
        children: []
      };
      
      Object.entries(node).forEach(([key, value]) => {
        const childId = flattenNode(value, nodeId);
        flattened[nodeId].children.push(childId);
        // Store the original key relationship
        if (!flattened[nodeId].childKeys) flattened[nodeId].childKeys = {};
        flattened[nodeId].childKeys[childId] = key;
      });
      
    } else {
      // Handle primitive values
      flattened[nodeId] = {
        id: nodeId,
        type: 'text',
        parentId,
        content: String(node),
        children: []
      };
    }
    
    return nodeId;
  };

  try {
    const rootId = flattenNode(processedData);
    return { flattened, rootId };
  } catch (error) {
    console.error('Error flattening nodes:', error);
    const errorId = 'error_001';
    return { 
      flattened: { 
        [errorId]: { 
          id: errorId, 
          type: 'error', 
          error: error.message,
          originalData: processedData,
          children: []
        } 
      }, 
      rootId: errorId 
    };
  }
};