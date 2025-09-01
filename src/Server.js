import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// Server configuration store
export const useServerStore = create(
  immer((set, get) => ({
    // Server URL configuration
    serverUrl: process.env.NODE_ENV === 'development' ? 'https://wwf194.myqnapcloud.com:10001' : '',
    
    // Set server URL
    setServerUrl: (url) => {
      set((state) => {
        state.serverUrl = url;
      });
    },
    
    // Get current server URL
    getServerUrl: () => {
      return get().serverUrl;
    },
    
    // Get full URL by combining server URL with path
    getFullUrl: (path) => {
      const state = get();
      // console.log('🔍 getFullUrl:', state.serverUrl, path);
      
      // Defensive check: ensure path is a string
      if (typeof path !== 'string') {
        console.error('🚨 getFullUrl received non-string path:', path, typeof path);
        console.trace();
        return '';
      }
      
      // Ensure path starts with / for proper URL construction
      const pathNormalized = path.startsWith('/') ? path : `/${path}`;
      const fullUrl = `${state.serverUrl}${pathNormalized}`;
      // console.log('🔍 getFullUrl:', fullUrl);
      return fullUrl;
    },
    
    // Development server configurations (presets)
    presets: {
      development: 'https://wwf194.myqnapcloud.com:10001',
      local: 'http://localhost:10203',
      production: '', // Empty string means use relative URLs
    },
    
    // Set server URL using preset
    setPreset: (presetName) => {
      const state = get();
      if (state.presets[presetName] !== undefined) {
        state.setServerUrl(state.presets[presetName]);
      }
    },
    
    // Get available presets
    getPresets: () => {
      return get().presets;
    },
  }))
);


