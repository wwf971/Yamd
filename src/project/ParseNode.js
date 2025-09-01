import { nanoid } from 'nanoid';

export const parseNode = (parsed, node, parentId = null) => {
  
  // console.log('🔍 parseNode called with:', { node, parentId, nodeId });
  if (Array.isArray(node)) {
    // Handle arrays
    // First, create the node in parsed with the basic structure
    const nodeId = nanoid();
    parsed[nodeId] = {
      ...(node && typeof node === 'object' ? node : {}), // Safely preserve all original properties
      type: 'array',
      id: node.id ? node.id : nodeId, // override with generated ID
      parentId, // add parsing-specific property
      children: [] // initialize parsing-specific property
    };
    node.forEach(item => {
      const childId = parseNode(parsed, item, nodeId);
      parsed[nodeId].children.push(childId);
    });

    console.warn("    array node:", node, "nodeId:", nodeId);
    return nodeId;
  }
  else if (typeof node === 'string') {
    const nodeId = nanoid();
    parsed[nodeId] = {
      ...(node && typeof node === 'object' ? node : {}), // Safely preserve all original properties
      id: nodeId, // override with generated ID
      type: 'text', // override with determined type
      parentId, // add parsing-specific property
      children: [] // initialize parsing-specific property
    };
    // Handle primitive values (strings, numbers, etc.)
    parsed[nodeId].text_raw = String(node);
    parsed[nodeId].text_processed = String(node);
    return nodeId;
  }
  else if (typeof node === 'object' && Object.keys(node).length === 1 && [
    'img', 'image', 'video', 'pdf', 'latex',
  ].includes(Object.keys(node)[0])) {
    
    let key_name = Object.keys(node)[0];
    if(key_name === 'img'){
      key_name = 'image'
    }
    let value = node[key_name];
    value.type = key_name;
    let childId = parseNode(parsed, value, parentId)
    // console.warn("    single key node(1):", node);
    // console.log("    child:", parsed[childId]);
    return childId;
  }
  else if (typeof node === 'object' && Object.keys(node).length === 1 && [
    'unordered-list', 'unordered_list', 'ul',
    'ordered-list', 'ordered_list', 'ol',
    'plain-list', 'plain_list', 'pl',
    'paragraph-list', 'paragraphs', 'p'
  ].includes(Object.keys(node)[0])) {
    let key_name = Object.keys(node)[0];
    let value = {
      'type': key_name,
      'content': node[key_name]
    }
    // console.warn("    single key node(2):", node, "childId:", childId);
    let childId = parseNode(parsed, value, parentId);
    // console.log("    single key node(2) value:", value);
    // console.log("    child:", parsed[childId]);
    return childId;
  }
  else if (node && typeof node === 'object') {
    const nodeId = nanoid();

    parsed[nodeId] = {
      ...(node && typeof node === 'object' ? node : {}), // Safely preserve all original properties
      id: node.id ? node.id : nodeId, // override with generated ID
      parentId, // add parsing-specific property
      children: [] // initialize parsing-specific property
    };
    // console.log("    noteId:", nodeId, "parsed[nodeId].type:", parsed[nodeId].type);
    if(parsed[nodeId].type === undefined){
      parsed[nodeId].type = 'section';
    }
    // Handle yaml-markdown as leaf node - stop parsing content here
    if (node.type && node.type === 'yaml-markdown') {
      parsed[nodeId].type = 'yaml-markdown';
      parsed[nodeId].content = node.content; // Store raw content for Node.jsx to handle
      // Don't parse children for yaml-markdown - treat as leaf node
      return nodeId;
    }
    const isLeaf = dealWithLeafNode(parsed, nodeId);
    if(isLeaf){return nodeId;}
    const isList = dealWithListNode(parsed, nodeId);
    if(isList){
      parseChildNode(parsed, nodeId);
      return nodeId;
    }
    if(parsed[nodeId].type === 'section'){
      if(node.content){
        parseChildNode(parsed, nodeId);
        return nodeId;
      }
      const hasListChild = dealWithNodeWithListChild(parsed, nodeId);
      if(hasListChild){
        // children already parsed in dealWithNodeWithListChild()
        return nodeId;
      }
      if (node.image || node.img) {
        /*
          - title: 'xxx'
          - selfClass: 'yyy'
          - image:
            - src: 'zzz'
        */
        dealWithNoteWithImage(parsed, nodeId, node);
        return nodeId;
      } else if (node.pdf) {
        dealWithNoteWithPdf(parsed, nodeId);
        return nodeId;
      }
      else if (node.latex) {
        dealWithNodeWithLatex(parsed, nodeId);
        return nodeId;
      }else if (node.content){
        parseChildNode(parsed, nodeId);
        return nodeId;
      }else if(node.video){
        dealWithNoteWithVideo(parsed, nodeId, node);
        return nodeId;
      }
      else{
        console.error(" dealWithNodeWithListChild: unhandled node:", node);
      }
    }
    console.error(" dealWithNodeWithListChild: unhandled node:", node);
  }
  // console.log('🔍 parseNode returning nodeId:', nodeId, typeof nodeId);
};

export const processLatexNodesToSvg = async (nodesDict, triggerUpdate = null) => {
  console.log('🔧 Starting LaTeX to SVG processing...');
  
  const latexNodes = Object.values(nodesDict).filter(node => node.type === 'latex');
  console.log(`📄 Found ${latexNodes.length} LaTeX nodes to process`);
  
  // Process LaTeX nodes sequentially to avoid overwhelming MathJax
  for (const node of latexNodes) {
    if (!node.text_raw) {
      console.warn('⚠️ LaTeX node missing text_raw:', node.id);
      continue;
    }
    try {
      console.log(`🔧 Processing LaTeX node: ${node.id}`);
      const svgString = null;
      if (svgString) {
        // Directly set the SVG on the node (should work now that we pre-allocated the property)
        node.latex_svg = svgString;
        console.log(`✅ SVG generated for LaTeX node: ${node.id}`);
        
        // Trigger store update to cause re-render
        if (triggerUpdate) {
          triggerUpdate();
        }
      } else {
        console.error(`❌ Failed to generate SVG for LaTeX node: ${node.id}`);
      }
    } catch (error) {
      console.error(`❌ Error processing LaTeX node ${node.id}:`, error);
    }
    
    // Small delay between processing to be gentle on the browser
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('✅ LaTeX to SVG processing complete');
};

export const parseChildNode = (parsed, nodeId) => {
  let node = parsed[nodeId];

  console.error("    parseChildNode: node:", node);
  console.trace();
  if (Array.isArray(node.content)) {
    node.content.forEach(item => {
      console.log("    parseChildNode: item:", item);
      const childId = parseNode(parsed, item, nodeId);
      console.log("    parseChildNode: childId:", childId);
      parsed[nodeId].children.push(childId);
    });
    // Clear content array after converting to children to avoid confusion
    delete parsed[nodeId].content;
  } else if (typeof node.content === 'string') {
    const childId = parseNode(parsed, node.content, nodeId);
    parsed[nodeId].children.push(childId);
  } else if (typeof node.content === 'object' && node.content !== null) {
    // Handle single object content (like images in list items)
    console.log('🔍 Processing object content:', node.content);
    const childId = parseNode(parsed, node.content, nodeId);
    parsed[nodeId].children.push(childId);
  } else{
    console.error(" parseChildNode: unhandled node:", node);
  }
}

export const dealWithImageNode = (parsed, nodeId) => {
  const node = parsed[nodeId];
  console.log('🔍 Created image node:', parsed[nodeId]);
  return nodeId;
};

export const dealWithNoteWithImage = (parsed, nodeId, node) => {
  let childImageInfo = node.image || node.img;
  childImageInfo.type = 'image'
  if(typeof childImageInfo === 'string'){
    childImageInfo = {src: childImageInfo};
  }
  const imageId = parseNode(
    parsed, childImageInfo,
    nodeId // parentId
  );
  parsed[nodeId].children.push(imageId);
}

export const dealWithNoteWithVideo = (parsed, nodeId, node) => {

  console.log("    dealWithNoteWithVideo: node:", node);
  let childVideoInfo = node.video;
  childVideoInfo.type = 'video';
  if(typeof childVideoInfo === 'string'){
    childVideoInfo = {src: childVideoInfo};
  }
  const videoId = parseNode(
    parsed, childVideoInfo,
    nodeId // parentId
  );
  parsed[nodeId].children.push(videoId);
}


export const dealWithListNode = (parsed, nodeId) => {
  const node = parsed[nodeId];
  let isList = false;
  if(!node.type){
    return false;
  }
  const node_type = node.type;
  console.log("    dealWithListNode: node_type:", node_type, "node:", node);
  if (node_type === 'unordered-list' || node_type === 'unordered_list' || node_type === 'ul') {
    parsed[nodeId].type = 'unordered-list';
    parsed[nodeId].content = node.content;
    console.error("    dealWithListNode: node_type:", node_type, "node:", node);
    isList = true;
  }
  else if (node_type === 'ordered-list' || node_type === 'ordered_list' || node_type === 'ol') {
    parsed[nodeId].type = 'ordered-list';
    parsed[nodeId].content = node.content;
    isList = true;
  }
  else if (node_type === 'plain-list' || node_type === 'plain_list' || node_type === 'pl') {
    parsed[nodeId].type = 'plain-list';
    parsed[nodeId].content = node.content;
    isList = true;
  }
  else if (node_type === 'paragraph-list' || node_type === 'paragraphs' || node_type === 'p') {
    parsed[nodeId].type = 'paragraph-list';
    parsed[nodeId].content = node.content;
    isList = true;
  } else if (node_type === 'array'){
    console.error("    dealWithListNode: unhandled node_type:", node_type, "node:", node);

  }
  return isList;
}

export const dealWithLeafNode = (parsed, nodeId) => {
  const node = parsed[nodeId];
  let isLeaf = false;
  // Handle type: "image" with src property (another image format)
  if (node.type && node.type === 'image') {
    dealWithImageNode(parsed, nodeId);
    isLeaf = true;
  }
  else if (node.type && node.type === 'pdf') {
    parsed[nodeId].src = node.src; // src can be string, array, or null/undefined
    parsed[nodeId].id = node.id; // preserve custom id if provided
    isLeaf = true;
  }
  else if (node.type && node.type === 'latex') {
    parsed[nodeId].latex_svg = null; // initialize LaTeX SVG slot for LaTeX nodes
    if (node.id) {
      parsed[nodeId].id = node.id; // preserve custom id if provided
      console.log('🔍 Using custom ID for LaTeX:', node.id);
    }
    isLeaf = true;
  }else if (node.type && node.type === 'video'){
    if (node.id) {
      parsed[nodeId].id = node.id; // preserve custom id if provided
      console.log('🔍 Using custom ID for LaTeX:', node.id);
    }
    isLeaf = true;
  }
  return isLeaf;
}

export const dealWithNodeWithPdf = (parsed, nodeId = null) => {
  const node = parsed[nodeId];
  // Handle different PDF formats for nested parsing
  console.log('🔍 Processing PDF in nested parsing:', node);
  let pdfInfo = node.pdf;
  pdfInfo.type = 'pdf';
  if (typeof node.pdf === 'string') {
    pdfInfo.src = node.pdf;
  }
  const pdfId = parseNode( parsed, pdfInfo,
    nodeId // parentId
  );
  parsed[nodeId].children.push(pdfId);
}

export const dealWithNodeWithLatex = (parsed, nodeId = null) => {
  const node = parsed[nodeId];
  // Handle different LaTeX formats for nested parsing
  console.log('🔍 Processing LaTeX in nested parsing:', node);
  let latexData = {
    ...(node && typeof node === 'object' ? node : {}), // Safely preserve all original properties
    type: 'latex' // Override with determined type
  };
  
  if (typeof node.latex === 'object' && node.latex !== null) {
    latexData.text_raw = node.latex.content;
    if (node.latex.id) {
      latexData.id = node.latex.id; // use custom id if provided
      console.log('🔍 Found LaTeX with custom ID (nested):', node.latex.id);
    }
  } else {
    latexData.text_raw = node.latex;
  }
  const latexId = parseNode(parsed, latexData, nodeId);
  parsed[nodeId].children.push(latexId);

}

export const dealWithNodeWithListChild = (parsed, nodeId = null) => {
  const node = parsed[nodeId];
  let hasListChild = false;

  // console.log("    dealWithNodeWithListChild: node:", node);
  // parse child content of this node
  if (node['unordered-list'] || node['unordered_list'] || node['ul']) {
    const listId = parseNode(parsed, {
      type: 'unordered-list',
      content: node['unordered-list'] || node['unordered_list'] || node['ul']
    }, nodeId);
    // console.log("    dealWithNodeWithListChild: listId:", listId);
    // console.log("    dealWithNodeWithListChild: child:", parsed[listId]);
    parsed[nodeId].children.push(listId);
    hasListChild = true;
  } else if (node['ordered-list'] || node['ordered_list'] || node['ol']) {
    const listId = parseNode(parsed, {
      type: 'ordered-list', 
      content: node['ordered-list'] || node['ordered_list'] || node['ol']
    }, nodeId);
    parsed[nodeId].children.push(listId);
    hasListChild = true;
  } else if (node['plain-list'] || node['plain_list'] || node['pl']) {
    const listId = parseNode(parsed, {
      type: 'plain-list',
      content: node['plain-list'] || node['plain_list'] || node['pl']
    }, nodeId);
    parsed[nodeId].children.push(listId);
    hasListChild = true;
  } else if (node['paragraph-list'] || node['paragraphs'] || node['p']) {
    const paragraphId = parseNode(parsed, {
      type: 'paragraph-list',
      content: node['paragraph-list'] || node['paragraphs'] || node['p']
    }, nodeId);
    parsed[nodeId].children.push(paragraphId);
    hasListChild = true;
  } else{
    console.error("    dealWithNodeWithListChild: unhandled node:", node);
  }
  return hasListChild;
}


const dealWithNoteWithPdf = (parsed, nodeId) => {
  const node = parsed[nodeId];
  let pdfInfo = node.pdf;
  pdfInfo.type = 'pdf';
  if(typeof pdfInfo === 'string'){
    pdfInfo = {src: pdfInfo};
  }
  // Handle different PDF formats:
  // 1. Object: { src: "...", width: "...", height: "..." }
  // 2. String: "path/to/document.pdf"
  // 3. Array: ["path1.pdf", "path2.pdf"]
  // Allow src to be null/undefined - will be handled in Pdf.jsx
  const pdfId = parseNode(parsed, pdfInfo, nodeId);
  parsed[nodeId].children.push(pdfId);
}

export const dealWithNoteWithLatex = (parsed, nodeId) => {
  const node = parsed[nodeId];
  let latexInfo = node.latex;
  latexInfo.type = 'latex';
  if(typeof latexInfo === 'string'){
    latexInfo = {text_raw: latexInfo};
  }

  if(typeof latexInfo === 'object' && latexInfo.content){
    latexInfo.text_raw = latexInfo.content;
    // remove content from latexInfo
    delete latexInfo.content;
  }
  // Handle different LaTeX formats:
  // 1. Direct string: { latex: "LaTeX content" }
  // 2. Object format: { latex: { content: "LaTeX content", id: "..." } }

  // caption, title
  const latexId = parseNode(parsed, latexInfo, nodeId);
  parsed[nodeId].children.push(latexId);
}