import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { findKey, composeKeyWithAttributes } from '@/Note.js';

// Extract keyword node data from project metadata
// This function finds the keyword entry and composes it with appropriate styling attributes
export const extractKeywordNodeData = (project, selfClass=null, childClass=null) => {
  // Find the keyword entry  
  const keywordResult = findKey(
    project, "keyword", false // exactMatch
  );
  
  if (!keywordResult) {
    return null;
  }
  
  // Compose the "Key Word:" key with appropriate attributes
  // Ensure selfClass has priority over keywordResult.attributes
  const attributes = {};
  if (keywordResult.attributes) {
    Object.assign(attributes, keywordResult.attributes);
  }
  // Override with explicit attributes - these take priority
  attributes.self = "key";
  if(selfClass){
    attributes.selfClass = selfClass;
  }else{
    attributes.selfClass = "node-text-s";
  }
  if(childClass){
    attributes.childClass = childClass;
  }else{
    attributes.childClass = "cv-project-keyword";
  }
  
  const keyWordKey = composeKeyWithAttributes("Key Word:", attributes);
  
  return [{
    [keyWordKey]: keywordResult.value
  }];
};

// Projects metadata store for managing parsed project data from home/projects.yaml
export const useProjectsMetadataStore = create(
  immer((set, get) => ({
    // Processed projects metadata array
    projectsMetadata: null,
    
    // Loading state
    isLoading: false,
    
    // Error state
    error: null,
    
    // Set projects metadata
    setProjectsMetadata: (projectsArray) => {
      set((state) => {
        state.projectsMetadata = projectsArray;
        state.isLoading = false;
        state.error = null;
      });
    },
    
    // Set loading state
    setLoading: (loading) => {
      set((state) => {
        state.isLoading = loading;
        if (loading) {
          state.error = null;
        }
      });
    },
    
    // Set error state
    setError: (error) => {
      set((state) => {
        state.error = error;
        state.isLoading = false;
      });
    },
    
    // Clear projects metadata
    clearProjectsMetadata: () => {
      set((state) => {
        state.projectsMetadata = null;
        state.isLoading = false;
        state.error = null;
      });
    },
    
    // Get project by key (use this as a selector function)
    getProjectByKey: (key) => (state) => {
      if (!state.projectsMetadata) return null;
      return state.projectsMetadata.find(project => project.key === key) || null;
    },
    
    // Process projects asset data and store as metadata
    receiveProjectsAsset: (projectsAsset) => {
      const state = get();
      
      if (!projectsAsset?.content?.type === 'json' || !projectsAsset.content.data) {
        state.setError('Invalid projects asset data');
        return;
      }
      
      try {
        state.setLoading(true);
        
        // Handle new list structure where each item is an object with a single key-value pair
        const projectsList = projectsAsset.content.data;
        const projectsArray = projectsList.map(projectItem => {
          // Each item is like { "mu": { cover: "...", title: "...", ... } }
          const [key, project] = Object.entries(projectItem)[0];
          return {
            key,
            ...(project && typeof project === 'object' ? project : {})
          };
        });
        
        state.setProjectsMetadata(projectsArray);
        console.log('✅ Projects metadata processed and stored:', projectsArray);
        
      } catch (error) {
        console.error('❌ Error processing projects asset:', error);
        state.setError(error.message);
      }
    }
  }))
);
