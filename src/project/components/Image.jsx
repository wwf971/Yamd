import React from 'react';
import { useServerStore } from '@/Server.js';

/**
 * Image Component
 * Renders single or dual images with captions
 */
function Image({ node }) {
  const getFullUrl = useServerStore((state) => state.getFullUrl);
  
  // Debug logging for image node
  if (!node.caption) {
    console.warn('🚨 Image missing caption:', {
      id: node.id,
      src: node.src,
      nodeKeys: Object.keys(node)
    });
  }
  
  // Handle missing or null/undefined src
  if (!node.src) {
    console.warn('⚠️ Image node missing src, showing placeholder:', node);
    return (
      <div id={node.id} className="image-container">
        <div className="image-placeholder" style={{
          border: '2px dashed #ccc',
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f9f9f9',
          color: '#666',
          minHeight: node.height || '200px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div>🖼️</div>
          <div>Image source not specified</div>
          {node.title && <div style={{ fontStyle: 'italic', marginTop: '10px' }}>{node.title}</div>}
        </div>
        {node.caption && (
          <div className="image-caption" dangerouslySetInnerHTML={{ 
            __html: node.no_index ? 
              (node.caption_processed || node.caption) : 
              `Fig. ${node.fig_num}. ${node.caption_processed || node.caption}` 
          }} />
        )}
      </div>
    );
  }
  
  return (
    <div id={node.id} className="image-container">
      {/* Single image */}
      {!Array.isArray(node.src) ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <img 
              id={node.id}
              src={getFullUrl(node.src)} 
              alt={node.alt || 'Document image'} 
              style={node.height ? { maxHeight: node.height, width: 'auto' } : {}}
              onError={(e) => {
                console.warn('⚠️ Image failed to load:', node.src);
                e.target.style.display = 'none';
                e.target.nextSibling && (e.target.nextSibling.textContent = 'Image failed to load');
              }}
            />
          </div>
          {node.caption && !node.no_index && (
            <div className="image-caption" dangerouslySetInnerHTML={{ 
              __html: `Fig. ${node.fig_num}. ${node.caption_processed || node.caption}` 
            }} />
          )}
          {!node.caption && !node.no_index && (
            <div className="image-caption" dangerouslySetInnerHTML={{ 
              __html: `Fig. ${node.fig_num}` 
            }} />
          )}
          {node.caption && node.no_index && (
            <div className="image-caption" dangerouslySetInnerHTML={{ 
              __html: node.caption_processed || node.caption 
            }} />
          )}
        </>
      ) : (
        /* Two images side by side */
        <>
          <div className="dual-image-container">
            <div id={Array.isArray(node.id) ? node.id[0] : `${node.id}-0`} className="dual-image-item">
              {node.src[0] ? (
                <img 
                  id={Array.isArray(node.id) ? node.id[0] : `${node.id}-0`}
                  src={getFullUrl(node.src[0])}
                  alt={(Array.isArray(node.alt) ? node.alt[0] : node.alt) || 'Document image 1'}
                  style={node.height ? { height: node.height, width: 'auto' } : {}}
                  onError={(e) => {
                    console.warn('⚠️ Left image failed to load:', node.src[0]);
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                <div className="image-placeholder" style={{ 
                  border: '1px dashed #ccc', 
                  padding: '20px', 
                  textAlign: 'center',
                  color: '#999',
                  minHeight: '100px'
                }}>Image 1 source missing</div>
              )}
            </div>
            <div id={Array.isArray(node.id) ? node.id[1] : `${node.id}-1`} className="dual-image-item">
              {node.src[1] ? (
                <img 
                  id={Array.isArray(node.id) ? node.id[1] : `${node.id}-1`}
                  src={getFullUrl(node.src[1])} 
                  alt={(Array.isArray(node.alt) ? node.alt[1] : node.alt) || 'Document image 2'}
                  style={node.height ? { height: node.height, width: 'auto' } : {}}
                  onError={(e) => {
                    console.warn('⚠️ Right image failed to load:', node.src[1]);
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                <div className="image-placeholder" style={{ 
                  border: '1px dashed #ccc', 
                  padding: '20px', 
                  textAlign: 'center',
                  color: '#999',
                  minHeight: '100px'
                }}>Image 2 source missing</div>
              )}
            </div>
          </div>
          {node.caption && !node.no_index && (
            <div className="image-caption" dangerouslySetInnerHTML={{ 
              __html: `Fig. ${node.fig_num}. ${node.caption_processed || node.caption}` 
            }} />
          )}
          {!node.caption && !node.no_index && (
            <div className="image-caption" dangerouslySetInnerHTML={{ 
              __html: `Fig. ${node.fig_num}` 
            }} />
          )}
          {node.caption && node.no_index && (
            <div className="image-caption" dangerouslySetInnerHTML={{ 
              __html: node.caption_processed || node.caption 
            }} />
          )}
        </>
      )}
    </div>
  );
}

export default Image;
