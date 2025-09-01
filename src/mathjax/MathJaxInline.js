/**
 * Simple inline MathJax setup for cases where dynamic loading fails
 * This can be used as a fallback or alternative approach
 */

export const setupInlineMathJax = () => {
  // If MathJax is already available, configure it
  if (typeof window.MathJax !== 'undefined') {
    console.log('MathJax detected, configuring...');
    
    // For MathJax v3
    if (window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise().then(() => {
        console.log('MathJax v3 configured and ready');
      }).catch(err => {
        console.error('MathJax v3 configuration error:', err);
      });
    }
    // For MathJax v2
    else if (window.MathJax.Hub) {
      window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub]);
      console.log('MathJax v2 configured and ready');
    }
    
    return true;
  }
  
  console.warn('MathJax not found. Please include MathJax script in your HTML.');
  return false;
};

// Prevent multiple simultaneous MathJax renders
let mathJaxRenderQueue = Promise.resolve();

// Block LaTeX SVG conversion using Zustand MathJax store
import { useMathJaxStore, waitForMathJax, selectMathJaxState } from './MathJaxStore.js';

// Legacy DOM-based rendering (keep for inline math in titles if needed)
export const renderMathJax = (element = null) => {
  if (typeof window.MathJax === 'undefined') {
    console.warn('MathJax not available for rendering');
    return Promise.resolve();
  }

  // Queue the render to prevent overlapping
  mathJaxRenderQueue = mathJaxRenderQueue.then(async () => {
    try {
      const target = element || document;
      
      if (window.MathJax.typesetPromise) {
        // MathJax v3 - check if element still exists
        if (element && !document.contains(element)) {
          console.log('MathJax target element no longer exists, skipping');
          return;
        }
        
        const elements = element ? [element] : undefined;
        console.log('🔍 MathJax rendering with elements:', elements);
        
        await window.MathJax.typesetPromise(elements);
        console.log('MathJax rendering complete');
      } else if (window.MathJax.Hub) {
        // MathJax v2
        return new Promise((resolve) => {
          window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub, target]);
          window.MathJax.Hub.Queue([resolve]);
        });
      }
    } catch (err) {
      console.error('MathJax rendering error:', err);
    }
  }).catch(err => {
    console.error('MathJax queue error:', err);
  });

  return mathJaxRenderQueue;
};

export default { setupInlineMathJax, renderMathJax };
