import React from 'react';
import { useAssetStore } from '@/asset/Asset.js';
import { useProjectStore } from './ProjectStore.js';
import DocumentContent from './DocumentContent.jsx';
import ReferenceHandler from './components/ReferenceHandler.jsx';
import { loadMathJax } from '@/mathjax/MathJaxLoad.js';
import { setupInlineMathJax, renderMathJax } from '@/mathjax/MathJaxInline.js';
import BackToHome from '@/navi/BackToHome.jsx';
import './Document.css';

/**
 * DocumentRenderer Component
 * Main component for rendering parsed project documents
 * 
 * Props:
 * - projectData: object - The processed project data ready for rendering
 * - projectMetadata: object - The project metadata (optional, for displaying project type)
 */
function DocumentRenderer({ projectData, projectMetadata }) {
  console.log('🔍 DocumentRenderer called with projectData:', projectData);
  
  // projectData is required
  if (!projectData) {
    console.error('❌ DocumentRenderer: projectData is undefined!');
    return (
      <div className="doc-content">
        <div className="error-container">
          <h3>Missing Required Data</h3>
          <p>projectData must be provided</p>
        </div>
      </div>
    );
  }

  if (!projectData.projectDataParsed) {
    console.error('❌ DocumentRenderer: projectData.projectDataParsed is undefined!', projectData);
    return (
      <div className="doc-content">
        <div className="error-container">
          <h3>Invalid Project Data</h3>
          <p>Project data is missing parsed structure</p>
        </div>
      </div>
    );
  }

  // load MathJax on component mount
  React.useEffect(() => {
    console.error("loading MathJax");
    // const success = setupInlineMathJax();
    loadMathJax().catch(err => {
      console.error('Failed to load MathJax dynamically:', err);
      console.log('Trying inline MathJax setup as fallback...');
      
      // Try inline setup as fallback
      // const success = setupInlineMathJax();
      // if (!success) {
      //   console.warn('MathJax not available. Consider adding <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"></script> to your HTML.');
      // }
    });
  }, []);

  // Trigger MathJax rendering for inline math in titles (if needed)
  React.useEffect(() => {
    if (projectData && projectData.projectDataParsed) {
      console.log('🔍 DocumentRenderer mounted with project data');
      
      // Only render inline math in titles and other text elements that need DOM processing
      // Block LaTeX is now handled via SVG generation in the ProjectStore
      const renderInlineMath = async () => {
        try {
          // Wait for React to finish renders
          await new Promise(resolve => requestAnimationFrame(resolve));
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Check for inline math in titles and text elements
          const elementsWithInlineMath = Array.from(document.querySelectorAll('[data-mathjax="true"], .contains-inline-math')).filter(el => 
            el.innerHTML && el.innerHTML.includes('\\(')
          );
          
          if (elementsWithInlineMath.length > 0) {
            console.log('🔍 Found inline math elements:', elementsWithInlineMath.length);
            console.log('⚠️ MathJax rendering disabled due to DOM conflicts - inline math will show as raw text');
            // await renderMathJax(); // Disabled due to MathJax DOM conflicts
          } else {
            console.log('ℹ️ No inline math elements found');
          }
        } catch (error) {
          console.error('❌ Inline math rendering error:', error);
        }
      };
      
      renderInlineMath();
    }
  }, [projectData]);

  // Check if we have the required data structure
  if (!projectData.projectDataParsed.rootId) {
    console.error('❌ DocumentRenderer: projectData.projectDataParsed.rootId is undefined!', projectData.projectDataParsed);
    return (
      <div className="doc-content">
        <div className="error-container">
          <h3>Invalid Project Data</h3>
          <p>Project data is missing rootId</p>
        </div>
      </div>
    );
  }

  // Render the document
  return (
    <div className="doc-content" style={{ position: 'relative', maxWidth: '800px' }}>
              <div style={{display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px', marginTop: '8px'}}>
        <BackToHome />
        {projectMetadata?.type && (
          <span className="project-type-button">
            {projectMetadata.type}
          </span>
        )}
      </div>

      <ReferenceHandler>
        <DocumentContent 
          projectData={projectData}
          nodeId={projectData?.projectDataParsed?.rootId}
          isRoot={false}
        />
      </ReferenceHandler>
    </div>
  );
}

export default DocumentRenderer;

