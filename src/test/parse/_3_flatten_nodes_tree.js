import { parseLatexInline } from './_4_latex.js';

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
