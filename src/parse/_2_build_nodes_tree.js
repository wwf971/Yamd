import { extractSquareBracketAttr } from './_1_parse_attr.js';

/**
 * Process nodes - parse square bracket attributes and build nested structure
 * @param {any} jsonData - Raw JSON data from YAML parsing
 * @returns {any} - Processed nested structure with parsed attributes
 */
export function processNodes(jsonData) {
  // Handle single dictionary input by converting to array
  if (jsonData && typeof jsonData === 'object' && !Array.isArray(jsonData)) {
    jsonData = [jsonData];
  }
  
  if (!Array.isArray(jsonData)) {
    throw new Error('Expected array or object input for processing');
  }
  
  return jsonData.map(item => processNode(item));
}

/**
 * Check if object has alternative YAMD grammar for leaf nodes (indentation mistake tolerance)
 * @param {object} obj - Object to check
 * @returns {string|null} - Leaf node key with null value, or null if not found
 */
function checkAlternativeYamdGrammarForLeafNode(obj) {
/*
standard yaml grammar for latex node:
  - [latex]xxx:
      a: b
      c: d
alternative yaml grammar for latex node:
  - [latex]xxx:
    a: b
    c: d

This also applies to other leaf node types like [image], [video], etc.
*/
  
  const entries = Object.entries(obj);
  if (entries.length < 2) return null; // Need at least 2 entries for this mistake

  for (const [key, value] of entries) {
    // Check if key looks like a leaf node type and has null value
    if (value === null && key.includes('[')) {
      const { attr } = extractSquareBracketAttr(key);
      const nodeType = determineNodeType(attr);
      // Check for leaf node types that support this grammar
      if (nodeType === 'latex' || nodeType === 'image' || nodeType === 'video' || nodeType === 'image-list') {
        console.log('🔧 Detected alternative YAMD grammar for leaf node:', key, 'with null value');
        return key;
      }
    }
  }
  return null;
}

/**
 * Handle alternative YAMD grammar for leaf nodes by merging attributes
 * @param {object} obj - Object with leaf node indentation mistake
 * @param {string} leafNodeKey - The leaf node key with null value
 * @returns {object} - Corrected leaf node
 */
function handleAlternativeYamdGrammarForLeafNode(obj, leafNodeKey) {
  console.log('🔧 Handling alternative YAMD grammar for leaf node:', leafNodeKey);
  
  const { textRaw, attr, textOriginal } = extractSquareBracketAttr(leafNodeKey);
  const nodeType = determineNodeType(attr);
  
  // Collect all other entries as attributes
  const mergedAttributes = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key !== leafNodeKey) {
      mergedAttributes[key] = value;
    }
  }
  
  console.log('🔧 Merging attributes:', mergedAttributes);
  
  // Process the appropriate leaf node type with merged attributes
  let processedNode;
  if (nodeType === 'latex') {
    processedNode = processLaTeXNode(attr, textRaw, textOriginal, mergedAttributes);
  } else if (nodeType === 'image') {
    processedNode = processImageNode(attr, textRaw, textOriginal, mergedAttributes);
  } else if (nodeType === 'video') {
    processedNode = processVideoNode(attr, textRaw, textOriginal, mergedAttributes);
  } else if (nodeType === 'image-list') {
    processedNode = processImageListNode(attr, textRaw, textOriginal, mergedAttributes);
  } else {
    // Fallback to generic processing
    processedNode = {
      type: nodeType,
      textRaw,
      textOriginal,
      attr: { ...attr },
      children: [],
      ...mergedAttributes // Merge attributes directly
    };
  }
  
  // Return as a single-entry object (like the correct indentation would produce)
  return { [textOriginal]: processedNode };
}

/**
 * Process LaTeX node - special handling for LaTeX blocks
 * @param {object} attr - Parsed attributes 
 * @param {string} textRaw - Raw text content
 * @param {string} textOriginal - Original text
 * @param {any} value - Node value (children/content)
 * @returns {object} - Processed LaTeX node
 */
function processLaTeXNode(attr, textRaw, textOriginal, value) {
  console.log('🔧 Processing LaTeX node in tree building phase:', { textRaw, textOriginal, value });
  
  // Initialize LaTeX node
  const latexNode = {
    type: 'latex',
    textRaw: textRaw || '', // Always use textRaw for LaTeX content
    textOriginal,
    attr: { ...attr }, // Copy existing attributes
    children: [],
    caption: null // Caption stays at node level for easy access
  };
  
  // Process the value to extract LaTeX attributes
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    // Handle object with content, caption, height
    for (const [key, val] of Object.entries(value)) {
      if (key === 'content' && typeof val === 'string') {
        latexNode.textRaw = val; // Use textRaw for LaTeX content
      } else if (key === 'caption' && typeof val === 'string') {
        latexNode.caption = val;
      } else if (key === 'height' && typeof val === 'string') {
        latexNode.attr.height = val; // Store height in attr
      } else if ((key === 'caption_title' || key === 'caption-title') && typeof val === 'string') {
        latexNode.attr.caption_title = val; // Store custom caption title in attr
      } else if (key === 'id' && typeof val === 'string') {
        latexNode.htmlId = val; // Store user-defined ID for HTML element (not in attr)
      }
    }
  } else if (Array.isArray(value)) {
    // Handle array value - process recursively but look for specific keys
    const processedChildren = value.map(item => processNode(item));
    
    // Extract content, caption, height from processed children
    for (const child of processedChildren) {
      if (typeof child === 'object' && child.textRaw) {
        if (child.textRaw === 'content' && child.children && child.children.length > 0) {
          const contentChild = child.children[0];
          if (typeof contentChild === 'object' && contentChild.textRaw) {
            latexNode.textRaw = contentChild.textRaw; // Use textRaw for LaTeX content
          }
        } else if (child.textRaw === 'caption' && child.children && child.children.length > 0) {
          const captionChild = child.children[0];
          if (typeof captionChild === 'object' && captionChild.textRaw) {
            latexNode.caption = captionChild.textRaw;
          }
        } else if (child.textRaw === 'height' && child.children && child.children.length > 0) {
          const heightChild = child.children[0];
          if (typeof heightChild === 'object' && heightChild.textRaw) {
            latexNode.attr.height = heightChild.textRaw; // Store height in attr
          }
        } else if ((child.textRaw === 'caption_title' || child.textRaw === 'caption-title') && child.children && child.children.length > 0) {
          const captionTitleChild = child.children[0];
          if (typeof captionTitleChild === 'object' && captionTitleChild.textRaw) {
            latexNode.attr.caption_title = captionTitleChild.textRaw; // Store custom caption title in attr
          }
        } else if (child.textRaw === 'id' && child.children && child.children.length > 0) {
          const idChild = child.children[0];
          if (typeof idChild === 'object' && idChild.textRaw) {
            latexNode.htmlId = idChild.textRaw; // Store user-defined ID for HTML element (not in attr)
          }
        }
      }
    }
  }
  
  console.log('✅ LaTeX node processed:', latexNode);
  return latexNode;
}

/**
 * Process Image node - special handling for image blocks
 * @param {object} attr - Parsed attributes 
 * @param {string} textRaw - Raw text content (image src)
 * @param {string} textOriginal - Original text
 * @param {any} value - Node value (children/content)
 * @returns {object} - Processed image node
 */
function processImageNode(attr, textRaw, textOriginal, value) {
  console.log('🔧 Processing Image node in tree building phase:', { textRaw, textOriginal, value });
  
  // Initialize image node
  const imageNode = {
    type: 'image',
    textRaw: textRaw || '', // Image src
    textOriginal,
    attr: { ...attr },
    children: [],
    caption: null
  };
  
  // Process the value to extract image attributes
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    // Handle object with src, caption, alt, etc.
    for (const [key, val] of Object.entries(value)) {
      if (key === 'src' && typeof val === 'string') {
        imageNode.textRaw = val; // Use textRaw for image src
      } else if (key === 'caption' && typeof val === 'string') {
        imageNode.caption = val;
      } else if (key === 'alt' && typeof val === 'string') {
        imageNode.attr.alt = val;
      } else if (key === 'width' && typeof val === 'string') {
        imageNode.attr.width = val;
      } else if (key === 'height' && typeof val === 'string') {
        imageNode.attr.height = val;
      } else if (key === 'id' && typeof val === 'string') {
        imageNode.htmlId = val; // Store user-defined ID for HTML element (not in attr)
      }
    }
  } else if (Array.isArray(value)) {
    // Handle array value - process recursively but look for specific keys
    const processedChildren = value.map(item => processNode(item));
    
    // Extract src, caption, alt from processed children
    for (const child of processedChildren) {
      if (typeof child === 'object' && child.textRaw) {
        if (child.textRaw === 'src' && child.children && child.children.length > 0) {
          const srcChild = child.children[0];
          if (typeof srcChild === 'object' && srcChild.textRaw) {
            imageNode.textRaw = srcChild.textRaw; // Use textRaw for image src
          }
        } else if (child.textRaw === 'caption' && child.children && child.children.length > 0) {
          const captionChild = child.children[0];
          if (typeof captionChild === 'object' && captionChild.textRaw) {
            imageNode.caption = captionChild.textRaw;
          }
        } else if (child.textRaw === 'alt' && child.children && child.children.length > 0) {
          const altChild = child.children[0];
          if (typeof altChild === 'object' && altChild.textRaw) {
            imageNode.attr.alt = altChild.textRaw;
          }
        } else if (child.textRaw === 'id' && child.children && child.children.length > 0) {
          const idChild = child.children[0];
          if (typeof idChild === 'object' && idChild.textRaw) {
            imageNode.htmlId = idChild.textRaw; // Store user-defined ID for HTML element (not in attr)
          }
        }
      }
    }
  }
  
  console.log('✅ Image node processed:', imageNode);
  return imageNode;
}

/**
 * Process Video node - special handling for video blocks
 * @param {object} attr - Parsed attributes 
 * @param {string} textRaw - Raw text content (video src)
 * @param {string} textOriginal - Original text
 * @param {any} value - Node value (children/content)
 * @returns {object} - Processed video node
 */
function processVideoNode(attr, textRaw, textOriginal, value) {
  console.log('🔧 Processing Video node in tree building phase:', { textRaw, textOriginal, value });
  
  // Initialize video node (similar to image but for videos)
  const videoNode = {
    type: 'video',
    textRaw: textRaw || '', // Video src
    textOriginal,
    attr: { ...attr },
    children: [],
    caption: null
  };
  
  // Process attributes similar to image node
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, val] of Object.entries(value)) {
      if (key === 'src' && typeof val === 'string') {
        videoNode.textRaw = val;
      } else if (key === 'caption' && typeof val === 'string') {
        videoNode.caption = val;
      } else if (['width', 'height', 'controls', 'autoplay', 'loop', 'muted', 'playOnLoad'].includes(key)) {
        videoNode.attr[key] = val;
      } else if (key === 'id' && typeof val === 'string') {
        videoNode.htmlId = val; // Store user-defined ID for HTML element (not in attr)
      }
    }
  }
  
  console.log('✅ Video node processed:', videoNode);
  return videoNode;
}

/**
 * Process image-list node - special handling for image list blocks
 * @param {object} attr - Parsed attributes 
 * @param {string} textRaw - Raw text content
 * @param {string} textOriginal - Original text
 * @param {any} value - Node value (children/content)
 * @returns {object} - Processed image-list node
 */
function processImageListNode(attr, textRaw, textOriginal, value) {
  
  // Clean attr by removing redundant type (it's already in the node type field)
  const cleanAttr = { ...attr };
  delete cleanAttr.type;
  delete cleanAttr.selfDisplay; // Remove redundant selfDisplay too
  
  // Initialize image-list node
  const imageListNode = {
    type: 'image-list',
    textRaw: textRaw || '',
    textOriginal,
    attr: cleanAttr,
    children: []
  };
  
  // Process value - extract attributes and children
  if (value && typeof value === 'object') {
    if (Array.isArray(value)) {
      // Direct array of children - process them normally but they'll be forced to images during flattening
      imageListNode.children = value.map(item => processNode(item));
    } else {
      // Object with potential attributes and children
      const children = [];
      for (const [key, val] of Object.entries(value)) {
        // Recognize image-list level attributes (properties that should belong to the image-list)
        if (['height', 'width', 'caption', 'alignX', 'subindex'].includes(key)) {
          // Store as image-list attribute
          if (key === 'caption') {
            imageListNode.caption = val;
          } else {
            imageListNode.attr[key] = val;
          }
        } else if (key === 'children' && Array.isArray(val)) {
          // The main children array - force each child to be an image
          val.forEach(childItem => {
            if (typeof childItem === 'string') {
              // Direct URL string - create image node
              const imageNode = processImageNode({ type: 'image', selfDisplay: 'image' }, childItem, `[image]${childItem}`, null);
              children.push(imageNode);
            } else if (childItem && typeof childItem === 'object') {
              // Object with src/caption - force to be image
              const forcedImageNode = forceNodeToImage(childItem);
              children.push(forcedImageNode);
            } else {
              // Fallback to normal processing
              children.push(processNode(childItem));
            }
          });
        } else {
          // Everything else is treated as a child - process normally
          if (Array.isArray(val)) {
            // Array of children
            children.push(...val.map(item => processNode(item)));
          } else {
            // Single child
            children.push(processNode({ [key]: val }));
          }
        }
      }
      imageListNode.children = children;
    }
  }
  
  return imageListNode;
}

/**
 * Force a node to be treated as an image node
 * @param {object} nodeObj - Node object to convert to image
 * @returns {object} - Image node
 */
function forceNodeToImage(nodeObj) {
  if (typeof nodeObj === 'string') {
    // Direct URL string
    return processImageNode({ type: 'image', selfDisplay: 'image' }, nodeObj, `[image]${nodeObj}`, null);
  }
  
  // Check if object has 'src' property - this is image data
  if (nodeObj && typeof nodeObj === 'object' && nodeObj.src) {
    // Object with src property - treat as image with attributes
    const src = nodeObj.src;
    return processImageNode({ type: 'image', selfDisplay: 'image' }, src, `[image]${src}`, nodeObj);
  }
  
  // Extract the first key-value pair and force it to be an image
  const [key, value] = Object.entries(nodeObj)[0];
  
  if (key === 'src' && typeof value === 'string') {
    // Direct src specification
    return processImageNode({ type: 'image', selfDisplay: 'image' }, value, `[image]${value}`, nodeObj);
  } else {
    // Treat the key as potential image content and value as attributes
    const { textRaw, attr, textOriginal } = extractSquareBracketAttr(key);
    // Force type to image
    const imageAttr = { ...attr, type: 'image', selfDisplay: 'image' };
    return processImageNode(imageAttr, textRaw, textOriginal || `[image]${textRaw}`, value);
  }
}

/**
 * Process a single node (recursive)
 * @param {any} node - Node to process
 * @returns {any} - Processed node
 */
function processNode(node) {
  if (typeof node === 'string') {
    // Process string nodes - extract square bracket attributes
    const { textRaw, attr, textOriginal } = extractSquareBracketAttr(node);
    
    return {
      type: 'text',
      textRaw,
      textOriginal,
      attr
    };
  } else if (Array.isArray(node)) {
    // Process arrays recursively
    return node.map(item => processNode(item));
  } else if (node && typeof node === 'object') {
    // Process objects - handle keys with square bracket attributes
    const processedObj = {};
    
    // Check for alternative YAMD grammar for leaf nodes: [type]xxx: null with other attributes
    const leafNodeKeyWithNullValue = checkAlternativeYamdGrammarForLeafNode(node);
    if (leafNodeKeyWithNullValue) {
      return handleAlternativeYamdGrammarForLeafNode(node, leafNodeKeyWithNullValue);
    }
    
    // Check if this object contains an image-list key that needs to consume all entries
    let imageListKey = null;
    for (const [key, value] of Object.entries(node)) {
      const { attr } = extractSquareBracketAttr(key);
      const nodeType = determineNodeType(attr);
      if (nodeType === 'image-list') {
        imageListKey = key;
        break;
      }
    }

    // special handling for image-list: consume ALL entries in this object
    if (imageListKey) {
      const { textRaw, attr, textOriginal } = extractSquareBracketAttr(imageListKey);
      const imageListValue = node[imageListKey];
      
      // Collect all other entries as attributes for the image-list
      const allEntries = {};
      for (const [key, value] of Object.entries(node)) {
        if (key !== imageListKey) {
          allEntries[key] = value;
        }
      }
      
      // Add the main value to the entries
      if (Array.isArray(imageListValue)) {
        allEntries.children = imageListValue;
      } else {
        allEntries.main = imageListValue;
      }
      
      const processedNode = processImageListNode(attr, textRaw, textOriginal, allEntries);
      processedObj[textOriginal] = processedNode;
      return processedObj; // Return early since we consumed all entries
    }
    
    for (const [key, value] of Object.entries(node)) {
      // extract attributes from the key
      const { textRaw, attr, textOriginal } = extractSquareBracketAttr(key);
      
      // determine node type based on attributes
      const nodeType = determineNodeType(attr);
      
      // special handling for leaf nodes - don't process children recursively
      if (nodeType === 'latex') {
        const processedNode = processLaTeXNode(attr, textRaw, textOriginal, value);
        processedObj[textOriginal] = processedNode;
        continue; // Skip normal processing
      } else if (nodeType === 'image') {
        const processedNode = processImageNode(attr, textRaw, textOriginal, value);
        processedObj[textOriginal] = processedNode;
        continue; // Skip normal processing
      } else if (nodeType === 'video') {
        const processedNode = processVideoNode(attr, textRaw, textOriginal, value);
        processedObj[textOriginal] = processedNode;
        continue; // Skip normal processing
      }
      
      // process the value recursively for non-LaTeX nodes
      const processedValue = Array.isArray(value) ? value.map(item => processNode(item)) : processNode(value);
      
      // create processed node
      const processedNode = {
        type: nodeType,
        textRaw,
        textOriginal, 
        attr,
        children: Array.isArray(processedValue) ? processedValue : [processedValue]
      };
      
      // Use original key as the object key
      processedObj[textOriginal] = processedNode;
    }
    
    return processedObj;
  }
  
  return node;
}

/**
 * Determine node type based on attributes
 * @param {object} attr - Parsed attributes
 * @returns {string} - Node type
 */
function determineNodeType(attr) {
  // Check for explicit type first (like [latex], [image], [image-list])
  if (attr.type) {
    return attr.type;
  } else if (attr.selfDisplay) {
    return 'node';
  } else if (attr.childDisplay || attr.childClass || attr.valueNum !== null) {
    return 'node';
  } else {
    return 'node'; // Default type
  }
}
