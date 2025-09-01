import React, { useRef, useEffect, useState } from 'react';
import { useProjectStore } from '../ProjectStore.js';
import { useMathJaxStore } from '@/mathjax/MathJaxStore.js';
import { LaTeX2Svg, LaTeX2Chtml } from '@/mathjax/MathJaxConvert.js';


/* latex math block */
function LaTeX({ node, projectData }) {
  const containerRef = useRef(null);
  const [renderedHTML, setRenderedHTML] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  
  // Watch MathJax readiness
  const isMathJaxReady = useMathJaxStore((state) => state.isMathJaxReady);
  const isMathJaxError = useMathJaxStore((state) => state.isMathJaxError);

  // calculate renderedHTML from latex text
  useEffect(() => {
    const convertLatex = async () => {
      if (!isMathJaxReady || isMathJaxError || isConverting || renderedHTML) {
        return; // Skip if not ready, in error, already converting, or already converted
      }

      const latexContent = node.text_raw || node.content;
      if (!latexContent) {
        return;
      }

      setIsConverting(true);

      try {
        // Try SVG conversion first (since we're using tex-svg.js now)
        let result = await LaTeX2Svg(latexContent, node.id);
        
        // Fallback to CHTML if SVG fails
        if (!result) {
          console.log(`🔄 SVG conversion failed, trying CHTML for node: ${node.id}`);
          result = await LaTeX2Chtml(latexContent, node.id);
        }
        
        if (result) {
          setRenderedHTML(result);
        }
        
      } catch (error) {
        console.error(`❌ LaTeX conversion failed for node ${node.id}:`, error);
        // Keep raw content as fallback
      } finally {
        setIsConverting(false);
      }
    };

    convertLatex();
  }, [isMathJaxReady, isMathJaxError, node.text_raw, node.content, node.id, isConverting, renderedHTML]);

  if (!node.text_raw && !node.content) {
    return (
      <div id={node.id} className="latex-container">
        <div className="latex-error">No LaTeX content provided</div>
      </div>
    );
  }

  const latexContent = node.text_raw || node.content;
  const elementId = node.id || `latex-${Math.random().toString(36).substr(2, 9)}`;

  // If we have rendered HTML, display it
  if (renderedHTML) {
    return (
      <div ref={containerRef} id={elementId} className="latex-container">
        <div 
          className="latex-content latex-rendered"
          dangerouslySetInnerHTML={{ __html: renderedHTML }}
        />
        {node.caption && (
          <div className="latex-caption" dangerouslySetInnerHTML={{ 
            __html: node.caption_processed || node.caption 
          }} />
        )}
      </div>
    );
  }

  // Fallback: Show raw LaTeX content (NO MathJax delimiters to avoid scanner detection)
  const latexContentTrim = latexContent.trim();
  
  return (
    <div ref={containerRef} id={elementId} className="latex-container">
      <div className="latex-content latex-raw" style={{
        fontFamily: 'monospace',
        fontSize: '0.9em',
        padding: '8px',
        backgroundColor: '#f5f5f5',
        border: '1px solid #ddd',
        borderRadius: '4px'
      }}>
        {isConverting ? '🔄 Converting...' : latexContentTrim}
      </div>
      {node.caption && (
        <div className="latex-caption" dangerouslySetInnerHTML={{ 
          __html: node.caption_processed || node.caption 
        }} />
      )}
    </div>
  );
}

export default LaTeX;
