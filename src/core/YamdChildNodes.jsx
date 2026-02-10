import React from 'react';
import YamdTimeline from '@/components/NodeTimeline.jsx';
import { LIST_SETTINGS } from '@/config/RenderConfig.js';
import YamdNode from '@/core/YamdNode.jsx';
import { useRenderUtilsContext } from '@/core/RenderUtils.ts';
import { getClosestSegmentForClick } from '@/components/TextUtils.js';

/**
 * Component for rendering children nodes based on childDisplay style from parentInfo
 * @param {Array} childIds - Array of child node IDs
 * @param {object} parentInfo - Parent context information containing childDisplay and childClass
 * @param {boolean} shouldAddIndent - Whether to add indentation to children (controlled by parent component type)
 * @param {object} globalInfo - Global context with getNodeDataById, getAssetById, getRefById, and fetchExternalData methods
 */
const YamdChildNodes = ({ 
  childIds, 
  parentInfo = null,
  shouldAddIndent = false,
  globalInfo = null
}) => {
  // Get render utils from context
  const renderUtils = useRenderUtilsContext();
  const isEditable = renderUtils.isEditable;

  // render children based on parentInfo.childDisplay
  if (!childIds || childIds.length === 0) return null;
  // console.log('🔍 YamdChildNodes rendering childIds:', childIds);
  const childDisplay = parentInfo?.childDisplay || 'pl';
  const childClass = parentInfo?.childClass;
  
  // Helper to join multiple class names
  const joinClassNames = (classNames) => {
    if (Array.isArray(classNames)) {
      return classNames.join(' ');
    }
    return classNames || '';
  };

  // Handle click on child container - focus the child node's rich text
  const handleChildContainerClick = (e, childId) => {
    if (!isEditable) return;
    
    // Check if click landed directly on the container (not on child elements inside it)
    // e.currentTarget is the element the handler is attached to
    // e.target is the actual element that was clicked
    if (e.target !== e.currentTarget) {
      // click falls onto a child element. child element will handle it
      // console.log(`[CLICK EVENT]YamdChildNodes: click on child element of ${childId}, ignoring`);
      return;
    } else {
      // console.log(`[CLICK EVENT]YamdChildNodes: click on container for child ${childId}, focusing with cursor coords`);
      
      // Convert clientX/Y to pageX/Y
      const cursorPageX = e.clientX + window.scrollX;
      const cursorPageY = e.clientY + window.scrollY;
      
      // Trigger focus on the child node with cursor coordinates
      renderUtils.triggerFocus?.(childId, 'parentClick', { cursorPageX, cursorPageY });
    }
  };

  const handleChildGapClick = (e) => {
    if (!isEditable) return;
    
    const targetEl = e.target instanceof Element ? e.target : null;
    if (!targetEl) return;
    
    // If click is inside a child wrapper, let that child handle it
    const clickedChild = targetEl.closest('[data-yamd-child-id]');
    if (clickedChild) return;
    
    const containerEl = e.currentTarget;
    const childEls = Array.from(containerEl.querySelectorAll('[data-yamd-child-id]'));
    if (childEls.length === 0) return;
    
    const { index } = getClosestSegmentForClick(childEls, e.clientX, e.clientY);
    const nearestChildEl = childEls[index];
    const nearestChildId = nearestChildEl?.dataset?.yamdChildId;
    if (!nearestChildId) return;
    
    const cursorPageX = e.clientX + window.scrollX;
    const cursorPageY = e.clientY + window.scrollY;
    renderUtils.triggerFocus?.(nearestChildId, 'parentClick', { cursorPageX, cursorPageY });
  };
  
  // ordered/unordered list renderer. using divs instead of ul/ol/li
  // supports multiple containerClassName and itemClassName
  const renderChildNodes = (containerClassName, itemClassName, defaultChildClass = 'yamd-list-content') => (
    <div className={joinClassNames(containerClassName)}>
      {childIds.map((childId, index) => (
        <div 
          key={childId} 
          className={joinClassNames(itemClassName)}
          data-yamd-child-id={childId}
          onClick={isEditable ? (e) => handleChildContainerClick(e, childId) : undefined}
        >
          <YamdNode
            key={childId}
            nodeId={childId}
            parentInfo={{ 
              childDisplay: childDisplay, // Pass current childDisplay so AddBullet knows to add bullets
              childClass: childClass || defaultChildClass,
              childIndex: index
            }}
            globalInfo={globalInfo}
          />
        </div>
      ))}
    </div>
  );
  
  // Helper to get container style with conditional indentation
  const getContainerStyle = () => ({
    paddingLeft: shouldAddIndent ? LIST_SETTINGS.child_indent_x : '0px',
    width: '100%'
  });

  switch (childDisplay) {
    case 'unordered-list':
    case 'unordered_list':
    case 'ul':
      return (
        <div
          style={getContainerStyle()}
          onClick={isEditable ? handleChildGapClick : undefined}
        >
          {renderChildNodes(['yamd-list', 'yamd-ulist'],
            ['yamd-list-item',
            'yamd-full-width'
          ])}
        </div>
      );
      
    case 'ordered-list':
    case 'ordered_list':
    case 'ol':
      return (
        <div
          style={getContainerStyle()}
          onClick={isEditable ? handleChildGapClick : undefined}
        >
          {renderChildNodes(['yamd-list', 'yamd-olist'],
            [
              'yamd-list-item',
              'yamd-full-width'
            ])}
        </div>
      );
      
    case 'plain-list':
    case 'plain_list':
    case 'pl':
      return (
        <div
          style={getContainerStyle()}
          onClick={isEditable ? handleChildGapClick : undefined}
        >
          {renderChildNodes(['yamd-list', 'yamd-plist'], [
            'yamd-list-item',
            'yamd-plist-item',
            'yamd-full-width'
          ])}
        </div>
      );
      
    case 'paragraph-list':
    case 'paragraphs':
    case 'paragraph':
    case 'p':
      return (
        <div
          style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', maxWidth: '100%'}}
          onClick={isEditable ? handleChildGapClick : undefined}
        >
          <div style={{ width: shouldAddIndent ? LIST_SETTINGS.child_indent_x : '0px', height: '0px' }} />
          <div className="yamd-paragraphs">
            {childIds.map(childId => (
              <div 
                key={childId} 
                className="yamd-paragraph"
                data-yamd-child-id={childId}
                onClick={isEditable ? (e) => handleChildContainerClick(e, childId) : undefined}
              >
                <YamdNode
                  key={childId}
                  nodeId={childId} 
                  parentInfo={{ childDisplay: 'p', childClass: childClass || 'yamd-paragraph-content' }}
                  globalInfo={globalInfo}
                />
              </div>
            ))}
          </div>
        </div>
      );
      
    case 'timeline':
      return (
        <YamdTimeline
          childIds={childIds}
          globalInfo={globalInfo}
          parentInfo={{ ...parentInfo, childClass: childClass || 'yamd-timeline-content' }}
        />
      );
      
    default:
      // Default: render as tags
      return (
        <div
          className="yamd-tags"
          onClick={isEditable ? handleChildGapClick : undefined}
        >
          {childIds.map(childId => (
            <div
              key={childId}
              data-yamd-child-id={childId}
            >
              <YamdNode
                nodeId={childId} 
                parentInfo={{ ...parentInfo, childClass: childClass || 'yamd-tag' }}
                globalInfo={globalInfo}
              />
            </div>
          ))}
        </div>
      );
  }
};

export default YamdChildNodes;
