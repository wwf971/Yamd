/**
 * EditUtils - Functions for editing the document structure
 * These functions modify the flattened docData structure to perform operations like indent/outdent
 */

/**
 * Outdent a node - move it up one level in the hierarchy
 * Makes the node a child of its parent's parent, positioned after the original parent
 * 
 * @param {string} nodeId - ID of the node to outdent
 * @param {object} docData - Flattened document data with nodes, rootNodeId, etc.
 * @returns {object} - {code: number, message?: string, data?: object}
 */
export function outdentNode(nodeId, docData) {
  // Validate input
  if (!nodeId || !docData || !docData.nodes) {
    return { code: -1, message: 'Invalid input: nodeId and docData.nodes required' };
  }

  const nodes = docData.nodes;
  const targetNode = nodes[nodeId];
  
  if (!targetNode) {
    return { code: -1, message: `Node ${nodeId} not found` };
  }

  if (!targetNode.parentId) {
    return { code: -1, message: 'Cannot outdent root node - it has no parent' };
  }

  const parentNode = nodes[targetNode.parentId];
  if (!parentNode) {
    return { code: -1, message: `Parent node ${targetNode.parentId} not found` };
  }

  if (!parentNode.parentId) {
    return { code: -1, message: 'Cannot outdent - parent is already at root level' };
  }

  const grandparentNode = nodes[parentNode.parentId];
  if (!grandparentNode) {
    return { code: -1, message: `Grandparent node ${parentNode.parentId} not found` };
  }

  // Create a deep copy of docData to avoid mutating the original
  const newDocData = JSON.parse(JSON.stringify(docData));
  const newNodes = newDocData.nodes;

  // Step 1: Remove node from its current parent's children array
  const newParentNode = newNodes[targetNode.parentId];
  const nodeIndex = newParentNode.children.indexOf(nodeId);
  if (nodeIndex === -1) {
    return { code: -1, message: 'Node not found in parent\'s children array' };
  }
  newParentNode.children.splice(nodeIndex, 1);

  // Step 2: Update the target node's parentId to point to grandparent
  const newTargetNode = newNodes[nodeId];
  newTargetNode.parentId = parentNode.parentId;

  // Step 3: Insert node into grandparent's children array, right after the original parent
  const newGrandparentNode = newNodes[parentNode.parentId];
  const parentIndex = newGrandparentNode.children.indexOf(targetNode.parentId);
  if (parentIndex === -1) {
    return { code: -1, message: 'Parent not found in grandparent\'s children array' };
  }
  
  // Insert after the parent (parentIndex + 1)
  newGrandparentNode.children.splice(parentIndex + 1, 0, nodeId);

  return { 
    code: 0, 
    message: `Node ${nodeId} outdented successfully`, 
    data: newDocData 
  };
}

/**
 * Indent a node - move it down one level in the hierarchy
 * Makes the node a child of its previous sibling
 * 
 * @param {string} nodeId - ID of the node to indent
 * @param {object} docData - Flattened document data with nodes, rootNodeId, etc.
 * @returns {object} - {code: number, message?: string, data?: object}
 */
export function indentNode(nodeId, docData) {
  // Validate input
  if (!nodeId || !docData || !docData.nodes) {
    return { code: -1, message: 'Invalid input: nodeId and docData.nodes required' };
  }

  const nodes = docData.nodes;
  const targetNode = nodes[nodeId];
  
  if (!targetNode) {
    return { code: -1, message: `Node ${nodeId} not found` };
  }

  if (!targetNode.parentId) {
    return { code: -1, message: 'Cannot indent root node - it has no parent' };
  }

  const parentNode = nodes[targetNode.parentId];
  if (!parentNode) {
    return { code: -1, message: `Parent node ${targetNode.parentId} not found` };
  }

  // Find the node's position in parent's children array
  const nodeIndex = parentNode.children.indexOf(nodeId);
  if (nodeIndex === -1) {
    return { code: -1, message: 'Node not found in parent\'s children array' };
  }

  if (nodeIndex === 0) {
    return { code: -1, message: 'Cannot indent - node is the first child (no previous sibling)' };
  }

  // Get the previous sibling (which will become the new parent)
  const newParentId = parentNode.children[nodeIndex - 1];
  const newParentNode = nodes[newParentId];
  
  if (!newParentNode) {
    return { code: -1, message: `New parent node ${newParentId} not found` };
  }

  // Create a deep copy of docData to avoid mutating the original
  const newDocData = JSON.parse(JSON.stringify(docData));
  const newNodes = newDocData.nodes;

  // Step 1: Remove node from its current parent's children array
  const currentParentNode = newNodes[targetNode.parentId];
  currentParentNode.children.splice(nodeIndex, 1);

  // Step 2: Update the target node's parentId to point to the new parent (previous sibling)
  const newTargetNode = newNodes[nodeId];
  newTargetNode.parentId = newParentId;

  // Step 3: Add node to the new parent's children array (at the end)
  const actualNewParentNode = newNodes[newParentId];
  actualNewParentNode.children.push(nodeId);

  return { 
    code: 0, 
    message: `Node ${nodeId} indented successfully`, 
    data: newDocData 
  };
}

/**
 * Move a node up in its sibling order (swap with previous sibling)
 * 
 * @param {string} nodeId - ID of the node to move up
 * @param {object} docData - Flattened document data
 * @returns {object} - {code: number, message?: string, data?: object}
 */
export function moveNodeUp(nodeId, docData) {
  if (!nodeId || !docData || !docData.nodes) {
    return { code: -1, message: 'Invalid input: nodeId and docData.nodes required' };
  }

  const nodes = docData.nodes;
  const targetNode = nodes[nodeId];
  
  if (!targetNode || !targetNode.parentId) {
    return { code: -1, message: 'Node not found or is root node' };
  }

  const parentNode = nodes[targetNode.parentId];
  const nodeIndex = parentNode.children.indexOf(nodeId);
  
  if (nodeIndex <= 0) {
    return { code: -1, message: 'Node is already at the top of its siblings' };
  }

  // Create a deep copy of docData
  const newDocData = JSON.parse(JSON.stringify(docData));
  const newParentNode = newDocData.nodes[targetNode.parentId];

  // Swap with previous sibling
  [newParentNode.children[nodeIndex - 1], newParentNode.children[nodeIndex]] = 
  [newParentNode.children[nodeIndex], newParentNode.children[nodeIndex - 1]];

  return { 
    code: 0, 
    message: `Node ${nodeId} moved up successfully`, 
    data: newDocData 
  };
}

/**
 * Move a node down in its sibling order (swap with next sibling)
 * 
 * @param {string} nodeId - ID of the node to move down
 * @param {object} docData - Flattened document data
 * @returns {object} - {code: number, message?: string, data?: object}
 */
export function moveNodeDown(nodeId, docData) {
  if (!nodeId || !docData || !docData.nodes) {
    return { code: -1, message: 'Invalid input: nodeId and docData.nodes required' };
  }

  const nodes = docData.nodes;
  const targetNode = nodes[nodeId];
  
  if (!targetNode || !targetNode.parentId) {
    return { code: -1, message: 'Node not found or is root node' };
  }

  const parentNode = nodes[targetNode.parentId];
  const nodeIndex = parentNode.children.indexOf(nodeId);
  
  if (nodeIndex === -1 || nodeIndex >= parentNode.children.length - 1) {
    return { code: -1, message: 'Node is already at the bottom of its siblings' };
  }

  // Create a deep copy of docData
  const newDocData = JSON.parse(JSON.stringify(docData));
  const newParentNode = newDocData.nodes[targetNode.parentId];

  // Swap with next sibling
  [newParentNode.children[nodeIndex], newParentNode.children[nodeIndex + 1]] = 
  [newParentNode.children[nodeIndex + 1], newParentNode.children[nodeIndex]];

  return { 
    code: 0, 
    message: `Node ${nodeId} moved down successfully`, 
    data: newDocData 
  };
}

/**
 * Delete a node from the document
 * Removes the node from its parent's children array and deletes it from the nodes object
 * This function is designed to work with Immer - it validates but doesn't copy data
 * 
 * @param {string} nodeId - ID of the node to delete
 * @param {object} docData - Flattened document data (will be mutated by Immer)
 * @returns {object} - {code: number, message?: string}
 */
export function deleteNode(nodeId, docData) {
  if (!nodeId || !docData || !docData.nodes) {
    return { code: -1, message: 'Invalid input: nodeId and docData.nodes required' };
  }

  const nodes = docData.nodes;
  const targetNode = nodes[nodeId];
  
  if (!targetNode) {
    return { code: -1, message: `Node ${nodeId} not found` };
  }

  if (!targetNode.parentId) {
    return { code: -1, message: 'Cannot delete root node' };
  }

  const parentNode = nodes[targetNode.parentId];
  if (!parentNode) {
    return { code: -1, message: `Parent node ${targetNode.parentId} not found` };
  }

  const nodeIndex = parentNode.children.indexOf(nodeId);
  if (nodeIndex === -1) {
    return { code: -1, message: 'Node not found in parent\'s children array' };
  }

  // These mutations will be handled safely by Immer in the store
  // Step 1: Remove node from parent's children array
  parentNode.children.splice(nodeIndex, 1);

  // Step 2: Delete the node from the nodes object
  delete nodes[nodeId];

  return {
    code: 0,
    message: `Node ${nodeId} deleted successfully`
  };
}

/**
 * Get the target node ID when moving up with arrow key
 * Returns the deepest last descendant of the previous sibling, or parent if first child
 * 
 * @param {string} nodeId - ID of the current node
 * @param {function} getNodeDataById - Function to get node data by ID
 * @returns {string|null} - Target node ID or null if no target
 */
export function getMoveUpTargetId(nodeId, getNodeDataById) {
  const currentNode = getNodeDataById(nodeId);
  const parentId = currentNode?.parentId;
  
  if (!parentId) return null; // Root node
  
  const parentNode = getNodeDataById(parentId);
  const siblings = parentNode?.children || [];
  const currentIndex = siblings.indexOf(nodeId);
  
  if (currentIndex > 0) {
    // Navigate to previous sibling's deepest last descendant
    let targetId = siblings[currentIndex - 1];
    
    // Keep going to last child until we find a node without children
    while (true) {
      const targetNode = getNodeDataById(targetId);
      if (targetNode?.children && targetNode.children.length > 0) {
        // Has children - go to last child
        targetId = targetNode.children[targetNode.children.length - 1];
      } else {
        // No children - this is our target
        break;
      }
    }
    
    return targetId;
  } else {
    // First child - navigate to parent
    return parentId;
  }
}

/**
 * Get the target node ID when moving down with arrow key
 * Priority: 1) First child, 2) Next sibling, 3) Next ancestor's sibling
 * 
 * @param {string} nodeId - ID of the current node
 * @param {function} getNodeDataById - Function to get node data by ID
 * @returns {string|null} - Target node ID or null if no target
 */
export function getMoveDownTargetId(nodeId, getNodeDataById) {
  const currentNode = getNodeDataById(nodeId);
  
  // Priority 1: If current node has children, go to first child
  if (currentNode?.children && currentNode.children.length > 0) {
    return currentNode.children[0];
  }
  
  // Priority 2: Try to find next sibling
  const parentId = currentNode?.parentId;
  if (!parentId) return null; // Root node with no children
  
  const parentNode = getNodeDataById(parentId);
  const siblings = parentNode?.children || [];
  const currentIndex = siblings.indexOf(nodeId);
  
  if (currentIndex < siblings.length - 1) {
    // Has next sibling
    return siblings[currentIndex + 1];
  }
  
  // Priority 3: Last child - find next ancestor's sibling
  let ancestorId = parentId;
  while (ancestorId) {
    const ancestor = getNodeDataById(ancestorId);
    const grandparentId = ancestor?.parentId;
    
    if (!grandparentId) break; // Reached root
    
    const grandparent = getNodeDataById(grandparentId);
    const ancestorSiblings = grandparent?.children || [];
    const ancestorIndex = ancestorSiblings.indexOf(ancestorId);
    
    if (ancestorIndex < ancestorSiblings.length - 1) {
      // Found an ancestor with a next sibling
      return ancestorSiblings[ancestorIndex + 1];
    }
    
    // Move up to next ancestor
    ancestorId = grandparentId;
  }
  
  return null; // No target found
}

/**
 * Get information about a node's position and possible edit operations
 * 
 * @param {string} nodeId - ID of the node to analyze
 * @param {object} docData - Flattened document data
 * @returns {object} - {code: number, message?: string, data?: object}
 */
export function getNodeEditInfo(nodeId, docData) {
  if (!nodeId || !docData || !docData.nodes) {
    return { code: -1, message: 'Invalid input: nodeId and docData.nodes required' };
  }

  const nodes = docData.nodes;
  const node = nodes[nodeId];
  
  if (!node) {
    return { code: -1, message: `Node ${nodeId} not found` };
  }

  const isRoot = !node.parentId;
  let canOutdent = false;
  let canIndent = false;
  let canMoveUp = false;
  let canMoveDown = false;
  let siblingIndex = -1;
  let totalSiblings = 0;

  if (!isRoot) {
    const parentNode = nodes[node.parentId];
    if (parentNode) {
      siblingIndex = parentNode.children.indexOf(nodeId);
      totalSiblings = parentNode.children.length;
      
      // Can outdent if parent is not root
      canOutdent = !!parentNode.parentId;
      
      // Can indent if not the first sibling
      canIndent = siblingIndex > 0;
      
      // Can move up if not the first sibling
      canMoveUp = siblingIndex > 0;
      
      // Can move down if not the last sibling
      canMoveDown = siblingIndex < totalSiblings - 1;
    }
  }

  return {
    code: 0,
    message: 'Node edit info retrieved successfully',
    data: {
      nodeId,
      isRoot,
      parentId: node.parentId,
      siblingIndex,
      totalSiblings,
      operations: {
        canOutdent,
        canIndent,
        canMoveUp,
        canMoveDown
      }
    }
  };
}
