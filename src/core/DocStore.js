import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';

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
  removePreferredYPosRequest: (docId, nodeId, containerClassName) => {
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
  clearPreferredYPosRequestsForNode: (docId, nodeId) => {
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
      if (!state.docs[docId]) {
        state.docs[docId] = {};
      }
      Object.assign(state.docs[docId], data);
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
  return `yamd_doc_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
};