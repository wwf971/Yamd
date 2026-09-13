import { makeAutoObservable, observable, runInAction } from 'mobx';

// MathJax loading and tex -> svg conversion for MathInlineSeg.
//
// Everything here is operational state, never document data: the svg html is
// derived deterministically from the latex source, so it must not enter the
// doc store or the edit history. Components observe mathJaxState and
// re-render when the readiness flag or a cached svg changes.
//
// Two load-time requirements, learned in the jotai version of this project:
//
// - The script must be the full build (tex-svg-full.js). The plain tex-svg.js
//   build misses TeX extension packages, so commands such as \leqslant and
//   \geqslant render as errors instead of glyphs.
// - MathJax must be initialized without its automatic document scan. The
//   default startup scans the whole page and rewrites latex text nodes in
//   place. React owns that DOM; a rewrite breaks reconciliation. Conversion
//   must only happen through the tex2svgPromise API.

const URL_MATHJAX_SCRIPT = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg-full.js';

export type SvgRenderState = {
  // outerHTML of the mjx-container element. The container is kept (instead of
  // extracting the bare <svg>) because it carries the vertical-align style
  // that aligns the math baseline with the surrounding text.
  svgHtml: string;
  isError: boolean;
  message: string;
};

class MathJaxState {
  isReady = false;
  isError = false;
  message = '';
  // svg cache keyed by latex source. Shared by all MathInlineSeg instances,
  // so the same formula converts once.
  svgStateByTex = observable.map<string, SvgRenderState>();

  constructor() {
    makeAutoObservable(this);
  }
}

export const mathJaxState = new MathJaxState();

let promiseLoadMathJax: Promise<void> | null = null;
const texSetConverting = new Set<string>();

export function loadMathJax() {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }
  if (promiseLoadMathJax) {
    return promiseLoadMathJax;
  }
  promiseLoadMathJax = new Promise<void>((resolve, reject) => {
    const windowMathJax = window as any;
    if (windowMathJax.MathJax?.tex2svgPromise) {
      runInAction(() => {
        mathJaxState.isReady = true;
      });
      resolve();
      return;
    }
    // The config object must exist on window before the script loads.
    windowMathJax.MathJax = {
      tex: {
        inlineMath: [['\\(', '\\)']],
        displayMath: [['\\[', '\\]']],
        processEscapes: true,
        processEnvironments: true,
        packages: { '[+]': ['ams', 'boldsymbol', 'bm', 'mathtools', 'physics'] },
      },
      options: {
        // Assistive MathML would add hidden text content inside the svg
        // container. The segment DOM must stay free of stray text nodes,
        // because selection offsets are read from segment textContent.
        enableAssistiveMml: false,
      },
      svg: {
        // Each svg carries its own glyph paths, so the html stays valid when
        // rendered through dangerouslySetInnerHTML in any order.
        fontCache: 'local',
      },
      startup: {
        // No automatic page typeset. Conversion is API-only.
        typeset: false,
        ready: () => {
          try {
            initMathJaxNoScan(windowMathJax.MathJax);
            runInAction(() => {
              mathJaxState.isReady = true;
            });
            resolve();
          } catch (error) {
            runInAction(() => {
              mathJaxState.isError = true;
              mathJaxState.message = String(error);
            });
            reject(error);
          }
        },
      },
    };
    const scriptEl = document.createElement('script');
    scriptEl.id = 'MathJax-script';
    scriptEl.src = URL_MATHJAX_SCRIPT;
    scriptEl.async = true;
    scriptEl.onerror = () => {
      runInAction(() => {
        mathJaxState.isError = true;
        mathJaxState.message = 'Failed to load MathJax script.';
      });
      reject(new Error('Failed to load MathJax script.'));
    };
    document.head.appendChild(scriptEl);
  });
  return promiseLoadMathJax;
}

// defaultReady() initializes the conversion APIs (tex2svgPromise), but the
// startup document it creates can still scan and rewrite the page. Blocking
// render/updateDocument during defaultReady guarantees no DOM scan even if a
// MathJax version ignores the typeset:false option.
function initMathJaxNoScan(mathJax: any) {
  const startup = mathJax?.startup;
  if (!startup) {
    throw new Error('MathJax startup missing.');
  }
  const documentMathJax = startup.document;
  const renderOriginal = documentMathJax?.render;
  const updateOriginal = documentMathJax?.updateDocument;
  if (documentMathJax) {
    documentMathJax.render = () => undefined;
    documentMathJax.updateDocument = () => undefined;
  }
  try {
    startup.defaultReady();
  } finally {
    if (documentMathJax) {
      if (renderOriginal) documentMathJax.render = renderOriginal;
      if (updateOriginal) documentMathJax.updateDocument = updateOriginal;
    }
  }
}

// Start (at most once per tex) the async conversion for a latex source.
// Components call this from an effect and observe svgStateByTex for the
// result. Safe to call before MathJax is loaded.
export function ensureSvgForTex(tex: string) {
  const texSafe = String(tex || '');
  if (!texSafe || mathJaxState.svgStateByTex.has(texSafe) || texSetConverting.has(texSafe)) {
    return;
  }
  texSetConverting.add(texSafe);
  void loadMathJax()
    .then(() => convertTexToSvg(texSafe))
    .then((svgState) => {
      runInAction(() => {
        mathJaxState.svgStateByTex.set(texSafe, svgState);
      });
    })
    .catch((error) => {
      runInAction(() => {
        mathJaxState.svgStateByTex.set(texSafe, {
          svgHtml: '',
          isError: true,
          message: String(error),
        });
      });
    })
    .finally(() => {
      texSetConverting.delete(texSafe);
    });
}

async function convertTexToSvg(tex: string): Promise<SvgRenderState> {
  const mathJax = (window as any).MathJax;
  if (!mathJax?.tex2svgPromise) {
    return { svgHtml: '', isError: true, message: 'MathJax tex2svgPromise not available.' };
  }
  mathJax.texReset?.();
  // display: false renders inline (text style) math, matching the inline
  // segment role of this component.
  const containerEl = await mathJax.tex2svgPromise(tex, { display: false });
  // An unknown command does not throw; MathJax renders an merror node inside
  // the svg. Keep the svg (it shows the error visibly) and flag the state so
  // the segment can add error styling and a message tooltip.
  const errorEl = containerEl.querySelector('[data-mjx-error]');
  return {
    svgHtml: String(containerEl.outerHTML || ''),
    isError: Boolean(errorEl),
    message: errorEl ? String(errorEl.getAttribute('data-mjx-error') || 'LaTeX error') : '',
  };
}
