import React from 'react';
import './Node.css';
import '@/home/SkillTree.css'
import '@/home/Education.css'
import NodeTimeline from './NodeTimeline.jsx';

// Error Boundary Component for Node rendering
export class NodeErrorBoundary extends React.Component {
  // avoid error in children make the entire page crash
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // this method is called when an error is thrown in any child component
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Node rendering error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="node-error-container">
          <h4>Data display error</h4>
          <p>There was an error displaying the data. Please check the source format.</p>
          <details style={{ marginTop: '10px', fontSize: '0.8em', color: '#666' }}>
            <summary>Error details</summary>
            <pre>{this.state.error?.toString()}</pre>
          </details>
        </div>
      );
    }
    // if no error, return the children(slots)
    return this.props.children;
  }
}

import { parseNodeStyle } from './ParseUtils.js';
export { parseNodeStyle } from './ParseUtils.js';

// Unified function to render content based on selfStyle
export const renderBySelfStyle = (key, name, value, selfStyle, childStyle = 'default', selfClass, childClass, valueNum = null, panelDefault = null) => {
  switch (selfStyle) {
    case 'panel':
      return (
        <NodePanelCollapse key={key} name={name} value={value}
          childStyle={childStyle} selfClass={selfClass} panelDefault={panelDefault}
        />
      );
    case 'top-right':
      return (
        <NodeTopRight key={key} name={name} value={value}
          childStyle={childStyle} selfClass={selfClass}
        />
      );
    case 'divider':
      return (
        <DividerNode key={key} name={name} value={value}
          childStyle={childStyle} selfClass={selfClass}
        />
      );
    case 'none':
      // Skip title completely and render only the content according to childStyle
      return <ChildrenRenderer key={key} value={value} childStyle={childStyle} childClass={childClass} />;
    case 'key':
      // Render title and children as siblings, with optional valueNum support
      const children = [];
      let remainingChildren = [];
      
      if (Array.isArray(value)) {
        if (valueNum !== null && valueNum > 0) {
          // Split children: first valueNum become siblings, rest become normal children
          const siblingChildren = value.slice(0, valueNum);
          remainingChildren = value.slice(valueNum);
          
          children.push(...siblingChildren.map((item, itemIndex) => (
            <TagItem key={`${key}-${itemIndex}`} item={item} itemIndex={itemIndex} customClassName={childClass} />
          )));
        } else {
          // Original behavior: all children become siblings
          children.push(...value.map((item, itemIndex) => (
            <TagItem key={`${key}-${itemIndex}`} item={item} itemIndex={itemIndex} customClassName={childClass} />
          )));
        }
      } else if (typeof value === 'string') {
        children.push(
          <TagItem key={`${key}-0`} item={value} itemIndex={0} customClassName={childClass} />
        );
      }
      
      // If valueNum is specified and we have remaining children, create structured layout
      if (valueNum !== null && valueNum > 0 && remainingChildren.length > 0) {
        return (
          <div key={key} className="node-key-with-valuenum">
            {/* Horizontal container for parent + first valueNum children */}
            <div className="node-key-siblings">
              <span className={selfClass || "node-text-default"}>
                {name || '\u00A0'}
              </span>
              {children}
            </div>
            {/* Remaining children as normal children */}
            <div className="node-key-remaining">
              <ChildrenRenderer value={remainingChildren} childStyle={childStyle} childClass={childClass} />
            </div>
          </div>
        );
      } else {
        // Original flat sibling behavior for no valueNum or no remaining children
        const result = [
          <span key={`${key}-title`} className={selfClass || "node-text-bold"}>
            {name || '\u00A0'}
          </span>,
          ...children
        ];
        
        // Add remaining children as normal children if any (fallback case)
        if (remainingChildren.length > 0) {
          result.push(
            <div key={`${key}-remaining`} className="node-subcategory-items">
              <ChildrenRenderer value={remainingChildren} childStyle={childStyle} childClass={childClass} />
            </div>
          );
        }
        
        return result;
      }
    default:
      // Default style
      return (
        <div key={key} className="node-subcategory">
          <span className={selfClass || "node-text-default"}>
            {name || '\u00A0'}
          </span>
          <ChildrenRenderer value={value} childStyle={childStyle} childClass={childClass} />
        </div>
      );
  }
};

// Reusable component for rendering children content based on childStyle
export const ChildrenRenderer = React.memo(({ value, childStyle = 'default', childClass }) => {
  if (!Array.isArray(value)) return null;
  
  if (childStyle === 'ul') {
    return (
      <ul className="node-list">
        {value.map((item, itemIndex) => (
          <ListItem key={itemIndex} item={item} itemIndex={itemIndex} />
        ))}
      </ul>
    );
  } else if (childStyle === 'plain-list') {
    return (
      <ul className="node-plain-list">
        {value.map((item, itemIndex) => (
          <ListItem key={itemIndex} item={item} itemIndex={itemIndex} listStyle="plain" />
        ))}
      </ul>
    );
  } else if (childStyle === 'timeline') {
    return <NodeTimeline data={value} />;
  } else {
    // Default: render as tags
    return (
      <div className="node-subcategory-items">
        {value.map((item, itemIndex) => (
          <TagItem key={itemIndex} item={item} itemIndex={itemIndex} customClassName={childClass} />
        ))}
      </div>
    );
  }
});

// Component for rendering a single list item (string or nested object)
export const ListItem = React.memo(({ item, itemIndex, listStyle = 'default' }) => {
  if (typeof item === 'string') {
    // Check if the string contains style annotations
    const { name, selfClass } = parseNodeStyle(item);
    const listItemClass = listStyle === 'plain' ? 'node-plain-list-item' : 'node-list-item';
    const contentClass = listStyle === 'plain' ? 'node-plain-list-content' : 'node-ul-ol-content';
    return (
      <li className={listItemClass}>
        <span className={selfClass || contentClass}>{name}</span>
      </li>
    );
  } else if (typeof item === 'object' && item !== null) {
    // Handle nested objects within lists - use unified rendering logic
    return Object.entries(item).map(([nestedKey, nestedValue]) => {
      if (typeof nestedKey !== 'string') return null;
      const { name: nestedName, selfStyle, childStyle = 'default', selfClass, childClass, valueNum, panelDefault } = parseNodeStyle(nestedKey);
      
      // Special handling for list context - wrap certain styles in <li>
      const rendered = renderBySelfStyle(
        `${itemIndex}-${nestedKey}`, 
        nestedName, 
        nestedValue, 
        selfStyle, 
        childStyle, 
        selfClass, 
        childClass,
        valueNum,
        panelDefault
      );
      
      // For some selfStyles, we need to wrap in <li> for proper list structure
      if (selfStyle === 'none') {
         const listItemClass = listStyle === 'plain' ? 'node-plain-list-item node-nested-list' : 'node-list-item node-nested-list';
         return (
           <li key={`${itemIndex}-${nestedKey}`} className={listItemClass}>
             {rendered}
           </li>
         );
      } else if (selfStyle === 'key') {
        // key style already returns properly formatted elements for lists
        const listItemClass = listStyle === 'plain' ? 
          'node-plain-list-item' : 'node-list-item';
        return (
          <li key={`${itemIndex}-${nestedKey}`} className={listItemClass}>
            <span className="node-key-value-pair">
              {rendered}
            </span>
          </li>
        );
      } else {
        // default case - wrap in list item with title
        const listItemClass = listStyle === 'plain' ? 'node-plain-list-item' : 'node-list-item';
        const nestedListItemClass = listStyle === 'plain' ? 'node-plain-list-item node-nested-list' : 'node-list-item node-nested-list';
        const contentClass = listStyle === 'plain' ? 'node-plain-list-content' : 'node-ul-ol-content';
        return [
          <li key={`${itemIndex}-${nestedKey}-title`} className={listItemClass}>
            <span className={selfClass || contentClass}>{nestedName || '\u00A0'}</span>
          </li>,
          ...(Array.isArray(nestedValue) && nestedValue.length > 0 ? 
            [<li key={`${itemIndex}-${nestedKey}-content`} className={nestedListItemClass}
              style={{
                marginLeft: childStyle === 'timeline' ? '0px' : '0px',
                marginTop: childStyle === 'timeline' ? '-2px' : '0px'
              }}>
              <ChildrenRenderer value={nestedValue} childStyle={childStyle} childClass={childClass} />
            </li>] : []
          )
        ];
      }
    }).flat().filter(Boolean);
  }
  return null;
});

// Component for rendering tag-style items
export const TagItem = React.memo(({ item, itemIndex, customClassName }) => {
  if (typeof item === 'string') {
    // Check if the string contains style annotations
    const { name, selfClass } = parseNodeStyle(item);
    const className = selfClass || customClassName || 'node-tag';
    return (
      <span className={className}>
        {name}
      </span>
    );
  } else if (typeof item === 'object' && item !== null) {
    // Handle nested objects within tag lists - use unified rendering logic
    return Object.entries(item).map(([nestedKey, nestedValue]) => {
      if (typeof nestedKey !== 'string') return null;
      const { name: nestedName, selfStyle, childStyle = 'default', selfClass, childClass, valueNum, panelDefault } = parseNodeStyle(nestedKey);
      
      // Use unified rendering for most cases
      const rendered = renderBySelfStyle(
        `${itemIndex}-${nestedKey}`, 
        nestedName, 
        nestedValue, 
        selfStyle, 
        childStyle, 
        selfClass, 
        childClass || customClassName,
        valueNum,
        panelDefault
      );
      
      return rendered;
    }).flat().filter(Boolean);
  }
  return null;
});

// Component for rendering divider-style nodes
export const DividerNode = React.memo(({ name, value, childStyle = 'default', selfClass }) => {
  // Defensive check for childStyle
  const safeChildStyle = childStyle || 'default';
  
  return (
    <div className="node-subcategory node-subcategory-divider">
      <div className="node-divider-line">
        <span className={selfClass || "node-divider-text"}>{name}</span>
      </div>
      {Array.isArray(value) && (
        safeChildStyle === 'ul' ? (
          <ul className="node-list">
            {value.map((item, itemIndex) => (
              <ListItem key={itemIndex} item={item} itemIndex={itemIndex} />
            ))}
          </ul>
        ) : safeChildStyle === 'plain-list' ? (
          <ul className="node-plain-list">
            {value.map((item, itemIndex) => (
              <ListItem key={itemIndex} item={item} itemIndex={itemIndex} />
            ))}
          </ul>
        ) : (
          <div className="node-subcategory-items">
            {value.map((item, itemIndex) => (
              <TagItem key={itemIndex} item={item} itemIndex={itemIndex} />
            ))}
          </div>
        )
      )}
    </div>
  );
});

// Component for rendering collapsible panel nodes
export const NodePanelCollapse = React.memo(({ name, value, childStyle = 'default', selfClass, panelDefault }) => {
  // Determine initial expanded state based on panelDefault
  const getInitialExpandedState = () => {
    if (panelDefault === 'collapse') {
      return false;
    } else if (panelDefault === 'expand') {
      return true;
    } else {
      // If panelDefault is invalid or not given, default to expand (true)
      return true;
    }
  };

  const [isExpanded, setIsExpanded] = React.useState(getInitialExpandedState());

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={`node-panel ${selfClass || ''}`}>
      <div className="node-panel-header" onClick={toggleExpanded}>
        <span className="node-panel-title">{name}</span>
        <button className="node-panel-toggle" type="button">
          {isExpanded ? 'hide' : 'show'}
        </button>
      </div>
      {isExpanded && (
        <div className="node-panel-content">
          <ChildrenRenderer value={value} childStyle={childStyle} />
        </div>
      )}
    </div>
  );
});

// Component for rendering top-right positioned nodes
export const NodeTopRight = React.memo(({ name, value, childStyle = 'default', selfClass }) => {
  return (
    <div className="node-top-right-wrapper">
      {/* Parent element positioned at top-right */}
      <div className={`node-top-right-parent ${selfClass || ''}`}>
        {name}
      </div>
      
      {/* Children content in the main area */}
      <div className="node-top-right-content">
        <ChildrenRenderer value={value} childStyle={childStyle} />
      </div>
    </div>
  );
});

// Main Node component for rendering JSON data structures
export const Node = React.memo(({ data, rootStyle = 'default' }) => {
  if (!data) return null;

  // Validate and sanitize data
  const validateData = (dataArray) => {
    if (!Array.isArray(dataArray)) {
      console.warn('Node data is not an array:', dataArray);
      return [];
    }
    return dataArray.filter(item => {
      if (typeof item === 'string') return true;
      if (typeof item === 'object' && item !== null) {
        // Check if it's a valid object structure
        try {
          Object.entries(item);
          return true;
        } catch (error) {
          console.warn('Invalid node object:', item, error);
          return false;
        }
      }
      console.warn('Invalid node type:', typeof item, item);
      return false;
    });
  };

  const validatedData = validateData(data);

  // If root style is 'ul', render as unordered list
  if (rootStyle === 'ul') {
    return (
      <ul className="node-list">
        {validatedData.map((item, index) => {
          try {
            return <ListItem key={index} item={item} itemIndex={index} />;
          } catch (error) {
            console.error('Error rendering list item:', item, error);
            return (
              <li key={index} className="node-list-item" style={{color: 'red', fontStyle: 'italic'}}>
                [Error rendering item]
              </li>
            );
          }
        })}
      </ul>
    );
  }

  // If root style is 'plain-list', render as plain list (no bullets)
  if (rootStyle === 'plain-list') {
    return (
      <ul className="node-plain-list">
        {validatedData.map((item, index) => {
          try {
            return <ListItem key={index} item={item} itemIndex={index} />;
          } catch (error) {
            console.error('Error rendering list item:', item, error);
            return (
              <li key={index} className="node-list-item" style={{color: 'red', fontStyle: 'italic'}}>
                [Error rendering item]
              </li>
            );
          }
        })}
      </ul>
    );
  }

  // Default rendering (tags format)
  return (
    <div className="node-details">
      {validatedData.map((item, index) => {
        if (typeof item === 'string') {
          // Check if the string contains style annotations
          const { name, selfClass } = parseNodeStyle(item);
          return (
            <span key={index} className={selfClass || "node-tag"}>
              {name}
            </span>
          );
        } else if (typeof item === 'object') {
          // Handle nested objects with subcategories
          try {
            return Object.entries(item).map(([key, value]) => {
              if (typeof key !== 'string') {
                console.warn('Invalid key type in node object:', key);
                return null;
              }
              const { name: subcategoryName, selfStyle, childStyle = 'default', childClass, selfClass, valueNum, panelDefault } = parseNodeStyle(key);
            
              // Use unified rendering logic
              return renderBySelfStyle(key, subcategoryName, value, selfStyle, childStyle, selfClass, childClass, valueNum, panelDefault);
            }).filter(Boolean);
          } catch (error) {
            console.error('Error rendering node object:', item, error);
            return (
              <span key={index} className="node-tag" style={{color: 'red', fontStyle: 'italic'}}>
                [Error rendering node data]
              </span>
            );
          }
        }
        return null;
      })}
    </div>
  );
});

export default Node;
