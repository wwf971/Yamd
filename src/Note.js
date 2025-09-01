import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import axios from 'axios';
import lodash from 'lodash';

// Utility function to parse key with optional style attributes
// Examples: 
//   "timeline" -> { baseKey: "timeline", attributes: {} }
//   "timeline[self=panel,panelDefault=collapse]" -> { baseKey: "timeline", attributes: { self: "panel", panelDefault: "collapse" } }
export const _parseKeyWithAttributes = (key) => {
  if (typeof key !== 'string') {
    return { baseKey: key, attributes: {} };
  }

  const styleMatch = key.match(/^(.*?)\[(.+?)\]$/);
  if (styleMatch) {
    const baseKey = styleMatch[1];
    const attributeString = styleMatch[2];
    
    // Parse comma-separated attributes
    const attributes = {};
    attributeString.split(',').forEach(attr => {
      const [attrKey, value] = attr.split('=').map(s => s.trim());
      if (attrKey && value) {
        attributes[attrKey] = value;
      }
    });
    
    return { baseKey, attributes };
  }
  
  return { baseKey: key, attributes: {} };
};

// Find key in object with exact or prefix matching
// Returns { key, baseKey, attributes, value } or null if not found
// exactMatch: true = "timeline" matches only "timeline" or "timeline[...]", not "timeline_extra"
// exactMatch: false = "timeline" matches "timeline", "timeline[...]", "timeline_extra", etc.
export const findKey = (obj, searchKey, exactMatch = true) => {
  if (!obj || typeof obj !== 'object') {
    return null;
  }

  console.warn("findKey(): searchKey=" + searchKey + ", exactMatch=" + exactMatch);
  
  for (const key of Object.keys(obj)) {
    const parsed = _parseKeyWithAttributes(key);
    
    const isMatch = exactMatch 
      ? parsed.baseKey === searchKey
      : parsed.baseKey.startsWith(searchKey);
    
    if (isMatch) {
      return {
        key,
        baseKey: parsed.baseKey,
        attributes: parsed.attributes,
        value: obj[key]
      };
    }
  }
  
  return null;
};

// Find all keys in object with exact or prefix matching
// Returns array of { key, baseKey, attributes, value } objects
export const findKeys = (obj, searchKey, exactMatch = true) => {
  if (!obj || typeof obj !== 'object') {
    return [];
  }
  
  return Object.keys(obj)
    .map(key => {
      const parsed = _parseKeyWithAttributes(key);
      return { 
        key, 
        baseKey: parsed.baseKey, 
        attributes: parsed.attributes, 
        value: obj[key] 
      };
    })
    .filter(({ baseKey }) => {
      return exactMatch 
        ? baseKey === searchKey
        : baseKey.startsWith(searchKey);
    });
};

// Compose a key with attributes, merging/overwriting existing attributes
// Examples:
//   composeKeyWithAttributes("Progress[child=timeline]", { self: "panel" })
//     -> "Progress[child=timeline,self=panel]"
//   composeKeyWithAttributes("Progress", { child: "timeline", self: "panel" })
//     -> "Progress[child=timeline,self=panel]"
//   composeKeyWithAttributes("Progress[child=ul]", { child: "timeline" })
//     -> "Progress[child=timeline]" (overwrites existing child attribute)
export const composeKeyWithAttributes = (keyWithPossibleAttributes, newAttributes = {}) => {
  const parsed = _parseKeyWithAttributes(keyWithPossibleAttributes);
  const mergedAttributes = { ...parsed.attributes, ...newAttributes };
  
  if (Object.keys(mergedAttributes).length === 0) {
    return parsed.baseKey;
  }
  
  const attributeString = Object.entries(mergedAttributes)
    .map(([key, value]) => `${key}=${value}`)
    .join(',');
    
  return `${parsed.baseKey}[${attributeString}]`;
};

// Configure axios to include credentials (cookies) in all requests
axios.defaults.withCredentials = true;

// Development configuration: Add interceptor to handle HTTPS requirement
// Note: Your Flask server has SESSION_COOKIE_SECURE=True which requires HTTPS
// For development with HTTP, you'll need to either:
// 1. Change SESSION_COOKIE_SECURE=False in server_flask/login.py, or
// 2. Use HTTPS for your dev server
console.warn("⚠️  Flask server requires HTTPS cookies (SESSION_COOKIE_SECURE=True)");

// Zustand store for managing markdown notes
export const useNoteStore = create(immer((set, get) => ({
  // State structure:
  // notes: { [noteId]: note_data_from_server }     // Original server data
  // notesEdited: { [noteId]: modified_note_data }  // Local edits
  notes: {},
  notesEdited: {},
  serverUrl: 'https://wwf194.myqnapcloud.com:10001',

  // Create a new note
  createNote: async () => {
    try {
      const post_dict = {
        task: 'create_note',
        note_dict: {
          type: 'markdown',
          content: {
            items: {},
            item_order: [],
          }
        }
      };
      
      const state = get();
      const response = await axios.post(state.serverUrl + '/note/', post_dict);
      
      if (!response.data.is_success) {
        console.error("createNote(): error:" + response.data.message);
        console.trace();

        return {is_success: false, message: response.data.message};
      }

      const noteData = response.data.data; // note_dict from server
      const noteId = noteData.id; // Server-issued ID
      
      // Create initial content structure if not present
      if (!noteData.content) {
        noteData.content = {
          items: {},
          item_order: [],
        };
      }
      set((state) => {
        // Store original server data
        state.notes[noteId] = noteData;
        // Create editable copy
        state.notesEdited[noteId] = lodash.cloneDeep(noteData);
      });
      
      return {is_success: true, data: noteId};
    } catch (error) {
      console.error("createNote(): " + error.message);
      return {is_success: false, message: error.message};
    }
  },

  // Save note to server
  saveNote: async (noteId) => {
    try {
      const state = get();
      const noteEdited = state.notesEdited[noteId];
      
      if (!noteEdited) {
        console.error("saveNote(): Note not found: " + noteId);
        return {is_success: false, message: `Note ${noteId} not found`};
      }

      const post_dict = {
        task: 'update_note',
        note_id: noteId,
        update_dict: {
          content: noteEdited.content
        }
      };

      const response = await axios.post(state.serverUrl + '/note/', post_dict);
      
      if (!response.data.is_success) {
        console.error("saveNote(): failed to save note(id=" + noteId + "): " + response.data.message);
        return {is_success: false, message: response.data.message};
      }

      // Server saved successfully, update local notes
      set((state) => {
        state.notes[noteId] = lodash.cloneDeep(state.notesEdited[noteId]);
      });

      return {is_success: true};
      
    } catch (error) {
      console.error("saveNote(): failed to save note(id=" + noteId + "): " + error.message);
      return {is_success: false, message: error.message};
    }
  },

  // Load note from server
  loadNote: async (noteId) => {
    try {
      const state = get();
      const response = await axios.get(`${state.serverUrl}/note/${noteId}`);
      
      if (!response.data.is_success) {
        console.error("loadNote(): " + response.data.message);
        return {is_success: false, message: response.data.message};
      }

      const noteData = response.data.data;
      
      set((state) => {
        state.notes[noteId] = noteData;
        state.notesEdited[noteId] = lodash.cloneDeep(noteData);
      });

      return {is_success: true, data: noteData};
      
    } catch (error) {
      console.error("loadNote(): " + error.message);
      return {is_success: false, message: error.message};
    }
  },

  // Get a note by ID (returns edited version)
  getNote: (noteId) => {
    const state = get();
    return state.notesEdited[noteId] || null;
  },

  // Add a new item to a note
  addItem: (noteId, content = '', indent = 0, afterItemId = null) => {
    const itemId = nanoid();
    const state = get();
    const noteEdited = state.notesEdited[noteId];
    if (!noteEdited) return null;

    const newItem = {
      id: itemId,
      content,
      indent
    };

    // Determine where to insert in the order array
    let insertIndex = noteEdited.content.item_order.length; // Default: append at end
    if (afterItemId) {
      const afterIndex = noteEdited.content.item_order.indexOf(afterItemId);
      if (afterIndex !== -1) {
        insertIndex = afterIndex + 1;
      }
    }

    set((state) => {
      const noteEdited = state.notesEdited[noteId];
      noteEdited.content.items[itemId] = newItem;
      noteEdited.content.item_order.splice(insertIndex, 0, itemId);
    });

    return itemId;
  },

  // Update an item's content
  updateItemContent: (noteId, itemId, content) => {
    const state = get();
    const noteEdited = state.notesEdited[noteId];
    if (!noteEdited || !noteEdited.content.items[itemId]) return;

    set((state) => {
      const noteEdited = state.notesEdited[noteId];
      const item = noteEdited.content.items[itemId];
      item.content = content;
    });
  },

  // Update an item's indent level
  updateItemIndent: (noteId, itemId, indent) => {
    const state = get();
    const noteEdited = state.notesEdited[noteId];
    if (!noteEdited || !noteEdited.content.items[itemId]) return;

    set((state) => {
      const noteEdited = state.notesEdited[noteId];
      const item = noteEdited.content.items[itemId];
      item.indent = Math.max(0, indent); // Ensure indent is never negative
    });
  },

  // Delete an item
  deleteItem: (noteId, itemId) => {
    const state = get();
    const noteEdited = state.notesEdited[noteId];
    if (!noteEdited || !noteEdited.content.items[itemId]) return;

    set((state) => {
      const noteEdited = state.notesEdited[noteId];
      delete noteEdited.content.items[itemId];
      noteEdited.content.item_order = noteEdited.content.item_order.filter(id => id !== itemId);
    });
  },

  // Reorder items
  reorderItems: (noteId, newOrder) => {
    const state = get();
    const noteEdited = state.notesEdited[noteId];
    if (!noteEdited) return;

    // Validate that newOrder contains all current item IDs
    const currentItemIds = new Set(noteEdited.content.item_order);
    const newItemIds = new Set(newOrder);
    if (currentItemIds.size !== newItemIds.size || 
        !Array.from(currentItemIds).every(id => newItemIds.has(id))) {
      console.error('Invalid reorder: order array must contain exactly the same items');
      return;
    }

    set((state) => {
      const noteEdited = state.notesEdited[noteId];
      noteEdited.content.item_order = newOrder;
    });
  },

  // Delete a note
  deleteNote: (noteId) => {
    set((state) => {
      delete state.notes[noteId];
      delete state.notesEdited[noteId];
    });
  },

  // Get all notes (for listing)
  getAllNotes: () => {
    const state = get();
    return Object.values(state.notesEdited);
  },

  // Helper: Get ordered items for a note
  getOrderedItems: (noteId) => {
    const state = get();
    const noteEdited = state.notesEdited[noteId];
    if (!noteEdited || !noteEdited.content) return [];

    return noteEdited.content.item_order.map(itemId => noteEdited.content.items[itemId]).filter(Boolean);
  },

  // Search notes by ID
  searchNoteById: async (queryStr) => {
    try {
      const state = get();
      const response = await axios.post(state.serverUrl + '/note/', {
        task: 'search_note_by_id',
        query_str: queryStr
      }, {
        withCredentials: true
      });

      if (!response.data.is_success) {
        console.error("searchNoteById(): " + response.data.message);
        return {is_success: false, message: response.data.message};
      }

      return {
        is_success: true,
        data: response.data.data,
        query_str: response.data.query_str  // For race condition handling
      };

    } catch (error) {
      console.error("searchNoteById(): " + error.message);
      return {is_success: false, message: error.message};
    }
  }
})));

// Export helper hook for getting a specific note
export const useNote = (noteId) => {
  const note = useNoteStore((state) => state.notesEdited[noteId]);
  const getOrderedItems = useNoteStore((state) => state.getOrderedItems);
  
  return {
    note,
    items: note ? getOrderedItems(noteId) : []
  };
};
