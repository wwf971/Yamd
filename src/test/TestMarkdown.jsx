import React, { useState } from 'react';
import { useNoteStore } from '@/Note.js';
import Root from '@/markdown/Root.jsx';
import Text from '@/markdown/Text.jsx';
import BackToHome from '@/navi/BackToHome.jsx';
import TestYamd from './TestYamd.jsx';
import SearchNote from '@/note/SearchNote.jsx';

import { useNodeParseStore } from './NodeParse.js';
import { useProjectsMetadataStore } from '@/project/ProjectsMetadataStore.js';
import { useAssetStore } from '@/asset/Asset.js';

const TestMarkdown = () => {
  // Test data for NodeParse.js
  const { parseNodeData, getParsedData } = useNodeParseStore();

  const addItem = useNoteStore((state) => state.addItem);
  const updateItemContent = useNoteStore((state) => state.updateItemContent);
  const getAllNotes = useNoteStore((state) => state.getAllNotes);

  // Zustand actions
  const createNote = useNoteStore((state) => state.createNote);
  const loadNote = useNoteStore((state) => state.loadNote);

  const [count, setCount] = useState(0);
  const [demoNoteId, setDemoNoteId] = useState(null);

  const createNewNote = async () => {
    const result = await createNote();
    if (result.is_success) {
      setDemoNoteId(result.data);
    }
  };

  const handleNoteSelect = async (noteId) => {
    // Load the note if it's not already in our store
    const result = await loadNote(noteId);
    if (result.is_success) {
      setDemoNoteId(noteId);
    } else {
      console.error('Failed to load note:', result.message);
    }
  };


  // Run NodeParse tests when projects metadata is available
  useNodeParseTest();

  return (
    <>
      <BackToHome />
      
      {/* Yamd Parser Test Section */}
      <TestYamd />
      
      <hr style={{ margin: '30px 0', borderTop: '2px solid #ddd' }} />
      
      <Root 
        className="markdown-editor"
        style={{ 
          border: '2px dashed #ccc', 
          padding: '10px', 
          margin: '10px 0',
          minHeight: '40px'
        }}
      >
        <div 
          contentEditable={true}
          suppressContentEditableWarning={true}
          style={{ outline: 'none' }}
        >
          <p>Root.jsx with event delegation (try selecting across components):
            <Text isDebug={true}>First component text</Text>
            <Text isDebug={true}>Second component text</Text>
            <Text isDebug={true}>Third component text</Text>
          </p>
        </div>

      </Root>

      <div style={{ margin: '20px 0' }}>
        <h3>Markdown Editor with Zustand</h3>
        
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={createNewNote} style={{ marginRight: '10px' }}>
            Create New Note
          </button>
          <SearchNote onNoteSelect={handleNoteSelect} />
          <span>Current Note ID: {demoNoteId}</span>
        </div>

        {demoNoteId && (
          <Root 
            noteId={demoNoteId}
            className="markdown-editor"
            style={{ 
              border: '2px solid #007acc', 
              padding: '20px', 
              margin: '10px 0',
              minHeight: '200px',
              backgroundColor: '#fafafa',
              borderRadius: '8px'
            }}
          />
        )}

        <div style={{ marginTop: '30px' }}>
          <h4>Instructions:</h4>
          <ul>
            <li><strong>Enter:</strong> Create new item</li>
            <li><strong>Tab:</strong> Increase indent</li>
            <li><strong>Shift+Tab:</strong> Decrease indent</li>
            <li><strong>Backspace on empty item:</strong> Delete item</li>
            <li><strong>Click to edit:</strong> Edit any item content</li>
          </ul>
        </div>

        <hr style={{ margin: '30px 0' }} />

        <h3>Legacy Text Component Test</h3>
        <p>Normal mode: <Text>Click to edit this text</Text></p>
      </div>
    </>
  );
};


// Asset fetching and projects processing is now handled centrally in App.jsx

// Test NodeParse.js functionality (moved here from old processing function)
function useNodeParseTest() {
  const { parseNodeData, getParsedData } = useNodeParseStore();
  const { projectsMetadata } = useProjectsMetadataStore();
  
  React.useEffect(() => {
    if (projectsMetadata && projectsMetadata.length > 0) {
      // Test NodeParse.js with sample data
      const testData = [
        {
          "Programming Languages[self=key]": ["Python", "JavaScript[selfClass=skill-tag-learning]", "TypeScript"]
        },
        {
          "Frameworks[self=divider,child=ul]": [
            "React",
            "Node.js",
            {
              "Backend[self=key]": ["Express", "FastAPI"]
            }
          ]
        },
        {
          "Project Info[self=panel,child=ul]": [
            "Status: In Progress",
            "Team: 5 members[selfClass=edu-tag]"
          ]
        },
        {
          "[self=none,child=plain-list]": [
            "Item 1",
            "Item 2[selfClass=special-item]"
          ]
        }
      ];
      
      console.log('🧪 Testing NodeParse.js with data:', testData);
      const parsed = parseNodeData('test-data', testData);
      const retrievedData = getParsedData('test-data');
      console.log('🧪 Retrieved parsed data:', retrievedData);
      
      // Also test with real skills data if available
      const skillsAsset = useAssetStore.getState().assets['yaml/project/home/1-skill.yaml'];
      if (skillsAsset?.content?.data) {
        console.log('🧪 Testing NodeParse.js with real skills data:', skillsAsset.content.data);
        const skillsParsed = parseNodeData('skills-data', skillsAsset.content.data);
        const skillsRetrieved = getParsedData('skills-data');
        console.log('🧪 Skills parsed data:', skillsRetrieved);
      }
    }
  }, [projectsMetadata, parseNodeData, getParsedData]);
}

export default TestMarkdown;