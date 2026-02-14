import React, { useRef, useImperativeHandle, forwardRef, useEffect, useState, useCallback } from 'react';
import { useRenderUtilsContext } from '@/core/RenderUtils.ts';
import { getMoveUpTargetId, getMoveDownTargetId } from '@/core/EditUtils.js';
import { getClosestCharIndex, setCursorPos, setCursorToBegin, setCursorToEnd } from '@/components/TextUtils.js';
import './NodeCustomBox.css';

/**
 * Example custom node component - renders a box with custom styling
 * This demonstrates how to create custom node types for Yamd
 * 
 * Must be a forwardRef component that exposes calcBulletYPos method
 * 
 * @param {string} nodeId - The node ID
 * @param {object} nodeData - The node data from flattened structure
 * @param {object} parentInfo - Parent context information
 * @param {object} globalInfo - Global context with helper methods
 */
// Custom hook that skips effect on initial mount
function useUpdateEffect(effect, deps) {
  const isFirst = useRef(true);
  
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    return effect();
  }, deps);
}

const NodeCustomBox = forwardRef(({ nodeId, nodeData, nodeState, parentInfo, globalInfo }, ref) => {
  const boxRef = useRef(null);
  const headerRef = useRef(null);
  const titleRef = useRef(null);
  const contentRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  
  // Get render utils from context
  const renderUtils = useRenderUtilsContext();
  
  // Subscribe to keyboard counter to receive forwarded events from YamdDoc
  const keyboardCounter = renderUtils.useNodeKeyboardCounter?.(nodeId) || 0;
  
  const textRaw = nodeData.textRaw ?? '';
  const children = nodeData.children || [];
  
  // Expose calcBulletYPos method for bullet positioning
  useImperativeHandle(ref, () => ({
    calcBulletYPos: (containerClassName) => {
      if (!boxRef.current || !headerRef.current) {
        return { code: -1, message: 'Refs not ready', data: null };
      }
      
      try {
        const bulletContainer = boxRef.current.closest(containerClassName);
        if (!bulletContainer) {
          return { code: -1, message: `Container ${containerClassName} not found`, data: null };
        }
        
        const headerRect = headerRef.current.getBoundingClientRect();
        const titleRect = titleRef.current?.getBoundingClientRect?.();
        const containerRect = bulletContainer.getBoundingClientRect();
        
        const targetRect = titleRect || headerRect;
        // Center bullet with the title text
        const bulletYPos = (targetRect.top - containerRect.top) + (targetRect.height / 2);
        
        return { code: 0, message: 'Success', data: bulletYPos };
      } catch (error) {
        return { code: -1, message: error.message, data: null };
      }
    }
  }), []);

  const handleProgramaticFocus = useCallback((state) => {
    if (!state?.focus) return;
    if (state.focus.counter <= state.focus.counterProcessed) return;

    setIsFocused(true);
    renderUtils.cancelCurrentSegId?.();
    renderUtils.setCurrentSegId?.(nodeId);
    requestAnimationFrame(() => {
      titleRef.current?.focus?.();
      const { type, cursorPageX } = state.focus;
      if (type === 'fromLeft') {
        setCursorToBegin(titleRef.current);
        return;
      }
      if (type === 'fromRight') {
        setCursorToEnd(titleRef.current);
        return;
      }
      if (type === 'fromUp' || type === 'arrowDown' || type === 'arrowUpFromFirstChild') {
        // Coming from above: position cursor at closest horizontal position
        if (cursorPageX !== undefined) {
          const closestPos = getClosestCharIndex(titleRef.current, cursorPageX, 'backward');
          setCursorPos(titleRef.current, closestPos);
        } else {
          setCursorToBegin(titleRef.current);
        }
        return;
      }
      if (type === 'fromDown' || type === 'arrowUp') {
        // Coming from below: position cursor at closest horizontal position
        if (cursorPageX !== undefined) {
          const closestPos = getClosestCharIndex(titleRef.current, cursorPageX, 'forward');
          setCursorPos(titleRef.current, closestPos);
        } else {
          setCursorToEnd(titleRef.current);
        }
        return;
      }
      setCursorToBegin(titleRef.current);
    });

    renderUtils.markFocusProcessed?.(nodeId);
  }, [nodeId, renderUtils]);

  const handleProgramaticUnfocus = useCallback((state) => {
    console.log('CustomBox handleProgramaticUnfocus called, state:', state?.unfocus);
    if (!state?.unfocus) return;
    if (state.unfocus.counter <= state.unfocus.counterProcessed) return;

    const { type, cursorPageX } = state.unfocus;
    console.log('CustomBox unfocus type:', type, 'cursorPageX:', cursorPageX);
    setIsFocused(false);
    renderUtils.markUnfocusProcessed?.(nodeId);

    if (type === 'up') {
      const upTargetId = getMoveUpTargetId(nodeId, renderUtils.getNodeDataById);
      console.log('CustomBox upTargetId:', upTargetId);
      if (upTargetId) {
        renderUtils.triggerFocus(upTargetId, 'arrowUp', { cursorPageX });
      } else {
        renderUtils.triggerFocus(nodeId, 'fromLeft');
      }
    }

    if (type === 'down') {
      const downTargetId = getMoveDownTargetId(nodeId, renderUtils.getNodeDataById);
      console.log('CustomBox downTargetId:', downTargetId);
      if (downTargetId) {
        renderUtils.triggerFocus(downTargetId, 'arrowDown', { cursorPageX });
      } else {
        renderUtils.triggerFocus(nodeId, 'fromRight');
      }
    }
  }, [nodeId, renderUtils]);

  useEffect(() => {
    handleProgramaticFocus(nodeState);
  }, [nodeState?.focus?.counter, handleProgramaticFocus]);

  useEffect(() => {
    handleProgramaticUnfocus(nodeState);
  }, [nodeState?.unfocus?.counter, handleProgramaticUnfocus]);

  const getBoxCenterPageX = () => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return rect.left + rect.width / 2 + window.scrollX;
  };

  const handleKeyDown = useCallback((event) => {
    if (!renderUtils.isEditable) return;
    
    console.log('CustomBox handleKeyDown', event.key);
    
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const cursorPageX = getBoxCenterPageX();
      console.log('CustomBox triggering unfocus UP, cursorPageX:', cursorPageX);
      renderUtils.triggerUnfocus(nodeId, nodeId, 'up', { cursorPageX });
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const cursorPageX = getBoxCenterPageX();
      console.log('CustomBox triggering unfocus DOWN, cursorPageX:', cursorPageX);
      renderUtils.triggerUnfocus(nodeId, nodeId, 'down', { cursorPageX });
      return;
    }
  }, [nodeId, renderUtils]);

  const handleMouseDown = (event) => {
    if (!renderUtils.isEditable) return;
    console.log('CustomBox handleMouseDown, target:', event.target.className || event.target.tagName);
    
    // If click is inside content area (children), let child segments handle it
    const clickedOnContent = contentRef.current && contentRef.current.contains(event.target);
    if (clickedOnContent) {
      console.log('CustomBox: click on child content, letting it handle');
      return;
    }
    
    event.stopPropagation();
    
    // Always set focused and current segment
    setIsFocused(true);
    renderUtils.setCurrentSegId?.(nodeId);
    
    // If click is not on title, focus the title
    const clickedOnTitle = titleRef.current && (event.target === titleRef.current || titleRef.current.contains(event.target));
    if (!clickedOnTitle) {
      requestAnimationFrame(() => {
        titleRef.current?.focus?.();
      });
    }
  };

  const handleTitleFocus = () => {
    if (!renderUtils.isEditable) return;
    console.log('CustomBox handleTitleFocus, nodeId:', nodeId);
    // Note: setCurrentSegId is already called in handleTitleMouseDown
    // This handler is kept for cases when focus comes from keyboard or programmatic focus
    setIsFocused(true);
    renderUtils.setCurrentSegId?.(nodeId);
  };

  const handleTitleBlur = () => {
    setIsFocused(false);
  };

  // Handle keyboard events forwarded from YamdDoc (skip on initial mount and duplicates)
  useUpdateEffect(() => {
    console.log('CustomBox useUpdateEffect triggered, keyboardCounter:', keyboardCounter);
    
    // Get node data to check last processed counter
    const data = renderUtils.getNodeDataById?.(nodeId);
    const lastProcessedKeyboardCounter = data?.lastProcessedKeyboardCounter || 0;
    
    console.log('CustomBox lastProcessed:', lastProcessedKeyboardCounter, 'current:', keyboardCounter);
    
    // Skip if we've already processed this counter (persists across remounts)
    if (keyboardCounter === lastProcessedKeyboardCounter) {
      console.log('CustomBox skipping duplicate counter');
      return;
    }
    
    const state = renderUtils.getNodeStateById?.(nodeId);
    console.log('CustomBox state:', state?.keyboard);
    if (!state?.keyboard?.event) {
      console.log('CustomBox no keyboard event in state');
      return;
    }
    
    const { event } = state.keyboard;
    
    console.log('CustomBox received keyboard event:', event.key);
    
    // Update last processed counter in atom (persists across remounts)
    renderUtils.updateNodeData(nodeId, (draft) => {
      draft.lastProcessedKeyboardCounter = keyboardCounter;
    });
    
    // Call handleKeyDown with the forwarded event
    handleKeyDown(event);
    
  }, [keyboardCounter, nodeId, renderUtils, handleKeyDown]);
  
  return (
    <div
      ref={boxRef}
      className={`yamd-custom-box${isFocused ? ' yamd-custom-box-focused' : ''}`}
      onMouseDown={handleMouseDown}
    >
      <div
        ref={headerRef}
        className="yamd-custom-box-header"
      >
        <span
          ref={titleRef}
          className="yamd-custom-box-title"
          contentEditable={renderUtils.isEditable ? true : undefined}
          suppressContentEditableWarning={true}
          spellCheck={false}
          onMouseDown={handleMouseDown}
          onFocus={handleTitleFocus}
          onBlur={handleTitleBlur}
        >
          {textRaw}
        </span>
      </div>
      
      {children.length > 0 && (
        <div ref={contentRef} className="yamd-custom-box-content">
          {renderUtils.renderChildNodes({
            childIds: children,
            shouldAddIndent: true,
            parentInfo: {
              childDisplay: 'ul',
              childClass: 'yamd-custom-box-item'
            },
            globalInfo: globalInfo,
            firstChildRef: null
          })}
        </div>
      )}
    </div>
  );
});

NodeCustomBox.displayName = 'NodeCustomBox';

export default NodeCustomBox;
