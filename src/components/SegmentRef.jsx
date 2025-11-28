import React, { useRef, useState, useEffect } from 'react';
import { useRenderUtilsContext } from '@/core/RenderUtils.ts';
import { docsState } from '@/core/DocStore.js';

/**
 * Segment component for asset references (images, videos, latex blocks, etc)
 * Handles \ref{linkText}{linkId} patterns with inline editing support
 */
const SegmentRef = ({ segment, globalInfo }) => {
  // Get render utils from context
  const renderUtils = useRenderUtilsContext();
  
  // Subscribe to segment node data for reactive updates
  const segmentData = renderUtils.useNodeData(segment.id);
  
  // Subscribe to segment node state for focus/edit management
  const segmentState = renderUtils.useNodeState ? renderUtils.useNodeState(segment.id) : {};
  const isEditing = segmentState?.focus?.type === 'editing';
  
  // Refs for editable spans
  const linkTextRef = useRef(null);
  const linkIdRef = useRef(null);
  
  // Backup state for cancel
  const [editBackup, setEditBackup] = useState(null);

  // Use reactive segment data if available, fallback to prop
  const currentSegment = segmentData || segment;

  if (!currentSegment || currentSegment.selfDisplay !== 'ref-asset') {
    return <span className="yamd-error">Invalid reference segment</span>;
  }

  const { id: segmentId, refId, targetId, linkText } = currentSegment;
  
  // Handle entering edit mode
  useEffect(() => {
    if (isEditing && !editBackup) {
      // Store backup when entering edit mode
      setEditBackup({
        linkText: linkText || '',
        targetId: targetId || ''
      });
      
      // Focus the linkText span
      setTimeout(() => {
        if (linkTextRef.current) {
          linkTextRef.current.focus();
          // Select all text
          const range = document.createRange();
          range.selectNodeContents(linkTextRef.current);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }, 0);
    } else if (!isEditing && editBackup) {
      // Clear backup when exiting edit mode
      setEditBackup(null);
    }
  }, [isEditing, editBackup, linkText, targetId]);
  
  // Handle keyboard events in edit mode
  const handleKeyDown = (e, field) => {
    if (!isEditing) return;
    
    if (e.key === 'Enter') {
      e.preventDefault();
      saveChanges();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    } else if (e.key === 'ArrowLeft' && field === 'linkId') {
      // Check if cursor is at the beginning of linkId
      const selection = window.getSelection();
      if (selection.anchorOffset === 0) {
        e.preventDefault();
        linkTextRef.current?.focus();
        // Move cursor to end of linkText
        const range = document.createRange();
        range.selectNodeContents(linkTextRef.current);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } else if (e.key === 'ArrowRight' && field === 'linkText') {
      // Check if cursor is at the end of linkText
      const selection = window.getSelection();
      const textLength = linkTextRef.current?.textContent?.length || 0;
      if (selection.anchorOffset === textLength) {
        e.preventDefault();
        linkIdRef.current?.focus();
        // Move cursor to beginning of linkId
        const range = document.createRange();
        range.setStart(linkIdRef.current.firstChild || linkIdRef.current, 0);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  };
  
  // Save changes to segment node
  const saveChanges = () => {
    const newLinkText = linkTextRef.current?.textContent || '';
    const newTargetId = linkIdRef.current?.textContent || '';
    
    // Update segment node data
    const docId = globalInfo?.docId;
    if (docId && segmentId) {
      renderUtils.updateNodeData(segmentId, (draft) => {
        draft.linkText = newLinkText;
        draft.targetId = newTargetId;
        // Regenerate textRaw from core data
        draft.textRaw = newLinkText 
          ? `\\ref{${newLinkText}}{${newTargetId}}`
          : `\\ref{${newTargetId}}`;
      });
    }
    
    // Exit edit mode
    docsState.triggerFocus(docId, segmentId, 'blur');
  };
  
  // Cancel edit and restore backup
  const cancelEdit = () => {
    if (editBackup) {
      // Restore backup values
      if (linkTextRef.current) {
        linkTextRef.current.textContent = editBackup.linkText;
      }
      if (linkIdRef.current) {
        linkIdRef.current.textContent = editBackup.targetId;
      }
    }
    
    // Exit edit mode
    const docId = globalInfo?.docId;
    docsState.triggerFocus(docId, segmentId, 'blur');
  };
  
  // Handle blur (save changes)
  const handleBlur = (e) => {
    // Check if focus moved to another editable span within this ref
    const relatedTarget = e.relatedTarget;
    if (relatedTarget === linkTextRef.current || relatedTarget === linkIdRef.current) {
      return; // Don't save yet, still editing
    }
    
    // Save changes when blurring out of the ref component
    if (isEditing) {
      saveChanges();
    }
  };
  
  // Handle click to enter edit mode or navigate
  const handleClick = (e) => {
    if (isEditing) {
      return; // Already editing
    }
    
    e.preventDefault();
    
    // TEMPORARY: Always enter edit mode on click for debugging
    const docId = globalInfo?.docId;
    docsState.triggerFocus(docId, segmentId, 'editing');
    
    // TODO: Restore navigation logic after debugging
    // Check if we should enter edit mode (e.g., double-click or Ctrl+click)
    // if (e.detail === 2 || e.ctrlKey || e.metaKey) {
    //   // Enter edit mode
    //   const docId = globalInfo?.docId;
    //   docsState.triggerFocus(docId, segmentId, 'editing');
    // } else if (globalInfo?.onRefClick) {
    //   // Normal click - navigate to target
    //   globalInfo.onRefClick({
    //     refId: refId,
    //     targetId: targetId,
    //     sourceElement: e.target
    //   });
    // }
  };
  
  // Render edit mode
  if (isEditing) {
    return (
      <span className="yamd-ref-editing">
        <span className="yamd-ref-syntax">\ref{'{'}</span>
        <span
          ref={linkTextRef}
          contentEditable
          suppressContentEditableWarning
          className="yamd-ref-editable yamd-ref-linktext"
          onKeyDown={(e) => handleKeyDown(e, 'linkText')}
          onBlur={handleBlur}
        >
          {linkText || ''}
        </span>
        <span className="yamd-ref-syntax">{'}{'}</span>
        <span
          ref={linkIdRef}
          contentEditable
          suppressContentEditableWarning
          className="yamd-ref-editable yamd-ref-linkid"
          onKeyDown={(e) => handleKeyDown(e, 'linkId')}
          onBlur={handleBlur}
        >
          {targetId || ''}
        </span>
        <span className="yamd-ref-syntax">{'}'}</span>
      </span>
    );
  }
  
  // Render display mode
  // Get reference data
  const refData = renderUtils.getRefById(refId);
  if (!refData) {
    // Fallback: display original reference syntax
    return <span className="yamd-ref-fallback">{segment.textRaw}</span>;
  }

  // Auto-generate link text if not provided
  let displayText = linkText;
  if (!displayText || displayText.trim() === '') {
    // Try to find the reference to get the target node
    const ref = renderUtils.getRefById(targetId);
    const targetNode = ref?.nodeId ? renderUtils.getNodeDataById(ref.nodeId) : null;
    
    if (targetNode) {
      if (targetNode.type === 'latex') {
        // For LaTeX nodes, try to get asset info for numbering
        const asset = targetNode.assetId ? renderUtils.getAssetById(targetNode.assetId) : null;
        if (asset && asset.indexOfSameType && !asset.no_index) {
          const captionTitle = asset.captionTitle || 'Eq';
          displayText = `${captionTitle} ${asset.indexOfSameType}`;
        } else {
          displayText = 'Equation';
        }
      } else if (targetNode.type === 'image') {
        displayText = 'Figure';
      } else if (targetNode.type === 'video') {
        displayText = 'Video';
      } else {
        displayText = targetId;
      }
    } else {
      displayText = targetId;
    }
  }

  return (
    <a 
      id={refId}
      href={`#${targetId}`}
      className="yamd-ref-link"
      data-ref-target={targetId}
      data-ref-id={refId}
      title={`Reference to ${targetId} (Double-click to edit)`}
      onClick={handleClick}
    >
      {displayText}
    </a>
  );
};

export default SegmentRef;
