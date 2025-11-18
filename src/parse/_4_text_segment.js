/**
 * Text segment processing for Yamd system (LaTeX, references, plain text)
 * Handles inline LaTeX, asset references, and plain text segments
 * This is step 4 in the processing pipeline
 */

import { LaTeX2Svg, LaTeX2Chtml } from '../mathjax/MathJaxConvert.js';

/**
 * Parse text string into segments of plain text, inline LaTeX, references, and bibliography citations
 * @param {string} text - Input text that may contain inline LaTeX, references, and bibliography citations
 * @param {object} assets - Assets dictionary to register LaTeX segments
 * @param {object} refs - References dictionary to register reference segments
 * @param {object} bibs - Bibliography dictionary to register bibliography entries
 * @param {object} bibsLookup - Bibliography lookup dictionary (bibKey -> bibId mapping)
 * @param {string} sourceNodeId - ID of the node containing this text
 * @returns {Array} - Array of segments: [{type: 'text'|'latex_inline'|'ref-asset'|'ref-bib', textRaw: string, assetId?: string, refId?: string, bibId?: string}]
 */
export function parseTextSegments(text, assets, refs, bibs, bibsLookup, sourceNodeId = null) {
  if (!text || typeof text !== 'string') {
    return [{ type: 'text', textRaw: text || '' }];
  }

  // Ensure objects exist (defensive programming)
  if (!assets) assets = {};
  if (!refs) refs = {};
  if (!bibs) bibs = {};
  if (!bibsLookup) bibsLookup = {};

  const segments = [];
  let currentPos = 0;
  let assetCounter = Object.keys(assets).length;
  let refCounter = Object.keys(refs).length;
  let bibCounter = Object.keys(bibs).length;
  
  // Combined pattern to match LaTeX, asset references, and bibliography citations
  // 1. LaTeX: $...$ but NOT $ref{...} (negative lookahead)
  // 2. Asset References: \ref{linkText}{linkId}
  // 3. Bibliography Citations: \bib{key1,key2,...}
  const combinedPattern = /(\$(?!ref\{)([^$]*)\$)|(\\ref\{([^}]*)\}\{([^}]*)\})|(\\bib\{([\w\d-]+(?:,[\w\d-]+)*)\})/g;
  
  let match;
  while ((match = combinedPattern.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = match.index + match[0].length;
    
    // Add any plain text before this match
    if (matchStart > currentPos) {
      const plainText = text.slice(currentPos, matchStart);
      if (plainText) {
        segments.push({ type: 'text', textRaw: plainText });
      }
    }
    
    if (match[1]) { // This is a LaTeX match: $...$
      const mathContent = match[2];
      
      // Add the LaTeX segment (only if content is not empty after trimming)
      if (mathContent.trim() !== '') {
        const assetId = `latex_${String(++assetCounter).padStart(3, '0')}`;
        
        // Register in assets with inline type
        assets[assetId] = {
          id: assetId,
          type: 'latex-inline',
          latexContent: mathContent,
          htmlContent: null, // Will be filled by processAllTextSegments
          original: match[0]
        };
        
        segments.push({ 
          type: 'latex_inline',
          textRaw: mathContent,
          assetId: assetId
        });
      } else {
        // Empty LaTeX content - treat as plain text
        segments.push({ type: 'text', textRaw: match[0] });
      }
    } else if (match[3]) {
      // This is a reference match: \ref{linkText}{linkId}
      const linkText = match[4];
      const linkId = match[5];
      
      if (linkId && linkId.trim()) {
        const refId = `ref_${String(++refCounter).padStart(3, '0')}`;
        
        // Register in refs dictionary
        refs[refId] = {
          id: refId,
          sourceNodeId: sourceNodeId,
          targetId: linkId.trim(),
          linkText: linkText || '', // Can be empty for auto-generation
          segmentIndex: segments.length // Track position in segments
        };
        
        segments.push({
          type: 'ref-asset',
          textRaw: match[0], // Store original ref syntax
          refId: refId,
          targetId: linkId.trim(),
          linkText: linkText || ''
        });
      } else {
        // Invalid reference - treat as plain text
        segments.push({ type: 'text', textRaw: match[0] });
      }
    } else if (match[6]) {
      // This is a bibliography citation match: \bib{key1,key2,...}
      const bibKeysString = match[7];
      
      if (bibKeysString && bibKeysString.trim()) {
        // Parse multiple keys (comma-separated)
        const bibKeys = bibKeysString.split(',').map(key => key.replace('bib.', '').trim()).filter(Boolean);
        
        if (bibKeys.length > 0) {
          // Process each bibliography key
          const bibIds = bibKeys.map(bibKey => {
            // Check if this bib key already exists in lookup
            let bibId = bibsLookup[bibKey];
            
            if (!bibId) {
              // Create new bibliography entry
              bibId = `bib_${String(++bibCounter).padStart(3, '0')}`;
              
              // Register in bib lookup
              bibsLookup[bibKey] = bibId;
              
                          // Register in bibs dictionary
            bibs[bibId] = {
              id: bibId,
              bibKey: bibKey,
              title: `Title for ${bibKey}`, // Placeholder - will be fetched later
              fullCitation: `Full citation for ${bibKey}`, // Placeholder
              referencedBy: [] // Track which nodes reference this bib
            };
            
            }
            
            // Add this source node to the referencedBy list
            if (sourceNodeId && !bibs[bibId].referencedBy.includes(sourceNodeId)) {
              bibs[bibId].referencedBy.push(sourceNodeId);
            }
            
            return bibId;
          });
          
          // Create bibliography reference segment
          segments.push({
            type: 'ref-bib',
            textRaw: match[0], // Store original \bib{...} syntax
            bibKeys: bibKeys, // Array of bibliography keys
            bibIds: bibIds, // Array of corresponding bibliography IDs
              // this id is internally maintained
            displayText: bibKeys.join(', ') // Default display text
          });
        } else {
          // No valid keys - treat as plain text
          segments.push({ type: 'text', textRaw: match[0] });
        }
      } else {
        // Empty bibliography reference - treat as plain text
        segments.push({ type: 'text', textRaw: match[0] });
      }
    }
    
    currentPos = matchEnd;
  }
  
  // Add any remaining plain text after the last match
  if (currentPos < text.length) {
    const remainingText = text.slice(currentPos);
    if (remainingText) {
      segments.push({ type: 'text', textRaw: remainingText });
    }
  }
  
  // If no segments were created, return the original text as a single text segment
  if (segments.length === 0) {
    return [{ type: 'text', textRaw: text }];
  }
  
  return segments;
}

/**
 * Backward-compatible function for LaTeX-only parsing
 * @param {string} text - Input text that may contain inline LaTeX
 * @param {object} assets - Assets dictionary to register LaTeX segments
 * @returns {Array} - Array of segments
 */
export function parseInlineLatex(text, assets = {}) {
  // Create local objects for this function (not shared with main pipeline)
  const localRefs = {};
  const localBibs = {};
  const localBibsLookup = {};
  return parseTextSegments(text, assets, localRefs, localBibs, localBibsLookup, null);
}

/**
 * Check if text contains inline LaTeX patterns
 * @param {string} text - Text to check
 * @returns {boolean} - True if LaTeX patterns are found
 */
export function hasInlineLatex(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }
  
  // Same pattern as parseInlineLatex but just for detection
  const latexPattern = /\$(?!ref\{)([^$]*)\$/g;
  const match = latexPattern.exec(text);
  
  // Only return true if we find a match with non-empty content
  return match !== null && match[1].trim() !== '';
}

/**
 * Check if text contains reference patterns
 * @param {string} text - Text to check
 * @returns {boolean} - True if reference patterns are found
 */
export function hasReferences(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }
  
  const refPattern = /\\ref\{([^}]*)\}\{([^}]*)\}/;
  return refPattern.test(text);
}

/**
 * Check if text contains bibliography citation patterns
 * @param {string} text - Text to check
 * @returns {boolean} - True if bibliography citation patterns are found
 */
export function hasBibCitations(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }
  
  const bibPattern = /\\bib\{([\w\d-]+(?:,[\w\d-]+)*)\}/;
  return bibPattern.test(text);
}

/**
 * Convert LaTeX segments back to text (for fallback scenarios)
 * @param {Array} segments - Array of text/latex segments
 * @returns {string} - Reconstructed text
 */
export function segmentsToText(segments) {
  if (!Array.isArray(segments)) {
    return '';
  }
  
  return segments.map(segment => {
    if (segment.type === 'latex_inline') {
      // Reconstruct original $...$ format
      return `$${segment.textRaw}$`;
    }
    return segment.textRaw || '';
  }).join('');
}

/**
 * Convert LaTeX segments to MathJax format (like ProjectStore does)
 * @param {Array} segments - Array of text/latex segments  
 * @returns {string} - Text with LaTeX converted to \(...\) format
 */
export function segmentsToMathJax(segments) {
  if (!Array.isArray(segments)) {
    return '';
  }
  
  return segments.map(segment => {
    if (segment.type === 'latex_inline') {
      // Convert to MathJax inline format: $content$ -> \(content\)
      return `\\(${segment.textRaw}\\)`;
    }
    return segment.textRaw || '';
  }).join('');
}

/**
 * Register LaTeX block node in assets
 * @param {object} nodeData - LaTeX block node data
 * @param {object} assets - Assets dictionary
 * @param {object} allNodes - All flattened nodes for child lookup
 * @returns {object} - Enhanced node data
 */
export function registerLatexBlock(nodeData, assets = {}, allNodes = {}) {
  if (!nodeData || nodeData.type !== 'latex') {
    // Debug: Log nodes that are not LaTeX type
    if (nodeData && nodeData.textRaw && nodeData.textRaw.includes('latex')) {
      console.warn('🔍 Node with "latex" in textRaw but not type="latex":', nodeData);
    }
    return nodeData;
  }
  
  console.log('🔧 Processing LaTeX block:', nodeData);
  
  let assetCounter = Object.keys(assets).filter(id => id.startsWith('latex_')).length;
  const assetId = `latex_${String(++assetCounter).padStart(3, '0')}`;
  
  // Count existing latex-block assets for indexOfSameType (only count indexed blocks)
  const existingBlocks = Object.values(assets).filter(asset => 
    asset.type === 'latex-block' && asset.indexOfSameType !== null
  );
  const shouldIndex = !nodeData.attr?.no_index;
  const indexOfSameType = shouldIndex ? existingBlocks.length + 1 : null;
  
  // Use textRaw for LaTeX content (as per user requirement)
  const latexContent = nodeData.textRaw || '';
  const caption = nodeData.caption;
  const height = nodeData.attr?.height || nodeData.height; // Check attr first, then node level
  const captionTitle = nodeData.attr?.caption_title || nodeData.attr?.['caption-title']; // Support both formats
  
  // Register LaTeX block in assets
  assets[assetId] = {
    id: assetId,
    type: 'latex-block',
    latexContent: latexContent,
    htmlContent: null, // Will be filled by processAllTextSegments
    caption: caption,
    height: height,
    indexOfSameType,
    captionTitle, // Store custom caption title
    no_index: !shouldIndex // Explicitly store no_index flag in asset
  };
  
  // Return enhanced node data with asset reference
  return {
    ...nodeData,
    assetId
  };
}

/**
 * Register image block as asset
 * @param {object} nodeData - Node data for image
 * @param {object} assets - Assets dictionary
 * @param {object} allNodes - All nodes dictionary
 * @returns {object} - Enhanced node data with assetId
 */
export function registerImageBlock(nodeData, assets = {}, allNodes = {}) {
  if (!nodeData || nodeData.type !== 'image') {
    return nodeData;
  }
  
  console.log('🔧 Processing Image block:', nodeData);
  
  let assetCounter = Object.keys(assets).filter(id => id.startsWith('image_')).length;
  const assetId = `image_${String(++assetCounter).padStart(3, '0')}`;
  
  // Register asset during processAllTextSegments - indexing will be calculated later in scanAssets()
  const shouldIndex = !nodeData.attr?.no_index;
  
  // Store basic subindex from node attributes (if any)
  const subindex = nodeData.attr?.subindex || null;
  
  // Initially set to null - will be calculated in scanAssets()
  const indexOfSameType = null;
  const indexStr = null;
  
  // Register image block in assets
  assets[assetId] = {
    id: assetId,
    type: 'image-block',
    src: nodeData.textRaw || '',
    caption: nodeData.caption,
    alt: nodeData.attr?.alt,
    width: nodeData.attr?.width,
    height: nodeData.attr?.height,
    indexOfSameType,
    subindex,
    indexStr,
    no_index: !shouldIndex,
    nodeId: nodeData.id // Store node ID for later reference during scanAssets
  };
  
  // Return enhanced node data with asset reference
  return {
    ...nodeData,
    assetId
  };
}

/**
 * Register video block as asset
 * @param {object} nodeData - Node data for video
 * @param {object} assets - Assets dictionary
 * @param {object} allNodes - All nodes dictionary
 * @returns {object} - Enhanced node data with assetId
 */
export function registerVideoBlock(nodeData, assets = {}, allNodes = {}) {
  if (!nodeData || nodeData.type !== 'video') {
    return nodeData;
  }
  
  console.log('🔧 Processing Video block:', nodeData);
  
  let assetCounter = Object.keys(assets).filter(id => id.startsWith('video_')).length;
  const assetId = `video_${String(++assetCounter).padStart(3, '0')}`;
  
  // Count existing video assets for indexOfSameType (only count indexed blocks)
  const existingVideos = Object.values(assets).filter(asset => 
    asset.type === 'video-block' && asset.indexOfSameType !== null
  );
  const shouldIndex = !nodeData.attr?.no_index;
  const indexOfSameType = shouldIndex ? existingVideos.length + 1 : null;
  
  // Register video block in assets
  assets[assetId] = {
    id: assetId,
    type: 'video-block',
    src: nodeData.textRaw || '',
    caption: nodeData.caption,
    width: nodeData.attr?.width,
    height: nodeData.attr?.height,
    controls: nodeData.attr?.controls,
    autoplay: nodeData.attr?.autoplay,
    loop: nodeData.attr?.loop,
    muted: nodeData.attr?.muted,
    playOnLoad: nodeData.attr?.playOnLoad,
    indexOfSameType,
    no_index: !shouldIndex
  };
  
  // Return enhanced node data with asset reference
  return {
    ...nodeData,
    assetId
  };
}

/**
 * Main processing function for step 4: Parse inline LaTeX in node data
 * This function should be called in the processing pipeline
 * @param {object} nodeData - Node data that may contain textRaw with LaTeX
 * @param {object} assets - Assets dictionary to register LaTeX segments
 * @returns {object} - Enhanced node data with textRich if LaTeX found
 */
export function parseLatexInline(nodeData, assets = {}, allNodes = {}) {
  if (!nodeData) {
    return nodeData;
  }
  
  // Handle LaTeX block nodes - register them in assets if not already processed
  if (nodeData.type === 'latex') {
    return registerLatexBlock(nodeData, assets, allNodes);
  }
  
  // Handle text nodes with potential inline LaTeX
  if (!nodeData.textRaw) {
    return nodeData;
  }
  
  const textString = nodeData.textRaw;
  
  // Check if text contains inline LaTeX
  if (!hasInlineLatex(textString)) {
    return nodeData;
  }
  
  // Parse into segments and register in assets
  const segments = parseInlineLatex(textString, assets);
  
  // Return enhanced node data
  return {
    ...nodeData,
    textRich: segments
  };
}

/**
 * Process text segments (LaTeX and references) in a single node
 * @param {object} nodeData - Node data to process
 * @param {object} assets - Assets dictionary
 * @param {object} refs - References dictionary
 * @param {string} nodeId - ID of the node being processed
 * @param {object} allNodes - All nodes for reference resolution
 * @returns {object} - Enhanced node data
 */
function parseTextSegmentsInNode(nodeData, assets, refs, bibs, bibsLookup, nodeId, allNodes) {
  // Handle LaTeX blocks - register as assets
  if (nodeData.type === 'latex') {
    return registerLatexBlock(nodeData, assets, allNodes);
  }
  
  // Handle image blocks - register as assets
  if (nodeData.type === 'image') {
    return registerImageBlock(nodeData, assets, allNodes);
  }
  
  // Handle video blocks - register as assets
  if (nodeData.type === 'video') {
    return registerVideoBlock(nodeData, assets, allNodes);
  }
  
  // Handle other nodes with text content
  if (!nodeData || !nodeData.textRaw || typeof nodeData.textRaw !== 'string') {
    return nodeData;
  }
  
  const textString = nodeData.textRaw;
  
  // Parse into segments and register in assets, refs, and bibs
  const segments = parseTextSegments(textString, assets, refs, bibs, bibsLookup, nodeId);
  
  // Return enhanced node data
  return {
    ...nodeData,
    textRich: segments
  };
}

/**
 * Process all nodes in flattened structure for text segments (LaTeX, refs, and bibs) (Step 4)
 * @param {object} flattenedData - {nodes: {}, rootNodeId: string, assets: {}}
 * @returns {object} - Enhanced flattened data with text segments processed
 */
export async function processAllTextSegments(flattenedData) {
  const { nodes, rootNodeId, assets } = flattenedData;
  const refs = {}; // New refs dictionary
  const bibs = {}; // New bibs dictionary for bibliography entries
  const bibsLookup = {}; // New bibsLookup dictionary for key->id mapping
  const processedNodes = {};
  
  console.log('🔄 Step 4: Processing text segments (LaTeX, refs, and bibs) for all nodes...');
  
  // Process each node that might contain LaTeX or references
  const nodeIds = Object.keys(nodes);
  let segmentNodesFound = 0;
  
  for (const nodeId of nodeIds) {
    const nodeData = nodes[nodeId];
    const processedNode = parseTextSegmentsInNode(nodeData, assets, refs, bibs, bibsLookup, nodeId, nodes);
    
    if (processedNode.textRich) {
      segmentNodesFound++;
      // console.log(`✅ Processed text segments in node ${nodeId}`);
    }
    processedNodes[nodeId] = processedNode;
  }
  
  console.log(`🔍 Text segment parsing complete: ${segmentNodesFound} nodes with segments found`);
  
  // Now convert LaTeX assets to HTML
  console.log('🔄 Step 4b: Converting LaTeX assets to HTML...');
  const latexAssets = Object.values(assets).filter(asset => 
    asset.type === 'latex-inline' || asset.type === 'latex-block'
  );
  let convertedCount = 0;
  
  for (const asset of latexAssets) {
    try {
      console.log(`🔧 Converting LaTeX asset ${asset.id}: "${asset.latexContent}"`);
      const htmlString = await LaTeX2Svg(asset.latexContent, asset.id);
      
      // Extract SVG from MathJax container here (not during rendering)
      let svgContent = htmlString;
      const svgMatch = htmlString.match(/<svg[^>]*>[\s\S]*?<\/svg>/i);
      if (svgMatch) {
        svgContent = svgMatch[0];
      }
      
      asset.htmlContent = svgContent; // Store clean SVG directly
      convertedCount++;
      // console.log(`✅ Converted LaTeX asset ${asset.id}`);
    } catch (error) {
      console.warn(`❌ Failed to convert LaTeX asset ${asset.id}:`, error);
      asset.htmlContent = null; // Will display raw text
    }
  }
  
  console.log(`🔍 LaTeX conversion complete: ${convertedCount}/${latexAssets.length} assets converted`);
  
  return {
    nodes: processedNodes,
    rootNodeId,
    assets,
    refs,
    bibs,
    bibsLookup
  };
}

/**
 * Debug function to analyze LaTeX parsing results
 * @param {string} text - Original text
 * @param {Array} segments - Parsed segments
 */
export function debugLatexParsing(text, segments, assets = {}) {
  console.log('🔍 LaTeX Parsing Debug:');
  console.log('Original:', text);
  console.log('Segments:', segments.length);
  segments.forEach((segment, index) => {
    console.log(`  [${index}] ${segment.type}: "${segment.textRaw}"`);
    if (segment.assetId) {
      const asset = assets[segment.assetId];
      console.log(`    Asset ID: ${segment.assetId}`);
      if (asset?.htmlContent) {
        console.log(`    HTML: ${asset.htmlContent.substring(0, 100)}...`);
      }
    }
  });
  console.log('Reconstructed:', segmentsToText(segments));
  console.log('MathJax format:', segmentsToMathJax(segments));
}

/**
 * Scan assets and calculate proper indexing, especially for image-list subindices
 * @param {object} flattenedData - The flattened node structure
 * @param {object} assets - The assets object to update
 */
export function scanAssets(flattenedData, assets) {
  console.error("scanAssets called");
  // Get all image and video assets that should be indexed
  const imageAssets = Object.values(assets).filter(asset => 
    asset.type === 'image-block' && !asset.no_index
  );
  const videoAssets = Object.values(assets).filter(asset => 
    asset.type === 'video-block' && !asset.no_index
  );
  
  console.log(`scanAssets called: found ${imageAssets.length} images and ${videoAssets.length} videos to index`);
  
  if (imageAssets.length === 0 && videoAssets.length === 0) {
    return;
  }
  
  let imageCounter = 0;
  let videoCounter = 0;
  const imageListGroups = new Map(); // Track image-list groups
  const videoListGroups = new Map(); // Track video-list groups
  
  for (const asset of imageAssets) {
    const nodeData = flattenedData[asset.nodeId];
    if (!nodeData) {
      continue;
    }
    
    // Check if this image is part of an image-list
    const parentNodeData = nodeData.parentId ? flattenedData[nodeData.parentId] : null;
    const isInImageList = parentNodeData && parentNodeData.type === 'image-list';
    
    if (isInImageList) {
      // Handle image-list subindices
      const parentId = parentNodeData.id;
      const subindexStrategy = parentNodeData.attr?.subindex || 'abc';
      
      if (!imageListGroups.has(parentId)) {
        // First image in this image-list - assign new group number
        imageCounter++;
        const children = parentNodeData.children || [];
        imageListGroups.set(parentId, {
          baseIndex: imageCounter,
          subindexStrategy: subindexStrategy,
          children: children
        });
      }
      
      const group = imageListGroups.get(parentId);
      const childIndex = group.children.indexOf(nodeData.id);
      
      if (childIndex >= 0) {
        // Calculate subindex based on strategy
        let calculatedSubindex;
        const totalChildren = group.children.length;
        
        if (subindexStrategy === 'LR' && totalChildren === 2) {
          calculatedSubindex = childIndex === 0 ? 'L' : 'R';
        } else if (subindexStrategy === 'abc') {
          calculatedSubindex = String.fromCharCode(97 + childIndex); // a, b, c, ...
        } else if (subindexStrategy === 'ABC') {
          calculatedSubindex = String.fromCharCode(65 + childIndex); // A, B, C, ...
        } else if (subindexStrategy === '123') {
          calculatedSubindex = String(childIndex + 1); // 1, 2, 3, ...
        } else {
          // Custom subindex pattern
          calculatedSubindex = subindexStrategy[childIndex] || String(childIndex + 1);
        }
        
        // Update asset with calculated values
        asset.indexOfSameType = group.baseIndex;
        asset.subindex = calculatedSubindex;
        asset.indexStr = `${group.baseIndex}${calculatedSubindex}`;
        
      }
    } else {
      // Regular standalone image
      imageCounter++;
      asset.indexOfSameType = imageCounter;
      asset.subindex = null;
      asset.indexStr = String(imageCounter);
      
    }
  }
  
  // Process video assets
  for (const asset of videoAssets) {
    const nodeData = flattenedData[asset.nodeId];
    if (!nodeData) {
      continue;
    }
    
    // Check if this video is part of a video-list
    const parentNodeData = nodeData.parentId ? flattenedData[nodeData.parentId] : null;
    const isInVideoList = parentNodeData && parentNodeData.type === 'video-list';
    
    if (isInVideoList) {
      // Handle video-list subindices
      const parentId = parentNodeData.id;
      const subindexStrategy = parentNodeData.attr?.subindex || 'abc';
      
      if (!videoListGroups.has(parentId)) {
        // First video in this video-list - assign new group number
        videoCounter++;
        const children = parentNodeData.children || [];
        videoListGroups.set(parentId, {
          baseIndex: videoCounter,
          subindexStrategy: subindexStrategy,
          children: children
        });
      }
      
      const group = videoListGroups.get(parentId);
      const childIndex = group.children.indexOf(nodeData.id);
      
      if (childIndex >= 0) {
        // Calculate subindex based on strategy
        let calculatedSubindex;
        if (group.subindexStrategy === 'LR' && group.children.length === 2) {
          calculatedSubindex = childIndex === 0 ? 'L' : 'R';
        } else if (group.subindexStrategy === 'abc') {
          calculatedSubindex = String.fromCharCode(97 + childIndex); // a, b, c, ...
        } else if (group.subindexStrategy === 'ABC') {
          calculatedSubindex = String.fromCharCode(65 + childIndex); // A, B, C, ...
        } else if (group.subindexStrategy === '123') {
          calculatedSubindex = String(childIndex + 1); // 1, 2, 3, ...
        } else {
          // Custom subindex pattern or unknown
          calculatedSubindex = group.subindexStrategy[childIndex] || String(childIndex + 1);
        }
        
        asset.indexOfSameType = group.baseIndex;
        asset.subindex = calculatedSubindex;
        asset.indexStr = `${group.baseIndex}${calculatedSubindex}`;
      } else {
        // Child not found in list - treat as standalone
        videoCounter++;
        asset.indexOfSameType = videoCounter;
        asset.subindex = null;
        asset.indexStr = String(videoCounter);
      }
    } else {
      // Regular standalone video
      videoCounter++;
      asset.indexOfSameType = videoCounter;
      asset.subindex = null;
      asset.indexStr = String(videoCounter);
    }
  }
  
}
