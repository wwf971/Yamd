import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { atom, createStore, getDefaultStore, useAtomValue } from 'jotai';

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
      // console.warn('fromFlattenedData: Invalid flattenedData, missing nodes');
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

    // console.log(`✅ fromFlattenedData: Initialized docId: ${docId}, rootNodeId: ${flattenedData.rootNodeId}`);

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
   * Get references atom for a document
   * @param {string} docId - Document ID
   * @returns {object} Reactive reference for refs (internal: Jotai atom)
   */
  getRefs(docId) {
    if (!this._data[docId]?._meta?.refs) {
      // Create default empty refs atom if doesn't exist
      if (!this._data[docId]) {
        this._data[docId] = {};
      }
      if (!this._data[docId]._meta) {
        this._data[docId]._meta = {};
      }
      this._data[docId]._meta.refs = atom({});
    }
    return this._data[docId]._meta.refs;
  }

  /**
   * Get assets atom for a document
   * @param {string} docId - Document ID
   * @returns {object} Reactive reference for assets (internal: Jotai atom)
   */
  getAssets(docId) {
    if (!this._data[docId]?._meta?.assets) {
      // Create default empty assets atom if doesn't exist
      if (!this._data[docId]) {
        this._data[docId] = {};
      }
      if (!this._data[docId]._meta) {
        this._data[docId]._meta = {};
      }
      this._data[docId]._meta.assets = atom({});
    }
    return this._data[docId]._meta.assets;
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
      console.log(`⚠️ getNodeData: docId "${docId}" not found in store`);
      this._data[docId] = {};
    }
    
    if (!this._data[docId][nodeId]) {
      console.log(`⚠️ getNodeData: nodeId "${nodeId}" not found in docId "${docId}", creating null atom`);
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
    // Cache for derived counter atoms
    this._focusCounterAtoms = {};
    this._unfocusCounterAtoms = {};
    this._keyboardCounterAtoms = {};
    this._childEventCounterAtoms = {};
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
          counterProcessed: 0, // Track last processed counter to avoid re-processing
          type: null // 'prevSiblingDeleted', 'nextSiblingDeleted', 'parentCommand', etc.
        },
        unfocus: {
          counter: 0,
          counterProcessed: 0, // Track last processed counter to avoid re-processing
          from: null, // segment ID that wants to unfocus
          type: null  // 'left', 'right', 'up', 'down'
        },
        keyboard: {
          counter: 0,
          event: null // { key, ctrlKey, shiftKey, metaKey, altKey }
        },
        childEvent: {
          counter: 0,
          from: null, // segment/child ID triggering the event
          type: null, // 'split', 'delete', 'create', 'indent', 'outdent', etc.
          cursorLoc: null, // 'begin', 'middle', 'end' (for split/delete)
          cursorPos: null, // { x, y } cursor page coordinates
          additionalData: null // any additional data: { reason, rightSegId, createType, isChildPseudo, etc. }
        }
      });
    }
    
    return this._states[docId][nodeId];
  }

  /**
   * Get derived atom for focus counter only (cached)
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @returns {object} Jotai derived atom for focus counter
   */
  getFocusCounterAtom(docId, nodeId) {
    if (!this._focusCounterAtoms[docId]) {
      this._focusCounterAtoms[docId] = {};
    }
    
    if (!this._focusCounterAtoms[docId][nodeId]) {
      const stateAtom = this.getNodeState(docId, nodeId);
      this._focusCounterAtoms[docId][nodeId] = atom((get) => get(stateAtom).focus.counter);
    }
    
    return this._focusCounterAtoms[docId][nodeId];
  }

  /**
   * Get derived atom for unfocus counter only (cached)
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @returns {object} Jotai derived atom for unfocus counter
   */
  getUnfocusCounterAtom(docId, nodeId) {
    if (!this._unfocusCounterAtoms[docId]) {
      this._unfocusCounterAtoms[docId] = {};
    }
    
    if (!this._unfocusCounterAtoms[docId][nodeId]) {
      const stateAtom = this.getNodeState(docId, nodeId);
      this._unfocusCounterAtoms[docId][nodeId] = atom((get) => get(stateAtom).unfocus.counter);
    }
    
    return this._unfocusCounterAtoms[docId][nodeId];
  }

  /**
   * Get derived atom for keyboard counter only (cached)
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @returns {object} Jotai derived atom for keyboard counter
   */
  getKeyboardCounterAtom(docId, nodeId) {
    if (!this._keyboardCounterAtoms[docId]) {
      this._keyboardCounterAtoms[docId] = {};
    }
    
    if (!this._keyboardCounterAtoms[docId][nodeId]) {
      const stateAtom = this.getNodeState(docId, nodeId);
      this._keyboardCounterAtoms[docId][nodeId] = atom((get) => get(stateAtom).keyboard.counter);
    }
    
    return this._keyboardCounterAtoms[docId][nodeId];
  }

  /**
   * Get derived atom for childEvent counter only (cached)
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @returns {object} Jotai derived atom for childEvent counter
   */
  getChildEventCounterAtom(docId, nodeId) {
    if (!this._childEventCounterAtoms[docId]) {
      this._childEventCounterAtoms[docId] = {};
    }
    
    if (!this._childEventCounterAtoms[docId][nodeId]) {
      const stateAtom = this.getNodeState(docId, nodeId);
      this._childEventCounterAtoms[docId][nodeId] = atom((get) => get(stateAtom).childEvent.counter);
    }
    
    return this._childEventCounterAtoms[docId][nodeId];
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
    
    // Mutate the focus object directly
    currentState.focus.counter++;
    currentState.focus.type = type;
    Object.assign(currentState.focus, extraData);
    
    // Set with a new state reference so Jotai detects the change
    this._store.set(stateAtom, {...currentState});
  }

  /**
   * Trigger unfocus on a node (for segments to request exit)
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID (parent rich text node)
   * @param {string} from - Segment ID that wants to unfocus
   * @param {string} type - Unfocus type ('left', 'right', 'up', 'down')
   * @param {object} extraData - Additional data (e.g., cursorPageX)
   */
  triggerUnfocus(docId, nodeId, from, type, extraData = {}) {
    const stateAtom = this.getNodeState(docId, nodeId);
    const currentState = this._store.get(stateAtom);
    
    // Mutate the unfocus object directly
    currentState.unfocus.counter++;
    currentState.unfocus.from = from;
    currentState.unfocus.type = type;
    Object.assign(currentState.unfocus, extraData);
    
    // Set with a new state reference so Jotai detects the change
    this._store.set(stateAtom, {...currentState});
  }

  /**
   * Mark all pending focus/unfocus events as processed (used when moving segments to new parent)
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   */
  resetFocusState(docId, nodeId) {
    const stateAtom = this.getNodeState(docId, nodeId);
    const currentState = this._store.get(stateAtom);
    
    // Mark current counters as already processed to prevent re-processing old events
    currentState.focus.counterProcessed = currentState.focus.counter;
    currentState.unfocus.counterProcessed = currentState.unfocus.counter;
    
    // Set with a new state reference so Jotai detects the change
    this._store.set(stateAtom, {...currentState});
  }

  /**
   * Mark focus event as processed (called by segments after handling focus)
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   */
  markFocusProcessed(docId, nodeId) {
    const stateAtom = this.getNodeState(docId, nodeId);
    const currentState = this._store.get(stateAtom);
    currentState.focus.counterProcessed = currentState.focus.counter;
    // No need to trigger re-render, just update the value
  }

  /**
   * Mark unfocus event as processed (called by segments after handling unfocus)
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   */
  markUnfocusProcessed(docId, nodeId) {
    const stateAtom = this.getNodeState(docId, nodeId);
    const currentState = this._store.get(stateAtom);
    currentState.unfocus.counterProcessed = currentState.unfocus.counter;
    // No need to trigger re-render, just update the value
  }

  /**
   * Trigger keyboard event on a node/segment
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node/Segment ID
   * @param {object} eventData - Event data { key, ctrlKey, shiftKey, metaKey, altKey }
   */
  triggerKeyboard(docId, nodeId, eventData) {
    const stateAtom = this.getNodeState(docId, nodeId);
    const currentState = this._store.get(stateAtom);
    
    // Update keyboard state
    currentState.keyboard = {
      counter: (currentState.keyboard?.counter || 0) + 1,
      event: eventData
    };
    
    // Set with a new state reference so Jotai detects the change
    this._store.set(stateAtom, {...currentState});
  }

  /**
   * Trigger child event (from child segment to parent rich text node)
   * @param {string} docId - Document ID
   * @param {string} parentNodeId - Parent node ID
   * @param {string} fromId - Segment ID triggering the event
   * @param {string} type - Event type: 'split', 'delete', 'create', 'indent', 'outdent', etc.
   * @param {string|null} cursorLoc - Optional cursor location: 'begin', 'middle', 'end', or null
   * @param {object|null} cursorPos - Optional cursor page coordinates: { x, y }, or null
   * @param {object|null} additionalData - Optional additional data
   */
  triggerChildEvent(docId, parentNodeId, fromId, type, cursorLoc = null, cursorPos = null, additionalData = null) {
    const stateAtom = this.getNodeState(docId, parentNodeId);
    const currentState = this._store.get(stateAtom);
    
    // Update childEvent state
    currentState.childEvent = {
      counter: (currentState.childEvent?.counter || 0) + 1,
      from: fromId,
      type: type,
      cursorLoc: cursorLoc,
      cursorPos: cursorPos,
      additionalData: additionalData
    };
    
    // Set with a new state reference so Jotai detects the change
    this._store.set(stateAtom, {...currentState});
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
    // Also clean up derived counter atom caches
    if (this._focusCounterAtoms[docId]) {
      delete this._focusCounterAtoms[docId];
    }
    if (this._unfocusCounterAtoms[docId]) {
      delete this._unfocusCounterAtoms[docId];
    }
    if (this._keyboardCounterAtoms[docId]) {
      delete this._keyboardCounterAtoms[docId];
    }
    if (this._childEventCounterAtoms[docId]) {
      delete this._childEventCounterAtoms[docId];
    }
  }
}

// Create singleton instance
export const docsState = new DocsState();

/**
 * DocsBulletState - Class-based store for bullet positioning communication
 * Manages bullet Y position requests and responses using Jotai atoms with derived atoms
 * 
 * Key design:
 * - Base atom stores all data: { [containerClassName]: { result, reqCounter, respCounter } }
 * - Derived "request atom" only changes when reqCounter changes (for responders)
 * - Derived "response atom" only changes when result changes (for requesters)
 * - Components never directly access base atom, only derived atoms
 */
class DocsBulletState {
  constructor() {
    // Base atoms: { [docId]: { [nodeId]: { base: atom, request: derivedAtom, response: derivedAtom } } }
    this._bulletStates = {};
    // Use the same Jotai store as DocsData
    this._store = docsData.getStore();
  }

  /**
   * Get or create bullet state atoms for a node (base + derived)
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @returns {object} { base, request, response } atoms
   */
  _getOrCreateAtoms(docId, nodeId) {
    if (!this._bulletStates[docId]) {
      this._bulletStates[docId] = {};
    }
    
    if (!this._bulletStates[docId][nodeId]) {
      // Base atom stores all data
      const baseAtom = atom({});
      
      // Derived atom for responders: only changes when reqCounters change
      const requestAtom = atom((get) => {
        const state = get(baseAtom);
        const reqCounters = {};
        Object.keys(state).forEach(key => {
          reqCounters[key] = state[key]?.reqCounter || 0;
        });
        return reqCounters;
      });
      
      // Derived atom for requesters: only changes when results change
      const respAtom = atom((get) => {
        const state = get(baseAtom);
        const results = {};
        Object.keys(state).forEach(key => {
          results[key] = state[key]?.result || null;
        });
        return results;
      });
      
      this._bulletStates[docId][nodeId] = { base: baseAtom, request: requestAtom, response: respAtom };
    }
    
    return this._bulletStates[docId][nodeId];
  }

  /**
   * Get request atom for responders (only changes when reqCounter changes)
   * Returns a safe atom (never null) for use with useAtomValue
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @returns {object} Jotai derived atom (safe to use with useAtomValue)
   */
  reqAtom(docId, nodeId) {
    if (!docId || !nodeId) return atom({});
    return this._getOrCreateAtoms(docId, nodeId).request;
  }

  /**
   * Get response atom for requesters (only changes when result changes)
   * Returns a safe atom (never null) for use with useAtomValue
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @returns {object} Jotai derived atom (safe to use with useAtomValue)
   */
  respAtom(docId, nodeId) {
    if (!docId || !nodeId) return atom({});
    return this._getOrCreateAtoms(docId, nodeId).response;
  }
  
  /**
   * React hook: Subscribe to request counters (for responders)
   * Only triggers when reqCounter changes, not when result/respCounter changes
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @returns {object} { [containerClassName]: reqCounter }
   */
  useReqCounters(docId, nodeId) {
    return useAtomValue(this.reqAtom(docId, nodeId));
  }
  
  /**
   * React hook: Subscribe to results (for requesters)
   * Only triggers when result changes, not when reqCounter/respCounter changes
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @returns {object} { [containerClassName]: result }
   */
  useResults(docId, nodeId) {
    return useAtomValue(this.respAtom(docId, nodeId));
  }
  
  // Backward compatibility aliases
  getReqAtom(docId, nodeId) {
    return this.reqAtom(docId, nodeId);
  }
  
  getrespAtom(docId, nodeId) {
    return this.respAtom(docId, nodeId);
  }

  /**
   * Remove bullet state for a node (cleanup on node deletion)
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   */
  removeNodeBulletState(docId, nodeId) {
    if (this._bulletStates[docId]?.[nodeId]) {
      delete this._bulletStates[docId][nodeId];
      
      // Clean up empty doc entries
      if (Object.keys(this._bulletStates[docId]).length === 0) {
        delete this._bulletStates[docId];
      }
    }
  }

  /**
   * Register a bullet Y position request for a specific container
   * Creates the container entry if it doesn't exist
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @param {string} containerClassName - CSS class name (e.g., '.yamd-bullet-container')
   */
  registerBulletYPosReq(docId, nodeId, containerClassName) {
    const { base } = this._getOrCreateAtoms(docId, nodeId);
    const currentState = this._store.get(base);
    
    // Only create if doesn't exist
    if (!currentState[containerClassName]) {
      this._store.set(base, {
        ...currentState,
        [containerClassName]: {
          result: null,
          reqCounter: 0,
          respCounter: 0
        }
      });
    }
  }

  /**
   * Increment request counter to trigger bullet Y position recalculation
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @param {string} containerClassName - CSS class name
   */
  reqCalcBulletYPos(docId, nodeId, containerClassName) {
    const { base } = this._getOrCreateAtoms(docId, nodeId);
    const currentState = this._store.get(base);
    
    if (currentState[containerClassName]) {
      this._store.set(base, {
        ...currentState,
        [containerClassName]: {
          ...currentState[containerClassName],
          reqCounter: currentState[containerClassName].reqCounter + 1
        }
      });
    }
  }

  /**
   * Update bullet Y position result and increment response counter
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @param {string} containerClassName - CSS class name
   * @param {number} result - The calculated Y position
   */
  updateBulletYPosResult(docId, nodeId, containerClassName, result) {
    const { base } = this._getOrCreateAtoms(docId, nodeId);
    const currentState = this._store.get(base);
    
    if (currentState[containerClassName]) {
      this._store.set(base, {
        ...currentState,
        [containerClassName]: {
          ...currentState[containerClassName],
          result,
          respCounter: currentState[containerClassName].respCounter + 1
        }
      });
    }
  }

  /**
   * Get all bullet requests for a node (non-reactive, for responders)
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @returns {object} Object with container class names as keys
   */
  getAllBulletYPosReqs(docId, nodeId) {
    const { base } = this._getOrCreateAtoms(docId, nodeId);
    return this._store.get(base);
  }

  /**
   * Remove a specific bullet request
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @param {string} containerClassName - CSS class name
   */
  removeBulletYPosReq(docId, nodeId, containerClassName) {
    const { base } = this._getOrCreateAtoms(docId, nodeId);
    const currentState = this._store.get(base);
    
    if (currentState[containerClassName]) {
      const newState = { ...currentState };
      delete newState[containerClassName];
      this._store.set(base, newState);
    }
  }

  /**
   * Clear all bullet requests for a node
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   */
  clearNodeBulletReqs(docId, nodeId) {
    if (this._bulletStates[docId]?.[nodeId]) {
      const { base } = this._bulletStates[docId][nodeId];
      this._store.set(base, {});
    }
  }



  /**
   * Remove all bullet states for a document
   * @param {string} docId - Document ID
   */
  removeDocBulletStates(docId) {
    if (this._bulletStates[docId]) {
      delete this._bulletStates[docId];
    }
  }

  /**
   * Check if a node has any bullet requests
   * @param {string} docId - Document ID
   * @param {string} nodeId - Node ID
   * @returns {boolean} True if node has any bullet requests
   */
  hasAnyBulletReqs(docId, nodeId) {
    if (!this._bulletStates[docId]?.[nodeId]) {
      return false;
    }
    const { base } = this._bulletStates[docId][nodeId];
    const currentState = this._store.get(base);
    return Object.keys(currentState).length > 0;
  }
}

// Create singleton instance
export const docsBulletState = new DocsBulletState();
// Keep old name for backward compatibility during migration
export const nodeBulletState = docsBulletState;

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