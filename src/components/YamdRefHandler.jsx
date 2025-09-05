import React, { useEffect, useRef } from 'react';

/**
 * YamdRefHandler - handles reference navigation with scroll and highlight effects
 * Based on ReferenceHandler.jsx but designed for the Yamd system
 * Supports both asset references and bibliography navigation
 */
const YamdRefHandler = React.memo(({ 
  refState,
  onBackToSource, 
  containerRef 
}) => {
  const elHighlightCurrent = useRef(null);
  
  // return <div>Hello</div>;

  console.log('🔍 YamdRefHandler rendering');
  // Remove highlight from currently highlighted element
  const removeCurrentHighlight = () => {
    if (elHighlightCurrent.current) {
      elHighlightCurrent.current.classList.remove('element-highlighted');
      elHighlightCurrent.current = null;
    }
  };

  // Handle going back to source
  const handleBackToSource = () => {
    // Remove highlight from destination
    removeCurrentHighlight();
    
    // Handle different types of back navigation
    if (refState.type === 'ref' && refState.refSourceId) {
      // For asset references, go back to the ref element
      const refSourceEl = document.getElementById(refState.refSourceId);
      if (refSourceEl) {
        refSourceEl.scrollIntoView({
          behavior: 'auto',
          block: 'center'
        });
        refSourceEl.classList.add('element-highlighted');
        elHighlightCurrent.current = refSourceEl;
      }
    } else if (refState.type === 'bib' && refState.sourceElement) {
      // For bibliography references, go back to the original click element
      refState.sourceElement.scrollIntoView({
        behavior: 'auto',
        block: 'center'
      });
      refState.sourceElement.classList.add('element-highlighted');
      elHighlightCurrent.current = refState.sourceElement;
    }
    
    // Notify parent to hide the handler
    if (onBackToSource) {
      onBackToSource();
    }
  };

  // Effect to handle highlighting the target when it becomes visible or changes
  useEffect(() => {
    console.log('🔍 YamdRefHandler useEffect rendering');
    if (refState.isVisible && refState.targetId) {
      // Remove any previous highlight first
      removeCurrentHighlight();
      
      const targetEl = document.getElementById(refState.targetId);
      if (targetEl) {
        // Scroll to target
        targetEl.scrollIntoView({
          behavior: 'auto',
          block: 'center'
        });
        
        // Add highlight to target element immediately
        if (targetEl && refState.isVisible) { // Double-check we're still visible
          targetEl.classList.add('element-highlighted');
          elHighlightCurrent.current = targetEl;
        }
      }
    } else {
      // Clean up when not visible
      removeCurrentHighlight();
    }
  }, [refState.isVisible, refState.targetId]); // This will run whenever either isVisible or targetId changes

  if (!refState.isVisible) {
    return null;
  }

  return (
    <div style={{
      position: 'absolute',
      right: '0px',
      top: `${refState.clickY}px`,
      padding: '8px 12px',
      backgroundColor: 'rgba(25, 118, 210, 0.6)',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      zIndex: 1000
    }}
    onClick={handleBackToSource}
    >
      Go Back
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for React.memo to prevent unnecessary re-renders
  // Only re-render if refState properties that matter have changed
  return (
    prevProps.refState.isVisible === nextProps.refState.isVisible &&
    prevProps.refState.targetId === nextProps.refState.targetId &&
    prevProps.refState.clickY === nextProps.refState.clickY &&
    prevProps.refState.type === nextProps.refState.type &&
    prevProps.onBackToSource === nextProps.onBackToSource &&
    prevProps.containerRef === nextProps.containerRef
  );
});

export default YamdRefHandler;
