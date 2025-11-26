import React from 'react';
import { useRenderUtilsContext } from '@/core/RenderUtils.ts';

/**
 * LaTeX inline renderer component
 * Handles rendering of LaTeX segments with asset-based HTML conversion
 */
const NodeTextRichLaTeXInline = ({ segment, globalInfo }) => {
  // Get render utils from context
  const renderUtils = useRenderUtilsContext();
  
  if (segment.type !== 'latex_inline' || !segment.assetId) {
    // Not a LaTeX segment, should not be handled by this component
    return (
      <span className="yamd-text-segment yamd-error">
        Invalid LaTeX segment
      </span>
    );
  }
  
  const asset = renderUtils.getAssetById(segment.assetId);
  
  if (!asset) {
    // Asset not found, display raw text
    console.warn(`LaTeX asset not found: ${segment.assetId}`);
    return (
      <span className="yamd-text-segment yamd-latex-missing">
        ${segment.textRaw}$
      </span>
    );
  }

  if (asset.htmlContent) {
    // Successfully converted LaTeX - htmlContent already contains clean SVG
    return (
      <span 
        className="yamd-latex-inline yamd-latex-converted"
        dangerouslySetInnerHTML={{ __html: asset.htmlContent }}
      />
    );
  } else {
    // Conversion failed or not ready yet - display raw text
    return (
      <span className="yamd-text-segment yamd-latex-raw">
        ${segment.textRaw}$
      </span>
    );
  }
};

export default NodeTextRichLaTeXInline;
