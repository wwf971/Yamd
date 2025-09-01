import React from 'react';
import { useServerStore } from '@/Server.js';

/**
 * PDF Component
 * Renders single or dual PDFs with captions
 */
function Pdf({ node }) {
  const getFullUrl = useServerStore((state) => state.getFullUrl);
  
  // Handle missing or null/undefined src
  if (!node.src) {
    console.warn('⚠️ PDF node missing src, showing placeholder:', node);
    return (
      <div id={node.id} className="pdf-container">
        <div className="pdf-placeholder" style={{
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
          <div>📄</div>
          <div>PDF source not specified</div>
          {node.title && <div style={{ fontStyle: 'italic', marginTop: '10px' }}>{node.title}</div>}
        </div>
        {node.caption && (
          <div className="pdf-caption" dangerouslySetInnerHTML={{ 
            __html: node.no_index ? 
              (node.caption_processed || node.caption) : 
              `Fig. ${node.fig_num}. ${node.caption_processed || node.caption}` 
          }} />
        )}
      </div>
    );
  }
  
  return (
    <div id={node.id} className="pdf-container">
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <iframe 
          id={node.id}
          src={getFullUrl(Array.isArray(node.src) ? node.src[0] : node.src)} 
          title={node.alt || 'Document PDF'} 
          style={{
            width: node.width || '100%',
            height: node.height || '600px',
            border: 'none',
            ...node.style
          }}
        />
      </div>
      {node.caption && !node.no_index && (
        <div className="pdf-caption" dangerouslySetInnerHTML={{ 
          __html: `Fig. ${node.fig_num}. ${node.caption_processed || node.caption}` 
        }} />
      )}
      {!node.caption && !node.no_index && (
        <div className="pdf-caption" dangerouslySetInnerHTML={{ 
          __html: `Fig. ${node.fig_num}` 
        }} />
      )}
      {node.caption && node.no_index && (
        <div className="pdf-caption" dangerouslySetInnerHTML={{ 
          __html: node.caption_processed || node.caption 
        }} />
      )}
    </div>
  );
}

export default Pdf;
