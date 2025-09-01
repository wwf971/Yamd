import React from 'react';
import { useServerStore } from '@/Server.js';

/**
 * Video Component
 * Renders single or dual videos with captions
 */
function Video({ node }) {
  const getFullUrl = useServerStore((state) => state.getFullUrl);
  return (
    <div id={node.id} className="video-container">
      {/* Single video */}
      {!Array.isArray(node.src) ? (
        <>
          <video controls width={node.width} height={node.height}>
            <source src={getFullUrl(node.src)} type={node.mime_type || 'video/mp4'} />
            Your browser does not support the video tag.
          </video>
          {node.caption && !node.no_index && (
            <div 
              className="video-caption"
              dangerouslySetInnerHTML={{ 
                __html: `Video ${node.video_num}. ${node.caption_processed || node.caption}` 
              }}
            />
          )}
          {!node.caption && !node.no_index && (
            <div 
              className="video-caption"
              dangerouslySetInnerHTML={{ 
                __html: `Video ${node.video_num}` 
              }}
            />
          )}
          {node.caption && node.no_index && (
            <div 
              className="video-caption"
              dangerouslySetInnerHTML={{ 
                __html: node.caption_processed || node.caption 
              }}
            />
          )}
        </>
      ) : (
        /* Two videos side by side */
        <>
          <div className="dual-video-container">
            <div className="dual-video-item">
              <video 
                controls 
                width={Array.isArray(node.width) ? node.width[0] : node.width}
                height={Array.isArray(node.height) ? node.height[0] : node.height}
              >
                <source 
                  src={getFullUrl(node.src[0])} 
                  type={(Array.isArray(node.mime_type) ? node.mime_type[0] : node.mime_type) || 'video/mp4'}
                />
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="dual-video-item">
              <video 
                controls 
                width={Array.isArray(node.width) ? node.width[1] : node.width}
                height={Array.isArray(node.height) ? node.height[1] : node.height}
              >
                <source 
                  src={getFullUrl(node.src[1])} 
                  type={(Array.isArray(node.mime_type) ? node.mime_type[1] : node.mime_type) || 'video/mp4'}
                />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
          {node.caption && !node.no_index && (
            <div 
              className="video-caption"
              dangerouslySetInnerHTML={{ 
                __html: `Video ${node.video_num}. ${node.caption_processed || node.caption}` 
              }}
            />
          )}
          {!node.caption && !node.no_index && (
            <div 
              className="video-caption"
              dangerouslySetInnerHTML={{ 
                __html: `Video ${node.video_num}` 
              }}
            />
          )}
          {node.caption && node.no_index && (
            <div 
              className="video-caption"
              dangerouslySetInnerHTML={{ 
                __html: node.caption_processed || node.caption 
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

export default Video;
