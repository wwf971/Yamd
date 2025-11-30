import React, { createContext, useContext } from 'react';
import { useAtomValue } from 'jotai';
import { produce as immer } from 'immer';
import { docsData, docsState, nodeBulletState } from '@/core/DocStore.js';
import { deleteNode as _deleteNode } from '@/core/EditUtils.js';

/**
 * Centralized bullet dimensions configuration
 * These values are used directly in inline styles for guaranteed consistency
 */
import { BULLET_DIMENSIONS, LIST_SETTINGS, TIMELINE_BULLET_SETTINGS } from '@/config/RenderConfig.js';

// ============================================================================
// TypeScript Type Definitions
// ============================================================================

/**
 * RenderUtils Context Value - Centralized rendering utilities and configuration
 */
export interface RenderUtilsContextValue {
  // Node registration for bullet positioning
  registerNodeRef?: (nodeId: string, ref: any) => void;
  
  // Child rendering
  renderChildNodes: (params: {
    childIds: string[];
    parentInfo: any;
    globalInfo: any;
  }) => React.ReactNode;
  
  // Document ID
  docId: string | null;
  
  // Jotai-based reactive data access (hook - must be called in React components)
  useNodeData: (nodeId: string) => any;
  useNodeState: (nodeId: string) => any;
  useAsset: (assetId: string) => any;
  
  // Non-reactive data access methods
  getNodeDataById: (nodeId: string) => any;
  updateNodeData: (nodeId: string, producer: (draft: any) => void) => void;
  getAssetById: (assetId: string) => any;
  updateAsset: (assetId: string, producer: (draft: any) => void) => void;
  getRefById: (refId: string) => any;
  createNodeAfter: (nodeId: string, newNodeData?: any) => {code: number; message: string; data: { newNodeId: string } | null };
  splitToNextSibling: (nodeId: string, splitPosition: number) => { code: number; message: string; data: { newNodeId: string; leftText: string; rightText: string } | null };
  mergeWithPrevSibling: (nodeId: string) => { code: number; message: string; data: { prevSiblingId: string; cursorPos: number } | null };
  deleteNode: (nodeId: string) => { code: number; message: string; data: { previousSiblingId: string | null } | null };
  indentNode: (nodeId: string) => { code: number; message: string; data: { prevSiblingId: string } | null };
  outdentNode: (nodeId: string) => { code: number; message: string; data: { grandparentId: string; nextSiblings: string[] } | null };
  
  // Focus management
  triggerFocus: (nodeId: string, type: string, extraData?: any) => void;
  triggerUnfocus: (nodeId: string, from: string, type: string, extraData?: any) => void;
  
  // Configuration
  BULLET_DIMENSIONS: typeof BULLET_DIMENSIONS;
  LIST_SETTINGS: typeof LIST_SETTINGS;
  TIMELINE_BULLET_SETTINGS: typeof TIMELINE_BULLET_SETTINGS;
  
  // Edit mode
  isEditable: boolean;
  
  // Zustand store (for backward compatibility - bullet positioning)
  docStore?: any;
  
  // Helper methods (not critical for type hints, but included for completeness)
  getChildDisplay?: any;
  getChildDefaultDisplay?: any;
  getAlignmentStrategy?: any;
  formatYPos?: any;
  createBulletEqualityFn?: any;
  
  // Allow any additional properties
  [key: string]: any;
}

// Re-export for backward compatibility
export { BULLET_DIMENSIONS, LIST_SETTINGS };
export {
  AddListBulletBeforeNode,
  renderListBullet,
} from '@/core/AddBullet.jsx';

/**
 * Get children display mode for a node
 */
export const getChildDisplay = (nodeData: any, isRoot = false, parentInfo: any = {}) => {
  // If node explicitly specifies childDisplay, use it
  if (nodeData.attr?.childDisplay) {
    return nodeData.attr.childDisplay;
  }
  
  // Otherwise use default based on node type and context
  return getChildDefaultDisplay(nodeData, isRoot, parentInfo);
};

/**
 * Get default children display mode based on node type and context
 */
export const getChildDefaultDisplay = (nodeData: any, isRoot = false, parentInfo: any = {}) => {
  // Special handling for root node
  if (isRoot) {
    return 'ul';  // Root nodes default to unordered list
  }
  
  // Inherit from parent if parent has childDisplay set to ul
  if (parentInfo?.childDisplay === 'ul' || parentInfo?.childDisplay === 'unordered-list') {
    return 'ul';
  }
  if (parentInfo?.childDisplay === 'ol' || parentInfo?.childDisplay === 'ordered-list') {
    return 'ol';
  }
  if (parentInfo?.childDisplay === 'p' || parentInfo?.childDisplay === 'paragraph-list') {
    return 'p';
  }
  
  // Default based on selfDisplay type
  const selfDisplay = nodeData.attr?.selfDisplay;
  switch (selfDisplay) {
    case 'timeline':
      return 'ul';  // Timeline children default to ul instead of pl
    case 'divider':
      return 'ul';  // Divider children commonly use lists
    case 'panel':
      return 'ul';  // Panel children default to unordered list
    case 'key':
      return 'pl';  // Key children default to plain list
    default:
      return 'pl';  // General default is plain list
  }
};


/**
 * Get horizontal alignment strategy for content blocks (LaTeX, images, videos)
 * @param {object} nodeData - The node data containing attributes
 * @param {object} parentInfo - Parent context information
 * @returns {string} - CSS alignment value ('center', 'flex-start', 'flex-end')
 */
export const getAlignmentStrategy = (nodeData: any, parentInfo: any) => {
  // User-specified alignX takes highest priority
  if (nodeData.attr?.alignX === 'center') {
    return 'center';
  }
  if (nodeData.attr?.alignX === 'left') {
    return 'flex-start';
  }
  if (nodeData.attr?.alignX === 'right') {
    return 'flex-end';
  }
  
  // Context-based alignment strategy
  const parentChildDisplay = parentInfo?.childDisplay;
  if (parentChildDisplay === 'pl' || parentChildDisplay === 'plain-list' || parentChildDisplay === 'plain_list') {
    return 'center';  // Plain lists center their content
  }
  if (parentChildDisplay === 'ul' || parentChildDisplay === 'ol' || 
      parentChildDisplay === 'unordered-list' || parentChildDisplay === 'ordered-list') {
    return 'flex-start';  // Bulleted/numbered lists align to start
  }
  
  // Default to center
  return 'center';
};


/**
 * Format Y position value for CSS - handles both numbers and CSS values with units
 * @param {number|string} value - Y position value (number or CSS string like '1.2rem')
 * @returns {string} - Properly formatted CSS value
 */
export const formatYPos = (value: any) => {
  // If it's a number, append 'px'
  if (typeof value === 'number') {
    return `${value}px`;
  }
  // If it's already a string with units, use as-is
  if (typeof value === 'string') {
    return value;
  }
  // Fallback
  return '0px';
};

/**
 * Equality function for Zustand subscriptions that only triggers when reqCounter increases
 * @param {string} nodeId - Node ID for debugging
 * @param {string} componentName - Component name for debugging
 * @returns {function} Equality function for Zustand subscribe
 */
export const createBulletEqualityFn = (nodeId: any, componentName: any) => {
  return (prev: any, next: any) => {
    // console.log(`noteId: ${nodeId} ${componentName} equalityFn prev:`, prev, "next:", next);

    // Only trigger if reqCounter has increased (ignore respCounter changes)
    const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
    const hasNewRequests = Array.from(keys).some((key) => 
      (next[key]?.reqCounter || 0) > (prev[key]?.reqCounter || 0)
    );
    // child almost always mounts before parent mounts

    
    const shouldSkip = !hasNewRequests; // skip if no new requests
    // console.log(`noteId: ${nodeId} ${componentName} equalityFn hasNewRequests:`, hasNewRequests, "shouldSkip:", shouldSkip);
    
    return shouldSkip;
  };
};

// ===== REACT CONTEXT FOR RENDER UTILS =====

/**
 * RenderUtils Context - provides rendering utility methods and settings
 * This allows components to access render utilities without prop drilling
 */
export const RenderUtilsContext = createContext<RenderUtilsContextValue | null>(null);

/**
 * Hook to use RenderUtils context
 * @returns {object} RenderUtils context object
 */
export const useRenderUtilsContext = () => {
  const context = useContext(RenderUtilsContext);
  if (!context) {
    throw new Error('useRenderUtilsContext must be used within a RenderUtilsProvider');
  }
  return context;
};


/**
 * Create the RenderUtils context value
 * @param {object} options - Options for creating context value
 * @param {function} options.registerNodeRef - Function to register node DOM references
 * @param {function} options.renderChildNodes - Function to render child nodes
 * @param {boolean} options.isEditable - Whether the document is in editable mode
 * @param {string} options.docId - Document ID for binding to store methods
 * @param {object} options.docStore - Reference to the Zustand document store (for backward compatibility)
 * @returns {object} RenderUtils context object with methods and settings
 */
/**
 * Create RenderUtils context value with all utilities and configuration
 */
export const createRenderUtilsContextValue = ({
  registerNodeRef,
  renderChildNodes = () => null,
  isEditable = false,
  docId = null,
  docStore = null, // Keep for backward compatibility (bullet positioning still uses Zustand)
}: {
  registerNodeRef?: (nodeId: string, ref: any) => void;
  renderChildNodes?: (params: { childIds: string[]; parentInfo: any; globalInfo: any }) => React.ReactNode;
  isEditable?: boolean;
  docId?: string | null;
  docStore?: any;
} = {}): RenderUtilsContextValue => {

  return {
    // Methods
    getChildDisplay,
    getChildDefaultDisplay,
    getAlignmentStrategy,
    formatYPos,
    createBulletEqualityFn,
    
    // Node reference management
    registerNodeRef,
    
    // Child rendering
    renderChildNodes,
    
    // Document store access
    docStore,  // Keep for backward compatibility (bullet positioning)
    docId,     // Document ID
    
    // Jotai-based data access methods (non-reactive)
    getNodeDataById: (nodeId: string) => {
      if (!docId) return null;
      const nodeAtom = docsData.getNodeData(docId, nodeId);
      return docsData.getAtomValue(nodeAtom);
    },

    // Hook to get node data reactively (must be called as a hook in components)
    // Usage: const nodeData = renderUtils.useNodeData(nodeId);
    useNodeData: (nodeId: string) => {
      if (!docId) return null;
      const nodeAtom = docsData.getNodeData(docId, nodeId) as any;
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const nodeData = useAtomValue(nodeAtom) as any;
      return nodeData;
    },

    useNodeState: (nodeId: string) => {
      if (!docId) return null;
      const stateAtom = docsState.getNodeState(docId, nodeId) as any;
      // eslint-disable-next-line react-hooks/rules-of-hooks
      return useAtomValue(stateAtom);
    },

    updateNodeData: (nodeId: string, producer: (draft: any) => void) => {
      if (!docId) return;
      const nodeAtom = docsData.getNodeData(docId, nodeId);
      docsData.setAtom(nodeAtom, (prev: any) => immer(prev, producer));
    },
    
    getAssetById: (assetId: string) => {
      if (!docId) return null;
      const assetsAtom = (docsData as any).getAssets(docId);
      return docsData.getAtomValue(assetsAtom)?.[assetId];
    },
    
    useAsset: (assetId: string) => {
      if (!docId) return null;
      const assetsAtom = (docsData as any).getAssets(docId) as any;
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const assets = useAtomValue(assetsAtom) as any;
      return assets?.[assetId];
    },
    
    updateAsset: (assetId: string, producer: (draft: any) => void) => {
      if (!docId) return;
      const assetsAtom = (docsData as any).getAssets(docId);
      docsData.setAtom(assetsAtom, (prev: any) => immer(prev, (draft: any) => {
        if (draft[assetId]) {
          producer(draft[assetId]);
        }
      }));
    },
    
    getRefById: (refId: string) => {
      if (!docId) return null;
      const refsAtom = (docsData as any).getRefs(docId);
      return docsData.getAtomValue(refsAtom)?.[refId];
    },
    
    createNodeAfter: (nodeId: string, newNodeData: any) => {
      if (!docId) return { code: -1, message: 'No docId available', data: null };
      
      const nodeAtom = docsData.getNodeData(docId, nodeId);
      const currentNode = docsData.getAtomValue(nodeAtom) as any;
      
      if (!currentNode) {
        return { code: -1, message: `Node ${nodeId} not found`, data: null };
      }
      
      const parentId = currentNode.parentId;
      if (!parentId) {
        return { code: -1, message: 'Cannot add node after root', data: null };
      }
      
      // Generate new node ID
      const newNodeId = `yamd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create new node with default structure
      const newNode = {
        id: newNodeId,
        type: 'text',
        parentId: parentId,
        textRaw: '',
        textOriginal: '',
        children: [],
        ...newNodeData,
      };
      
      console.log(`➕ Creating new node ${newNodeId} after ${nodeId}`);
      
      // Add new node to docsData
      docsData.ensureNode(docId, newNodeId);
      const newNodeAtom = docsData.getNodeData(docId, newNodeId);
      docsData.setAtom(newNodeAtom, newNode);
      
      // Insert new node into parent's children array after current node
      const parentNodeAtom = docsData.getNodeData(docId, parentId);
      docsData.setAtom(parentNodeAtom, (prev: any) =>
        immer(prev, (draft: any) => {
          if (draft && draft.children) {
            const currentIndex = draft.children.indexOf(nodeId);
            if (currentIndex !== -1) {
              draft.children.splice(currentIndex + 1, 0, newNodeId);
              console.log(`➕ Inserted ${newNodeId} at index ${currentIndex + 1}`);
            }
          }
        })
      );
      
      // Trigger focus on new node
      docsState.triggerFocus(docId, newNodeId, 'selfCreated');
      
      return {
        code: 0,
        message: `Node ${newNodeId} created successfully`,
        data: { newNodeId }
      };
    },
    
    splitToNextSibling: (nodeId: string, splitPosition: number) => {
      if (!docId) return { code: -1, message: 'No docId available', data: null };
      
      const nodeAtom = docsData.getNodeData(docId, nodeId);
      const currentNode = docsData.getAtomValue(nodeAtom) as any;
      
      if (!currentNode) {
        return { code: -1, message: `Node ${nodeId} not found`, data: null };
      }
      
      if (currentNode.type !== 'text') {
        return { code: -1, message: 'Can only split text nodes', data: null };
      }
      
      const parentId = currentNode.parentId;
      if (!parentId) {
        return { code: -1, message: 'Cannot split root node', data: null };
      }
      
      const currentText = currentNode.textRaw ?? currentNode.textOriginal ?? '';
      const leftText = currentText.substring(0, splitPosition);
      const rightText = currentText.substring(splitPosition);
      
      // Update current node with left part
      docsData.setAtom(nodeAtom, (prev: any) =>
        immer(prev, (draft: any) => {
          draft.textRaw = leftText;
          draft.textOriginal = leftText;
          
          // Update textRich if it exists
          if (draft.textRich && Array.isArray(draft.textRich)) {
            draft.textRich = [{
              type: 'text',
              textRaw: leftText
            }];
          }
        })
      );
      
      // Create new node with right part
      const newNodeId = `yamd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newNode = {
        id: newNodeId,
        type: 'text',
        parentId: parentId,
        textRaw: rightText,
        textOriginal: rightText,
        children: [],
      };
      
      // Add new node to docsData
      docsData.ensureNode(docId, newNodeId);
      const newNodeAtom = docsData.getNodeData(docId, newNodeId);
      docsData.setAtom(newNodeAtom, newNode);
      
      // Insert new node into parent's children array after current node
      const parentNodeAtom = docsData.getNodeData(docId, parentId);
      docsData.setAtom(parentNodeAtom, (prev: any) =>
        immer(prev, (draft: any) => {
          if (draft && draft.children) {
            const currentIndex = draft.children.indexOf(nodeId);
            if (currentIndex !== -1) {
              draft.children.splice(currentIndex + 1, 0, newNodeId);
            }
          }
        })
      );
      
      // Focus new node at the beginning
      docsState.triggerFocus(docId, newNodeId, 'selfCreated');
      
      return {
        code: 0,
        message: `Node ${nodeId} split into ${newNodeId}`,
        data: { newNodeId, leftText, rightText }
      };
    },
    
    mergeWithPrevSibling: (nodeId: string) => {
      if (!docId) return { code: -1, message: 'No docId available', data: null };
      
      const nodeAtom = docsData.getNodeData(docId, nodeId);
      const currentNode = docsData.getAtomValue(nodeAtom) as any;
      
      if (!currentNode) {
        return { code: -1, message: `Node ${nodeId} not found`, data: null };
      }
      
      const parentId = currentNode.parentId;
      if (!parentId) {
        return { code: -1, message: 'Cannot merge root node', data: null };
      }
      
      // Get parent's children to find previous sibling
      const parentNodeAtom = docsData.getNodeData(docId, parentId);
      const parentNode = docsData.getAtomValue(parentNodeAtom) as any;
      const siblings = parentNode?.children || [];
      const currentIndex = siblings.indexOf(nodeId);
      
      if (currentIndex <= 0) {
        return { code: -1, message: 'No previous sibling to merge with', data: null };
      }
      
      const prevSiblingId = siblings[currentIndex - 1];
      const prevSiblingAtom = docsData.getNodeData(docId, prevSiblingId);
      const prevSibling = docsData.getAtomValue(prevSiblingAtom) as any;
      
      // Only merge if previous sibling is also a text node
      if (prevSibling?.type !== 'text') {
        return { code: -1, message: 'Previous sibling is not a text node', data: null };
      }
      
      const currentText = currentNode.textRaw ?? currentNode.textOriginal ?? '';
      const prevText = prevSibling.textRaw ?? prevSibling.textOriginal ?? '';
      const mergedText = prevText + currentText;
      const cursorPos = prevText.length; // Cursor should be at the merge point
      
      // Update previous sibling with merged text
      docsData.setAtom(prevSiblingAtom, (prev: any) =>
        immer(prev, (draft: any) => {
          draft.textRaw = mergedText;
          draft.textOriginal = mergedText;
          
          // Update textRich if it exists
          if (draft.textRich && Array.isArray(draft.textRich)) {
            draft.textRich = [{
              type: 'text',
              textRaw: mergedText
            }];
          }
        })
      );
      
      // Remove current node from parent's children
      docsData.setAtom(parentNodeAtom, (prev: any) =>
        immer(prev, (draft: any) => {
          if (draft && draft.children) {
            draft.children = draft.children.filter((childId: string) => childId !== nodeId);
          }
        })
      );
      
      // Remove current node's data and state
      docsData.removeNode(docId, nodeId);
      docsState.removeNodeState(docId, nodeId);
      
      // Focus previous sibling with cursor at merge point
      docsState.triggerFocus(docId, prevSiblingId, 'mergedFromNext', { cursorPos });
      
      return {
        code: 0,
        message: `Node ${nodeId} merged with ${prevSiblingId}`,
        data: { prevSiblingId, cursorPos }
      };
    },
    
    deleteNode: (nodeId: string) => {
      if (!docId) return { code: -1, message: 'No docId available', data: null };
      
      const rootNodeIdAtom = docsData.getRootNodeId(docId);
      const rootNodeId = docsData.getAtomValue(rootNodeIdAtom);
      
      if (nodeId === rootNodeId) {
        return { code: -1, message: 'Cannot delete root node', data: null };
      }
      
      const nodeAtom = docsData.getNodeData(docId, nodeId);
      const targetNode = docsData.getAtomValue(nodeAtom) as any;
      
      if (!targetNode) {
        return { code: -1, message: `Node ${nodeId} not found`, data: null };
      }
      
      const parentId = targetNode.parentId;
      if (!parentId) {
        return { code: -1, message: 'Cannot delete node without parentId', data: null };
      }
      
      // Get parent's children to find previous sibling
      const parentNodeAtom = docsData.getNodeData(docId, parentId);
      const parentNode = docsData.getAtomValue(parentNodeAtom) as any;
      const childrenIds = parentNode?.children || [];
      console.log(`🗑️ Parent ${parentId} children before delete:`, childrenIds);
      const currentIndex = childrenIds.indexOf(nodeId);
      const previousSiblingId = currentIndex > 0 ? childrenIds[currentIndex - 1] : null;
      console.log(`🗑️ Current index: ${currentIndex}, previous sibling: ${previousSiblingId}`);
      
      // Remove nodeId from parent's children array
      docsData.setAtom(parentNodeAtom, (prev: any) => 
        immer(prev, (draft: any) => {
          if (draft && draft.children) {
            const oldChildren = [...draft.children];
            draft.children = draft.children.filter((childId: string) => childId !== nodeId);
            console.log(`🗑️ Parent children updated: ${oldChildren.length} → ${draft.children.length}`);
            console.log(`🗑️ New children:`, draft.children);
          }
        })
      );
      
      // Trigger focus on previous sibling if it exists
      if (previousSiblingId) {
        docsState.triggerFocus(docId, previousSiblingId, 'prevSiblingDeleted');
      }
      
      // Remove the node's data atom
      docsData.removeNode(docId, nodeId);
      
      // Remove the node's state atom
      docsState.removeNodeState(docId, nodeId);
      
      return { 
        code: 0, 
        message: `Node ${nodeId} deleted successfully`,
        data: { previousSiblingId }
      };
    },
    
    /**
     * Indent a node by making it a child of its previous sibling
     * @param {string} nodeId - The ID of the node to indent
     * @returns {object} - Result object with code, message, and data
     */
    indentNode: (nodeId: string) => {
      console.log(`🔄 Indent operation started for node: ${nodeId}`);
      if (!docId) return { code: -1, message: 'No docId available', data: null };
      
      const nodeAtom = docsData.getNodeData(docId, nodeId);
      const currentNode = docsData.getAtomValue(nodeAtom) as any;
      
      if (!currentNode) {
        return { code: -1, message: `Node ${nodeId} not found`, data: null };
      }
      
      const parentId = currentNode.parentId;
      if (!parentId) {
        return { code: -1, message: 'Cannot indent root node', data: null };
      }
      
      // Get parent's children to find previous sibling
      const parentNodeAtom = docsData.getNodeData(docId, parentId);
      const parentNode = docsData.getAtomValue(parentNodeAtom) as any;
      const siblings = parentNode?.children || [];
      const currentIndex = siblings.indexOf(nodeId);
      
      if (currentIndex <= 0) {
        return { code: -1, message: 'No previous sibling to indent under', data: null };
      }
      
      const prevSiblingId = siblings[currentIndex - 1];
      const prevSiblingAtom = docsData.getNodeData(docId, prevSiblingId);
      const prevSibling = docsData.getAtomValue(prevSiblingAtom) as any;
      
      console.log(`🔄 Indenting ${nodeId} under previous sibling ${prevSiblingId}`);
      
      // Check if previous sibling is a text node
      if (prevSibling?.type !== 'text') {
        return { code: -1, message: 'Previous sibling is not a text node', data: null };
      }
      
      // Get the node's children before moving it
      const nodeChildren = currentNode.children || [];
      
      // Remove node from current parent's children
      docsData.setAtom(parentNodeAtom, (prev: any) =>
        immer(prev, (draft: any) => {
          if (draft && draft.children) {
            const idx = draft.children.indexOf(nodeId);
            if (idx !== -1) {
              draft.children.splice(idx, 1);
            }
          }
        })
      );
      
      // Update parentId for all of the node's children (they become siblings of the indented node)
      nodeChildren.forEach((childId: string) => {
        const childAtom = docsData.getNodeData(docId, childId);
        docsData.setAtom(childAtom, (prev: any) =>
          immer(prev, (draft: any) => {
            if (draft) {
              draft.parentId = prevSiblingId; // Same parent as the indented node
            }
          })
        );
      });
      
      // Update node's parentId and clear its children
      docsData.setAtom(nodeAtom, (prev: any) =>
        immer(prev, (draft: any) => {
          if (draft) {
            draft.parentId = prevSiblingId;
            draft.children = []; // Clear children since they're now siblings
          }
        })
      );
      
      // Add node and its children to previous sibling's children
      docsData.setAtom(prevSiblingAtom, (prev: any) =>
        immer(prev, (draft: any) => {
          if (draft) {
            if (!draft.children) {
              draft.children = [];
            }
            // Add the indented node first, then its former children
            draft.children.push(nodeId, ...nodeChildren);
            
            // Set default childDisplay to 'ul' if not already set
            if (!draft.attr) {
              draft.attr = {};
            }
            if (!draft.attr.childDisplay) {
              draft.attr.childDisplay = 'ul';
            }
          }
        })
      );
      
      console.log(`✅ Indent operation completed for ${nodeId}, now child of ${prevSiblingId}${nodeChildren.length > 0 ? `, unwrapped ${nodeChildren.length} children` : ''}`);
      
      // Restore focus to the indented node
      docsState.triggerFocus(docId, nodeId, 'indented');
      
      // Trigger bullet position recalculation for the indented node
      // Use setTimeout to ensure DOM has updated before recalculating
      setTimeout(() => {
        // Check if there are any bullet positioning requests for this node
        if (nodeBulletState.hasAnyBulletReqs(docId, nodeId)) {
          const requests = nodeBulletState.getAllBulletYPosReqs(docId, nodeId);
          // Increment request counter for each container to trigger recalculation
          Object.keys(requests).forEach(containerClassName => {
            nodeBulletState.reqCalcBulletYPos(docId, nodeId, containerClassName);
          });
          console.log(`🔄 Triggered bullet recalculation for ${nodeId}`);
        }
      }, 0);
      
      return {
        code: 0,
        message: `Node ${nodeId} indented under ${prevSiblingId}`,
        data: { prevSiblingId }
      };
    },
    
    /**
     * Outdent a node by making it a sibling of its parent
     * @param {string} nodeId - The ID of the node to outdent
     * @returns {object} - Result object with code, message, and data
     */
    outdentNode: (nodeId: string) => {
      console.log(`🔄 Outdent operation started for node: ${nodeId}`);
      if (!docId) return { code: -1, message: 'No docId available', data: null };
      
      const nodeAtom = docsData.getNodeData(docId, nodeId);
      const currentNode = docsData.getAtomValue(nodeAtom) as any;
      
      if (!currentNode) {
        return { code: -1, message: `Node ${nodeId} not found`, data: null };
      }
      
      const parentId = currentNode.parentId;
      if (!parentId) {
        return { code: -1, message: 'Cannot outdent node without parent', data: null };
      }
      
      // Get parent node
      const parentNodeAtom = docsData.getNodeData(docId, parentId);
      const parentNode = docsData.getAtomValue(parentNodeAtom) as any;
      
      const grandparentId = parentNode?.parentId;
      if (!grandparentId) {
        return { code: -1, message: 'Cannot outdent node without grandparent', data: null };
      }
      
      console.log(`🔄 Outdenting ${nodeId} from parent ${parentId} to grandparent ${grandparentId}`);
      
      // Get current position in parent's children
      const siblings = parentNode?.children || [];
      const currentIndex = siblings.indexOf(nodeId);
      
      // Get all next siblings (after current node)
      const nextSiblings = siblings.slice(currentIndex + 1);
      
      // Remove node and next siblings from parent's children
      docsData.setAtom(parentNodeAtom, (prev: any) =>
        immer(prev, (draft: any) => {
          if (draft && draft.children) {
            // Keep only previous siblings (before current node)
            draft.children = draft.children.slice(0, currentIndex);
          }
        })
      );
      
      // Update parentId for all next siblings (they become children of the outdented node)
      nextSiblings.forEach((siblingId: string) => {
        const siblingAtom = docsData.getNodeData(docId, siblingId);
        docsData.setAtom(siblingAtom, (prev: any) =>
          immer(prev, (draft: any) => {
            if (draft) {
              draft.parentId = nodeId;
            }
          })
        );
      });
      
      // Update node's parentId and add next siblings as its children
      docsData.setAtom(nodeAtom, (prev: any) =>
        immer(prev, (draft: any) => {
          if (draft) {
            draft.parentId = grandparentId;
            // Add next siblings to the end of children array
            draft.children = [...(draft.children || []), ...nextSiblings];
            
            // Set default childDisplay to 'ul' if has children and not already set
            if (draft.children.length > 0) {
              if (!draft.attr) {
                draft.attr = {};
              }
              if (!draft.attr.childDisplay) {
                draft.attr.childDisplay = 'ul';
              }
            }
          }
        })
      );
      
      // Add node to grandparent's children (after parent)
      const grandparentNodeAtom = docsData.getNodeData(docId, grandparentId);
      docsData.setAtom(grandparentNodeAtom, (prev: any) =>
        immer(prev, (draft: any) => {
          if (draft && draft.children) {
            const parentIndex = draft.children.indexOf(parentId);
            if (parentIndex !== -1) {
              // Insert after parent
              draft.children.splice(parentIndex + 1, 0, nodeId);
            } else {
              // Fallback: add at end
              draft.children.push(nodeId);
            }
          }
        })
      );
      
      console.log(`✅ Outdent operation completed for ${nodeId}, now child of ${grandparentId}${nextSiblings.length > 0 ? `, adopted ${nextSiblings.length} next siblings` : ''}`);
      
      // Restore focus to the outdented node
      docsState.triggerFocus(docId, nodeId, 'outdented');
      
      return {
        code: 0,
        message: `Node ${nodeId} outdented to ${grandparentId}`,
        data: { grandparentId, nextSiblings }
      };
    },
    
    // Focus management
    triggerFocus: (nodeId: string, type: string, extraData: any = {}) => {
      if (!docId) return;
      docsState.triggerFocus(docId, nodeId, type, extraData);
    },
    
    triggerUnfocus: (nodeId: string, from: string, type: string, extraData: any = {}) => {
      if (!docId) return;
      docsState.triggerUnfocus(docId, nodeId, from, type, extraData);
    },
    
    // Settings/Configuration
    BULLET_DIMENSIONS,
    LIST_SETTINGS,
    TIMELINE_BULLET_SETTINGS,
    
    // Edit mode
    isEditable,
  };
};



