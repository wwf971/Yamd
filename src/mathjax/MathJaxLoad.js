
// loadMathJax() --call--> initMathJaxNoScan()
  // set window.MathJax before load MathJax .js script
    // ready() => {initMathJaxNoScan}
  // loadMathJaxScript // load MathJax .js script

// MathJaxStore.js: a zustand store that helps avoid multiple simultaneous MathJax initialization
import { useMathJaxStore } from './MathJaxStore.js';


// initialize MathJax without triggering a DOM scan and replace
const initMathJaxNoScan = () => {
  /*
  // when MathJax is ready, ready() will be called.
  // if call defaultRead() in this ready() callback function, MathJax will scan the entire document.
    // this is not always desired.
  // sometimes the document is not fully loaded yet, when MathJax is ready
  */
  console.log('🔍 Available MathJax startup methods:', Object.keys(window.MathJax.startup));
  // try manual initialization step by step with error handling
  console.log('🔧 Initializing MathJax manually without document scanning...');
  try {
    // Since tex2svgPromise isn't available after manual steps, 
    // we need to run defaultReady() but prevent document rendering
    console.log('🔄 Running defaultReady() with document render disabled...');
    
    // Store original document render functions
    const originalRender = window.MathJax.startup.document?.render;
    const originalUpdateDocument = window.MathJax.startup.document?.updateDocument;
    
    // Temporarily override document operations to prevent DOM scanning
    if (window.MathJax.startup.document) {
      window.MathJax.startup.document.render = () => {
        console.log('🚫 Document render() call blocked');
      };
      window.MathJax.startup.document.updateDocument = () => {
        console.log('🚫 Document updateDocument() call blocked');
      };
    }
    
    // Run defaultReady to initialize all APIs
    window.MathJax.startup.defaultReady();
    
    // Restore original functions for future use if needed
    if (window.MathJax.startup.document) {
      if (originalRender) {
        window.MathJax.startup.document.render = originalRender;
      }
      if (originalUpdateDocument) {
        window.MathJax.startup.document.updateDocument = originalUpdateDocument;
      }
    }
    
    console.log('✅ defaultReady() completed with document operations blocked');
  
    return true;
  } catch (initError) {
    console.error('❌ Protected defaultReady() failed:', initError);
    // Final fallback - just run defaultReady normally
    console.log('🔄 Final fallback to normal defaultReady()...');
    try {
      window.MathJax.startup.defaultReady();
      return true;
    } catch (fallbackError) {
      console.error('❌ Even fallback defaultReady() failed:', fallbackError);
      return false;
    }
  }
};

// Initialize MathJax when it already exists on window
const initializeMathJax = async () => {
  console.log("🔧 Initializing existing MathJax...");
  
  // Check if MathJax is ready
  if (window.MathJax.startup && window.MathJax.startup.document) {
    console.log("🔧 MathJax startup already initialized, running initMathJaxNoScan...");
    const success = initMathJaxNoScan();
    if (success) {
      console.log("✅ MathJax initialization completed");
      // Update store state immediately
      useMathJaxStore.getState().setMathJaxReady(true);
      return Promise.resolve();
    } else {
      throw new Error("MathJax initialization failed");
    }
  } else {
    // MathJax exists but startup is not ready yet
    console.log("🔧 MathJax startup not ready, waiting...");
    return new Promise((resolve, reject) => {
      const checkReady = () => {
        if (window.MathJax.startup && window.MathJax.startup.document) {
          const success = initMathJaxNoScan();
          if (success) {
            console.log("✅ MathJax initialization completed after waiting");
            // Update store state immediately
            useMathJaxStore.getState().setMathJaxReady(true);
            resolve();
          } else {
            reject(new Error("MathJax initialization failed"));
          }
        } else {
          setTimeout(checkReady, 100);
        }
      };
      checkReady();
    });
  }
};

export const loadMathJax = () => {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }
  
  // Get current state from Zustand store
  const store = useMathJaxStore.getState();
  store.logMathJaxState();
  
  if (store.isMathJaxReady) {
    console.log("✅ MathJax already ready according to store");
    return Promise.resolve();
  }
  
  if (store.isMathJaxError) {
    console.log("❌ MathJax in error state according to store");
    return Promise.reject(new Error('MathJax is in error state'));
  }
  
  // Check if initialization is already in progress
  if (store.mathJaxInitializationPromise) {
    console.log("⏳ MathJax initialization already in progress - returning existing promise");
    return store.mathJaxInitializationPromise;
  }

  // Create new initialization promise
  const initPromise = new Promise((resolve, reject) => {
    console.log("🔧 Starting new MathJax initialization...");
    
    const store = useMathJaxStore.getState();
    
    // Check if MathJax is already loaded at window level
    if (typeof window.MathJax !== 'undefined') {
      console.log("✅ MathJax already exists on window, initializing...");
      // MathJax exists but may not be properly initialized
      // Run the initialization process to ensure it's ready
      initializeMathJax().then(() => {
        console.log("✅ MathJax initialization completed, updating store state");
        store.setMathJaxReady(true);
        resolve();
      }).catch((error) => {
        console.error('❌ Failed to initialize existing MathJax:', error);
        store.setMathJaxError(true, 'Failed to initialize existing MathJax');
        reject(error);
      });
      return;
    }

    // Check if script is already in the DOM
    const existingScript = document.getElementById('MathJax-script');
    if (existingScript) {
      console.log("⏳ MathJax script already in DOM, waiting for load...");
      // Script exists, wait for it to load or resolve immediately if ready
      if (typeof window.MathJax !== 'undefined') {
        store.setMathJaxReady(true);
        resolve();
      } else {
        existingScript.onload = () => {
          console.log("✅ Existing MathJax script loaded");
          useMathJaxStore.getState().setMathJaxReady(true);
          resolve();
        };
        existingScript.onerror = (error) => {
          console.error("❌ Existing MathJax script failed to load:", error);
          useMathJaxStore.getState().setMathJaxError(true, error.message);
          reject(error);
        };
      }
      return;
    }

    // Configure MathJax before loading
    console.log("🔧 Configuring MathJax...");
    window.MathJax = {
      tex: {
        inlineMath: [['\\(', '\\)']],
        displayMath: [['\\[', '\\]']],
        processEscapes: true,
        processEnvironments: true,
        packages: {'[+]': ['ams', 'boldsymbol', 'bm', 'mathtools', 'physics']},
        macros: {
          // Additional macros for better symbol support
          // boldsymbol: ['\\boldsymbol{#1}', 1],
          // bm: ['\\boldsymbol{#1}', 1]
        }
      },
      options: {
        ignoreHtmlClass: 'tex2jax_ignore',
        processHtmlClass: 'tex2jax_process'
      },
      startup: {
        ready: async () => {
          console.log('✅ MathJax startup ready callback called');
          try {
            // wait for 1s
            // await new Promise(resolve => setTimeout(resolve, 1000));

            // window.MathJax.startup.defaultReady();
              // start scanning the entire document, and replace latex with svg

            // enable DOM mutation observer (optional)
            // window.MathJax.startup.document.updateDocument();

            // initialize MathJax without automatic document scanning
            const initSuccess = initMathJaxNoScan();
            
            useMathJaxStore.getState().setMathJaxReady(true);
            console.log('✅ MathJax initialized without automatic scanning - ready for manual control');
            

          } catch (error) {
            console.error('❌ MathJax manual startup failed:', error);
            useMathJaxStore.getState().setMathJaxError(true, error.message);
            reject(error);
          }
        }
      }
    };
    loadMathJaxScript();
  });
  // store the promise to prevent concurrent initializations
  useMathJaxStore.getState().setMathJaxInitializationPromise(initPromise);
  return initPromise;
};

const triggerMathJaxScan = () => {
  // Schedule a delayed initial scan to process any existing LaTeX
  // This ensures React has finished rendering before we scan
  setTimeout(async () => {
    if (window.MathJax && window.MathJax.typesetPromise) {
      console.log('🔄 Performing delayed initial document scan...');
      try {
        await window.MathJax.typesetPromise();
        console.log('✅ Delayed initial document scan completed');
      } catch (scanError) {
        console.warn('⚠️ Delayed initial document scan failed:', scanError);
      }
    }
  }, 2000); // 2 second delay to ensure React has rendered everything
  resolve();
}

const loadMathJaxScript = () => {
  // load MathJax script with full extension support
  console.log("🔧 Loading MathJax script with full extensions...");
  const mathJaxScript = document.createElement('script');
  mathJaxScript.id = 'MathJax-script';
  // use tex-svg-full.js for complete package support including ams, boldsymbol, etc.
  // mathJaxScript.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js';
    // tex2chtml, tex2chtmlPromise
    // tex-chtml.js --> does not support things \boldsymbol
  // mathJaxScript.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
    // tex2svg, tex2svgPromise
  mathJaxScript.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg-full.js';
    // tex2svg, tex2svgPromise + all TeX extensions (ams, boldsymbol, bm, etc.)
  mathJaxScript.async = true;
  mathJaxScript.onload = () => {
    // ccript loaded, startup.ready will handle the rest
    console.log('✅ MathJax script loaded successfully');
  };
  mathJaxScript.onerror = (error) => {
    console.error('❌ Failed to load MathJax script:', error);
    useMathJaxStore.getState().setMathJaxError(true, 'Failed to load MathJax script');
    reject(error);
  };
  document.head.appendChild(mathJaxScript);
}

// export function that uses Zustand store state
export const isMathJaxLoaded = () => {
  return useMathJaxStore.getState().isMathJaxReady;
};

export default loadMathJax;
