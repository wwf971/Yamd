import React, { useEffect, useCallback } from 'react';
import { useAssetStore } from './Asset.js';

/**
 * FetchText Component
 * Fetches text content from a URL using Zustand Asset store for caching
 * 
 * Props:
 * - url: string (required) - The URL to fetch text from
 * - fallback: string (optional) - Text to show while loading
 * - errorMessage: string (optional) - Custom error message
 * - asText: boolean (optional) - If true, renders as pure text (Fragment), otherwise as span
 * - isHtml: boolean (optional) - If true, renders content as HTML using dangerouslySetInnerHTML
 * - className: string (optional) - CSS class for the span (ignored if asText=true)
 * - style: object (optional) - Inline styles for the span (ignored if asText=true)
 */
function FetchText(allProps) {
  console.warn('FetchText received all props:', allProps);
  console.warn('isHtml in allProps:', allProps.isHtml);
  console.warn('hasOwnProperty isHtml:', allProps.hasOwnProperty('isHtml'));
  
  const { 
    url, 
    fallback = 'Loading...', 
    errorMessage = 'Failed to load text',
    asText = false,
    isHtml = false,
    className,
    style,
    ...props 
  } = allProps;
  
  console.warn('FetchText destructured props:', { url, asText, isHtml, fallback, errorMessage });
  
  // Extract asset path from URL (remove /file/ prefix)
  const assetPath = url;
  
  // Use Zustand asset store - get current asset state
  const asset = useAssetStore((state) => state.assets[assetPath] || null);
  
  // Memoized fetch function to prevent infinite loops
  const doFetch = useCallback(() => {
    if (!assetPath) return;
    
    const store = useAssetStore.getState();
    const currentAsset = store.assets[assetPath];
    
    // Check if we should fetch (first time or needs refresh)
    if (!currentAsset || store.shouldRefetch(assetPath)) {
      store.fetchAsset(assetPath);
    }
  }, [assetPath]);

  // Fetch asset using Zustand store
  useEffect(() => {
    doFetch();
  }, [doFetch]);

  // Get current state from asset store
  const loading = asset?.status === 'loading' || !asset;
  const error = asset?.status === 'error' ? asset.error : null;
  const content = asset?.content;

  // Helper function to decode HTML entities
  const decodeHtmlEntities = (text) => {
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    return textArea.value;
  };

  // Helper function to render content
  const renderContent = (content, extraStyle = {}) => {
    console.log('renderContent called with:', { content, asText, isHtml, extraStyle });
    
    if (asText) {
      console.log('Rendering as text (Fragment)');
      // Render as pure text (Fragment)
      return <>{content}</>;
    } else if (isHtml) {
      console.log('Rendering as HTML, original content:', content);
      // Decode HTML entities before rendering as HTML
      const decodedContent = decodeHtmlEntities(content);
      console.log('Decoded content:', decodedContent);
      // Render as HTML using dangerouslySetInnerHTML (like Vue's v-html)
      return (
        <div 
          className={className} 
          style={{ ...style, ...extraStyle }} 
          dangerouslySetInnerHTML={{ __html: decodedContent }}
          {...props}
        />
      );
    } else {
      console.log('Rendering as text (span)');
      // Render as span with text content
      return (
        <span 
          className={className} 
          style={{ ...style, ...extraStyle }} 
          {...props}
        >
          {content}
        </span>
      );
    }
  };

  // Render loading state
  if (loading) {
    return renderContent(fallback, { opacity: 0.6 });
  }

  // Render error state
  if (error) {
    if (asText) {
      // For asText mode, we still need some way to show it's an error
      // but we can't use styling, so we'll add error indication to the text
      return <>{`${errorMessage} (${error})`}</>;
    } else if (isHtml) {
      // For HTML mode, use a div with error styling
      return (
        <div 
          className={className} 
          style={{ 
            ...style, 
            color: '#dc3545', 
            fontStyle: 'italic' 
          }} 
          title={`Error: ${error}`}
          {...props}
        >
          {errorMessage}
        </div>
      );
    } else {
      // For text mode, use a span with error styling
      return (
        <span 
          className={className} 
          style={{ 
            ...style, 
            color: '#dc3545', 
            fontStyle: 'italic' 
          }} 
          title={`Error: ${error}`}
          {...props}
        >
          {errorMessage}
        </span>
      );
    }
  }

  // Extract text content based on content type
  let textContent = '';
  if (content) {
    if (content.type === 'text' || content.type === 'json') {
      textContent = content.data || '';
    } else {
      // For non-text content types, show an error
      if (asText) {
        return <>{`${errorMessage} (Not text content: ${content.type})`}</>;
      } else if (isHtml) {
        return (
          <div 
            className={className} 
            style={{ 
              ...style, 
              color: '#dc3545', 
              fontStyle: 'italic' 
            }} 
            title={`Error: Content type ${content.type} is not text`}
            {...props}
          >
            {errorMessage}
          </div>
        );
      } else {
        return (
          <span 
            className={className} 
            style={{ 
              ...style, 
              color: '#dc3545', 
              fontStyle: 'italic' 
            }} 
            title={`Error: Content type ${content.type} is not text`}
            {...props}
          >
            {errorMessage}
          </span>
        );
      }
    }
  }

  // Render the fetched text
  return renderContent(textContent);
}

export default FetchText;
