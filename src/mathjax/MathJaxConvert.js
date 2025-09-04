// MathJax LaTeX conversion utility functions
// Handles LaTeX to HTML/SVG conversion using MathJax APIs

import { useMathJaxStore } from './MathJaxStore.js';

/**
 * Convert LaTeX to CHTML using tex2chtmlPromise
 * @param {string} latexContent - Raw LaTeX content
 * @param {string} nodeId - Node ID for logging
 * @returns {Promise<string|null>} - HTML string or null on failure
 */
export const LaTeX2Chtml = async (latexContent, nodeId = 'unknown') => {
  const store = useMathJaxStore.getState();
  
  // Check MathJax readiness
  if (!store.isMathJaxReady || store.isMathJaxError) {
    console.warn(`⚠️ MathJax not ready for CHTML conversion (node: ${nodeId})`);
    return null;
  }

  if (!window.MathJax || !window.MathJax.tex2chtmlPromise) {
    console.warn(`⚠️ tex2chtmlPromise not available (node: ${nodeId})`);
    return null;
  }

  if (!latexContent) {
    console.warn(`⚠️ No LaTeX content provided (node: ${nodeId})`);
    return null;
  }

  try {
    console.log(`🔄 Converting LaTeX to CHTML for node: ${nodeId}`);

    // Clean LaTeX content - remove any existing delimiters
    let cleanLatex = latexContent.trim();
    cleanLatex = cleanLatex.replace(/^\\\[|\\\]$/g, ''); // Remove \[ \] 
    cleanLatex = cleanLatex.replace(/^\\\(|\\\)$/g, ''); // Remove \( \)

    // Convert using tex2chtmlPromise
    const html = await window.MathJax.tex2chtmlPromise(cleanLatex, {
      em: 12, 
      ex: 6, 
      display: true // Use display mode for block math
    });
    
    const htmlString = html.outerHTML;
    console.log(`✅ LaTeX converted to CHTML for node: ${nodeId}`);
    return htmlString;
    
  } catch (error) {
    console.error(`❌ LaTeX CHTML conversion failed for node ${nodeId}:`, error);
    return null;
  }
};

// ensure that mathJaxScript.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
  // otherwise tex2svg, tex2svgPromise will not be available
export const LaTeX2Svg = async (latexContent, nodeId = 'unknown') => {
  const store = useMathJaxStore.getState();
  
  // Check MathJax readiness
  if (!store.isMathJaxReady || store.isMathJaxError) {
    console.warn(`⚠️ MathJax not ready for SVG conversion (node: ${nodeId})`);
    return null;
  }

  if (!window.MathJax || !window.MathJax.tex2svgPromise) {
    console.warn(`⚠️ tex2svgPromise not available (node: ${nodeId})`);
    return null;
  }

  if (!latexContent) {
    console.warn(`⚠️ No LaTeX content provided (node: ${nodeId})`);
    return null;
  }

  try {
    // console.log(`🔄 Converting LaTeX to SVG for node: ${nodeId}`);

    // Clean LaTeX content - remove any existing delimiters
    let cleanLatex = latexContent.trim();
    cleanLatex = cleanLatex.replace(/^\\\[|\\\]$/g, ''); // Remove \[ \] 
    cleanLatex = cleanLatex.replace(/^\\\(|\\\)$/g, ''); // Remove \( \)

    // Convert using tex2svgPromise
    const svg = await window.MathJax.tex2svgPromise(cleanLatex, {
      em: 12, 
      ex: 6, 
      display: true // Use display mode for block math
    });
    
    const svgString = svg.outerHTML;
    // console.log(`✅ LaTeX converted to SVG for node: ${nodeId}`);
    return svgString;
    
  } catch (error) {
    console.error(`❌ LaTeX SVG conversion failed for node ${nodeId}:`, error);
    return null;
  }
};

/**
 * Reset the initialization state (useful for testing or error recovery)
 */
export const resetMathJaxState = () => {
  console.log('🔄 MathJax state reset');
};
