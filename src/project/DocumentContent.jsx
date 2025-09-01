import React from 'react';
import { useProjectStore } from './ProjectStore.js';

// Import individual content type components
import Section from './components/Section.jsx';
import Text from './components/Text.jsx';
import List from './components/List.jsx';
import Image from './components/Image.jsx';
import Video from './components/Video.jsx';
import Pdf from './components/Pdf.jsx';
import Code from './components/Code.jsx';
import LaTeX from './components/LaTeX.jsx';
import Array from './components/Array.jsx';
import YamlMarkdown from '@/markdown-yaml/YamlMarkdown.jsx';
import Paragraph from './Paragraph.jsx';

/**
 * DocumentContent Component
 * Recursively renders document nodes based on their type
 * 
 * Props:
 * - projectData: object - The parsed project data
 * - nodeId: string - The ID of the node to render
 */
const DocumentContent = React.memo(({ projectData, nodeId }) => {
  // Defensive check for projectData
  if (!projectData || !projectData.projectDataParsed) {
    console.error('🚨 DocumentContent: projectData or projectDataParsed is undefined', { projectData, nodeId });
    return <div>Error: Missing project data</div>;
  }

  const node = projectData.projectDataParsed[nodeId];

  // Note: MathJax rendering is handled globally by DocumentRenderer
  // Component-level triggering removed to prevent conflicts

  if (!node) {
    const message = `🚫 No node found for nodeId: ${nodeId}`;
    console.log(message);
    return <div>{message}</div>;
  }

  // console.log('🔍 Rendering node:', nodeId, 'type:', node.type, 'node:', node);

  // Component mapping for different content types
  const componentMap = {
    'section': Section,
    'text': Text,
    'unordered-list': List,
    'ul': List,
    'ordered-list': List,
    'ol': List,
    'plain-list': List,
    'pl': List,
    'paragraph-list': Paragraph,
    'paragraphs': Paragraph,
    'p': Paragraph,
    'image': Image,
    'video': Video,
    'pdf': Pdf,
    'code': Code,
    'latex': LaTeX,
    'array': Array,
    'yaml-markdown': YamlMarkdown,
  };

  const Component = componentMap[node.type];

  if (Component) {
    // console.log('🔍 Using component for type:', node.type);
    return <Component node={node} projectData={projectData} />;
  }

  // Fallback for unknown types
  if (node.text_processed || node.text_raw) {
    console.log('🔍 Using text fallback for node:', nodeId);
    return (
      <div 
        id={node.id}
        dangerouslySetInnerHTML={{ 
          __html: node.text_processed || node.text_raw || removeHeadTailQuote(node)
        }}
      />
    );
  }
  
  if (node.children) {
    console.log('🔍 Rendering children for node:', nodeId, 'children count:', node.children.length);
    return (
      <>
        {node.children.map(childId => (
          <DocumentContent
            key={childId} 
            projectData={projectData} 
            nodeId={childId} 
          />
        ))}
      </>
    );
  }
  
  console.log('🚨 Node has no content or children:', nodeId, node);
  return <div>Empty node: {nodeId}</div>;
});

// Utility function
function removeHeadTailQuote(str) {
  if (typeof str === 'string' && str.startsWith('"') && str.endsWith('"')) {
    return str.substring(1, str.length - 1);
  }
  return str;
}

export default DocumentContent;
export { DocumentContent };
