// No longer need parseLatexInline - text segment processing happens in step 4

/**
 * Check if a node is a leaf node type (nodes that don't have meaningful children)
 * 
 * Leaf nodes are special node types that represent self-contained content blocks
 * and should not have their structure further processed during flattening.
 * 
 * @param {object} node - Node to check
 * @returns {boolean} - True if node is a leaf node type
 * 
 * @example
 * // Returns true for leaf nodes
 * isLeafNodeType({ type: 'latex', textRaw: 'E=mc^2' })
 * isLeafNodeType({ type: 'image', textRaw: 'image.jpg' })
 * isLeafNodeType({ type: 'video', textRaw: 'video.mp4' })
 * 
 * // Returns false for non-leaf nodes
 * isLeafNodeType({ type: 'node', children: [...] })
 * isLeafNodeType({ type: 'text', textRaw: 'plain text' })
 */
function isLeafNodeType(node) {
  if (!node || typeof node !== 'object' || !node.type) {
    return false;
  }
  
  // Define leaf node types - easily extensible for future types
  // Add new leaf node types here as needed (e.g., 'audio', 'chart', 'diagram', etc.)
  // Note: image-list is NOT a leaf node because it has children (individual images)
  const leafNodeTypes = ['latex', 'image', 'video'];
  return leafNodeTypes.includes(node.type);
}

/**
 * Flatten nested node structure into ID-based dictionary
 * @param {any} processedData - Processed nested node structure
 * @returns {object} - {nodes, rootNodeId, assets}
 */
export function flattenJson(processedData) {
  const flattened = {};
  const assets = {}; // New assets system for LaTeX and other rich content
  let idCounter = 0;
  
  const generateId = () => `yamd_${String(++idCounter).padStart(3, '0')}`;
  
  const flattenNode = (node, parentId = null) => {
    const nodeId = generateId();
    
    if (Array.isArray(node)) {
      // Handle arrays
      flattened[nodeId] = { // special for root node
        id: nodeId,
        type: 'array',
        parentId,
        children: [],
        attr: {
          selfDisplay: 'none',  // Arrays should not display themselves
          childDisplay: 'pl'    // Children should display as plain list (no bullets)
        }
      };
      
      node.forEach(item => {
        const childId = flattenNode(item, nodeId);
        flattened[nodeId].children.push(childId);
      });
      
    } else if (node && typeof node === 'object' && node.type) {
      // Handle processed nodes with type
      const nodeData = {
        id: nodeId,
        type: node.type,
        parentId,
        textRaw: node.textRaw,
        textOriginal: node.textOriginal,
        attr: node.attr || {},
        children: []
      };
      
      // Timeline-specific logic: set selfDisplay to 'none' for empty timeline children
      if (node.textRaw === '' && !nodeData.attr.selfDisplay && parentId) {
        // Check if the immediate parent has childDisplay='timeline'
        const parentNode = flattened[parentId];
        if (parentNode && parentNode.attr && parentNode.attr.childDisplay === 'timeline') {
          nodeData.attr.selfDisplay = 'none';
          console.log(`✅ Set selfDisplay='none' for timeline child ${nodeId} (${node.textOriginal})`);
        }
      }
      
      // Preserve special node attributes
      if (node.type === 'latex' || node.type === 'image' || node.type === 'video') {
        if (node.caption !== undefined) {
          nodeData.caption = node.caption;
        }
        // Height is now stored in attr, but preserve it if it exists at node level
        if (node.height !== undefined) {
          nodeData.height = node.height;
        }
        // Preserve user-defined HTML ID
        if (node.htmlId !== undefined) {
          nodeData.htmlId = node.htmlId;
        }
      }
      
      // Note: LaTeX processing will be done in a separate step (step 4)
      // This flattening is step 3, LaTeX processing happens after flattening
      
      flattened[nodeId] = nodeData;
      
      if (node.children) {
        if (Array.isArray(node.children)) {
          node.children.forEach(child => {
            const childId = flattenNode(child, nodeId);
            flattened[nodeId].children.push(childId);
          });
        } else {
          const childId = flattenNode(node.children, nodeId);
          flattened[nodeId].children.push(childId);
        }
      }
      
    } else if (node && typeof node === 'object') {
      // Handle regular objects
      const entries = Object.entries(node);
      
      // Optimization: If object has only one entry and the value is a leaf node or primitive,
      // flatten the value directly instead of creating intermediate object
      if (entries.length === 1) {
        const [key, value] = entries[0];
        if (isLeafNodeType(value)
          // || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ) {
          // This is a single leaf node or primitive value - flatten it directly to avoid intermediate object
          return flattenNode(value, parentId);
        }
        /*
          - a:b
          - cc
          will be interpreted as:
          - a
            -b
        */
        return flattenNode(value, parentId);
      }
      
      // Otherwise, create object node as before
      flattened[nodeId] = {
        id: nodeId,
        type: 'object',
        parentId,
        children: []
      };
      
      Object.entries(node).forEach(([key, value]) => {
        const childId = flattenNode(value, nodeId);
        flattened[nodeId].children.push(childId);
      });
      
    } else {
      // Handle primitive values
      const textString = String(node);
      const nodeData = {
        id: nodeId,
        type: 'text',
        parentId,
        textRaw: textString,
        textOriginal: textString,
        attr: {}
      };
      
      // Note: LaTeX processing will be done in a separate step (step 4)
      // This flattening is step 3, LaTeX processing happens after flattening
      
      flattened[nodeId] = nodeData;
    }
    
    return nodeId;
  };
  
  const rootId = flattenNode(processedData);
  
  return { nodes: flattened, rootNodeId: rootId, assets };
}
