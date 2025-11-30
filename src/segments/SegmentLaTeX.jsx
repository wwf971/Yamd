import React, { useRef, useState, useEffect } from 'react';
import { useRenderUtilsContext } from '@/core/RenderUtils.ts';
import { docsState } from '@/core/DocStore.js';
import { LaTeX2Svg } from '@/mathjax/MathJaxConvert.js';
import { useMathJaxStore } from '@/mathjax/MathJaxStore.js';
import './SegmentLaTeX.css';

/**
 * Update LaTeX asset with new content
 * Converts LaTeX to SVG and updates the asset's htmlContent
 * @param {object} renderUtils - Render utils context
 * @param {string} assetId - Asset ID to update
 * @param {string} latexContent - New LaTeX content
 * @returns {Promise<boolean>} True if update succeeded, false otherwise
 */
export const updateLaTeXSvg = async (renderUtils, assetId, latexContent) => {
  if (!renderUtils || !assetId || !latexContent) {
    console.warn('updateLaTeXSvg: Missing required parameters');
    return false;
  }

  try {
    console.log(`🔧 Updating LaTeX asset ${assetId}: "${latexContent}"`);
    const htmlString = await LaTeX2Svg(latexContent, assetId);
    
    if (!htmlString) {
      console.warn(`❌ LaTeX conversion failed for asset ${assetId}`);
      return false;
    }
    
    // Extract SVG from MathJax container
    let svgContent = htmlString;
    const svgMatch = htmlString.match(/<svg[^>]*>[\s\S]*?<\/svg>/i);
    if (svgMatch) {
      svgContent = svgMatch[0];
    }
    
    // Update asset using renderUtils
    renderUtils.updateAsset(assetId, (asset) => {
      asset.latexContent = latexContent;
      asset.htmlContent = svgContent;
    });
    
    console.log(`✅ Updated LaTeX asset ${assetId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to update LaTeX asset ${assetId}:`, error);
    return false;
  }
};

/**
 * Segment component for inline LaTeX math
 * Handles $...$ patterns with inline editing support
 * Supports focus/unfocus protocol for navigation between segments
 */
const SegmentLaTeX = ({ segment, segmentId: segmentIdProp, parentNodeId, globalInfo }) => {
  // Get render utils from context
  const renderUtils = useRenderUtilsContext();

  const isFocusedRef = useRef(false);
  const [isEditing, setIsEditing] = useState(false);
  const editInputRef = useRef(null);
  const svgRef = useRef(null);
  const editorRef = useRef(null);
  const hasInitializedContentRef = useRef(false); // Track if we've set initial content
  
  // Track render versions to handle async MathJax conversions
  const renderCountNextRef = useRef(1); // Next version number to assign
  const latestRenderedCountRef = useRef(0); // Latest successfully rendered version

  // Subscribe to MathJax readiness
  const isMathJaxReady = useMathJaxStore((state) => state.isMathJaxReady);

  // Use segmentId from props if provided, otherwise use segment.id
  const effectiveSegmentId = segmentIdProp || segment?.id;
  
  // Subscribe to segment node data for reactive updates
  const segmentData = renderUtils.useNodeData?.(effectiveSegmentId);
  
  // Subscribe to segment node state for focus/edit management
  const segmentState = renderUtils.useNodeState ? renderUtils.useNodeState(effectiveSegmentId) : {};
  
  // Backup state for cancel
  const [editBackup, setEditBackup] = useState(null);

  // Use reactive segment data if available, fallback to prop
  const currentSegment = segmentData || segment;

  if (!currentSegment || currentSegment.selfDisplay !== 'latex_inline') {
    return <span className="yamd-error">Invalid LaTeX segment</span>;
  }

  const { assetId, textRaw } = currentSegment;
  // Use reactive asset hook to ensure SVG updates when asset loads
  const asset = assetId && renderUtils.useAsset ? renderUtils.useAsset(assetId) : null;
  
  // Convert LaTeX to SVG if asset exists but htmlContent is missing AND MathJax is ready
  useEffect(() => {
    if (isMathJaxReady && assetId && asset && !asset.htmlContent && textRaw) {
      console.log(`🔧 SegmentLaTeX [${effectiveSegmentId}] MathJax ready, converting LaTeX...`);
      updateLaTeXSvg(renderUtils, assetId, textRaw);
    }
  }, [isMathJaxReady, assetId, asset?.htmlContent, textRaw, effectiveSegmentId, renderUtils]);
  
  console.log(`🔄 SegmentLaTeX [${effectiveSegmentId}] rendering: isEditing=${isEditing}`);

  // Handle unfocus (save and exit edit mode)
  const handleUnfocus = (saveChanges, shouldBlur) => {
    console.log(`🔵 SegmentLaTeX [${effectiveSegmentId}] handleUnfocus: saveChanges=${saveChanges}, shouldBlur=${shouldBlur}`);
    
    if (saveChanges && editInputRef.current) {
      const newLatex = editInputRef.current.textContent || '';
      console.log(`💾 SegmentLaTeX [${effectiveSegmentId}] saving: "${newLatex}"`);
      
      // Update segment data
      renderUtils.updateNodeData?.(effectiveSegmentId, (draft) => {
        draft.textRaw = newLatex;
        draft.textOriginal = newLatex;
      });
    }
    
    // Mark as not focused
    isFocusedRef.current = false;
    
    // Blur if requested
    if (shouldBlur && editInputRef.current) {
      editInputRef.current.blur();
    }
    
    // Exit edit mode
    setIsEditing(false);
  };

  // Handle input changes - update data and re-render LaTeX
  const handleInput = async () => {
    if (!editInputRef.current || !assetId) return;
    
    const newLatex = editInputRef.current.textContent || '';
    console.log(`📝 SegmentLaTeX [${effectiveSegmentId}] input changed: "${newLatex}"`);
    
    // 1. Update segment data immediately
    renderUtils.updateNodeData?.(effectiveSegmentId, (draft) => {
      draft.textRaw = newLatex;
      draft.textOriginal = newLatex;
    });
    
    // 2. Attempt to re-render LaTeX with version tracking
    if (!isMathJaxReady) {
      console.log(`⚠️ SegmentLaTeX [${effectiveSegmentId}] MathJax not ready, skipping render`);
      return;
    }
    
    const renderVersion = renderCountNextRef.current;
    renderCountNextRef.current += 1;
    
    console.log(`🔧 SegmentLaTeX [${effectiveSegmentId}] attempting render v${renderVersion}`);
    
    try {
      const htmlString = await LaTeX2Svg(newLatex, assetId);
      
      if (!htmlString) {
        console.warn(`❌ SegmentLaTeX [${effectiveSegmentId}] render v${renderVersion} failed: null result`);
        return;
      }
      
      // Extract SVG
      let svgContent = htmlString;
      const svgMatch = htmlString.match(/<svg[^>]*>[\s\S]*?<\/svg>/i);
      if (svgMatch) {
        svgContent = svgMatch[0];
      }
      
      // Only update if this is a newer version than what's currently rendered
      if (renderVersion > latestRenderedCountRef.current) {
        console.log(`✅ SegmentLaTeX [${effectiveSegmentId}] render v${renderVersion} succeeded, updating asset`);
        
        renderUtils.updateAsset?.(assetId, (asset) => {
          asset.latexContent = newLatex;
          asset.htmlContent = svgContent;
        });
        
        latestRenderedCountRef.current = renderVersion;
      } else {
        console.log(`⏭️ SegmentLaTeX [${effectiveSegmentId}] render v${renderVersion} succeeded but outdated (latest: v${latestRenderedCountRef.current})`);
      }
      
    } catch (error) {
      console.error(`❌ SegmentLaTeX [${effectiveSegmentId}] render v${renderVersion} failed:`, error);
    }
  };

  // Cancel edit (restore backup)
  const cancelEdit = () => {
    console.log(`❌ SegmentLaTeX [${effectiveSegmentId}] canceling edit`);
    if (editBackup && editInputRef.current) {
      editInputRef.current.textContent = editBackup.textRaw;
    }
    handleUnfocus(false, true);
  };

  // Handle focus requests
  useEffect(() => {
    if (!segmentState?.focus) return;
    
    const { counter, type } = segmentState.focus;
    
    // Skip if counter is 0 (initial state)
    if (counter === 0) return;
    
    console.log(`🎯 SegmentLaTeX [${effectiveSegmentId}] received focus:`, { counter, type });
    
    // Check if this is a navigation focus (fromLeft, fromRight, fromUp, fromDown)
    const isNavigationFocus = ['fromLeft', 'fromRight', 'fromUp', 'fromDown'].includes(type);
    
    if (isNavigationFocus || type === 'editing') {
      // Enter edit mode
      if (!isEditing) {
        console.log(`✏️ SegmentLaTeX [${effectiveSegmentId}] entering edit mode from ${type}`);
        setIsEditing(true);
        
        // Mark as focused
        isFocusedRef.current = true;
        
        // Store backup for cancel
        setEditBackup({
          textRaw: currentSegment.textRaw || ''
        });
      }
    }
    
  }, [segmentState?.focus?.counter, effectiveSegmentId]);

  // Handle focusing the input when entering edit mode
  useEffect(() => {
    if (!isEditing) {
      hasInitializedContentRef.current = false; // Reset when exiting edit mode
      return;
    }
    
    // Only run setup when first entering edit mode
    // avoid cursor/selection reset
    if (hasInitializedContentRef.current) return;
    
    // Set initial content
    if (editInputRef.current) {
      editInputRef.current.textContent = textRaw;
      hasInitializedContentRef.current = true;
    }
    
    setTimeout(() => {
      if (editInputRef.current) {
        editInputRef.current.focus();
        // Select all text only on initial entry
        const range = document.createRange();
        range.selectNodeContents(editInputRef.current);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
      
      // Position the editor and triangle
      if (svgRef.current && editorRef.current) {
        const svgRect = svgRef.current.getBoundingClientRect();
        const containerRect = svgRef.current.parentElement.getBoundingClientRect();
        
        // Position editor's left edge at SVG's left edge
        const svgLeft = svgRect.left - containerRect.left;
        editorRef.current.style.left = `${svgLeft}px`;
        editorRef.current.style.transform = 'none';
        
        // Position triangle at SVG's horizontal center
        const svgCenterX = svgRect.width / 2;
        const triangle = editorRef.current.querySelector('.yamd-latex-editor-triangle');
        if (triangle) {
          triangle.style.left = `${svgCenterX}px`;
          triangle.style.transform = 'translateX(-50%)';
        }
      }
    }, 10);
  }, [isEditing, textRaw]);

  // Handle blur (only save if still marked as focused)
  const handleBlur = (e) => {
    // Only call handleUnfocus if we're still marked as focused
    if (isFocusedRef.current) {
      console.log(`🔵 SegmentLaTeX [${effectiveSegmentId}] handleBlur: isFocused=true, calling handleUnfocus(true, false)`);
      handleUnfocus(true, false);
    } else {
      console.log(`⚪ SegmentLaTeX [${effectiveSegmentId}] handleBlur: isFocused=false, skipping`);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!parentNodeId) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      handleUnfocus(true, true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    } else if (e.key === 'ArrowLeft') {
      const selection = window.getSelection();
      
      // Only trigger unfocus if there's no selection (collapsed) and cursor is at the beginning
      if (selection.isCollapsed && selection.anchorOffset === 0) {
        e.preventDefault();
        handleUnfocus(true, true);
        console.log(`⬅️ SegmentLaTeX [${effectiveSegmentId}] triggering unfocus: left`);
        renderUtils.triggerUnfocus?.(parentNodeId, effectiveSegmentId, 'left');
      }
      // Otherwise, let the browser handle it (collapse selection or move cursor)
    } else if (e.key === 'ArrowRight') {
      const selection = window.getSelection();
      const textLength = editInputRef.current?.textContent?.length || 0;
      
      // Only trigger unfocus if there's no selection (collapsed) and cursor is at the end
      if (selection.isCollapsed && selection.anchorOffset === textLength) {
        e.preventDefault();
        handleUnfocus(true, true);
        console.log(`➡️ SegmentLaTeX [${effectiveSegmentId}] triggering unfocus: right`);
        renderUtils.triggerUnfocus?.(parentNodeId, effectiveSegmentId, 'right');
      }
      // Otherwise, let the browser handle it (collapse selection or move cursor)
    } else if (e.key === 'ArrowUp') {
      // Check if cursor is on the first visual line
      const selection = window.getSelection();
      if (!editInputRef.current || !selection.rangeCount) return;
      
      const range = selection.getRangeAt(0);
      const cursorRect = range.getBoundingClientRect();
      const containerRect = editInputRef.current.getBoundingClientRect();
      
      // Get container padding
      const computedStyle = window.getComputedStyle(editInputRef.current);
      const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
      
      // Check if cursor Y is close to container top + padding (first visual line)
      const isOnFirstLine = (cursorRect.top - containerRect.top - paddingTop) < 5;
      
      if (isOnFirstLine) {
        e.preventDefault();
        handleUnfocus(true, true);
        
        // Get cursor X position for vertical navigation
        const cursorPageX = cursorRect.left + (cursorRect.width / 2);
        console.log(`⬆️ SegmentLaTeX [${effectiveSegmentId}] triggering unfocus: up, cursorPageX=${cursorPageX}`);
        renderUtils.triggerUnfocus?.(parentNodeId, effectiveSegmentId, 'up', { cursorPageX });
      }
      // Otherwise, let browser handle moving cursor up within the text
    } else if (e.key === 'ArrowDown') {
      // Check if cursor is on the last visual line
      const selection = window.getSelection();
      if (!editInputRef.current || !selection.rangeCount) return;
      
      const range = selection.getRangeAt(0);
      const cursorRect = range.getBoundingClientRect();
      const containerRect = editInputRef.current.getBoundingClientRect();
      
      // Get container padding
      const computedStyle = window.getComputedStyle(editInputRef.current);
      const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
      
      // Check if cursor Y is close to container bottom - padding (last visual line)
      const isOnLastLine = (containerRect.bottom - paddingBottom - cursorRect.bottom) < 5;
      
      if (isOnLastLine) {
        e.preventDefault();
        handleUnfocus(true, true);
        
        // Get cursor X position for vertical navigation
        const cursorPageX = cursorRect.left + (cursorRect.width / 2);
        console.log(`⬇️ SegmentLaTeX [${effectiveSegmentId}] triggering unfocus: down, cursorPageX=${cursorPageX}`);
        renderUtils.triggerUnfocus?.(parentNodeId, effectiveSegmentId, 'down', { cursorPageX });
      }
      // Otherwise, let browser handle moving cursor down within the text
    }
  };

  // Handle click to enter edit mode
  const handleClick = (e) => {
    if (isEditing) return;
    
    e.preventDefault();
    const docId = globalInfo?.docId;
    docsState.triggerFocus(docId, effectiveSegmentId, 'editing');
  };

  // Render edit mode
  if (isEditing) {
    return (
      <span className="yamd-latex-segment-container">
        {/* Display the SVG in its original place */}
        {asset?.htmlContent ? (
          <span 
            ref={svgRef}
            className="yamd-latex-inline yamd-latex-converted"
            dangerouslySetInnerHTML={{ __html: asset.htmlContent }}
          />
        ) : (
          <span ref={svgRef} className="yamd-latex-inline yamd-latex-raw">
            ${textRaw}$
          </span>
        )}
        
        {/* Floating editor above */}
        <span ref={editorRef} className="yamd-latex-editor">
          <span className="yamd-latex-editor-triangle"></span>
          <span
            ref={editInputRef}
            className="yamd-latex-editor-input"
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
          />
        </span>
      </span>
    );
  }

  // Render display mode
  return (
    <span 
      className="yamd-latex-segment-container"
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
    >
      {asset?.htmlContent ? (
        <span 
          className="yamd-latex-inline yamd-latex-converted"
          dangerouslySetInnerHTML={{ __html: asset.htmlContent }}
        />
      ) : (
        <span className="yamd-latex-inline yamd-latex-raw">
          ${textRaw}$
        </span>
      )}
    </span>
  );
};

export default SegmentLaTeX;
