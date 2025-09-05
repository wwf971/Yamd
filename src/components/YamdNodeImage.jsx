import React, { useRef, useEffect } from 'react';
import { getNodeClass } from '../YamdNode.jsx';
import { IMAGE_SETTINGS } from '../YamdRenderSettings.js';
import { getAlignmentStrategy } from '../YamdRenderUtils.js';

/**
 * Image node renderer - displays images with captions
 */
const YamdNodeImage = ({ nodeId, parentInfo, globalInfo }) => {
  const nodeRef = useRef(null);

  // Register the node reference after the component finishes rendering
  useEffect(() => {
    if (nodeRef.current) {
      globalInfo?.registerNodeRef?.(nodeId, nodeRef.current);
    }
  }, [nodeId, globalInfo]);

  if (!globalInfo?.getNodeDataById) {
    return <div className="yamd-error">Missing globalInfo.getNodeDataById</div>;
  }
  const nodeData = globalInfo.getNodeDataById(nodeId);
  if (!nodeData) {
    return <div className="yamd-error">Image node not found: nodeId: {nodeId}</div>;
  }

  // Try to fetch external data if globalInfo.fetchExternalData is available
  let externalData = null;
  if (globalInfo?.fetchExternalData) {
    const result = globalInfo.fetchExternalData(nodeData);
    if (result.code === 0) {
      // Success - use external data
      externalData = result.data;
    } else if (result.code === -1) {
      // Error - display error message
      return (
        <div ref={nodeRef} className="yamd-image-block yamd-image-error" id={nodeData.htmlId}>
          <div className="yamd-image-content">
            <div className="yamd-error">
              Failed to load image: {result.message}
            </div>
          </div>
          {nodeData.caption && (
            <div className="yamd-image-caption">
              <span className="yamd-image-label">
                Image.
              </span>
              {' '}
              {nodeData.caption}
            </div>
          )}
        </div>
      );
    }
    // code === 1: component should handle itself (continue with normal rendering)
  }

  // Get image src from textRaw or external data
  const imageSrc = externalData?.src || nodeData.textRaw;
  
  if (!imageSrc) {
    return (
      <div ref={nodeRef} className="yamd-image-block yamd-image-error" id={nodeData.htmlId}>
        <div className="yamd-image-content">
          <div className="yamd-error">
            Image source not found
          </div>
        </div>
        <div className="yamd-image-caption">
          <span className="yamd-image-label">
            Image.
          </span>
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

  const nodeClass = getNodeClass(nodeData, parentInfo) || 'yamd-image-block';
  const customWidth = nodeData.attr?.width;
  const customHeight = nodeData.attr?.height;
  const altText = nodeData.attr?.alt || nodeData.caption || 'Image';

  // Get alignment strategy for the image
  const alignmentStrategy = getAlignmentStrategy(nodeData, parentInfo);

  // Handle forced height from image-list parent
  const forcedHeight = parentInfo?.forcedHeight;

  const imageStyle = {
    ...(customWidth && { width: customWidth }),
    ...(customHeight && { height: customHeight }),
    ...(forcedHeight ? {
      height: `${forcedHeight}px`,
      width: 'auto', // Let width be determined by aspect ratio
      maxWidth: 'none' // Don't limit the natural width
    } : {
      maxWidth: '100%',
      height: 'auto'
    })
  };

  const containerStyle = {
    display: 'flex',
    justifyContent: 'center', // Always center image within its content container
    alignItems: 'center', // Always center image within its content container
    ...(forcedHeight ? {
      // Inside YamdImageList: fill the item container
      width: '100%',
      height: '100%'
    } : {
      // Independent image: size to content only
      width: 'max-content', // Only take the width needed for the image
      height: 'auto',
      flexShrink: 0 // Don't shrink below content size
    })
  };

  // For independent images, apply alignment at the block level
  const blockStyle = forcedHeight ? {} : {
    display: 'flex',
    alignSelf: alignmentStrategy, // This controls where yamd-image-content sits within yamd-image-block
    width: 'max-content'
  };

  return (
    <div ref={nodeRef} className={`yamd-image-block ${nodeClass}`} id={nodeData.htmlId} style={blockStyle}>
      <div className="yamd-image-content" style={containerStyle}>
        <img 
          src={imageSrc}
          alt={altText}
          style={imageStyle}
          className="yamd-image-element"
          onError={(e) => {
            console.warn(`Failed to load image: ${imageSrc}`);
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'block';
          }}
        />
        <div className="yamd-image-fallback" style={{ display: 'none' }}>
          <div className="yamd-error">
            Failed to load image: {imageSrc}
          </div>
        </div>
      </div>
      
      <div className="yamd-image-caption">
        <span className="yamd-image-label">
          {/* Use IMAGE_SETTINGS for default caption title */}
          {IMAGE_SETTINGS.captionTitleDefault}
          {/* Show index number if available from asset */}
          {(() => {
            if (nodeData.assetId && globalInfo?.getAssetById) {
              const asset = globalInfo.getAssetById(nodeData.assetId);
              if (asset && !asset.no_index && (asset.indexStr || asset.indexOfSameType)) {
                return ` ${asset.indexStr || asset.indexOfSameType}`;
              }
            }
            return '';
          })()}
          .
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
};

export default YamdNodeImage;
