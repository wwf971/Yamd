// MathJax state management using Zustand
// Centralizes MathJax initialization state across the application

import { create } from 'zustand';

export const useMathJaxStore = create((set, get) => ({
  // State
  isMathJaxReady: false,
  isMathJaxError: false,
  mathJaxErrorMessage: null,
  mathJaxInitializationPromise: null,

  // Actions
  setMathJaxReady: (ready = true) => {
    set((state) => {
      const newState = {
        isMathJaxReady: ready,
        isMathJaxError: ready ? false : state.isMathJaxError,
        mathJaxErrorMessage: ready ? null : state.mathJaxErrorMessage
      };
      console.log(`📊 MathJax state updated: ready=${newState.isMathJaxReady}, error=${newState.isMathJaxError}`);
      return newState;
    });
  },

  setMathJaxError: (error = true, message = null) => {
    set((state) => {
      const newState = {
        isMathJaxError: error,
        mathJaxErrorMessage: message,
        isMathJaxReady: error ? false : state.isMathJaxReady
      };
      console.log(`📊 MathJax error state updated: error=${newState.isMathJaxError}, message=${newState.mathJaxErrorMessage}`);
      return newState;
    });
  },

  setMathJaxInitializationPromise: (promise) => {
    set({ mathJaxInitializationPromise: promise });
  },

  resetMathJaxState: () => {
    set({
      isMathJaxReady: false,
      isMathJaxError: false,
      mathJaxErrorMessage: null,
      mathJaxInitializationPromise: null
    });
    console.log('📊 MathJax state reset');
  },

  // Helper methods
  getMathJaxState: () => {
    const state = get();
    return {
      isMathJaxReady: state.isMathJaxReady,
      isMathJaxError: state.isMathJaxError,
      mathJaxErrorMessage: state.mathJaxErrorMessage
    };
  },

  logMathJaxState: () => {
    const state = get();
    console.log('📊 Current MathJax state:', {
      isMathJaxReady: state.isMathJaxReady,
      isMathJaxError: state.isMathJaxError,
      mathJaxErrorMessage: state.mathJaxErrorMessage,
      hasInitializationPromise: !!state.mathJaxInitializationPromise,
      windowMathJaxExists: typeof window !== 'undefined' && !!window.MathJax,
      tex2svgPromiseExists: typeof window !== 'undefined' && !!window.MathJax?.tex2svgPromise
    });
  }
}));

// Helper function to wait for MathJax to be ready
export const waitForMathJax = async (timeout = 10000) => {
  const store = useMathJaxStore.getState();
  
  if (store.isMathJaxReady) {
    return true;
  }
  
  if (store.isMathJaxError) {
    console.warn('⚠️ MathJax is in error state, cannot wait for ready');
    return false;
  }
  
  // If there's an ongoing initialization, wait for it
  if (store.mathJaxInitializationPromise) {
    console.log('⏳ Waiting for ongoing MathJax initialization...');
    try {
      await store.mathJaxInitializationPromise;
      return useMathJaxStore.getState().isMathJaxReady;
    } catch (error) {
      console.error('❌ MathJax initialization failed while waiting:', error);
      return false;
    }
  }
  
  // Wait with timeout
  const startTime = Date.now();
  while (true) {
    const currentState = useMathJaxStore.getState();
    
    if (currentState.isMathJaxReady) {
      console.log('✅ MathJax became ready while waiting');
      return true;
    }
    
    if (currentState.isMathJaxError) {
      console.error('❌ MathJax entered error state while waiting');
      return false;
    }
    
    if ((Date.now() - startTime) >= timeout) {
      console.error('⏰ Timeout waiting for MathJax to become ready');
      return false;
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
};

// Selector helpers for common use cases
export const selectMathJaxReady = (state) => state.isMathJaxReady;
export const selectMathJaxError = (state) => state.isMathJaxError;
export const selectMathJaxErrorMessage = (state) => state.mathJaxErrorMessage;
export const selectMathJaxState = (state) => ({
  isMathJaxReady: state.isMathJaxReady,
  isMathJaxError: state.isMathJaxError,
  mathJaxErrorMessage: state.mathJaxErrorMessage
});

// Function to trigger MathJax re-scanning/typesetting
export const typesetMathJax = async (elements = null) => {
  const store = useMathJaxStore.getState();
  
  // Check if MathJax is ready
  if (!store.isMathJaxReady) {
    console.warn('⚠️ MathJax not ready, cannot typeset');
    return false;
  }
  
  if (store.isMathJaxError) {
    console.warn('⚠️ MathJax in error state, cannot typeset');
    return false;
  }
  
  if (!window.MathJax || !window.MathJax.typesetPromise) {
    console.warn('⚠️ MathJax.typesetPromise not available');
    return false;
  }
  
  try {
    if (!elements || elements.length === 0) {
      // Re-scan entire document
      console.log('🔄 Re-scanning entire document for LaTeX...');
      await window.MathJax.typesetPromise();
      console.log('✅ Document-wide MathJax typeset complete');
    } else {
      // Re-scan specific elements
      console.log(`🔄 Re-scanning ${elements.length} specific elements for LaTeX...`);
      await window.MathJax.typesetPromise(elements);
      console.log('✅ Element-specific MathJax typeset complete');
    }
    return true;
  } catch (error) {
    console.error('❌ MathJax typeset failed:', error);
    return false;
  }
};
