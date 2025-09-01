import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { useServerStore } from '@/Server.js';

// Asset store for managing asset data and state
export const useAssetStore = create(
  immer((set, get) => ({
    // Dictionary to store asset data by path
    assets: {},
    
    // Get asset data by path
    getAsset: (path) => {
      const state = get();
      return state.assets[path] || null;
    },
    
    // Set asset data
    setAsset: (path, assetData) => {
      set((state) => {
        state.assets[path] = {
          ...assetData,
          timeLastFetched: Date.now(),
        };
      });
    },
    
    // Update asset status (loading, error, success)
    updateAssetStatus: (path, status, error = null) => {
      set((state) => {
        if (!state.assets[path]) {
          state.assets[path] = {};
        }
        state.assets[path].status = status;
        state.assets[path].error = error;
        if (status === 'loading') {
          state.assets[path].error = null;
        }
      });
    },
    
    // Set asset content
    setAssetContent: (path, content, contentType) => {
      set((state) => {
        if (!state.assets[path]) {
          state.assets[path] = {};
        }
        state.assets[path].content = content;
        state.assets[path].contentType = contentType;
        state.assets[path].status = 'success';
        state.assets[path].timeLastFetched = Date.now();
      });
    },
    
    // Clear asset data (for refresh)
    clearAsset: (path) => {
      set((state) => {
        delete state.assets[path];
      });
    },
    
    // Clear all assets
    clearAllAssets: () => {
      set((state) => {
        state.assets = {};
      });
    },
    
    // Check if asset should be refetched (based on age or force refresh)
    shouldRefetch: (path, maxAge = 1000 * 60 * 1000) => { // 10 minutes default
      const asset = get().assets[path];
      
      // If no asset exists, fetch it
      if (!asset) return true;
      
      // NEVER refetch assets that have failed with an error unless manually refreshed
      if (asset.status === 'error') {
        console.log(`🚫 Not refetching failed asset: ${path}`);
        return false;
      }
      
      // If currently loading, don't fetch again
      if (asset.status === 'loading') return false;
      
      // If no timestamp, fetch it
      if (!asset.timeLastFetched) return true;
      
      // Check age
      return (Date.now() - asset.timeLastFetched) > maxAge;
    },
    
    // Fetch asset from server
    fetchAsset: async (path) => {
      const state = get();
      
      // Don't fetch if already loading
      const existingAsset = state.assets[path];
      if (existingAsset && existingAsset.status === 'loading') {
        return existingAsset;
      }
      
      try {
        // Update status to loading
        state.updateAssetStatus(path, 'loading');
  
        console.log('📍 Request Information:');
        console.log('Asset Path:', path);


        const fileUrl = `${path}`;
        const getFullUrl = useServerStore.getState().getFullUrl;
        const fullUrl = getFullUrl(fileUrl);
        
        console.log('File URL:', fileUrl);
        console.log('Full URL:', fullUrl);
        
        const response = await fetch(fullUrl);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const responseContentType = response.headers.get('content-type') || '';
        console.log('Content Type:', responseContentType);
        
        let content;
        let contentData;
        
        // Handle different content types
        if (responseContentType.startsWith('image/')) {
          // For images, store the URL and let the img tag handle it
          content = { type: 'image', url: fullUrl };
          contentData = null; // Don't store binary data
        } else if (responseContentType.startsWith('video/')) {
          // For videos, store the URL and let the video tag handle it
          content = { type: 'video', url: fullUrl };
          contentData = null; // Don't store binary data
        } else if (responseContentType.includes('text/html')) {
          // For HTML, cache the content and display in iframe
          contentData = await response.text();
          content = { type: 'html', data: contentData, url: fullUrl };
        } else if (responseContentType.includes('json')) {
          // For JSON, parse and store the data
          const responseJson = await response.json();
          
          // Handle Flask server response format: { is_success: true, data: [...] }
          if (responseJson.is_success === true && responseJson.data) {
            contentData = responseJson.data;
            content = { type: 'json', data: contentData };
            console.log('Content Data:', contentData);
          } else if (responseJson.is_success === false) {
            throw new Error(`Server error: ${responseJson.message || 'Unknown error'}`);
          } else {
            // Direct JSON data (not wrapped by Flask)
            contentData = responseJson;
            content = { type: 'json', data: contentData };
          }
        } else {
          // For other text content, store the text
          contentData = await response.text();
          content = { type: 'text', data: contentData };
        }
        
        // Store the asset data
        state.setAssetContent(path, content, responseContentType);
        
        return {
          is_success: true,
          data: state.assets[path],
          message: 'Asset fetched successfully'
        };
        
      } catch (error) {
        console.error('Error fetching asset:', error);
        state.updateAssetStatus(path, 'error', error.message);
        return {
          is_success: false,
          data: state.assets[path],
          message: error.message
        };
      }
    },
    
    // Refresh asset (force refetch)
    refreshAsset: async (path) => {
      const state = get();
      state.clearAsset(path);
      return await state.fetchAsset(path);
    },
  }))
);
