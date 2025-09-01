import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import { cloneDeep } from 'lodash';

import { parseNodeStyle } from '../markdown-yaml/ParseUtils.js';

// node Parse Store for handling JSON data parsing similar to ProjectStore.js
export const useNodeParseStore = create(
  immer((set, get) => ({
    // parsed data storage by data ID
    dataParsed: {}, // { [dataId]: { parsed: {...}, rootId: string } }
    // parse nested JSON data into flattened structure
    parseNodeData: (dataId, jsonData) => {
      console.log('🔍 Raw node data for', dataId, ':', jsonData);
      const parsed = {};
      const rootId = nanoid();
      
      const parseNode = (node, parentId = null) => {
        const nodeId = nanoid();
        console.log('🔍 parseNode called with:', { node, parentId, nodeId });
        
        if (Array.isArray(node)) {
          // Handle arrays
          parsed[nodeId] = {
            id: nodeId,
            type: 'array',
            children: [],
            parentId
          };
          
          node.forEach(item => {
            const childId = parseNode(item, nodeId);
            parsed[nodeId].children.push(childId);
          });
          
        } else if (node && typeof node === 'object') {
          // Handle objects - this is where most of the Node.jsx logic will be moved
          
          // Check if it's a simple key-value object that needs to be processed
          const entries = Object.entries(node);
          if (entries.length === 1) {
            // Single key-value pair - parse the key for style annotations
            const [key, value] = entries[0];
            const { name, selfStyle, childStyle, childClass, selfClass } = parseNodeStyle(key);
            
            parsed[nodeId] = {
              id: nodeId,
              type: 'node',
              parentId,
              selfContent: name,
              selfStyle,
              childStyle,
              childClass,
              selfClass,
              selfContentOriginal: key,
              children: []
            };
            
            // Process the value based on its type
            if (Array.isArray(value)) {
              // Value is an array of items
              value.forEach(item => {
                const childId = parseNode(item, nodeId);
                parsed[nodeId].children.push(childId);
              });
            } else if (typeof value === 'string') {
              // Value is a string - create a text node
              const textNodeId = nanoid();
              const { name: textName, selfClass: textSelfClass } = parseNodeStyle(value);
              parsed[textNodeId] = {
                id: textNodeId,
                type: 'text',
                parentId: nodeId,
                childContent: textName,
                selfClass: textSelfClass,
                children: []
              };
              parsed[nodeId].children.push(textNodeId);
            } else if (value && typeof value === 'object') {
              // Value is an object - recursively parse it
              const childId = parseNode(value, nodeId);
              parsed[nodeId].children.push(childId);
            }
            
          } else {
            // Multiple key-value pairs - treat as a container
            parsed[nodeId] = {
              id: nodeId,
              type: 'container',
              parentId,
              children: []
            };
            
            entries.forEach(([key, value]) => {
              // Create a node for each key-value pair
              const pairNodeId = parseNode({ [key]: value }, nodeId);
              parsed[nodeId].children.push(pairNodeId);
            });
          }
          
        } else {
          // Handle primitive values (strings, numbers, etc.)
          const { name: textName, selfClass: textSelfClass } = parseNodeStyle(String(node));
          parsed[nodeId] = {
            id: nodeId,
            type: 'text',
            parentId,
            childContent: textName,
            selfClass: textSelfClass,
            children: []
          };
        }
        
        console.log('🔍 parseNode returning nodeId:', nodeId, 'parsed[nodeId]:', parsed[nodeId]);
        return nodeId;
      };
      
      const _jsonData = cloneDeep(jsonData);
      // Parse the entire JSON data structure
      const parsedRootId = parseNode(_jsonData);
      parsed.rootId = parsedRootId;
      
      set((state) => {
        state.dataParsed[dataId] = {
          parsed,
          rootId: parsedRootId
        };
      });
      
      console.log('🔍 Final parsed data:', parsed);
      return parsed;
    },
    
    // Get parsed data by ID
    getParsedData: (dataId) => {
      const state = get();
      return state.dataParsed[dataId] || null;
    },
    
    // Get a specific node by data ID and node ID
    getNode: (dataId, nodeId) => {
      const state = get();
      const dataParsed = state.dataParsed[dataId];
      return dataParsed?.parsed?.[nodeId] || null;
    },
    
    clearParsedData: (dataId) => {
      set((state) => {
        delete state.dataParsed[dataId];
      });
    },
    
    clearAllParsedData: () => {
      set((state) => {
        state.dataParsed = {};
      });
    }
  }))
);

export default useNodeParseStore;
