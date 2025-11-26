import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { atom, createStore, getDefaultStore } from 'jotai';

/**
 * DocsData - Class-based store for fine-grained node reactivity
 * Each node gets its own reactive data container, avoiding unnecessary re-renders
 * Internal implementation uses Jotai atoms
 * 
 * Encapsulates the Jotai store to ensure all operations use the same store instance
 */
class DocsData {
  constructor() {
    // Internal structure: { [docId]: { [nodeId]: atom(nodeData), _meta: { bibs, rootNodeId, etc. } } }
    this._data = {};
    
    // Use Jotai's default store for consistency with useAtomValue hooks in React components
    this._store = getDefaultStore();
  }
  
  /**
   * Get the Jotai store instance
   * @returns {object} Jotai store
   */
  getStore() {
    return this._store;
  }
  
  /**
   * Read an atom's value (non-reactive, for use outside React components)
   * @param {object} atomRef - Jotai atom reference
   * @returns {*} Current atom value
   */
  getAtomValue(atomRef) {
    return this._store.get(atomRef);
  }
  
  /**
   * Write to an atom (for use outside React components)
   * @param {object} atomRef - Jotai atom reference
   * @param {*} update - New value or updater function
   */
  setAtom(atomRef, update) {
    this._store.set(atomRef, update);
  }

  /**
   * Initialize document from flattened data structure
   * Creates atoms for all nodes and metadata
   * @param {string} docId - Document ID
   * @param {object} flattenedData - Flattened document data with nodes, rootNodeId, etc.
   * @returns {object} Document metadata (rootNodeId, nodeIds, etc.)
   */
  fromFlattenedData(docId, flattenedData) {
    if (!flattenedData?.nodes) {
      console.warn('fromFlattenedData: Invalid flattenedData, missing nodes');
      return null;
    }

    // Clear any existing data for this docId to avoid stale atoms
    if (this._data[docId]) {
      delete this._data[docId];
    }
    
    // Create fresh doc entry
    this._data[docId] = {};

    // Create atoms for each node
    const nodeIds = Object.keys(flattenedData.nodes);
    console.log(`📦 fromFlattenedData: Creating ${nodeIds.length} node atoms for docId: ${docId}`);
    console.log(`  Sample nodes:`, nodeIds.slice(0, 3).map(id => ({ 
      id, 
      type: flattenedData.nodes[id].type, 
      textRaw: flattenedData.nodes[id].textRaw?.substring(0, 50) 
    })));
    nodeIds.forEach(nodeId => {
      const nodeData = flattenedData.nodes[nodeId];
      // Create atom with initial node data
      this._data[docId][nodeId] = atom(nodeData);
    });

    // Store metadata in special _meta object with atoms
    this._data[docId]._meta = {
      rootNodeId: atom(flattenedData.rootNodeId),
      bibs: atom(flattenedData.bibs || {}),
      assets: atom(flattenedData.assets || {}),
      refs: atom(flattenedData.refs || {}),
      bibsLookup: atom(flattenedData.bibsLookup || {})
    };

    console.log(`✅ fromFlattenedData: Initialized docId: ${docId}, rootNodeId: ${flattenedData.rootNodeId}`);

    // Return metadata about the loaded document
    return {
      docId,
      rootNodeId: flattenedData.rootNodeId,
      nodeIds,
      nodeCount: nodeIds.length
    };
  }

  /**
   * Get bibliography atom for a document
   * @param {string} docId - Document ID
   * @returns {object} Reactive reference for bibs (internal: Jotai atom)
   */
  getBibs(docId) {
    if (!this._data[docId]?._meta?.bibs) {
      // Create default empty bibs atom if doesn't exist
      if (!this._data[docId]) {
        this._data[docId] = {};
      }
      if (!this._data[docId]._meta) {
        this._data[docId]._meta = {};
      }
      this._data[docId]._meta.bibs = atom({});
    }
    return this._data[docId]._meta.bibs;
  }

  /**
   * Get root node ID atom for a document
   * @param {string} docId - Document ID
   * @returns {object} Reactive reference for rootNodeId (internal: Jotai atom)
   */
  getRootNodeId(docId) {
    if (!this._data[docId]?._meta?.rootNodeId) {
      // Create default null rootNodeId atom if doesn't exist
      if (!this._data[docId]) {
        this._data[docId] = {};
      }
      if (!this._data[docId]._meta) {
        this._data[docId]._meta = {};
      }
      this._data[docId]._meta.rootNodeId = atom(null);
    }
    return this._data[docId]._meta.rootNodeId;
  }

  /**
   * Get reactive node data reference for a specific node
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @returns {object} Reactive reference for the node (internal: Jotai atom)
   */
  getNodeData(docId, nodeId) {
    if (!this._data[docId]) {
      console.warn(`⚠️ getNodeData: docId "${docId}" not found in store`);
      this._data[docId] = {};
    }
    
    if (!this._data[docId][nodeId]) {
      console.warn(`⚠️ getNodeData: nodeId "${nodeId}" not found in docId "${docId}", creating null atom`);
      // Create new reactive container with null initial value
      this._data[docId][nodeId] = atom(null);
    }
    
    return this._data[docId][nodeId];
  }

  /**
   * Ensure node data reference exists (creates if doesn't exist)
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @returns {object} Reactive reference for the node
   */
  ensureNode(docId, nodeId) {
    return this.getNodeData(docId, nodeId);
  }

  /**
   * Remove a node's reactive data
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   */
  removeNode(docId, nodeId) {
    if (this._data[docId]?.[nodeId]) {
      delete this._data[docId][nodeId];
      
      // Clean up empty doc entries
      if (Object.keys(this._data[docId]).length === 0) {
        delete this._data[docId];
      }
    }
  }

  /**
   * Remove all nodes for a document
   * @param {string} docId - Document ID
   */
  removeDoc(docId) {
    if (this._data[docId]) {
      delete this._data[docId];
    }
  }

  /**
   * Get all node IDs for a document
   * @param {string} docId - Document ID
   * @returns {string[]} Array of node IDs
   */
  getNodeIds(docId) {
    return Object.keys(this._data[docId] || {});
  }

  /**
   * Check if a node exists
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @returns {boolean} True if node exists
   */
  hasNode(docId, nodeId) {
    return !!(this._data[docId]?.[nodeId]);
  }
}

// Create singleton instance
export const docsData = new DocsData();

// Export convenience functions that use the singleton's store
// These ensure all atom operations use the same store instance
export const getAtomValue = (atomRef) => docsData.getAtomValue(atomRef);
export const setAtom = (atomRef, update) => docsData.setAtom(atomRef, update);

/**
 * DocsState - Class-based store for node operation states (focus, cursor, etc.)
 * Separate from DocsData (content) to keep concerns separated
 * Each node has a state atom with: { focus: { counter, type }, ... }
 */
class DocsState {
  constructor() {
    // Structure: { [docId]: { [nodeId]: atom(stateData) } }
    this._states = {};
    // Use the same Jotai store as DocsData
    this._store = docsData.getStore();
  }

  /**
   * Get or create state atom for a node
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @returns {object} Jotai atom for node state
   */
  getNodeState(docId, nodeId) {
    if (!this._states[docId]) {
      this._states[docId] = {};
    }
    
    if (!this._states[docId][nodeId]) {
      // Create initial state
      this._states[docId][nodeId] = atom({
        focus: {
          counter: 0,
          type: null // 'prevSiblingDeleted', 'nextSiblingDeleted', 'parentCommand', etc.
        }
      });
    }
    
    return this._states[docId][nodeId];
  }

  /**
   * Trigger focus on a node
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @param {string} type - Focus type ('prevSiblingDeleted', etc.)
   */
  triggerFocus(docId, nodeId, type, extraData = {}) {
    const stateAtom = this.getNodeState(docId, nodeId);
    const currentState = this._store.get(stateAtom);
    
    this._store.set(stateAtom, {
      ...currentState,
      focus: {
        counter: currentState.focus.counter + 1,
        type,
        ...extraData
      }
    });
  }

  /**
   * Remove state for a node
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   */
  removeNodeState(docId, nodeId) {
    if (this._states[docId]?.[nodeId]) {
      delete this._states[docId][nodeId];
    }
  }

  /**
   * Remove all states for a document
   * @param {string} docId - Document ID
   */
  removeDocStates(docId) {
    if (this._states[docId]) {
      delete this._states[docId];
    }
  }
}

// Create singleton instance
export const docsState = new DocsState();

/**
 * DocStore - Zustand store for managing document data and states
 * Each document instance is identified by a unique docId
 * Stores both document metadata and the actual node data (docData.nodes)
 */
export const useDocStore = create(
  subscribeWithSelector(
    immer((set, get) => ({
  // Store data for each document instance
  // Structure: { [docId]: { docData: { nodes: {...}, rootNodeId: '...' }, ...other metadata } }
  docs: {},

  // List bullet preferred Y position requests
  // Structure: { [docId]: { [nodeId]: { [containerClassName]: { result: null, requestCounter: number, responseCounter: number } } } }
  // Example:
  // {
  //   "doc-1": {
  //     "node-123": {
  //       ".yamd-bullet-container": { result: null, requestCounter: 0, responseCounter: 0 },
  //       ".yamd-timeline-item": { result: null, requestCounter: 0, responseCounter: 0 }
  //     },
  //     "node-456": {
  //       ".yamd-bullet-container": { result: null, requestCounter: 0, responseCounter: 0 }
  //     }
  //   }
  // }
  bulletYPosReq: {},
  /**
   * Add a list bullet preferred Y position request using Immer
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID that should provide preferred Y position
   * @param {string} containerClassName - CSS class name of the container (starting with dot)
   */
  addBulletYPosReq: (docId, nodeId, containerClassName) => {
    set((state) => {
      // Ensure the document exists in the requests structure
      if (!state.bulletYPosReq[docId]) {
        state.bulletYPosReq[docId] = {};
      }
      
      // Ensure the node exists in the document's requests
      if (!state.bulletYPosReq[docId][nodeId]) {
        state.bulletYPosReq[docId][nodeId] = {};
      }
      
      // Add the request using containerClassName as key
      if (!state.bulletYPosReq[docId][nodeId][containerClassName]) {
        state.bulletYPosReq[docId][nodeId][containerClassName] = {
          result: null,
          requestCounter: 0,
          responseCounter: 0
        };
      }
    });
  },


  /**
   * Update result for a specific request (using Immer)
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @param {string} containerClassName - CSS class name of the container (starting with dot)
   * @param {any} result - The result to store
   */
  updateReqResult: (docId, nodeId, containerClassName, result) => {
    set((state) => {
      if (state.bulletYPosReq[docId]?.[nodeId]?.[containerClassName]) {
        state.bulletYPosReq[docId][nodeId][containerClassName].result = result;
      }
    });
  },

  /**
   * Increment request counter for a specific request (using Immer)
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @param {string} containerClassName - CSS class name of the container (starting with dot)
   */
  incReqCounter: (docId, nodeId, containerClassName) => {
    set((state) => {
      if (state.bulletYPosReq[docId]?.[nodeId]?.[containerClassName]) {
        state.bulletYPosReq[docId][nodeId][containerClassName].requestCounter++;
      }
    });
  },

  /**
   * Increment response counter for a specific request (using Immer)
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @param {string} containerClassName - CSS class name of the container (starting with dot)
   */
  incRespCounter: (docId, nodeId, containerClassName) => {
    set((state) => {
      if (state.bulletYPosReq[docId]?.[nodeId]?.[containerClassName]) {
        state.bulletYPosReq[docId][nodeId][containerClassName].responseCounter++;
      }
    });
  },

  /**
   * Get all requests for a specific node
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @returns {object} Object with container class names as keys and request data as values
   */
  getBulletYPosReqs: (docId, nodeId) => {
    return get().bulletYPosReq[docId]?.[nodeId] || {};
  },

  /**
   * Remove a specific request (using Immer)
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @param {string} containerClassName - CSS class name of the container (starting with dot)
   */
  removeBulletYPosReq: (docId, nodeId, containerClassName) => {
    set((state) => {
      if (state.bulletYPosReq[docId]?.[nodeId]?.[containerClassName]) {
        delete state.bulletYPosReq[docId][nodeId][containerClassName];
        
        // If no more requests for this node, remove the node entry
        if (Object.keys(state.bulletYPosReq[docId][nodeId]).length === 0) {
          delete state.bulletYPosReq[docId][nodeId];
        }
        
        // If no more nodes for this doc, remove the doc entry
        if (Object.keys(state.bulletYPosReq[docId]).length === 0) {
          delete state.bulletYPosReq[docId];
        }
      }
    });
  },

  /**
   * Clear all requests for a specific node (using Immer)
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   */
  clearBulletYPosReqForDoc: (docId, nodeId) => {
    set((state) => {
      if (state.bulletYPosReq[docId]?.[nodeId]) {
        delete state.bulletYPosReq[docId][nodeId];
        
        // If no more nodes for this doc, remove the doc entry
        if (Object.keys(state.bulletYPosReq[docId]).length === 0) {
          delete state.bulletYPosReq[docId];
        }
      }
    });
  },

  /**
   * Clear all requests for a document (using Immer)
   * @param {string} docId - Document ID
   */
  clearBulletYPosReqForDoc: (docId) => {
    set((state) => {
      if (state.bulletYPosReq[docId]) {
        delete state.bulletYPosReq[docId];
      }
    });
  },

  /**
   * Check if there are any requests for a node
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @returns {boolean} True if there are requests for this node
   */
  hasPreferredYPosRequests: (docId, nodeId) => {
    const requests = get().bulletYPosReq[docId]?.[nodeId];
    return requests && Object.keys(requests).length > 0;
  },

  // ===== Document Management Methods =====

  /**
   * Get data for a specific document
   * @param {string} docId - Document ID
   * @returns {object} Document data or empty object if not found
   */
  getDocData: (docId) => {
    return get().docs[docId] || {};
  },

  /**
   * Set data for a specific document (using Immer)
   * @param {string} docId - Document ID
   * @param {object} data - Data to store for this document
   */
  setDocData: (docId, data) => {
    set((state) => {
      state.docs[docId] = {
        ...state.docs[docId],
        ...data
      };
    });
  },

  /**
   * Update specific field in document data (using Immer)
   * @param {string} docId - Document ID
   * @param {string} field - Field name to update
   * @param {any} value - Value to set
   */
  updateDocField: (docId, field, value) => {
    set((state) => {
      if (!state.docs[docId]) {
        state.docs[docId] = {};
      }
      state.docs[docId][field] = value;
    });
  },

  /**
   * Delete a node from the document (using Immer)
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID to delete
   * @returns {object} Result with code and message
   */
  deleteNodeFromDoc: (docId, nodeId) => {
    const state = get();
    const doc = state.docs[docId];
    if (!doc?.docData?.nodes) return { code: -1, message: 'Document not found' };
    
    const targetNode = doc.docData.nodes[nodeId];
    if (!targetNode) return { code: -1, message: `Node ${nodeId} not found` };
    if (!targetNode.parentId) return { code: -1, message: 'Cannot delete root node' };
    
    const parentNode = doc.docData.nodes[targetNode.parentId];
    if (!parentNode) return { code: -1, message: `Parent node not found` };
    
    const nodeIndex = parentNode.children.indexOf(nodeId);
    if (nodeIndex === -1) return { code: -1, message: 'Node not found in parent\'s children' };
    
    // Perform the deletion with Immer
    set((state) => {
      const parent = state.docs[docId].docData.nodes[targetNode.parentId];
      parent.children.splice(nodeIndex, 1);
      delete state.docs[docId].docData.nodes[nodeId];
    });
    
    return { code: 0, message: `Node ${nodeId} deleted successfully` };
  },

  /**
   * Remove document data (using Immer)
   * @param {string} docId - Document ID to remove
   */
  removeDoc: (docId) => {
    set((state) => {
      if (state.docs[docId]) {
        delete state.docs[docId];
      }
    });
  },

  /**
   * Clear all document data (using Immer)
   */
  clearAllDocs: () => {
    set((state) => {
      state.docs = {};
    });
  },

  /**
   * Get all document IDs
   * @returns {string[]} Array of document IDs
   */
  getAllDocIds: () => {
    return Object.keys(get().docs);
  },

  /**
   * Check if document exists
   * @param {string} docId - Document ID to check
   * @returns {boolean} True if document exists
   */
  hasDoc: (docId) => {
    return docId in get().docs;
  },

  // ===== Node Data Management Methods =====

  /**
   * Get node data by ID from a specific document
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @returns {object|null} Node data or null if not found
   */
  getNodeDataById: (docId, nodeId) => {
    const doc = get().docs[docId];
    if (!doc || !doc.docData || !doc.docData.nodes) {
      return null;
    }
    return doc.docData.nodes[nodeId] || null;
  },

  /**
   * Update node data using an Immer producer function
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @param {function} producer - Immer producer function that receives the node data to mutate
   * @example
   * updateNodeData('doc-1', 'node-123', (node) => {
   *   node.textRaw = 'New text';
   *   node.textOriginal = 'New text';
   * });
   */
  updateNodeData: (docId, nodeId, producer) => {
    set((state) => {
      const doc = state.docs[docId];
      if (!doc || !doc.docData || !doc.docData.nodes || !doc.docData.nodes[nodeId]) {
        console.warn(`Cannot update node: docId=${docId}, nodeId=${nodeId} not found`);
        return;
      }
      // Immer allows us to "mutate" the node safely
      producer(doc.docData.nodes[nodeId]);
    });
  }
  }))
  )
);

/**
 * Generate a random document ID
 * @returns {string} Random document ID
 */
export const generateDocId = () => {
  return `doc_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
};