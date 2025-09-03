import React from 'react';
import YamdTimeline from './components/YamdTimeline.jsx';
import { LIST_INDENT } from './YamdRenderSettings.js';

/**
 * Component for rendering children nodes based on childDisplay style from parentInfo
 * @param {Array} childIds - Array of child node IDs
 * @param {function} getNodeDataById - Function to get node data by ID
 * @param {object} parentInfo - Parent context information containing childDisplay and childClass
 * @param {React.Component} YamdNodeComponent - YamdNode component passed to avoid circular dependency
 * @param {boolean} shouldAddIndent - Whether to add indentation to children (controlled by parent component type)
 */
  const YamdChildrenNodes = ({ 
    childIds, 
    getNodeDataById, 
    getAssetById,
    parentInfo = null,
    YamdNodeComponent,
    shouldAddIndent = false,
    globalInfo = null
  }) => {
  // render children based on parentInfo.childDisplay
  if (!childIds || childIds.length === 0) return null;

  const childDisplay = parentInfo?.childDisplay || 'pl';
  const childClass = parentInfo?.childClass;
  
  // Helper to join multiple class names
  const joinClassNames = (classNames) => {
    if (Array.isArray(classNames)) {
      return classNames.join(' ');
    }
    return classNames || '';
  };
  
  // common list renderer. using divs instead of ul/ol/li
  // supports multiple containerClassName and itemClassName
  const renderChildList = (containerClassName, itemClassName, defaultChildClass = 'yamd-list-content') => (
    <div className={joinClassNames(containerClassName)}>
      {childIds.map((childId, index) => (
        <div key={childId} className={joinClassNames(itemClassName)}>
          <YamdNodeComponent 
            nodeId={childId} 
            getNodeDataById={getNodeDataById} 
            getAssetById={getAssetById}
            parentInfo={{ 
              ...parentInfo, 
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
    paddingLeft: shouldAddIndent ? LIST_INDENT.childIndent : '0px',
    width: '100%'
  });

  switch (childDisplay) {
    case 'unordered-list':
    case 'unordered_list':
    case 'ul':
      return (
        <div style={getContainerStyle()} >
          {renderChildList(['yamd-list', 'yamd-ulist'], ['yamd-list-item', 'yamd-full-width'])}
        </div>
      );
      
    case 'ordered-list':
    case 'ordered_list':
    case 'ol':
      return (
        <div style={getContainerStyle()}>
          {renderChildList(['yamd-list', 'yamd-olist'], ['yamd-list-item', 'yamd-full-width'])}
        </div>
      );
      
    case 'plain-list':
    case 'plain_list':
    case 'pl':
      return (
        <div style={getContainerStyle()}>
          {renderChildList(['yamd-list', 'yamd-plist'], ['yamd-list-item', 'yamd-plist-item', 'yamd-full-width'])}
        </div>
      );
      
    case 'paragraph-list':
    case 'paragraphs':
    case 'paragraph':
    case 'p':
      return (
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>
          <div style={{ width: shouldAddIndent ? LIST_INDENT.childIndent : '0px', height: '0px' }} />
          <div className="yamd-paragraphs">
            {childIds.map(childId => (
              <div key={childId} className="yamd-paragraph">
                <YamdNodeComponent 
                  nodeId={childId} 
                  getNodeDataById={getNodeDataById} 
                  getAssetById={getAssetById}
                  parentInfo={{ ...parentInfo, childClass: childClass || 'yamd-paragraph-content' }}
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
          getNodeDataById={getNodeDataById}
          getAssetById={getAssetById}
          parentInfo={{ ...parentInfo, childClass: childClass || 'yamd-timeline-content' }}
        />
      );
      
    default:
      // Default: render as tags
      return (
        <div className="yamd-tags">
          {childIds.map(childId => (
            <YamdNodeComponent 
              key={childId}
              nodeId={childId} 
              getNodeDataById={getNodeDataById} 
              getAssetById={getAssetById}
              parentInfo={{ ...parentInfo, childClass: childClass || 'yamd-tag' }}
              globalInfo={globalInfo}
            />
          ))}
        </div>
      );
  }
};

export default YamdChildrenNodes;
