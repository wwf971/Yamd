import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useAssetStore } from './Asset.js';
import BackToHome from '@/navi/BackToHome.jsx';
import './AssetInfo.css';

function AssetPage() {
  // Get the asset path from the URL parameters
  const params = useParams();
  const location = useLocation();
  const assetPath = params['*'] || '';
  const requestUrl = location.pathname;
  
  // Zustand store
  const refreshAsset = useAssetStore((state) => state.refreshAsset);
  const asset = useAssetStore((state) => state.assets[assetPath] || null);
  
  // State for HTML view mode (iframe vs source)
  const [htmlViewMode, setHtmlViewMode] = useState('iframe');

  // Fetch content from /file/ endpoint using Zustand
  useEffect(() => {
    if (!assetPath) return;
    
    const store = useAssetStore.getState();
    const currentAsset = store.assets[assetPath];
    
    // Check if we should fetch (first time or needs refresh)
    if (!currentAsset || store.shouldRefetch(assetPath)) {
      store.fetchAsset(assetPath);
    }
  }, [assetPath]);

  // Handle refresh button click
  const handleRefreshAsset = () => {
    if (assetPath) {
      refreshAsset(assetPath);
    }
  };

  const renderContent = () => {
    const loading = asset?.status === 'loading';
    const error = asset?.status === 'error' ? asset.error : null;
    const content = asset?.content;

    if (loading) {
      return (
        <div className="loading-container">
          <p>Loading content...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="error-container">
          <h3>❌ Asset Not Found</h3>
          <p><strong>Error:</strong> {error}</p>
          <p>The requested asset could not be retrieved from the server.</p>
        </div>
      );
    }

    if (!content) {
      return (
        <div className="no-content-container">
          <p>No asset path provided. Try visiting a URL like <code>/asset/images/photo.jpg</code></p>
        </div>
      );
    }

    // Render based on content type
    switch (content.type) {
      case 'image':
        return (
          <div className="content-container">
            <h3>Image Content</h3>
            <div className="image-content">
              <img 
                src={content.url} 
                alt={`Asset: ${assetPath}`}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <div className="image-error">
                Failed to load image
              </div>
            </div>
          </div>
        );
        
      case 'video':
        return (
          <div className="content-container">
            <h3>Video Content</h3>
            <div className="video-content">
              <video controls>
                <source src={content.url} />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        );
        
      case 'json':
        return (
          <div className="content-container">
            <h3>JSON Content</h3>
            <pre className="json-content">
              {content.data}
            </pre>
          </div>
        );
        
      case 'html':
        return (
          <div className="content-container">
            <h3>HTML Content</h3>
            <div className="html-content">
              <div className="html-options">
                <span>View mode:</span>
                <button 
                  className={`html-option-button ${htmlViewMode === 'iframe' ? 'active' : ''}`}
                  onClick={() => setHtmlViewMode('iframe')}
                >
                  Rendered
                </button>
                <button 
                  className={`html-option-button ${htmlViewMode === 'source' ? 'active' : ''}`}
                  onClick={() => setHtmlViewMode('source')}
                >
                  Source
                </button>
              </div>
              
              {htmlViewMode === 'iframe' ? (
                <iframe
                  className="html-iframe"
                  srcDoc={content.data}
                  title={`HTML content: ${assetPath}`}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              ) : (
                <div className="html-source-view">
                  {content.data}
                </div>
              )}
            </div>
          </div>
        );
        
      default:
        return (
          <div className="content-container">
            <h3>Text Content</h3>
            <div className="text-content">
              {content.data}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="asset-viewer">
      <h1>Asset Viewer</h1>
      
      {/* Content Display Area */}
      {renderContent()}
      
      <div className="button-container">
        <button 
          className="refresh-button"
          onClick={handleRefreshAsset}
          disabled={asset?.status === 'loading'}
        >
          🔄 {asset?.status === 'loading' ? 'Loading...' : 'Refresh'}
        </button>
        
        <BackToHome />
      </div>

    </div>
  );
}

export default AssetPage;
