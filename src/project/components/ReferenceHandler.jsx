import React, { useEffect, useRef, useState } from 'react';

/**
  refSource: the link itself
  refTarget: the element the link points to
 */
function ReferenceHandler({ children, onRefClick }) {
  const containerRef = useRef(null);
  const [refTargetInfo, setRefTargetInfo] = useState({
    isVisible: false,
    refSourceEl: null,
    targetRef: null,
    clickY: 0
  });
  const elHighlightCurrent = useRef(null);

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
    
    if (refTargetInfo.refSourceEl) {
      refTargetInfo.refSourceEl.scrollIntoView({
        behavior: 'auto',
        block: 'center'
      });
      // Add highlight to source element
      refTargetInfo.refSourceEl.classList.add('element-highlighted');
      elHighlightCurrent.current = refTargetInfo.refSourceEl;
    }
    setRefTargetInfo({ isVisible: false, refSourceEl: null, targetRef: null, clickY: 0 });
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const handleClick = (event) => {
      // console.log('🔍 ReferenceHandler click detected:', event.target);
      const refSourceEl = event.target.closest('a[data-ref-target]');
      // console.log('🔍 Found ref target:', target);
      if (!refSourceEl) {
        console.warn('🔍 No ref target found, ignoring click');
        return;
      }

      event.preventDefault();
      // console.log('🔍 Processing reference click for:', target.getAttribute('data-ref-target'));
      
      const refTargetId = refSourceEl.getAttribute('data-ref-target');
      const refTargetEl = document.getElementById(refTargetId);
      
      if (refTargetEl) {
        // Remove highlight from any previously highlighted element
        removeCurrentHighlight();
        
        // scroll to target with center positioning
        refTargetEl.scrollIntoView({
          behavior: 'auto',
          block: 'center'
        });
        
        // add highlight to target element
        refTargetEl.classList.add('element-highlighted');
        elHighlightCurrent.current = refTargetEl;

        // calculate position next to the DESTINATION element (where we scrolled to)
        setTimeout(() => {
          const destRect = refTargetEl.getBoundingClientRect();
          const containerRect = containerRef.current.getBoundingClientRect();
          
          // Position relative to the container, next to the destination
          const relativeY = destRect.top - containerRect.top + (destRect.height / 2);
          
          console.log('🔍 Position calc for destination:', {
            destTop: destRect.top,
            containerTop: containerRect.top,
            destHeight: destRect.height,
            relativeY: relativeY
          });
          
          setRefTargetInfo({
            isVisible: true,
            refSourceEl: refSourceEl,
            targetRef: refTargetEl,
            clickY: relativeY
          });
        }, 50); // Small delay to let scroll complete
      }
    };

    const container = containerRef.current;
    container.addEventListener('click', handleClick);

    return () => {
      container.removeEventListener('click', handleClick);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {children}
      
      {/* Reference Navigation Panel - positioned inside the container */}
      {refTargetInfo.isVisible && (
        <div style={{
          position: 'absolute',
          right: '0px',
          // transform: 'translateY(50%)',
          top: `${refTargetInfo.clickY}px`,
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
      )}
    </div>
  );
}

export default ReferenceHandler;
