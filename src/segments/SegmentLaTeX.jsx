import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useRenderUtilsContext } from '@/core/RenderUtils.ts';
import { docsState } from '@/core/DocStore.js';
import { LaTeX2Svg } from '@/mathjax/MathJaxConvert.js';
import { useMathJaxStore } from '@/mathjax/MathJaxStore.js';
import { 
  isCursorOnFirstLine, 
  isCursorOnLastLine,
  isCursorAtEnd,
  isCursorAtBeginning,
  getClosestCharIndex,
  setCursorPos,
  getCursorPageX
} from '@/components/TextUtils.js';
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
const SegmentLaTeX = ({ segmentId, parentNodeId, globalInfo }) => {
  // Get render utils from context
  const renderUtils = useRenderUtilsContext();

  const isLogicallyFocused = useRef(false);
  const [isEditing, setIsEditing] = useState(false);
  const editInputRef = useRef(null);
  const svgRef = useRef(null);
  const editorRef = useRef(null);
  const hasInitializedContentRef = useRef(false); // Track if we've set initial content
  const lastFocusTypeRef = useRef(null); // Store focus type for cursor positioning
  const lastCursorPageXRef = useRef(null); // Store cursorPageX for vertical navigation
  
  // Track render versions to handle async MathJax conversions
  const renderCountNextRef = useRef(1); // Next version number to assign
  const latestRenderedCountRef = useRef(0); // Latest successfully rendered version

  // Subscribe to MathJax readiness
  const isMathJaxReady = useMathJaxStore((state) => state.isMathJaxReady);
  
  // Subscribe to segment node data for reactive updates
  const segmentData = renderUtils.useNodeData?.(segmentId);
  
  // Subscribe ONLY to counters to avoid unnecessary re-renders
  const focusCounter = renderUtils.useNodeFocusCounter(segmentId);
  const unfocusCounter = renderUtils.useNodeUnfocusCounter(segmentId);
  const keyboardCounter = renderUtils.useNodeKeyboardCounter(segmentId);
  
  // Backup state for cancel
  const [editBackup, setEditBackup] = useState(null);

  if (!segmentData || segmentData.selfDisplay !== 'latex_inline') {
    return <span className="yamd-error">Invalid LaTeX segment: {segmentId}</span>;
  }

  const { assetId, textRaw } = segmentData;
  // Use reactive asset hook to ensure SVG updates when asset loads
  const asset = assetId && renderUtils.useAsset ? renderUtils.useAsset(assetId) : null;
  
  // Convert LaTeX to SVG if asset exists but htmlContent is missing AND MathJax is ready
  useEffect(() => {
    if (isMathJaxReady && assetId && asset && !asset.htmlContent && textRaw) {
      console.log(`🔧 SegmentLaTeX [${segmentId}] MathJax ready, converting LaTeX...`);
      updateLaTeXSvg(renderUtils, assetId, textRaw);
    }
  }, [isMathJaxReady, assetId, asset?.htmlContent, textRaw, segmentId, renderUtils]);
  
  console.log(`🔄 SegmentLaTeX [${segmentId}] rendering: isEditing=${isEditing}`);

  // Handle unfocus (save and exit edit mode)
  const handleUnfocus = useCallback((saveChanges) => {
    console.log(`🔵 SegmentLaTeX [${segmentId}] handleUnfocus: saveChanges=${saveChanges}`);
    
    // Save content FIRST before any DOM operations
    let savedContent = '';
    if (saveChanges && editInputRef.current) {
      savedContent = editInputRef.current.textContent || '';
      console.log(`💾 SegmentLaTeX [${segmentId}] saving: "${savedContent}"`);
      
      // Update segment data
      renderUtils.updateNodeData?.(segmentId, (draft) => {
        draft.textRaw = savedContent;
        draft.textOriginal = savedContent;
      });
    }
    
    // Mark as not focused
    isLogicallyFocused.current = false;
    
    // Exit edit mode
    setIsEditing(false);
  }, [segmentId, renderUtils]);

  // Recompute LaTeX SVG from current input
  const recomputeLaTeXSvg = useCallback(async () => {
    if (!editInputRef.current || !assetId) return;
    
    const newLatex = editInputRef.current.textContent || '';
    console.log(`🔧 SegmentLaTeX [${segmentId}] recomputing SVG for: "${newLatex}"`);
    
    // 1. Update segment data immediately
    renderUtils.updateNodeData?.(segmentId, (draft) => {
      draft.textRaw = newLatex;
      draft.textOriginal = newLatex;
    });
    
    // 2. Attempt to re-render LaTeX with version tracking
    if (!isMathJaxReady) {
      console.log(`⚠️ SegmentLaTeX [${segmentId}] MathJax not ready, skipping render`);
      return;
    }
    
    const renderVersion = renderCountNextRef.current;
    renderCountNextRef.current += 1;
    
    console.log(`🔧 SegmentLaTeX [${segmentId}] attempting render v${renderVersion}`);
    
    try {
      const htmlString = await LaTeX2Svg(newLatex, assetId);
      
      if (!htmlString) {
        console.warn(`❌ SegmentLaTeX [${segmentId}] render v${renderVersion} failed: null result`);
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
        console.log(`✅ SegmentLaTeX [${segmentId}] render v${renderVersion} succeeded, updating asset`);
        
        renderUtils.updateAsset?.(assetId, (asset) => {
          asset.latexContent = newLatex;
          asset.htmlContent = svgContent;
        });
        
        latestRenderedCountRef.current = renderVersion;
      } else {
        console.log(`⏭️ SegmentLaTeX [${segmentId}] render v${renderVersion} succeeded but outdated (latest: v${latestRenderedCountRef.current})`);
      }
      
    } catch (error) {
      console.error(`❌ SegmentLaTeX [${segmentId}] render v${renderVersion} failed:`, error);
    }
  }, [segmentId, assetId, isMathJaxReady, renderUtils]);

  // Handle input changes - update data and re-render LaTeX
  const handleInput = async () => {
    await recomputeLaTeXSvg();
  };

  // Cancel edit (restore backup)
  const cancelEdit = () => {
    console.log(`❌ SegmentLaTeX [${segmentId}] canceling edit`);
    if (editBackup && editInputRef.current) {
      editInputRef.current.textContent = editBackup.textRaw;
    }
    handleUnfocus(false);
  };

  // Handle unfocus requests (from clicking other segments)
  useEffect(() => {
    // Skip if counter is 0 (initial state)
    if (unfocusCounter === 0) return;
    
    // Fetch the full state non-reactively to get the type
    const state = renderUtils.getNodeStateById?.(segmentId);
    if (!state?.unfocus) return;
    
    const { type } = state.unfocus;
    
    console.log(`🔕 SegmentLaTeX [${segmentId}] received unfocus:`, { counter: unfocusCounter, type, isEditing });
    
    // Exit edit mode and mark as not focused (always call handleUnfocus, let it handle the state)
    handleUnfocus(true); // Save changes
    
  }, [unfocusCounter, segmentId, handleUnfocus, renderUtils]);
  // Note: isEditing removed from deps to avoid re-processing when exiting edit mode
  
  // Handle keyboard events forwarded from YamdDoc
  // This is a fallback for when keyboard events reach YamdDoc (shouldn't happen normally
  // because edit input stops propagation, but needed for consistency)
  useEffect(() => {
    // Skip if counter is 0 (initial state) or not editing
    if (keyboardCounter === 0 || !isEditing) return;
    
    // Skip if not actually focused (prevent handling stale events after unfocus)
    if (!isLogicallyFocused.current) return;
    
    // Fetch the full state non-reactively to get the event
    const state = renderUtils.getNodeStateById?.(segmentId);
    if (!state?.keyboard?.event) return;
    
    const event = state.keyboard.event;
    
    console.log(`⌨️ SegmentLaTeX [${segmentId}] received keyboard event (fallback):`, event);
    
    // Handle the keyboard event with source='root' to indicate it's forwarded
    handleKeyDown(event, 'root');
    
  }, [keyboardCounter, segmentId, renderUtils]);
  
  // Handle focus requests
  useEffect(() => {
    // Skip if counter is 0 (initial state)
    if (focusCounter === 0) return;
    
    // Fetch the full state non-reactively to get the type
    const state = renderUtils.getNodeStateById?.(segmentId);
    if (!state?.focus) return;
    
    const { type, cursorPageX } = state.focus;
    
    console.log(`🎯 SegmentLaTeX [${segmentId}] received focus:`, { counter: focusCounter, type, cursorPageX });
    
    // Check if this is a navigation focus (fromLeft, fromRight, fromUp, fromDown)
    const isNavigationFocus = ['fromLeft', 'fromRight', 'fromUp', 'fromDown'].includes(type);
    
    if (isNavigationFocus || type === 'mouseClick') {
      // Enter edit mode
      if (!isEditing) {
        console.log(`✏️ SegmentLaTeX [${segmentId}] entering edit mode from ${type}`);
        
        // Report to YamdDoc that this segment is now focused
        renderUtils.setCurrentSegmentId?.(segmentId);
        
        // Store focus type and cursorPageX for cursor positioning
        lastFocusTypeRef.current = type;
        lastCursorPageXRef.current = cursorPageX;
        
        setIsEditing(true);
        
        // Mark as focused
        isLogicallyFocused.current = true;
        
        // Store backup for cancel
        setEditBackup({
          textRaw: segmentData.textRaw || ''
        });
      }
    }
    
  }, [focusCounter, segmentId, renderUtils]);

  // Handle focusing the input when entering edit mode
  useEffect(() => {
    console.log(`🔧 SegmentLaTeX [${segmentId}] focus effect running: isEditing=${isEditing}, hasInitialized=${hasInitializedContentRef.current}`);
    
    if (!isEditing) {
      hasInitializedContentRef.current = false; // Reset when exiting edit mode
      return;
    }
    
    // Only run setup when first entering edit mode
    // avoid cursor/selection reset
    if (hasInitializedContentRef.current) {
      console.log(`⏭️ SegmentLaTeX [${segmentId}] skipping focus - already initialized`);
      return;
    }
    
    // Set initial content
    if (editInputRef.current) {
      editInputRef.current.textContent = textRaw;
      hasInitializedContentRef.current = true;
    }
    
    // Use requestAnimationFrame for better timing after DOM updates
    requestAnimationFrame(() => {
      if (editInputRef.current) {
        console.log(`🎯 SegmentLaTeX [${segmentId}] attempting to focus edit input...`);
        
        const focusType = lastFocusTypeRef.current;
        const cursorPageX = lastCursorPageXRef.current;
        
        // Position cursor based on how we entered edit mode
        if (focusType === 'fromUp' && cursorPageX !== undefined) {
          // Coming from above - position cursor based on horizontal coordinate
          console.log(`🎯 SegmentLaTeX [${segmentId}] positioning cursor from above at pageX=${cursorPageX}`);
          const closestPos = getClosestCharIndex(editInputRef.current, cursorPageX, 'forward');
          setCursorPos(editInputRef.current, closestPos);
        } else if (focusType === 'fromDown' && cursorPageX !== undefined) {
          // Coming from below - position cursor based on horizontal coordinate
          console.log(`🎯 SegmentLaTeX [${segmentId}] positioning cursor from below at pageX=${cursorPageX}`);
          const closestPos = getClosestCharIndex(editInputRef.current, cursorPageX, 'backward');
          setCursorPos(editInputRef.current, closestPos);
        } else {
          // Default: select all text for other entry types (fromLeft, fromRight, mouseClick)
          console.log(`🎯 SegmentLaTeX [${segmentId}] selecting all text (focus type: ${focusType})`);
          const range = document.createRange();
          range.selectNodeContents(editInputRef.current);
          const selection = window.getSelection();
          selection.removeAllRanges();
          // important: this might make focus lost
          selection.addRange(range);
        }
        
        // Focus AFTER setting selection/cursor (selection might cause blur)
        editInputRef.current.focus({ preventScroll: true });
        
        console.log(`🎯 SegmentLaTeX [${segmentId}] after focus(), activeElement:`, document.activeElement);
        console.log(`🎯 SegmentLaTeX [${segmentId}] editInputRef.current:`, editInputRef.current);
        console.log(`🎯 SegmentLaTeX [${segmentId}] are they same?`, document.activeElement === editInputRef.current);
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
    });
  }, [isEditing, textRaw, segmentId]);

  // Handle blur (only save if still marked as focused)
  const handleBlur = (e) => {
    // Only call handleUnfocus if we're still marked as focused
    if (isLogicallyFocused.current) {
      console.log(`🔵 SegmentLaTeX [${segmentId}] handleBlur: isFocused=true, calling handleUnfocus(true)`);
      handleUnfocus(true);
    } else {
      console.log(`⚪ SegmentLaTeX [${segmentId}] handleBlur: isFocused=false, skipping`);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e, source = 'direct') => {
    if (!parentNodeId) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      
      // Save and exit edit mode
      handleUnfocus(true);
      
      // Check if this is the last segment
      const parentNode = renderUtils.getNodeDataById?.(parentNodeId);
      const segments = parentNode?.segments || [];
      const segmentIndex = segments.indexOf(segmentId);
      const isLastSegment = segmentIndex === segments.length - 1;
      
      if (isLastSegment) {
        console.log(`↩️ SegmentLaTeX [${segmentId}] Enter pressed (last segment), creating new pseudo segment to right`);
        // Request parent to create a new empty text segment to the right
        renderUtils.triggerChildCreate?.(parentNodeId, segmentId, 'toRight', true); // isPseudo=true
      } else {
        console.log(`↩️ SegmentLaTeX [${segmentId}] Enter pressed (not last), focusing next segment`);
        // Just focus on the next segment
        renderUtils.triggerUnfocus?.(parentNodeId, segmentId, 'right');
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    } else if (e.key === 'ArrowLeft') {
      // Always prevent YamdDoc from seeing this event
      e.stopPropagation();
      
      const selection = window.getSelection();
      
      // If text is selected: collapse selection and stay in edit mode
      if (!selection.isCollapsed) {
        e.preventDefault();
        selection.collapseToStart();
        return;
      }
      
      // If cursor at beginning: exit to previous segment
      if (isCursorAtBeginning(editInputRef.current)) {
        e.preventDefault();
        
        // Save content first
        if (editInputRef.current) {
          const savedContent = editInputRef.current.textContent || '';
          renderUtils.updateNodeData?.(segmentId, (draft) => {
            draft.textRaw = savedContent;
            draft.textOriginal = savedContent;
          });
        }
        
        // Mark as not focused
        isLogicallyFocused.current = false;
        
        console.log(`⬅️ SegmentLaTeX [${segmentId}] triggering unfocus: left`);
        renderUtils.triggerUnfocus?.(parentNodeId, segmentId, 'left');
        return;
      }
      
      // Otherwise: let browser move cursor left naturally (no preventDefault)
    } else if (e.key === 'ArrowRight') {
      // Always prevent YamdDoc from seeing this event
      e.stopPropagation();
      
      const selection = window.getSelection();
      
      // If text is selected: collapse selection and stay in edit mode
      if (!selection.isCollapsed) {
        e.preventDefault();
        selection.collapseToEnd();
        return;
      }
      
      // If cursor at end: exit to next segment
      if (isCursorAtEnd(editInputRef.current)) {
        e.preventDefault();
        
        // Save content first
        if (editInputRef.current) {
          const savedContent = editInputRef.current.textContent || '';
          renderUtils.updateNodeData?.(segmentId, (draft) => {
            draft.textRaw = savedContent;
            draft.textOriginal = savedContent;
          });
        }
        
        // Mark as not focused
        isLogicallyFocused.current = false;
        
        console.log(`➡️ SegmentLaTeX [${segmentId}] triggering unfocus: right`);
        renderUtils.triggerUnfocus?.(parentNodeId, segmentId, 'right');
        return;
      }
      
      // Otherwise: let browser move cursor right naturally (no preventDefault)

    } else if (e.key === 'ArrowUp') {
      // Always prevent YamdDoc from seeing this event
      e.stopPropagation();
      
      const selection = window.getSelection();
      if (!editInputRef.current || !selection.rangeCount) return;
      
      // If text is selected: collapse to start but stay in edit mode
      if (!selection.isCollapsed) {
        e.preventDefault();
        selection.collapseToStart();
        return;
      }
      
      // If cursor on first line OR at beginning (for single-line inputs): exit to previous node
      const isOnFirstLine = isCursorOnFirstLine(editInputRef.current);
      const isAtBeginning = isCursorAtBeginning(editInputRef.current);
      
      console.log(`🔍 SegmentLaTeX [${segmentId}] ArrowUp check: isOnFirstLine=${isOnFirstLine}, isAtBeginning=${isAtBeginning}`);
      
      if (isOnFirstLine || isAtBeginning) {
        e.preventDefault();
        
        console.log(`🔔 SegmentLaTeX [${segmentId}] ArrowUp at beginning/first line, triggering unfocus`);
        
        // Save content first
        if (editInputRef.current) {
          const savedContent = editInputRef.current.textContent || '';
          renderUtils.updateNodeData?.(segmentId, (draft) => {
            draft.textRaw = savedContent;
            draft.textOriginal = savedContent;
          });
        }
        
        // Mark as not focused
        isLogicallyFocused.current = false;
        
        // Get cursor X position for vertical navigation
        const cursorPageX = getCursorPageX(editInputRef.current);
        console.log(`⬆️ SegmentLaTeX [${segmentId}] triggering unfocus: up, cursorPageX=${cursorPageX}`);
        renderUtils.triggerUnfocus?.(parentNodeId, segmentId, 'up', { cursorPageX });
        return;
      }
      
      // Otherwise: let browser move cursor up naturally (no preventDefault)
    } else if (e.key === 'ArrowDown') {
      // Always prevent YamdDoc from seeing this event
      e.stopPropagation();
      
      const selection = window.getSelection();
      if (!editInputRef.current || !selection.rangeCount) return;
      
      // If text is selected: collapse to end but stay in edit mode
      if (!selection.isCollapsed) {
        e.preventDefault();
        selection.collapseToEnd();
        return;
      }
      
      // If cursor on last line OR at end (for single-line inputs): exit to next node
      const isOnLastLine = isCursorOnLastLine(editInputRef.current);
      const isAtEnd = isCursorAtEnd(editInputRef.current);
      
      console.log(`🔍 SegmentLaTeX [${segmentId}] ArrowDown check: isOnLastLine=${isOnLastLine}, isAtEnd=${isAtEnd}`);
      
      if (isOnLastLine || isAtEnd) {
        e.preventDefault();
        
        console.log(`🔔 SegmentLaTeX [${segmentId}] ArrowDown at end/last line, triggering unfocus`);
        
        // Save content first
        if (editInputRef.current) {
          const savedContent = editInputRef.current.textContent || '';
          renderUtils.updateNodeData?.(segmentId, (draft) => {
            draft.textRaw = savedContent;
            draft.textOriginal = savedContent;
          });
        }
        
        // Mark as not focused
        isLogicallyFocused.current = false;
        
        // Get cursor X position for vertical navigation
        const cursorPageX = getCursorPageX(editInputRef.current);
        console.log(`⬇️ SegmentLaTeX [${segmentId}] triggering unfocus: down, cursorPageX=${cursorPageX}`);
        renderUtils.triggerUnfocus?.(parentNodeId, segmentId, 'down', { cursorPageX });
        return;
      }
      
      // Otherwise: let browser move cursor down naturally (no preventDefault)
    }
  };

  // Handle click to enter edit mode
  const handleClick = (e) => {
    console.log(`🖱️ SegmentLaTeX [${segmentId}] handleClick: isLogicallyFocused.current=${isLogicallyFocused.current}, isEditing=${isEditing}`);
    
    // Don't trigger focus if already focused (check using ref, not state to avoid stale closure)
    if (isLogicallyFocused.current) {
      console.log(`⚠️ SegmentLaTeX [${segmentId}] already focused, ignoring click`);
      return;
    }
    
    e.preventDefault();
    
    // Report to parent that this segment is now focused
    renderUtils.setCurrentSegmentId?.(segmentId);
    
    const docId = globalInfo?.docId;
    docsState.triggerFocus(docId, segmentId, 'mouseClick');
  };

  // YamdDoc (contentEditable=true)
  // └── Container span (contentEditable=false)  ← Isolated!
  //       ├── SVG span (contentEditable=false)
  //       └── Editor span
  //             └── Edit input (contentEditable=true)  ← Only this is editable

  // Render edit mode
  if (isEditing) {
    return (
      <span className="yamd-latex-segment-container" contentEditable={false}>
        {/* Display the SVG in its original place */}
        {asset?.htmlContent ? (
          <span 
            ref={svgRef}
            className="yamd-latex-inline yamd-latex-converted"
            dangerouslySetInnerHTML={{ __html: asset.htmlContent }}
            contentEditable={false}
            style={{ userSelect: 'none' }}
          />
        ) : (
          <span ref={svgRef} className="yamd-latex-inline yamd-latex-raw" contentEditable={false}>
            ${textRaw}$
          </span>
        )}
        
        {/* Floating editor above */}
        <span ref={editorRef} className="yamd-latex-editor">
          <span className="yamd-latex-editor-triangle"></span>
          <div
            ref={editInputRef}
            className="yamd-latex-editor-input"
            contentEditable={true}
            suppressContentEditableWarning
            tabIndex={-1}
            onInput={handleInput}
            onKeyDown={(e) => {
              console.log(`🎯 SegmentLaTeX edit input onKeyDown fired:`, e.key, `activeElement:`, document.activeElement);
              handleKeyDown(e, 'direct');
            }}
            onFocus={() => {
              console.log(`✅ SegmentLaTeX edit input gained focus`);
            }}
            onBlur={() => {
              const ae = document.activeElement;
              console.log(`❌ SegmentLaTeX edit input lost focus, new activeElement:`, ae?.tagName, ae?.className);
            }}
          />
        </span>
      </span>
    );
  }

  // Render display mode
  // Wrap in contentEditable={false} to prevent parent's contentEditable from affecting this
  return (
    <span 
      contentEditable={false}
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
