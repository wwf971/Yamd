import React, { createContext, useContext } from 'react';
import { useAtomValue } from 'jotai';
import { produce as immer } from 'immer';
import { docsData, docsState, nodeBulletState } from '@/core/DocStore.js';
import { indentNode as indentNodeUtil, outdentNode as outdentNodeUtil } from '@/core/EditUtils.js';
import { getCursorPos } from '@/components/TextUtils.js';

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
  useNodeFocusCounter: (nodeId: string) => number;
  useNodeUnfocusCounter: (nodeId: string) => number;
  useNodeKeyboardCounter: (nodeId: string) => number;
  useNodeChildEventCounter: (nodeId: string) => number;
  useAsset: (assetId: string) => any;
  
  // Non-reactive data access methods
  getNodeDataById: (nodeId: string) => any;
  getNodeStateById: (nodeId: string) => any;
  updateNodeData: (nodeId: string, producer: (draft: any) => void) => void;
  createNode: (nodeId: string, nodeData: any) => void;
  getAssetById: (assetId: string) => any;
  updateAsset: (assetId: string, producer: (draft: any) => void) => void;
  getRefById: (refId: string) => any;
  createNodeAbove: (nodeId: string, newNodeData?: any) => {code: number; message: string; data: { newNodeId: string } | null };
  createListItemBelow: (nodeId: string, newNodeData?: any) => {code: number; message: string; data: { newNodeId: string } | null };
  splitToNextSibling: (nodeId: string, splitPosition: number) => { code: number; message: string; data: { newNodeId: string; leftText: string; rightText: string } | null };
  splitListItemToBelow: (segmentId: string, splitPosition: number) => { code: number; message: string; data: { newNodeId: string; leftText: string; rightText: string; newNodeSegments: string[] } | null };
  mergeWithPrevSibling: (nodeId: string) => { code: number; message: string; data: { prevSiblingId: string; cursorPos: number } | null };
  deleteNode: (nodeId: string) => { code: number; message: string; data: { previousSiblingId: string | null } | null };
  indentNode: (nodeId: string) => { code: number; message: string; data: { prevSiblingId: string } | null };
  outdentNode: (nodeId: string) => { code: number; message: string; data: { grandparentId: string } | null };
  
  // Focus management
  triggerFocus: (nodeId: string, type: string, extraData?: any) => void;
  triggerUnfocus: (nodeId: string, from: string, type: string, extraData?: any) => void;
  resetFocusState: (nodeId: string) => void;
  markFocusProcessed: (nodeId: string) => void;
  markUnfocusProcessed: (nodeId: string) => void;
  triggerChildEvent: (parentNodeId: string, fromId: string, type: string, cursorLoc?: string | null, cursorPos?: {x: number, y: number} | null, additionalData?: any) => void;
  triggerBulletYPosCalc: (nodeId: string) => void;
  
  // Cursor/selection utilities
  getCurrentSegmentId: (containerRef: React.RefObject<HTMLElement>) => string | null;
  
  // Focused segment tracking
  setCurrentSegId: (segmentId: string | null) => void;
  cancelCurrentSegId: () => void;
  
  // Configuration
  BULLET_DIMENSIONS: typeof BULLET_DIMENSIONS;
  LIST_SETTINGS: typeof LIST_SETTINGS;
  TIMELINE_BULLET_SETTINGS: typeof TIMELINE_BULLET_SETTINGS;
  
  // Edit mode
  isEditable: boolean;
  
  // Zustand store (for backward compatibility - bullet positioning)
  docStore?: any;
  
  // Callbacks
  onCreate?: ((id: string, data: any) => void) | null;
  onDelete?: ((id: string, data: any) => void) | null;
  
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
  setCurrentSegId = () => {},
  cancelCurrentSegId = () => {},
  onCreate = null,
  onDelete = null,
}: {
  registerNodeRef?: (nodeId: string, ref: any) => void;
  renderChildNodes?: (params: { childIds: string[]; parentInfo: any; globalInfo: any }) => React.ReactNode;
  isEditable?: boolean;
  docId?: string | null;
  docStore?: any;
  setCurrentSegId?: (segmentId: string | null) => void;
  cancelCurrentSegId?: () => void;
  onCreate?: ((id: string, data: any) => void) | null;
  onDelete?: ((id: string, data: any) => void) | null;
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

    getNodeStateById: (nodeId: string) => {
      if (!docId) return null;
      const stateAtom = docsState.getNodeState(docId, nodeId);
      const store = docsData.getStore() as any;
      return store.get(stateAtom);
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

    // Subscribe to individual counters (avoids re-renders when other state fields change)
    useNodeFocusCounter: (nodeId: string) => {
      if (!docId) return 0;
      const counterAtom = docsState.getFocusCounterAtom(docId, nodeId) as any;
      // eslint-disable-next-line react-hooks/rules-of-hooks
      return useAtomValue(counterAtom) as number;
    },

    useNodeUnfocusCounter: (nodeId: string) => {
      if (!docId) return 0;
      const counterAtom = docsState.getUnfocusCounterAtom(docId, nodeId) as any;
      // eslint-disable-next-line react-hooks/rules-of-hooks
      return useAtomValue(counterAtom) as number;
    },

    useNodeKeyboardCounter: (nodeId: string) => {
      if (!docId) return 0;
      const counterAtom = docsState.getKeyboardCounterAtom(docId, nodeId) as any;
      // eslint-disable-next-line react-hooks/rules-of-hooks
      return useAtomValue(counterAtom) as number;
    },

    useNodeChildEventCounter: (nodeId: string) => {
      if (!docId) return 0;
      const counterAtom = docsState.getChildEventCounterAtom(docId, nodeId) as any;
      // eslint-disable-next-line react-hooks/rules-of-hooks
      return useAtomValue(counterAtom) as number;
    },

    updateNodeData: (nodeId: string, producer: (draft: any) => void) => {
      if (!docId) return;
      const nodeAtom = docsData.getNodeData(docId, nodeId);
      docsData.setAtom(nodeAtom, (prev: any) => immer(prev, producer));
    },

    /**
     * Create a new node/segment in docsData with proper atom initialization
     * Use this instead of updateNodeData when creating new entities
     */
    createNode: (nodeId: string, nodeData: any) => {
      if (!docId) return;
      docsData.ensureNode(docId, nodeId);
      const nodeAtom = docsData.getNodeData(docId, nodeId);
      docsData.setAtom(nodeAtom, nodeData);
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
    
    createNodeAbove: (nodeId: string, newNodeData: any) => {
      if (!docId) return { code: -1, message: 'No docId available', data: null };
      
      const nodeAtom = docsData.getNodeData(docId, nodeId);
      const currentNode = docsData.getAtomValue(nodeAtom) as any;
      
      if (!currentNode) {
        return { code: -1, message: `Node ${nodeId} not found`, data: null };
      }
      
      const parentId = currentNode.parentId;
      if (!parentId) {
        return { code: -1, message: 'Cannot add node before root', data: null };
      }
      
      // Use provided node data or generate new node ID
      const newNodeId = newNodeData.id || `yamd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
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
      
      console.log(`➕ Creating new node ${newNodeId} before ${nodeId}`);
      
      // If newNode has segments, add them to docsData first
      if (newNode.segments) {
        newNode.segments.forEach((segId: string) => {
          const segData = newNodeData.segmentsData?.[segId];
          if (segData) {
            docsData.ensureNode(docId, segId);
            const segAtom = docsData.getNodeData(docId, segId);
            docsData.setAtom(segAtom, segData);
          }
        });
      }
      
      // Add new node to docsData
      docsData.ensureNode(docId, newNodeId);
      const newNodeAtom = docsData.getNodeData(docId, newNodeId);
      docsData.setAtom(newNodeAtom, newNode);
      
      // Insert new node into parent's children array before current node
      const parentNodeAtom = docsData.getNodeData(docId, parentId);
      docsData.setAtom(parentNodeAtom, (prev: any) =>
        immer(prev, (draft: any) => {
          if (draft && draft.children) {
            const currentIndex = draft.children.indexOf(nodeId);
            if (currentIndex !== -1) {
              draft.children.splice(currentIndex, 0, newNodeId);
              console.log(`➕ Inserted ${newNodeId} at index ${currentIndex} (before ${nodeId})`);
            }
          }
        })
      );
      
      // Call onCreate callback
      if (onCreate) {
        onCreate(newNodeId, newNode);
      }
      
      // Trigger bullet recalculation for the new node
      setTimeout(() => {
        if (nodeBulletState.hasAnyBulletReqs(docId, newNodeId)) {
          const requests = nodeBulletState.getAllBulletYPosReqs(docId, newNodeId);
          Object.keys(requests).forEach(containerClassName => {
            nodeBulletState.reqCalcBulletYPos(docId, newNodeId, containerClassName);
          });
        }
      }, 0);
      
      return {
        code: 0,
        message: `Node ${newNodeId} created successfully`,
        data: { newNodeId }
      };
    },
    
    createListItemBelow: (nodeId: string, newNodeData: any = {}) => {
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
      
      // Generate new node ID and segment ID
      const newNodeId = `yamd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newSegmentId = `seg_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create empty segment
      const newSegment = {
        type: 'segment',
        textRaw: '',
        id: newSegmentId,
        selfDisplay: 'text',
        parentId: newNodeId,
      };
      
      // Add segment to docsData
      docsData.ensureNode(docId, newSegmentId);
      const segmentAtom = docsData.getNodeData(docId, newSegmentId);
      docsData.setAtom(segmentAtom, newSegment);
      
      // Create new rich text node with default structure
      const newNode = {
        id: newNodeId,
        type: 'richtext',
        parentId: parentId,
        segments: [newSegmentId],
        children: [],
        ...newNodeData,
      };
      
      console.log(`➕ Creating new rich text node ${newNodeId} below ${nodeId} with empty segment ${newSegmentId}`);
      
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
      
      // Focus the empty segment (not the node itself)
      docsState.triggerFocus(docId, newSegmentId, 'fromLeft');
      
      // Call onCreate callback
      if (onCreate) {
        onCreate(newNodeId, newNode);
      }
      
      // Trigger bullet recalculation for the new node
      setTimeout(() => {
        if (nodeBulletState.hasAnyBulletReqs(docId, newNodeId)) {
          const requests = nodeBulletState.getAllBulletYPosReqs(docId, newNodeId);
          Object.keys(requests).forEach(containerClassName => {
            nodeBulletState.reqCalcBulletYPos(docId, newNodeId, containerClassName);
          });
        }
      }, 0);
      
      return {
        code: 0,
        message: `Node ${newNodeId} created successfully with segment ${newSegmentId}`,
        data: { newNodeId, newSegmentId }
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
    
    /**
     * Split a rich text segment and create a new rich text node below with the right part and remaining segments
     * Used when Enter is pressed in the middle of a text segment
     * @param segmentId - The segment being split
     * @param splitPosition - Character position in the segment's text where to split
     * @returns Result object with code, message, and new node ID
     */
    splitListItemToBelow: (segmentId: string, splitPosition: number) => {
      if (!docId) return { code: -1, message: 'No docId available', data: null };
      
      // Get the segment data
      const segmentAtom = docsData.getNodeData(docId, segmentId);
      const segmentData = docsData.getAtomValue(segmentAtom) as any;
      
      if (!segmentData) {
        return { code: -1, message: `Segment ${segmentId} not found`, data: null };
      }
      
      const parentRichTextNodeId = segmentData.parentId;
      if (!parentRichTextNodeId) {
        return { code: -1, message: 'Segment has no parent rich text node', data: null };
      }
      
      // Get the parent rich text node
      const parentAtom = docsData.getNodeData(docId, parentRichTextNodeId);
      const parentNode = docsData.getAtomValue(parentAtom) as any;
      
      if (!parentNode) {
        return { code: -1, message: `Parent node ${parentRichTextNodeId} not found`, data: null };
      }
      
      const grandparentId = parentNode.parentId;
      if (!grandparentId) {
        return { code: -1, message: 'Cannot split - parent node is root', data: null };
      }
      
      const segments = parentNode.segments || [];
      const segmentIndex = segments.indexOf(segmentId);
      
      if (segmentIndex === -1) {
        return { code: -1, message: `Segment ${segmentId} not found in parent's segments array`, data: null };
      }
      
      // Split the current segment's text
      const currentText = segmentData.textRaw || '';
      const leftText = currentText.substring(0, splitPosition);
      const rightText = currentText.substring(splitPosition);
      
      console.log(`✂️ Splitting segment ${segmentId} at position ${splitPosition}: "${leftText}" | "${rightText}"`);
      
      // Update current segment with left part
      docsData.setAtom(segmentAtom, (prev: any) =>
        immer(prev, (draft: any) => {
          draft.textRaw = leftText;
        })
      );
      
      // Segments after the split segment (these will all move to new node)
      const segmentsToMove = segments.slice(segmentIndex + 1);
      
      // Create new segment for the right text (if not empty)
      const newNodeSegments: string[] = [];
      
      if (rightText !== '') {
        // Create a new segment with the right text
        const rightSegmentId = `seg_${Math.random().toString(36).substr(2, 9)}`;
        const rightSegment = {
          type: 'segment',
          textRaw: rightText,
          id: rightSegmentId,
          selfDisplay: 'text',
          parentId: null, // Will be set when added to new node
        };
        
        // Add to docsData
        docsData.ensureNode(docId, rightSegmentId);
        const rightSegmentAtom = docsData.getNodeData(docId, rightSegmentId);
        docsData.setAtom(rightSegmentAtom, rightSegment);
        
        newNodeSegments.push(rightSegmentId);
      }
      
      // Add all segments that were to the right of the split segment
      newNodeSegments.push(...segmentsToMove);
      
      // If no segments to move to new node, create an empty text segment
      if (newNodeSegments.length === 0) {
        const emptySegmentId = `seg_${Math.random().toString(36).substr(2, 9)}`;
        const emptySegment = {
          type: 'segment',
          textRaw: '',
          id: emptySegmentId,
          selfDisplay: 'text',
          parentId: null, // Will be set below
        };
        
        docsData.ensureNode(docId, emptySegmentId);
        const emptySegmentAtom = docsData.getNodeData(docId, emptySegmentId);
        docsData.setAtom(emptySegmentAtom, emptySegment);
        newNodeSegments.push(emptySegmentId);
      }
      
      // Create new rich text node
      const newNodeId = `yamd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newNode = {
        id: newNodeId,
        type: 'richtext',
        parentId: grandparentId,
        segments: newNodeSegments,
        children: [],
      };
      
      console.log(`➕ Creating new rich text node ${newNodeId} with segments:`, newNodeSegments);
      
      // Add new node to docsData
      docsData.ensureNode(docId, newNodeId);
      const newNodeAtom = docsData.getNodeData(docId, newNodeId);
      docsData.setAtom(newNodeAtom, newNode);
      
      // Update parentId for all segments in the new node
      newNodeSegments.forEach(segId => {
        const segAtom = docsData.getNodeData(docId, segId);
        docsData.setAtom(segAtom, (prev: any) =>
          immer(prev, (draft: any) => {
            draft.parentId = newNodeId;
          })
        );
      });
      
      // Remove moved segments from the current rich text node
      docsData.setAtom(parentAtom, (prev: any) =>
        immer(prev, (draft: any) => {
          if (draft.segments) {
            // Keep only segments up to and including the split segment
            draft.segments = draft.segments.slice(0, segmentIndex + 1);
          }
        })
      );
      
      // Insert new node into grandparent's children array after current parent
      const grandparentAtom = docsData.getNodeData(docId, grandparentId);
      docsData.setAtom(grandparentAtom, (prev: any) =>
        immer(prev, (draft: any) => {
          if (draft && draft.children) {
            const parentIndex = draft.children.indexOf(parentRichTextNodeId);
            if (parentIndex !== -1) {
              draft.children.splice(parentIndex + 1, 0, newNodeId);
            }
          }
        })
      );
      
      // Call onCreate callback
      if (onCreate) {
        onCreate(newNodeId, newNode);
      }
      
      // Focus the first segment of the new node
      const firstSegmentId = newNodeSegments[0];
      docsState.triggerFocus(docId, firstSegmentId, 'fromLeft');
      
      return {
        code: 0,
        message: `Segment ${segmentId} split, created new node ${newNodeId}`,
        data: { newNodeId, leftText, rightText, newNodeSegments }
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
      
      // Call onDelete callback before actual deletion
      if (onDelete) {
        onDelete(nodeId, targetNode);
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
      
      try {
        // Extract relevant nodes from atoms
        const currentNode = docsData.getAtomValue(docsData.getNodeData(docId, nodeId)) as any;
        const nodes: any = { [nodeId]: currentNode };
        
        const parentId = currentNode.parentId;
        const parentNode = docsData.getAtomValue(docsData.getNodeData(docId, parentId)) as any;
        nodes[parentId] = parentNode;
        
        // Get all sibling and child nodes
        [...(parentNode?.children || []), ...(currentNode.children || [])].forEach((relatedId: string) => {
          if (!nodes[relatedId]) {
            nodes[relatedId] = docsData.getAtomValue(docsData.getNodeData(docId, relatedId)) as any;
          }
        });
        
        // Call EditUtils function
        const result: any = indentNodeUtil(nodeId, nodes);
        if (result.code !== 0) {
          console.warn(`⚠️ Indent validation failed for ${nodeId}: ${result.message}`);
          return { code: result.code, message: result.message, data: null };
        }
        
        // Apply changes to atoms
        result.changes.forEach((change: any) => {
          docsData.setAtom(docsData.getNodeData(docId, change.nodeId), (prev: any) => immer(prev, change.updates));
        });
        
        console.log(`✅ Indent operation completed for ${nodeId}, now child of ${result.data?.prevSiblingId}${result.data?.nodeChildrenCount > 0 ? `, unwrapped ${result.data.nodeChildrenCount} children` : ''}`);
        docsState.triggerFocus(docId, nodeId, 'indented');
        
        setTimeout(() => {
          if (nodeBulletState.hasAnyBulletReqs(docId, nodeId)) {
            const requests = nodeBulletState.getAllBulletYPosReqs(docId, nodeId);
            Object.keys(requests).forEach(containerClassName => {
              nodeBulletState.reqCalcBulletYPos(docId, nodeId, containerClassName);
            });
            console.log(`🔄 Triggered bullet recalculation for ${nodeId}`);
          }
        }, 0);
        
        return { code: 0, message: result.message, data: { prevSiblingId: result.data?.prevSiblingId } };
      } catch (error: any) {
        return { code: -1, message: error.message || 'Indent operation failed', data: null };
      }
    },
    
    /**
     * Outdent a node by making it a sibling of its parent
     * @param {string} nodeId - The ID of the node to outdent
     * @returns {object} - Result object with code, message, and data
     */
    outdentNode: (nodeId: string) => {
      console.log(`🔄 Outdent operation started for node: ${nodeId}`);
      if (!docId) return { code: -1, message: 'No docId available', data: null };
      
      try {
        // Capture cursor position/selection and segment ID before outdenting
        let cursorPos: number | undefined = undefined;
        let selectionStart: number | undefined = undefined;
        let selectionEnd: number | undefined = undefined;
        let focusedSegmentId: string | undefined = undefined;
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          // Start from the container (could be text node or element)
          // Use startContainer for both collapsed and non-collapsed selections
          let node: Node | null = range.startContainer;
          
          // Find the segment element that contains the selection start
          // Traverse up from the text node to find the element with data-segment-id
          let segmentElement: HTMLElement | null = null;
          while (node) {
            // If it's a text node, get its parent
            if (node.nodeType === Node.TEXT_NODE) {
              node = node.parentNode;
              continue;
            }
            
            // Check if this element has the segment ID
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;
              const segmentId = element.getAttribute?.('data-segment-id');
              if (segmentId) {
                segmentElement = element;
                focusedSegmentId = segmentId;
                break;
              }
            }
            node = node.parentNode;
          }
          
          // Check if the found segment belongs to the node being outdented
          if (segmentElement && focusedSegmentId) {
            const currentNode = docsData.getAtomValue(docsData.getNodeData(docId, nodeId)) as any;
            if (currentNode?.segments?.includes(focusedSegmentId)) {
              if (selection.isCollapsed) {
                // For collapsed selection, get cursor position only
                // Explicitly clear selection values to avoid reusing old data
                cursorPos = getCursorPos(segmentElement);
                selectionStart = undefined;
                selectionEnd = undefined;
              } else {
                // For non-collapsed selection, capture both start and end positions
                // Explicitly clear cursorPos to avoid reusing old data
                const preStartRange = range.cloneRange();
                preStartRange.selectNodeContents(segmentElement);
                preStartRange.setEnd(range.startContainer, range.startOffset);
                selectionStart = preStartRange.toString().length;
                
                const preEndRange = range.cloneRange();
                preEndRange.selectNodeContents(segmentElement);
                preEndRange.setEnd(range.endContainer, range.endOffset);
                selectionEnd = preEndRange.toString().length;
                cursorPos = undefined;
              }
            } else {
              // Segment doesn't belong to this node, clear it
              focusedSegmentId = undefined;
            }
          }
        }
        
        // Extract relevant nodes from atoms
        const currentNode = docsData.getAtomValue(docsData.getNodeData(docId, nodeId)) as any;
        if (!currentNode || !currentNode.parentId) {
          return { code: -1, message: 'Node has no parent - cannot outdent', data: null };
        }
        
        const parentNode = docsData.getAtomValue(docsData.getNodeData(docId, currentNode.parentId)) as any;
        if (!parentNode) {
          return { code: -1, message: `Parent node ${currentNode.parentId} not found`, data: null };
        }
        
        const nodes: any = {
          [nodeId]: currentNode,
          [currentNode.parentId]: parentNode
        };
        
        // Only get grandparent if parent has one
        if (parentNode.parentId) {
          const grandparentNode = docsData.getAtomValue(docsData.getNodeData(docId, parentNode.parentId)) as any;
          if (grandparentNode) {
            nodes[parentNode.parentId] = grandparentNode;
          }
        }
        
        // Call EditUtils function
        const result: any = outdentNodeUtil(nodeId, nodes);
        if (result.code !== 0) return { code: result.code, message: result.message, data: null };
        
        // Apply changes to atoms
        result.changes.forEach((change: any) => {
          docsData.setAtom(docsData.getNodeData(docId, change.nodeId), (prev: any) => immer(prev, change.updates));
        });
        
        console.log(`✅ Outdent operation completed for ${nodeId}, now child of ${result.data?.grandparentId}`);
        
        // Trigger focus on the specific segment that was focused, preserving cursor position/selection
        // Use requestAnimationFrame to ensure DOM has updated after outdent
        requestAnimationFrame(() => {
          if (focusedSegmentId) {
            if (selectionStart !== undefined && selectionEnd !== undefined) {
              // Preserve selection range - explicitly clear cursorPos to avoid old values
              docsState.triggerFocus(docId, focusedSegmentId, 'outdented', { 
                selectionStart, 
                selectionEnd,
                cursorPos: undefined 
              });
            } else if (cursorPos !== undefined) {
              // Preserve cursor position - explicitly clear selection to avoid old values
              docsState.triggerFocus(docId, focusedSegmentId, 'outdented', { 
                cursorPos,
                selectionStart: undefined,
                selectionEnd: undefined
              });
            } else {
              // Fallback: focus without position - explicitly clear all to avoid old values
              docsState.triggerFocus(docId, focusedSegmentId, 'outdented', {
                cursorPos: undefined,
                selectionStart: undefined,
                selectionEnd: undefined
              });
            }
          } else {
            // Fallback: focus the node (will default to first segment)
            docsState.triggerFocus(docId, nodeId, 'outdented');
          }
        });
        
        return { code: 0, message: result.message, data: { grandparentId: result.data?.grandparentId } };
      } catch (error: any) {
        return { code: -1, message: error.message || 'Outdent operation failed', data: null };
      }
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

    resetFocusState: (nodeId: string) => {
      if (!docId) return;
      docsState.resetFocusState(docId, nodeId);
    },

    markFocusProcessed: (nodeId: string) => {
      if (!docId) return;
      docsState.markFocusProcessed(docId, nodeId);
    },

    markUnfocusProcessed: (nodeId: string) => {
      if (!docId) return;
      docsState.markUnfocusProcessed(docId, nodeId);
    },

    triggerChildEvent: (parentNodeId: string, fromId: string, type: string, cursorLoc: string | null = null, cursorPos: {x: number, y: number} | null = null, additionalData: any = null) => {
      if (!docId) return;
      docsState.triggerChildEvent(docId, parentNodeId, fromId, type, cursorLoc ?? undefined, cursorPos ?? undefined, additionalData ?? undefined);
    },

    /**
     * Trigger bullet position recalculation for a node
     * Use after operations that change node structure (split, merge, etc.)
     */
    triggerBulletYPosCalc: (nodeId: string) => {
      if (!docId) return;
      setTimeout(() => {
        // Check if there are any bullet positioning requests for this node
        if (nodeBulletState.hasAnyBulletReqs(docId, nodeId)) {
          const requests = nodeBulletState.getAllBulletYPosReqs(docId, nodeId);
          // Increment request counter for each container to trigger recalculation
          Object.keys(requests).forEach(containerClassName => {
            nodeBulletState.reqCalcBulletYPos(docId, nodeId, containerClassName);
          });
        }
      }, 0);
    },
    
    // Cursor/selection utilities
    getCurrentSegmentId: (containerRef: React.RefObject<HTMLElement>) => {
      const sel = window.getSelection();
      if (!sel || !sel.anchorNode) return null;
      
      let node: Node | null = sel.anchorNode;
      const containerElement = containerRef.current;
      
      if (!containerElement) return null;
      
      // Traverse up to find a node with data-segment-id
      while (node && node !== containerElement) {
        const segmentId = (node as HTMLElement).dataset?.segmentId;
        if (segmentId) {
          return segmentId;
        }
        node = node.parentNode;
      }
      
      return null;
    },
    
    // Focused segment tracking
    setCurrentSegId,
    cancelCurrentSegId,
    
    // Settings/Configuration
    BULLET_DIMENSIONS,
    LIST_SETTINGS,
    TIMELINE_BULLET_SETTINGS,
    
    // Edit mode
    isEditable,
    
    // Callbacks
    onCreate,
    onDelete,
  };
};



