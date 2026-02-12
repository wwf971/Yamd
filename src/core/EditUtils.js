/**
 * EditUtils - Functions for editing the document structure
 * Core logic for indent/outdent operations that work with static node data.
 * These functions are used by RenderUtils.ts which adapts them to work with Jotai atoms.
 */
import { findSegIdFromNode } from '@/components/TextUtils.js';

/**
 * Indent a node - move it down one level in the hierarchy
 * Makes the node a child of its previous sibling
 * 
 * @param {string} nodeId - ID of the node to indent
 * @param {object} nodes - Object mapping nodeId to node data { [nodeId]: nodeData }
 * @returns {object} - {code: number, message?: string, changes?: Array<{nodeId, updates}>}
 */
export function indentNode(nodeId, nodes) {
  const targetNode = nodes[nodeId];
  if (!targetNode || !targetNode.parentId) {
    return { code: -1, message: 'Cannot indent - node has no parent' };
  }
  
  const parentNode = nodes[targetNode.parentId];
  if (!parentNode || !parentNode.children) {
    return { code: -1, message: 'Cannot indent - parent node not found or has no children' };
  }
  
  const nodeIndex = parentNode.children.indexOf(nodeId);
  if (nodeIndex === -1) {
    return { code: -1, message: 'Cannot indent - node not found in parent\'s children array' };
  }
  
  if (nodeIndex === 0) {
    return { code: -1, message: 'Cannot indent - node is the first child (no previous sibling)' };
  }

  const newParentId = parentNode.children[nodeIndex - 1];
  const newParentNode = nodes[newParentId];
  // Allow indenting under any node that can have children (not just text nodes)
  // This allows indenting under list items, sections, etc.

  // Get the node's children before moving it
  const nodeChildren = targetNode.children || [];

  // Build list of changes to apply
  const changes = [];

  // Change 1: Remove node from current parent's children
  changes.push({
    nodeId: targetNode.parentId,
    updates: (draft) => {
      if (draft && draft.children) {
        const idx = draft.children.indexOf(nodeId);
        if (idx !== -1) {
          draft.children.splice(idx, 1);
        }
      }
    }
  });

  // Change 2: Update parentId for all of the node's children (they become siblings of the indented node)
  nodeChildren.forEach((childId) => {
    changes.push({
      nodeId: childId,
      updates: (draft) => {
        if (draft) {
          draft.parentId = newParentId;
        }
      }
    });
  });

  // Change 3: Update node's parentId and clear its children
  changes.push({
    nodeId: nodeId,
    updates: (draft) => {
      if (draft) {
        draft.parentId = newParentId;
        draft.children = []; // Clear children since they're now siblings
      }
    }
  });

  // Change 4: Add node and its children to previous sibling's children
  changes.push({
    nodeId: newParentId,
    updates: (draft) => {
      if (draft) {
        if (!draft.children) {
          draft.children = [];
        }
        // Add the indented node first, then its former children (they become siblings of the indented node)
        // This maintains the original order: the node appears before its former children
        draft.children.push(nodeId, ...nodeChildren);
        
        // Set default childDisplay to 'ul' if not already set
        if (!draft.attr) {
          draft.attr = {};
        }
        if (!draft.attr.childDisplay) {
          draft.attr.childDisplay = 'ul';
        }
      }
    }
  });

  return {
    code: 0,
    message: `Node ${nodeId} indented under ${newParentId}`,
    data: { prevSiblingId: newParentId, nodeChildrenCount: nodeChildren.length },
    changes
  };
}

/**
 * Outdent a node - move it up one level in the hierarchy
 * Makes the node a child of its parent's parent, positioned after the original parent
 * 
 * @param {string} nodeId - ID of the node to outdent
 * @param {object} nodes - Object mapping nodeId to node data { [nodeId]: nodeData }
 * @returns {object} - {code: number, message?: string, changes?: Array<{nodeId, updates}>}
 */
export function outdentNode(nodeId, nodes) {
  const targetNode = nodes[nodeId];
  if (!targetNode || !targetNode.parentId) {
    return { code: -1, message: 'Cannot outdent - node has no parent' };
  }
  
  const parentNode = nodes[targetNode.parentId];
  if (!parentNode) {
    return { code: -1, message: `Cannot outdent - parent node ${targetNode.parentId} not found` };
  }
  
  // Cannot outdent if parent is root (no grandparent)
  if (!parentNode.parentId) {
    return { code: -1, message: 'Cannot outdent - parent is root node (no grandparent)' };
  }
  
  const grandparentNode = nodes[parentNode.parentId];
  const siblings = parentNode.children || [];
  const currentIndex = siblings.indexOf(nodeId);
  
  // Capture the parent's index in grandparent's children BEFORE making any changes
  const parentIndexInGrandparent = grandparentNode.children.indexOf(targetNode.parentId);
  if (parentIndexInGrandparent === -1) {
    return { code: -1, message: 'Parent not found in grandparent\'s children array' };
  }

  // Get all siblings after the current node (they will become children of the outdented node)
  const followingSiblings = siblings.slice(currentIndex + 1);

  // Build list of changes to apply
  const changes = [];

  // Change 1: Remove node and all following siblings from parent's children
  changes.push({
    nodeId: targetNode.parentId,
    updates: (draft) => {
      if (draft && draft.children) {
        // Remove the node and all following siblings
        const idx = draft.children.indexOf(nodeId);
        if (idx !== -1) {
          draft.children.splice(idx, followingSiblings.length + 1);
        }
      }
    }
  });

  // Change 2: Update following siblings' parentId to the outdented node
  followingSiblings.forEach((siblingId) => {
    changes.push({
      nodeId: siblingId,
      updates: (draft) => {
        if (draft) {
          draft.parentId = nodeId;
        }
      }
    });
  });

  // Change 3: Update node's parentId to grandparent and add following siblings as children
  changes.push({
    nodeId: nodeId,
    updates: (draft) => {
      if (draft) {
        draft.parentId = parentNode.parentId;
        // Add following siblings as children (preserve existing children, then add new ones)
        if (!draft.children) {
          draft.children = [];
        }
        draft.children.push(...followingSiblings);
        
        // Copy childDisplay from original parent to maintain display style for new children
        if (parentNode.attr?.childDisplay) {
          if (!draft.attr) {
            draft.attr = {};
          }
          draft.attr.childDisplay = parentNode.attr.childDisplay;
        }
      }
    }
  });

  // Change 4: Insert node into grandparent's children array, right after the original parent
  // Use the captured index to avoid issues with stale references
  changes.push({
    nodeId: parentNode.parentId,
    updates: (draft) => {
      if (draft && draft.children) {
        // Use the captured index, but verify the parent is still at that position
        // (it should be, since we haven't modified grandparent's children yet)
        if (draft.children[parentIndexInGrandparent] === targetNode.parentId) {
          // Insert right after parent
          draft.children.splice(parentIndexInGrandparent + 1, 0, nodeId);
        } else {
          // Fallback: find parent again (shouldn't happen, but safe)
          const parentIndex = draft.children.indexOf(targetNode.parentId);
          if (parentIndex !== -1) {
            draft.children.splice(parentIndex + 1, 0, nodeId);
          } else {
            // Last resort: add at end
            draft.children.push(nodeId);
          }
        }
      }
    }
  });

  return {
    code: 0,
    message: `Node ${nodeId} outdented to ${parentNode.parentId}`,
    data: { grandparentId: parentNode.parentId },
    changes
  };
}

/**
 * Move a node up in its sibling order (swap with previous sibling)
 * 
 * @param {string} nodeId - ID of the node to move up
 * @param {object} nodes - Object mapping nodeId to node data { [nodeId]: nodeData }
 * @returns {object} - {code: number, message?: string, changes?: Array<{nodeId, updates}>}
 */
export function moveNodeUp(nodeId, nodes) {
  const targetNode = nodes[nodeId];
  if (!targetNode || !targetNode.parentId) {
    return { code: -1, message: 'Node not found or is root node' };
  }

  const parentNode = nodes[targetNode.parentId];
  const nodeIndex = parentNode.children.indexOf(nodeId);
  
  if (nodeIndex <= 0) {
    return { code: -1, message: 'Node is already at the top of its siblings' };
  }

  // Build list of changes to apply
  const changes = [];

  // Swap with previous sibling
  changes.push({
    nodeId: targetNode.parentId,
    updates: (draft) => {
      if (draft && draft.children) {
        const idx = draft.children.indexOf(nodeId);
        if (idx > 0) {
          // Swap with previous sibling
          [draft.children[idx - 1], draft.children[idx]] = 
          [draft.children[idx], draft.children[idx - 1]];
        }
      }
    }
  });

  return {
    code: 0,
    message: `Node ${nodeId} moved up successfully`,
    changes
  };
}

/**
 * Move a node down in its sibling order (swap with next sibling)
 * 
 * @param {string} nodeId - ID of the node to move down
 * @param {object} nodes - Object mapping nodeId to node data { [nodeId]: nodeData }
 * @returns {object} - {code: number, message?: string, changes?: Array<{nodeId, updates}>}
 */
export function moveNodeDown(nodeId, nodes) {
  const targetNode = nodes[nodeId];
  if (!targetNode || !targetNode.parentId) {
    return { code: -1, message: 'Node not found or is root node' };
  }

  const parentNode = nodes[targetNode.parentId];
  const nodeIndex = parentNode.children.indexOf(nodeId);
  
  if (nodeIndex === -1 || nodeIndex >= parentNode.children.length - 1) {
    return { code: -1, message: 'Node is already at the bottom of its siblings' };
  }

  // Build list of changes to apply
  const changes = [];

  // Swap with next sibling
  changes.push({
    nodeId: targetNode.parentId,
    updates: (draft) => {
      if (draft && draft.children) {
        const idx = draft.children.indexOf(nodeId);
        if (idx !== -1 && idx < draft.children.length - 1) {
          // Swap with next sibling
          [draft.children[idx], draft.children[idx + 1]] = 
          [draft.children[idx + 1], draft.children[idx]];
        }
      }
    }
  });

  return {
    code: 0,
    message: `Node ${nodeId} moved down successfully`,
    changes
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

/**
 * Get selected nodes from DOM selection by walking segments in document order.
 * This returns the set of rich text node IDs that contain the selected segments.
 *
 * @param {object} params
 * @param {string} params.rootNodeId - Root node ID for traversal
 * @param {function} params.getNodeDataById - Function to get node data by ID
 * @param {HTMLElement|null} [params.rootContainer] - Optional DOM root to validate selection scope
 * @param {Selection|null} [params.selection] - Optional selection (defaults to window.getSelection())
 * @returns {object} - {code, message?, data?}
 */
export function getSelectedNodes({ rootNodeId, getNodeDataById, rootContainer = null, selection = null }) {
  if (!rootNodeId || !getNodeDataById) {
    return { code: -1, message: 'Invalid input: rootNodeId and getNodeDataById are required' };
  }

  const activeSelection = selection || (typeof window !== 'undefined' ? window.getSelection() : null);
  if (!activeSelection || activeSelection.rangeCount === 0) {
    return { code: -1, message: 'No DOM selection available' };
  }

  const range = activeSelection.getRangeAt(0);
  const segStartId = findSegIdFromNode(range.startContainer, rootContainer);
  const segEndId = findSegIdFromNode(range.endContainer, rootContainer);

  if (!segStartId || !segEndId) {
    return { code: -1, message: 'Selection does not map to valid segments' };
  }

  const orderedSegments = _collectSegsInOrder(rootNodeId, getNodeDataById);
  const startIndex = orderedSegments.indexOf(segStartId);
  const endIndex = orderedSegments.indexOf(segEndId);

  if (startIndex === -1 || endIndex === -1) {
    return { code: -1, message: 'Selection segments not found in document order' };
  }

  const fromIndex = Math.min(startIndex, endIndex);
  const toIndex = Math.max(startIndex, endIndex);

  const nodesSelectedIdArray = [];
  const nodeIdSet = new Set();
  for (let i = fromIndex; i <= toIndex; i += 1) {
    const segmentId = orderedSegments[i];
    const segmentData = getNodeDataById(segmentId);
    const parentId = segmentData?.parentId;
    if (parentId && !nodeIdSet.has(parentId)) {
      nodeIdSet.add(parentId);
      nodesSelectedIdArray.push(parentId);
    }
  }

  return {
    code: 0,
    data: {
      nodesSelectedIdArray,
      isCollapsed: activeSelection.isCollapsed
    }
  };
}

/**
 * Compute top-level subtree roots from selected node IDs.
 * A subtree root is a selected node whose parent is not selected.
 *
 * @param {object} params
 * @param {string[]} params.nodesSelectedIdArray - Selected node IDs in document order
 * @param {function} params.getNodeDataById - Function to get node data by ID
 * @returns {object} - {code, message?, data?}
 */
/**
 * Check if multi-node indent can be performed based on the selection rule.
 *
 * @param {object} params
 * @param {string[]} params.nodesSelectedIdArray - Selected node IDs in document order
 * @param {function} params.getNodeDataById - Function to get node data by ID
 * @returns {object} - {code, message?}
 */
export function canIndentMultiNodes({ nodesSelectedIdArray, getNodeDataById }) {
  if (!Array.isArray(nodesSelectedIdArray) || nodesSelectedIdArray.length === 0) {
    return { code: -1, message: 'No selected nodes' };
  }
  if (!getNodeDataById) {
    return { code: -1, message: 'Invalid input: getNodeDataById is required' };
  }

  const firstNodeId = nodesSelectedIdArray[0];
  const firstNode = getNodeDataById(firstNodeId);
  const parentId = firstNode?.parentId;
  if (!parentId) {
    return { code: -1, message: 'Cannot indent: first selected node has no parent' };
  }

  const parentNode = getNodeDataById(parentId);
  const siblings = parentNode?.children || [];
  const firstIndex = siblings.indexOf(firstNodeId);
  if (firstIndex <= 0) {
    return { code: -1, message: 'Cannot indent: first selected node has no previous sibling' };
  }

  return { code: 0 };
}

/**
 * Check if multi-node outdent can be performed based on the selection rule.
 *
 * @param {object} params
 * @param {string[]} params.nodesSelectedIdArray - Selected node IDs in document order
 * @param {function} params.getNodeDataById - Function to get node data by ID
 * @returns {object} - {code, message?}
 */
export function canOutdentMultiNodes({ nodesSelectedIdArray, getNodeDataById }) {
  if (!Array.isArray(nodesSelectedIdArray) || nodesSelectedIdArray.length === 0) {
    return { code: -1, message: 'No selected nodes' };
  }
  if (!getNodeDataById) {
    return { code: -1, message: 'Invalid input: getNodeDataById is required' };
  }

  const lastNodeId = nodesSelectedIdArray[nodesSelectedIdArray.length - 1];
  const lastNode = getNodeDataById(lastNodeId);
  const lastChildren = lastNode?.children || [];
  if (lastChildren.length > 0) {
    return { code: -1, message: 'Cannot outdent: last selected node has children' };
  }

  return { code: 0 };
}

/**
 * Perform multi-node indent by applying single-node indent on selected nodes in order.
 *
 * @param {object} params
 * @param {string[]} params.nodesSelectedIdArray - Selected nodes in document order
 * @param {object} params.nodes - Object mapping nodeId to node data
 * @returns {object} - {code, message?, changes?}
 */
export function applyMultiNodeIndent({ nodesSelectedIdArray, nodes, getNodeDataById }) {
  if (!Array.isArray(nodesSelectedIdArray) || nodesSelectedIdArray.length === 0) {
    return { code: -1, message: 'No selected nodes' };
  }
  if (!nodes) {
    return { code: -1, message: 'Invalid input: nodes is required' };
  }

  const workingNodes = _cloneNodesMap(nodes);
  const allChanges = [];

  for (const nodeId of nodesSelectedIdArray) {
    const ensureResult = _ensureIndentNodes(nodeId, workingNodes, getNodeDataById);
    if (ensureResult.code !== 0) {
      return ensureResult;
    }

    const result = indentNode(nodeId, workingNodes);
    if (result.code !== 0) {
      return { code: result.code, message: result.message || 'Indent failed' };
    }
    result.changes.forEach((change) => {
      allChanges.push(change);
      _applyChangeToNodes(workingNodes, change);
    });
  }

  return { code: 0, changes: allChanges };
}

/**
 * Perform multi-node outdent by applying single-node outdent on selected nodes in reverse order.
 *
 * @param {object} params
 * @param {string[]} params.nodesSelectedIdArray - Selected nodes in document order
 * @param {object} params.nodes - Object mapping nodeId to node data
 * @returns {object} - {code, message?, changes?}
 */
export function applyMultiNodeOutdent({ nodesSelectedIdArray, nodes, getNodeDataById }) {
  if (!Array.isArray(nodesSelectedIdArray) || nodesSelectedIdArray.length === 0) {
    return { code: -1, message: 'No selected nodes' };
  }
  if (!nodes) {
    return { code: -1, message: 'Invalid input: nodes is required' };
  }

  const workingNodes = _cloneNodesMap(nodes);
  const allChanges = [];

  for (let i = nodesSelectedIdArray.length - 1; i >= 0; i -= 1) {
    const nodeId = nodesSelectedIdArray[i];
    const ensureResult = _ensureOutdentNodes(nodeId, workingNodes, getNodeDataById);
    if (ensureResult.code !== 0) {
      return ensureResult;
    }

    const result = outdentNode(nodeId, workingNodes);
    if (result.code !== 0) {
      return { code: result.code, message: result.message || 'Outdent failed' };
    }
    result.changes.forEach((change) => {
      allChanges.push(change);
      _applyChangeToNodes(workingNodes, change);
    });
  }

  return { code: 0, changes: allChanges };
}

/**
 * Pipeline for multi-node indent: selection -> validation -> edits.
 *
 * @param {object} params
 * @param {string} params.rootNodeId - Root node ID for traversal
 * @param {function} params.getNodeDataById - Function to get node data by ID
 * @param {object} params.nodes - Object mapping nodeId to node data
 * @param {HTMLElement|null} [params.rootContainer] - Optional DOM root to validate selection scope
 * @param {Selection|null} [params.selection] - Optional selection (defaults to window.getSelection())
 * @returns {object} - {code, message?, changes?}
 */
export function multiNodeIndent({ rootNodeId, getNodeDataById, nodes, rootContainer = null, selection = null }) {
  const selectedResult = getSelectedNodes({ rootNodeId, getNodeDataById, rootContainer, selection });
  if (selectedResult.code !== 0) return selectedResult;

  const nodesSelectedIdArray = selectedResult.data.nodesSelectedIdArray;
  const canIndentResult = canIndentMultiNodes({ nodesSelectedIdArray, getNodeDataById });
  if (canIndentResult.code !== 0) return canIndentResult;

  return applyMultiNodeIndent({ nodesSelectedIdArray, nodes, getNodeDataById });
}

/**
 * Pipeline for multi-node outdent: selection -> validation -> edits.
 *
 * @param {object} params
 * @param {string} params.rootNodeId - Root node ID for traversal
 * @param {function} params.getNodeDataById - Function to get node data by ID
 * @param {object} params.nodes - Object mapping nodeId to node data
 * @param {HTMLElement|null} [params.rootContainer] - Optional DOM root to validate selection scope
 * @param {Selection|null} [params.selection] - Optional selection (defaults to window.getSelection())
 * @returns {object} - {code, message?, changes?}
 */
export function multiNodeOutdent({ rootNodeId, getNodeDataById, nodes, rootContainer = null, selection = null }) {
  const selectedResult = getSelectedNodes({ rootNodeId, getNodeDataById, rootContainer, selection });
  if (selectedResult.code !== 0) return selectedResult;

  const nodesSelectedIdArray = selectedResult.data.nodesSelectedIdArray;
  const canOutdentResult = canOutdentMultiNodes({ nodesSelectedIdArray, getNodeDataById });
  if (canOutdentResult.code !== 0) return canOutdentResult;

  return applyMultiNodeOutdent({ nodesSelectedIdArray, nodes, getNodeDataById });
}

const _cloneNodesMap = (nodes) => {
  const cloned = {};
  Object.keys(nodes || {}).forEach((nodeId) => {
    const node = nodes[nodeId];
    cloned[nodeId] = node ? _shallowCloneNode(node) : node;
  });
  return cloned;
};

const _applyChangeToNodes = (nodes, change) => {
  if (!nodes || !change) return;
  const nodeId = change.nodeId;
  if (!nodeId || !nodes[nodeId]) return;
  const draft = _shallowCloneNode(nodes[nodeId]);
  change.updates(draft);
  nodes[nodeId] = draft;
};

const _ensureIndentNodes = (nodeId, nodes, getNodeDataById) => {
  const targetNode = _ensureNode(nodes, nodeId, getNodeDataById);
  if (!targetNode) {
    return { code: -1, message: `Missing node data for ${nodeId}` };
  }

  const parentId = targetNode.parentId;
  if (!parentId) {
    return { code: -1, message: `Cannot indent: node ${nodeId} has no parent` };
  }

  const parentNode = _ensureNode(nodes, parentId, getNodeDataById);
  if (!parentNode) {
    return { code: -1, message: `Missing parent data for ${nodeId}` };
  }

  const siblings = parentNode.children || [];
  const currentIndex = siblings.indexOf(nodeId);
  if (currentIndex <= 0) {
    return { code: -1, message: `Cannot indent: node ${nodeId} has no previous sibling` };
  }

  const prevSiblingId = siblings[currentIndex - 1];
  const prevSiblingNode = _ensureNode(nodes, prevSiblingId, getNodeDataById);
  if (!prevSiblingNode) {
    return { code: -1, message: `Missing previous sibling data for ${nodeId}` };
  }

  (targetNode.children || []).forEach((childId) => {
    _ensureNode(nodes, childId, getNodeDataById);
  });

  return { code: 0 };
};

const _ensureOutdentNodes = (nodeId, nodes, getNodeDataById) => {
  const targetNode = _ensureNode(nodes, nodeId, getNodeDataById);
  if (!targetNode) {
    return { code: -1, message: `Missing node data for ${nodeId}` };
  }

  const parentId = targetNode.parentId;
  if (!parentId) {
    return { code: -1, message: `Cannot outdent: node ${nodeId} has no parent` };
  }

  const parentNode = _ensureNode(nodes, parentId, getNodeDataById);
  if (!parentNode) {
    return { code: -1, message: `Missing parent data for ${nodeId}` };
  }

  const grandparentId = parentNode.parentId;
  if (!grandparentId) {
    return { code: -1, message: `Cannot outdent: parent of ${nodeId} has no parent` };
  }

  const grandparentNode = _ensureNode(nodes, grandparentId, getNodeDataById);
  if (!grandparentNode) {
    return { code: -1, message: `Missing grandparent data for ${nodeId}` };
  }

  const siblings = parentNode.children || [];
  const currentIndex = siblings.indexOf(nodeId);
  if (currentIndex === -1) {
    return { code: -1, message: `Cannot outdent: node ${nodeId} not found in parent children` };
  }

  const followingSiblings = siblings.slice(currentIndex + 1);
  followingSiblings.forEach((siblingId) => {
    _ensureNode(nodes, siblingId, getNodeDataById);
  });

  return { code: 0 };
};

const _ensureNode = (nodes, nodeId, getNodeDataById) => {
  if (!nodeId) return null;
  if (!nodes[nodeId] && getNodeDataById) {
    const loaded = getNodeDataById(nodeId);
    if (loaded) {
      nodes[nodeId] = _shallowCloneNode(loaded);
    }
  }
  return nodes[nodeId] || null;
};

const _shallowCloneNode = (node) => {
  if (!node || typeof node !== 'object') return node;
  return {
    ...node,
    children: Array.isArray(node.children) ? [...node.children] : node.children,
    segments: Array.isArray(node.segments) ? [...node.segments] : node.segments,
    attr: node.attr ? { ...node.attr } : node.attr
  };
};

/**
 * Check if the current DOM selection spans multiple segments.
 *
 * @param {object} params
 * @param {HTMLElement|null} [params.rootContainer] - Optional DOM root to validate selection scope
 * @param {Selection|null} [params.selection] - Optional selection (defaults to window.getSelection())
 * @returns {boolean}
 */
export function isCrossSelection({ rootContainer = null, selection = null } = {}) {
  const activeSelection = selection || (typeof window !== 'undefined' ? window.getSelection() : null);
  if (!activeSelection || activeSelection.rangeCount === 0) {
    return false;
  }

  const range = activeSelection.getRangeAt(0);
  const segStartId = findSegIdFromNode(range.startContainer, rootContainer);
  const segEndId = findSegIdFromNode(range.endContainer, rootContainer);

  if (!segStartId || !segEndId) {
    return false;
  }

  return segStartId !== segEndId;
}

const _collectSegsInOrder = (nodeId, getNodeDataById, result = []) => {
  const node = getNodeDataById(nodeId);
  if (!node) return result;

  if (Array.isArray(node.segments)) {
    node.segments.forEach((segId) => {
      if (segId) result.push(segId);
    });
  }

  if (Array.isArray(node.children)) {
    node.children.forEach((childId) => {
      _collectSegsInOrder(childId, getNodeDataById, result);
    });
  }

  return result;
};
