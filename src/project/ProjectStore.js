import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import { cloneDeep } from 'lodash';
import axios from 'axios';
import { useServerStore } from '@/Server.js';
import {
  processLatexNodesToSvg,
  parseNode,
} from './ParseNode.js';

import {
  extractCitationsFromText,
  extractAllBibKeysFromNodes,
} from './BibProcess.js';

// Utility function to format people with place information
// Used by both CVProjectCard and Project components
export const formatPeopleWithPlace = (people, place) => {
  if (!people) return null;
  
  let peopleString = '';
  if (Array.isArray(people)) {
    peopleString = people.join(', ');
  } else {
    peopleString = people;
  }
  
  if (place) {
    let placeString = '';
    if (Array.isArray(place)) {
      placeString = place.join(' / ');
    } else {
      placeString = place;
    }
    return `${peopleString} @ ${placeString}`;
  }
  
  return peopleString;
};

// Utility function to format project metadata text based on project type
// Returns the appropriate text for display in project cards or project pages
// showPlace: boolean - whether to include place information (default: true)
export const formatProjectPeoplePlace = (project, showPlace = true) => {
  if (!project) return null;
  
  if (project.type === 'personal project') {
    return 'Personal Project';
  }
  
  if (project.people) {
    const place = showPlace ? project.place : null;
    const peopleText = formatPeopleWithPlace(project.people, place);
    return `Worked with: ${peopleText}`;
  }
  
  return null;
};

// project store for managing document rendering state
export const useProjectStore = create(
  immer((set, get) => ({
    // flattened project data by project path
    projects: {}, // { [projectPath]: { projectDataParsed: {...}, figureCounter: 0, citations: {...}, latexSvgs: {} } }
    
    // fetch bib data from server
    getMetadata: async (bibKey) => {
      try {
        const getFullUrl = useServerStore.getState().getFullUrl;
        const response = await axios.post(getFullUrl('/bib'), {
          task: 'get_metadata',
          name: bibKey,
          style: 'plain'
        });
        
        if (response.data.is_success) {
          console.log(`Success in get metadata: ${bibKey}`);
          return response.data.data;
        } else {
          console.log(response.data);
          console.log(`Failed to get metadata: ${bibKey}`);
          throw new Error(`Failed to get metadata: ${bibKey}`);
        }
      } catch (error) {
        console.error(`Error fetching metadata for ${bibKey}:`, error);
        throw error;
      }
    },
    
    getCitationInfo: async (bibKey) => {
      const state = get();
      try {
        const metadata = await state.getMetadata(bibKey);
        
        // parse author name - handle "LastName, FirstName" format
        const authorParts = metadata.author_list[0].split(',');
        let firstName, lastName;
        if (authorParts.length >= 2) {
          // "LastName, FirstName" format
          lastName = authorParts[0].trim();
          firstName = authorParts[1].trim();
        } else {
          // fallback to "FirstName LastName" format
          const nameParts = metadata.author_list[0].split(' ');
          firstName = nameParts[0];
          lastName = nameParts.slice(-1)[0];
        }
        
        return {
          firstName,
          lastName,
          year: metadata.year || '2024',
          title: metadata.title || `Title for ${bibKey}`,
          fullCitation: metadata.citation || `Full citation for ${bibKey}`,
          authorCount: metadata.author_list ? metadata.author_list.length : 1
        };
      } catch (error) {
        console.error(`Error processing citation ${bibKey}:`, error);
        // Return fallback data
        return {
          firstName: 'Author',
          lastName: 'LastName',
          year: '2024',
          title: `Title for ${bibKey}`,
          fullCitation: `Full citation for ${bibKey}`,
          authorCount: 1
        };
      }
    },
    
    fetchAllCitations: async (bibKeys) => {
      const citations = {};
      await Promise.all(
        Array.from(bibKeys).map(async key => {
          try {
            citations[key] = await get().getCitationInfo(key);
          } catch (error) {
            console.error(`Error processing key ${key}:`, error);
            citations[key] = {
              firstName: 'Author',
              lastName: 'LastName',
              year: '2024',
              title: `Title for ${key}`,
              fullCitation: `Full citation for ${key}`,
              authorCount: 1
            };
          }
        })
      );
      return citations;
    },
    
    // parse nested projectData into flattened projectDataParsed
    parseProjectData: (projectPath, projectData) => {
      // console.log('🔍 Raw project data for', projectPath, ':', projectData);
      const parsed = {};
      const rootId = nanoid();
      
      // Use imported parseNode function
      
      const _projectData = cloneDeep(projectData);
      // Parse the entire project data structure
      const parsedRootId = parseNode(parsed, _projectData);
      parsed.rootId = parsedRootId;
      
      set((state) => {
        if (!state.projects[projectPath]) {
          state.projects[projectPath] = {};
        }
        state.projects[projectPath].projectDataParsed = parsed;
        state.projects[projectPath].figureCounter = 0;
        state.projects[projectPath].videoCounter = 0;
        state.projects[projectPath].citations = {};
        state.projects[projectPath].latexSvgs = {};
      });
      
      return parsed;
    },
    // Process text content (LaTeX, citations, references)
    processProjectText: async (projectPath) => {
      const state = get();
      const project = state.projects[projectPath];
      if (!project || !project.projectDataParsed) return;
      
      const parsed = project.projectDataParsed;
      
      // Citation processing functions moved to ProjectStoreFunc.js

      // Step 1: Process LaTeX nodes to SVG (non-blocking)
      const triggerUpdate = () => {
        set((state) => {
          const currentProject = state.projects[projectPath];
          if (currentProject?.projectDataParsed) {
            // Touch the lastUpdated timestamp to trigger reactions
            currentProject.lastLatexUpdate = Date.now();
          }
        });
      };
      
      processLatexNodesToSvg(parsed, triggerUpdate).catch(error => {
        console.error('❌ LaTeX SVG processing failed:', error);
      });
      
      // Step 2: Extract all citation keys
      const bibKeys = extractAllBibKeysFromNodes(parsed);
      
      // Step 3: Fetch citation metadata from server
      const citations = await state.fetchAllCitations(bibKeys);
      
      // Step 4: Process figure numbers
      let figureCounter = 0;
      let videoCounter = 0;
      set((state) => {
        const currentProject = state.projects[projectPath];
        if (!currentProject?.projectDataParsed) return;
        
        Object.values(currentProject.projectDataParsed).forEach(node => {
          if (node.type === 'image' && !node.no_index && !node.fig_num) {
            figureCounter++;
            node.fig_num = figureCounter;
            // console.log('🔍 Added fig_num to image:', node.id, 'fig_num:', figureCounter);
          }
          if (node.type === 'video' && !node.no_index && !node.video_num) {
            videoCounter++;
            node.video_num = videoCounter;
            // console.log('🔍 Added video_num to video:', node.id, 'video_num:', videoCounter);
          }
        });
        console.log('🔍 Figure numbering complete, total figures:', figureCounter);
        console.log('🔍 Video numbering complete, total videos:', videoCounter);
      });
      
      // Helper functions for text processing
      const processInlineLatex = (str) => {
        // $...$ --> \(...\) (MathJax inline format)
        // process inline LaTeX math expressions, avoid $ref{} patterns
        return str.replace(/\$(?!ref\{)([^$]*)\$/g, (match, mathContent) => {
          if (mathContent.trim() !== '') {
            return `\\(${mathContent}\\)`;
          }
          return match;
        });
      };

      const processCitations = (str) => {
        return str.replace(/\\bib\{([\w\d-]+(?:,[\w\d-]+)*)\}/g, (match, keysString) => {
          const keys = keysString.split(',').map(key => key.replace('bib.', '').trim());
          const citationParts = keys.map(key => {
            if (citations[key]) {
              const citation = citations[key];
              const authorDisplay = citation.authorCount > 1 ? `${citation.lastName} et al.` : citation.lastName;
              return `<a href='#ref-${key}' class='citation-link' data-ref-target='ref-${key}' title='${key}'><span class='author'>${authorDisplay}</span>, <span class='year'>${citation.year}</span></a>`;
            }
            return key;
          });
          return `<span class="citation">(${citationParts.join('; ')})</span>`;
        });
      };

      const processReferences = (str, currentParsed) => {
        console.log('🔍 processReferences called with:', str);
        return str.replace(/\\ref\{([^}]*)\}\{([^}]*)\}/g, (match, linkText, linkId) => {
          console.log('🔍 Processing ref:', { match, linkText, linkId });
          
          // If linkText is provided and not empty, use it directly
          if (linkText && linkText.trim() !== '') {
            return `<a href='#${linkId}' class='reference-link' data-ref-target='${linkId}'>${linkText}</a>`;
          }
          
          // Auto-generate link text based on target for empty linkText
          const targetNode = Object.values(currentParsed).find(n => n.id === linkId);
          
          if (targetNode && targetNode.type === 'image' && targetNode.fig_num) {
            linkText = `Fig. ${targetNode.fig_num}`;
          } else {
            // Check if it's a dual image reference
            const imageNode = Object.values(currentParsed).find(n => {
              if (n.type !== 'image' || !n.fig_num) return false;
              // Check if linkId matches one of the dual image IDs
              if (Array.isArray(n.id)) {
                return n.id.includes(linkId);
              }
              // Check if it's in format nodeId-0 or nodeId-1
              return linkId === `${n.id}-0` || linkId === `${n.id}-1`;
            });
            
            if (imageNode && imageNode.fig_num) {
              // Determine if it's L or R
              let suffix = '';
              if (Array.isArray(imageNode.id)) {
                const index = imageNode.id.indexOf(linkId);
                suffix = index === 0 ? 'L' : index === 1 ? 'R' : '';
              } else if (linkId.endsWith('-0')) {
                suffix = 'L';
              } else if (linkId.endsWith('-1')) {
                suffix = 'R';
              }
              linkText = `Fig. ${imageNode.fig_num}${suffix}`;
            } else {
              // For equations or other elements, use the linkId as fallback
              linkText = linkId;
            }
          }
          
          return `<a href='#${linkId}' class='reference-link' data-ref-target='${linkId}'>${linkText}</a>`;
        });
      };

      // Main text processing function
      const processTextString = (str, currentParsed) => {
        let textProcessed = str;
        
        // Apply all text transformations in sequence
        textProcessed = processInlineLatex(textProcessed);
        textProcessed = processCitations(textProcessed);
        textProcessed = processReferences(textProcessed, currentParsed);
        
        return textProcessed;
      };

      // Step 5: Process text content within Zustand set context
      set((state) => {
        const currentProject = state.projects[projectPath];
        if (!currentProject?.projectDataParsed) return;
        
        // Get fresh reference to parsed data with updated fig_num values
        const freshParsed = currentProject.projectDataParsed;
        
        Object.values(freshParsed).forEach(node => {
          // Process text content (skip LaTeX nodes to preserve special characters)
          if (node.text_raw && node.type !== 'latex') {
            node.text_processed = processTextString(node.text_raw, freshParsed);
          }
          
          // Process title (like Vue.js implementation)
          if (node.title && typeof node.title === 'string') {
            node.title_processed = processTextString(node.title, freshParsed);
          }
          
          // Process caption (like Vue.js implementation)
          if (node.caption && typeof node.caption === 'string') {
            node.caption_processed = processTextString(node.caption, freshParsed);
          }
        });
      });
      
      // Step 6: Update project metadata
      set((state) => {
        state.projects[projectPath].citations = citations;
        state.projects[projectPath].figureCounter = figureCounter;
        state.projects[projectPath].videoCounter = videoCounter;
      });
      
      // Step 7: Add bibliography section (check for existing first)
      if (bibKeys.size > 0) {
        set((state) => {
          const currentProject = state.projects[projectPath];
          if (!currentProject?.projectDataParsed) return;
          
          const rootNode = currentProject.projectDataParsed[currentProject.projectDataParsed.rootId];
          if (!rootNode || !rootNode.children) return;
          
          // Check if bibliography already exists
          const existingBibSection = Object.values(currentProject.projectDataParsed).find(node => 
            node.type === 'section' && node.title === 'References'
          );
          
          if (existingBibSection) {
            console.log('📚 Bibliography section already exists, skipping creation');
            return;
          }
          
          console.log('📚 Creating new bibliography section');
          const bibSectionId = nanoid();
          const bibListId = nanoid();
          
          // Add bibliography section
          currentProject.projectDataParsed[bibSectionId] = {
            id: bibSectionId,
            type: 'section',
            title: 'References',
            selfClass: 'section-title',
            children: [bibListId]
          };
          
          // Add bibliography list  
          currentProject.projectDataParsed[bibListId] = {
            id: bibListId,
            type: 'ordered-list',
            parentId: bibSectionId,
            children: []
          };
          
          // Create individual reference nodes
          Array.from(bibKeys).forEach(key => {
            const refNodeId = nanoid();
            currentProject.projectDataParsed[refNodeId] = {
              id: refNodeId,
              type: 'text',
              parentId: bibListId,
              text_raw: `<div id="ref-${key}" class="reference tooltip-container" title="${key}">${citations[key].fullCitation.trim()}<div class="selectable-tooltip">${key}<div class="selectable-tooltip-outer"></div></div></div>`,
              text_processed: `<div id="ref-${key}" class="reference tooltip-container" title="${key}">${citations[key].fullCitation.trim()}<div class="selectable-tooltip">${key}<div class="selectable-tooltip-outer"></div></div></div>`
            };
            currentProject.projectDataParsed[bibListId].children.push(refNodeId);
          });
          
          // Add bibliography to root
          rootNode.children.push(bibSectionId);
        });
      }
    },
    
    // Get parsed project data
    getProjectData: (projectPath) => {
      const state = get();
      return state.projects[projectPath] || null;
    },
    
    // Get a specific node by ID
    getNode: (projectPath, nodeId) => {
      const state = get();
      const project = state.projects[projectPath];
      return project?.projectDataParsed?.[nodeId] || null;
    },
    
    // check if project is processed
    isProjectProcessed: (projectPath) => {
      const state = get();
      return Boolean(state.projects[projectPath]?.projectDataParsed);
    },
    
    // clear project data
    clearProject: (projectPath) => {
      set((state) => {
        delete state.projects[projectPath];
      });
    },
    
    // process a project (parse + text processing)
    processProjectData: async (projectPath, projectData) => {
      const state = get();
      // clear existing project data to prevent accumulation of duplicates
      if (state.projects[projectPath]) {
        console.log('🗑️ Clearing existing project data for reprocessing:', projectPath);
        state.clearProject(projectPath);
      }
      // parse the project data
      state.parseProjectData(projectPath, projectData);
      // process text content
      await state.processProjectText(projectPath);
      
      return state.projects[projectPath];
    }
  }))
);
