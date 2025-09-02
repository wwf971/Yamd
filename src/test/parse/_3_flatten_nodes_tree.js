/**
 * Flatten nested node structure into ID-based dictionary
 * @param {any} processedData - Processed nested node structure
 * @returns {object} - {flattened, rootId}
 */
export function flattenJson(processedData) {
  const flattened = {};
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
      flattened[nodeId] = {
        id: nodeId,
        type: node.type,
        parentId,
        textRaw: node.textRaw,
        textOriginal: node.textOriginal,
        attr: node.attr || {},
        children: []
      };
      
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
      // Handle regular objects (convert to node structure)
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
      flattened[nodeId] = {
        id: nodeId,
        type: 'text',
        parentId,
        textRaw: String(node),
        textOriginal: String(node),
        attr: {}
      };
    }
    
    return nodeId;
  };
  
  const rootId = flattenNode(processedData);
  
  return { flattened, rootId };
}
