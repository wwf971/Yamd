import React from 'react';
import { getNodeClass } from '../YamdNode.jsx';
import { LATEX_SETTINGS } from '../YamdRenderSettings.js';
import { getAlignmentStrategy } from '../YamdRenderUtils.js';

/**
 * LaTeX block node renderer - displays standalone LaTeX equations
 */
const YamdNodeLaTeX = ({ nodeId, parentInfo, globalInfo }) => {
  if (!globalInfo?.getNodeDataById || !globalInfo?.getAssetById) {
    return <div className="yamd-error">Missing globalInfo functions</div>;
  }
  
  const nodeData = globalInfo.getNodeDataById(nodeId);
  
  if (!nodeData) {
    return <div className="yamd-error">LaTeX node not found: {nodeId}</div>;
  }

  if (!nodeData.assetId) {
    return (
      <div className="yamd-latex-block yamd-latex-raw" id={nodeData.htmlId}>
        <div className="yamd-latex-content">
          ${nodeData.textRaw || 'LaTeX content'}$
        </div>
        <div className="yamd-latex-caption">
          <span className="yamd-latex-label">
            {/* Use default caption title when no asset */}
            {LATEX_SETTINGS.captionTitleDefault}.
          </span>
          {/* Show caption text if provided */}
          {nodeData.caption && (
            <>
              {' '}
              {nodeData.caption}
            </>
          )}
        </div>
      </div>
    );
  }

  const asset = globalInfo.getAssetById(nodeData.assetId);
  
  if (!asset) {
    console.warn(`LaTeX block asset not found: ${nodeData.assetId}`);
    return (
      <div className="yamd-latex-block yamd-latex-missing">
        <div className="yamd-latex-content">
          ${nodeData.textRaw || 'LaTeX content'}$
        </div>
        {nodeData.caption && (
          <div className="yamd-latex-caption">
            {nodeData.caption}
          </div>
        )}
      </div>
    );
  }

  const nodeClass = getNodeClass(nodeData, parentInfo) || 'yamd-latex-block';
  const customHeight = nodeData.attr?.height || nodeData.height || asset?.height;

  // Get alignment strategy for the LaTeX block
  const alignmentStrategy = getAlignmentStrategy(nodeData, parentInfo);

  return (
    <div 
      className={`yamd-latex-block ${nodeClass}`} 
      id={nodeData.htmlId}
      style={{ alignSelf: alignmentStrategy }}
    >
      <div 
        className="yamd-latex-content"
        style={{ 
          height: customHeight || 'auto',
          ...(customHeight && { overflow: 'auto' })
        }}
      >
        {asset.htmlContent ? (
          <div 
            className="yamd-latex-rendered"
            dangerouslySetInnerHTML={{ __html: asset.htmlContent }}
          />
        ) : (
          <div className="yamd-latex-fallback">
            ${nodeData.textRaw || asset.latexContent}$
          </div>
        )}
      </div>
      
      <div className="yamd-latex-caption">
        <span className="yamd-latex-label">
          {/* Use custom caption title or default from settings */}
          {asset?.captionTitle || LATEX_SETTINGS.captionTitleDefault}
          {/* Show index number only if not no_index */}
          {!asset?.no_index && asset?.indexOfSameType ? ` ${asset.indexOfSameType}` : ''}
          .
        </span>
        {/* Show caption text if provided */}
        {(nodeData.caption || asset?.caption) && (
          <>
            {' '}
            {nodeData.caption || asset.caption}
          </>
        )}
      </div>
    </div>
  );
};

export default YamdNodeLaTeX;
