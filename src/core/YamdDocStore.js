import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';

/**
 * YamdDocStore - Zustand store for managing states of multiple YamdDoc instances
 * Each document instance is identified by a unique docId
 */
export const useYamdDocStore = create(
  subscribeWithSelector(
    immer((set, get) => ({
  // Store data for each document instance
  // Structure: { [docId]: { ...document-specific data } }
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
  bulletPreferredYPosReq: {},
  /**
   * Add a list bullet preferred Y position request using Immer
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID that should provide preferred Y position
   * @param {string} containerClassName - CSS class name of the container (starting with dot)
   */
  addBulletYPosReq: (docId, nodeId, containerClassName) => {
    set((state) => {
      // Ensure the document exists in the requests structure
      if (!state.bulletPreferredYPosReq[docId]) {
        state.bulletPreferredYPosReq[docId] = {};
      }
      
      // Ensure the node exists in the document's requests
      if (!state.bulletPreferredYPosReq[docId][nodeId]) {
        state.bulletPreferredYPosReq[docId][nodeId] = {};
      }
      
      // Add the request using containerClassName as key
      if (!state.bulletPreferredYPosReq[docId][nodeId][containerClassName]) {
        state.bulletPreferredYPosReq[docId][nodeId][containerClassName] = {
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
      if (state.bulletPreferredYPosReq[docId]?.[nodeId]?.[containerClassName]) {
        state.bulletPreferredYPosReq[docId][nodeId][containerClassName].result = result;
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
      if (state.bulletPreferredYPosReq[docId]?.[nodeId]?.[containerClassName]) {
        state.bulletPreferredYPosReq[docId][nodeId][containerClassName].requestCounter++;
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
      if (state.bulletPreferredYPosReq[docId]?.[nodeId]?.[containerClassName]) {
        state.bulletPreferredYPosReq[docId][nodeId][containerClassName].responseCounter++;
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
    return get().bulletPreferredYPosReq[docId]?.[nodeId] || {};
  },

  /**
   * Remove a specific request (using Immer)
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @param {string} containerClassName - CSS class name of the container (starting with dot)
   */
  removePreferredYPosRequest: (docId, nodeId, containerClassName) => {
    set((state) => {
      if (state.bulletPreferredYPosReq[docId]?.[nodeId]?.[containerClassName]) {
        delete state.bulletPreferredYPosReq[docId][nodeId][containerClassName];
        
        // If no more requests for this node, remove the node entry
        if (Object.keys(state.bulletPreferredYPosReq[docId][nodeId]).length === 0) {
          delete state.bulletPreferredYPosReq[docId][nodeId];
        }
        
        // If no more nodes for this doc, remove the doc entry
        if (Object.keys(state.bulletPreferredYPosReq[docId]).length === 0) {
          delete state.bulletPreferredYPosReq[docId];
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
      if (state.bulletPreferredYPosReq[docId]?.[nodeId]) {
        delete state.bulletPreferredYPosReq[docId][nodeId];
        
        // If no more nodes for this doc, remove the doc entry
        if (Object.keys(state.bulletPreferredYPosReq[docId]).length === 0) {
          delete state.bulletPreferredYPosReq[docId];
        }
      }
    });
  },

  /**
   * Clear all requests for a document (using Immer)
   * @param {string} docId - Document ID
   */
  clearPreferredYPosRequestsForDoc: (docId) => {
    set((state) => {
      if (state.bulletPreferredYPosReq[docId]) {
        delete state.bulletPreferredYPosReq[docId];
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
    const requests = get().bulletPreferredYPosReq[docId]?.[nodeId];
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