/**
 * LaTeX processing for Yamd system (inline and block)
 * Handles both inline LaTeX segments and standalone LaTeX blocks
 * This is step 4 in the processing pipeline
 */

import { LaTeX2Svg, LaTeX2Chtml } from '@/mathjax/MathJaxConvert.js';

/**
 * Parse text string into segments of plain text and inline LaTeX
 * @param {string} text - Input text that may contain inline LaTeX
 * @param {object} assets - Assets dictionary to register LaTeX segments
 * @returns {Array} - Array of segments: [{type: 'text'|'latex', textRaw: string, assetId?: string}]
 */
export function parseInlineLatex(text, assets = {}) {
  if (!text || typeof text !== 'string') {
    return [{ type: 'text', textRaw: text || '' }];
  }

  const segments = [];
  let currentPos = 0;
  let assetCounter = Object.keys(assets).length;
  
  // Regex pattern matching the ProjectStore logic:
  // $...$ but NOT $ref{...} (negative lookahead)
  // Also handle edge cases like empty content
  const latexPattern = /\$(?!ref\{)([^$]*)\$/g;
  
  let match;
  while ((match = latexPattern.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = match.index + match[0].length;
    const mathContent = match[1];
    
    // Add any plain text before this match
    if (matchStart > currentPos) {
      const plainText = text.slice(currentPos, matchStart);
      if (plainText) {
        segments.push({ type: 'text', textRaw: plainText });
      }
    }
    
    // Add the LaTeX segment (only if content is not empty after trimming)
    if (mathContent.trim() !== '') {
      const assetId = `latex_${String(++assetCounter).padStart(3, '0')}`;
      
      // Register in assets with inline type
      assets[assetId] = {
        id: assetId,
        type: 'latex-inline',
        latexContent: mathContent,
        htmlContent: null, // Will be filled by processAllLaTeXInline
        original: match[0]
      };
      
      segments.push({ 
        type: 'latex_inline', // Differentiate from latex_block
        textRaw: mathContent,
        assetId: assetId
      });
    } else {
      // Empty math content - treat as plain text (preserve original $$ pattern)
      segments.push({ type: 'text', textRaw: match[0] });
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
  
  // If no LaTeX was found, return the original text as a single text segment
  if (segments.length === 0) {
    return [{ type: 'text', textRaw: text }];
  }
  
  return segments;
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
    htmlContent: null, // Will be filled by processAllLaTeXInline
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
 * Process all nodes in flattened structure for inline LaTeX (Step 4)
 * @param {object} flattenedData - {nodes: {}, rootNodeId: string, assets: {}}
 * @returns {object} - Enhanced flattened data with LaTeX processed
 */
export async function processAllLaTeXInline(flattenedData) {
  const { nodes, rootNodeId, assets } = flattenedData;
  const processedNodes = {};
  
  console.log('🔄 Step 4: Processing inline LaTeX for all nodes...');
  
  // Process each node that might contain LaTeX
  const nodeIds = Object.keys(nodes);
  let latexNodesFound = 0;
  
  for (const nodeId of nodeIds) {
    const nodeData = nodes[nodeId];
    const processedNode = parseLatexInline(nodeData, assets, nodes);
    
    if (processedNode.textRich) {
      latexNodesFound++;
      console.log(`✅ Processed LaTeX in node ${nodeId}`);
    }
    
    processedNodes[nodeId] = processedNode;
  }
  
  console.log(`🔍 LaTeX parsing complete: ${latexNodesFound} nodes with LaTeX found`);
  
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
      console.log(`✅ Converted LaTeX asset ${asset.id}`);
    } catch (error) {
      console.warn(`❌ Failed to convert LaTeX asset ${asset.id}:`, error);
      asset.htmlContent = null; // Will display raw text
    }
  }
  
  console.log(`🔍 LaTeX conversion complete: ${convertedCount}/${latexAssets.length} assets converted`);
  
  return {
    nodes: processedNodes,
    rootNodeId,
    assets
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
