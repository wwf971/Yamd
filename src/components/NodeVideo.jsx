import React, { useRef, useEffect } from 'react';
import { getNodeClass } from '@/core/YamdNode.jsx';
import { VIDEO_SETTINGS } from '@/config/RenderConfig.js';
import { getAlignmentStrategy } from '@/YamdRenderUtils.js';

/**
 * Video node renderer - displays videos with captions
 */
const NodeVideo = ({ nodeId, parentInfo, globalInfo }) => {
  const nodeRef = useRef(null);
  const videoRef = useRef(null);

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
    return <div className="yamd-error">Video node not found: {nodeId}</div>;
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
        <div ref={nodeRef} className="yamd-video-block yamd-video-error" id={nodeData.htmlId}>
          <div className="yamd-video-content">
            <div className="yamd-error">
              Failed to load video: {result.message}
            </div>
          </div>
          {nodeData.caption && (
            <div className="yamd-video-caption">
              <span className="yamd-video-label">
                Video.
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

  // Get video src from textRaw or external data
  const videoSrc = externalData?.src || nodeData.textRaw;
  
  if (!videoSrc) {
    return (
      <div ref={nodeRef} className="yamd-video-block yamd-video-error" id={nodeData.htmlId}>
        <div className="yamd-video-content">
          <div className="yamd-error">
            Video source not found
          </div>
        </div>
        <div className="yamd-video-caption">
          <span className="yamd-video-label">
            Video.
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

  const nodeClass = getNodeClass(nodeData, parentInfo) || 'yamd-video-block';
  const customWidth = nodeData.attr?.width;
  const customHeight = nodeData.attr?.height;
  const playOnLoad = nodeData.attr?.playOnLoad === 'true' || nodeData.attr?.playOnLoad === true;
  const controls = nodeData.attr?.controls !== 'false'; // Default to true
  const autoplay = nodeData.attr?.autoplay === 'true' || nodeData.attr?.autoplay === true;
  const loop = nodeData.attr?.loop === 'true' || nodeData.attr?.loop === true;
  const muted = nodeData.attr?.muted === 'true' || nodeData.attr?.muted === true;

  const videoStyle = {
    ...(customWidth && { width: customWidth }),
    ...(customHeight && { height: customHeight }),
    maxWidth: '100%',
    height: 'auto',
    // Apply default maxHeight if no custom height is specified
    ...(!customHeight && { maxHeight: VIDEO_SETTINGS.maxHeight })
  };

  // Get alignment strategy for the video
  const alignmentStrategy = getAlignmentStrategy(nodeData, parentInfo);
  
  // Check if parent (like YamdVideoList) wants to force a specific height
  const forcedHeight = parentInfo?.forcedHeight;
  
  // Apply forced height styling if provided by parent
  if (forcedHeight) {
    videoStyle.height = `${forcedHeight}px`;
    videoStyle.width = 'auto';
    videoStyle.maxWidth = 'none';
  }

  const containerStyle = {
    display: 'flex',
    justifyContent: forcedHeight ? 'center' : alignmentStrategy, // Center in video-list, respect alignX when independent
    width: forcedHeight ? '100%' : '100%',
    height: forcedHeight ? '100%' : 'auto'
  };
  
  // Block level alignment for independent videos (not inside video-list)
  const blockStyle = forcedHeight ? {} : {
    display: 'flex',
    alignSelf: alignmentStrategy, // This controls where yamd-video-content sits within yamd-video-block
    width: 'max-content' // Only take the width needed for the video
  };

  // Handle playOnLoad functionality
  useEffect(() => {
    if (playOnLoad && videoRef.current) {
      // Small delay to ensure video is ready
      const timer = setTimeout(() => {
        videoRef.current.play().catch(error => {
          console.warn('Failed to auto-play video (browser policy):', error);
        });
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [playOnLoad]);

  return (
    <div ref={nodeRef} className={`yamd-video-block ${nodeClass}`} id={nodeData.htmlId} style={blockStyle}>
      <div className="yamd-video-content" style={containerStyle}>
        <video 
          ref={videoRef}
          src={videoSrc}
          style={videoStyle}
          className="yamd-video-element"
          controls={controls}
          autoPlay={autoplay}
          loop={loop}
          muted={muted}
          onError={(e) => {
            console.warn(`Failed to load video: ${videoSrc}`);
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'block';
          }}
        />
        <div className="yamd-video-fallback" style={{ display: 'none' }}>
          <div className="yamd-error">
            Failed to load video: {videoSrc}
          </div>
        </div>
      </div>
      
      <div className="yamd-video-caption">
        <span className="yamd-video-label">
          Video
          {/* Show index number if available from asset */}
          {(() => {
            if (nodeData.assetId && globalInfo?.getAssetById) {
              const asset = globalInfo.getAssetById(nodeData.assetId);
              if (asset && !asset.no_index && asset.indexOfSameType) {
                return ` ${asset.indexOfSameType}`;
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

export default NodeVideo;
