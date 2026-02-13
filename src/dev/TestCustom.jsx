import React, { useState, useEffect } from 'react';
import YamdDoc from '@/core/YamdDoc.jsx';
import { docsData, useDocStore } from '@/core/DocStore.js';
import { loadMathJax } from '@/mathjax/MathJaxLoad.js';
import { 
  parseYamlToJson, 
  formatJson, 
  getSampleYaml,
  getSampleYamlSeries,
  processNodes, 
  flattenJson,
  processAllTextSegments
} from '@/parse/ParseYamd.js';
import { getCustomComp } from '@/custom/customCompStore.js';
import { BoolSlider } from '@wwf971/react-comp-misc';
import { DocDataDisplay } from './TestUtils.jsx';
import './TestRender.css';
import './TestEdit.css';

const TestCustom = () => {
  const sampleNames = getSampleYamlSeries('custom');
  const defaultSample = sampleNames[0] || "custom-box";
  const [selectedSample, setSelectedSample] = useState(defaultSample);
  const [yamlInput, setYamlInput] = useState(getSampleYaml(defaultSample));
  const [docData, setDocData] = useState(null);
  const [docId, setDocId] = useState(null);
  const [nodeIds, setNodeIds] = useState([]);
  const [parseError, setParseError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEditable, setIsEditable] = useState(true);
  const [currentSegmentId, setCurrentSegId] = useState(null);
  const [activeElement, setActiveElement] = useState(null);

  // initialize mathjax
  React.useEffect(() => {
    console.log("🔧 Loading MathJax for TestCustom...");
    loadMathJax().catch(err => {
      console.error('Failed to load MathJax in TestCustom:', err);
    });
  }, []);

  // Track active element for debugging
  useEffect(() => {
    const updateActiveElement = () => {
      setActiveElement(document.activeElement);
    };

    // Update on focus/blur events
    document.addEventListener('focusin', updateActiveElement);
    document.addEventListener('focusout', updateActiveElement);
    
    // Initial update
    updateActiveElement();

    return () => {
      document.removeEventListener('focusin', updateActiveElement);
      document.removeEventListener('focusout', updateActiveElement);
    };
  }, []);

  const handleParse = async () => {
    setIsLoading(true);
    setParseError('');
    
    try {
      // Step 1: YAML → JSON
      const yamlResult = parseYamlToJson(yamlInput);
      
      if (yamlResult.code === 0) {
        const rawJson = yamlResult.data;
        
        // Step 2: Process nodes (apply square bracket grammar)
        const processedData = processNodes(rawJson);
        
        // Step 3: Flatten to ID-based structure
        const flattenedData = flattenJson(processedData);
        
        // Step 4: Process inline LaTeX
        const finalData = await processAllTextSegments(flattenedData);
        
        const finalResult = { 
          nodes: finalData.nodes, 
          rootNodeId: finalData.rootNodeId, 
          assets: finalData.assets, 
          refs: finalData.refs || {},
          bibs: finalData.bibs || {},
          bibsLookup: finalData.bibsLookup || {}
        };
        
        setDocData(finalResult);
        setParseError('');
        
        // Generate docId and initialize both Jotai and Zustand stores
        const newDocId = `doc_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
        const docInfo = docsData.fromFlattenedData(newDocId, finalResult);
        setNodeIds(docInfo.nodeIds);
        useDocStore.getState().setDocData(newDocId, {
          docId: newDocId,
          createdAt: new Date().toISOString(),
          docData: finalResult
        });
        setDocId(newDocId);
      } else {
        setDocData(null);
        setParseError(yamlResult.message);
      }
    } catch (error) {
      console.error('Processing error:', error);
      setParseError(`Processing error: ${error.message}`);
      setDocData(null);
    }
    
    setIsLoading(false);
  };

  const handleSampleChange = (sampleName) => {
    setSelectedSample(sampleName);
    setYamlInput(getSampleYaml(sampleName));
    setDocData(null);
    setParseError('');
  };

  useEffect(() => {
    // Auto-parse after 1 second
    setTimeout(() => {
      handleParse();
    }, 300);
  }, [yamlInput]);

  return (
    <div className="test-render-container">
      <div className="test-render-header">
        <div className="test-render-title">Custom Node Test</div>
        <div className="test-render-description">Testing custom node types with NodeWrapper integration</div>
      </div>
      
      <div className="button-controls">
        <button 
          onClick={handleParse} 
          disabled={isLoading}
          className="btn btn-parse"
        >
          {isLoading ? 'Processing...' : 'Parse'}
        </button>
      </div>

      <div className="panel" style={{ marginTop: '8px' }}>
          <div className="yaml-display-title">YAML Input</div>
          {/* Sample Selection Radio Buttons */}
          <div className="sample-selection">
            <span className="sample-selection-label">Select Sample:</span>
            {sampleNames.map(name => (
              <label key={name} className="sample-radio-label">
                <input
                  type="radio"
                  name="sample"
                  value={name}
                  checked={selectedSample === name}
                  onChange={(e) => handleSampleChange(e.target.value)}
                  className="sample-radio-input"
                />
                <span className="sample-radio-text">{name}</span>
              </label>
            ))}
          </div>
          <textarea
            value={yamlInput}
            onChange={(e) => setYamlInput(e.target.value)}
            placeholder="Enter your YAML here..."
            className="panel-textarea panel-textarea-input panel-textarea-short"
          />
      </div>

      <div className="panels-grid" style={{ marginTop: '8px' }}>
        {docId && docData && (
          <div className="rendered-document-section">
            <div className="rendered-doc-header">
              <div className="rendered-document-title">Rendered Document with Custom Nodes</div>
              <div className="edit-toggle">
                <span className="edit-toggle-label">Editable</span>
                <BoolSlider checked={isEditable} onChange={setIsEditable} />
              </div>
            </div>
            <div className="rendered-document-container">
              <YamdDoc 
                docId={docId}
                disableRefJump={false}
                isEditable={isEditable}
                getCustomComp={getCustomComp}
                onCurrentSegmentChange={setCurrentSegId}
              />
            </div>
          </div>
        )}
        <div className="panel" style={{ maxHeight: '600px' }}>
          <div className="panel-title">Flattened Data</div>
          <div className="flattened-panel-status">
            <div className="flattened-panel-status-row">
              <strong>Current Segment:</strong> {currentSegmentId || 'none'}
            </div>
            <div className="flattened-panel-status-row">
              <strong>Active Element:</strong> {
                activeElement
                  ? `<${activeElement.tagName.toLowerCase()}${
                      activeElement.id ? ` id="${activeElement.id}"` : ''
                    }${
                      activeElement.className ? ` class="${activeElement.className}"` : ''
                    }${
                      activeElement.dataset?.segmentId ? ` data-segment-id="${activeElement.dataset.segmentId}"` : ''
                    }${
                      activeElement.dataset?.docId ? ` data-doc-id="${activeElement.dataset.docId}"` : ''
                    }${
                      activeElement.contentEditable === 'true' ? ' contenteditable="true"' : ''
                    }>`
                  : 'none'
              }
            </div>
          </div>
          <div className="doc-data-shell">
            {docId && docData && (
              <DocDataDisplay 
                key={docId}
                docId={docId} 
                nodeIds={nodeIds} 
                isLoading={isLoading}
              />
            )}
          </div>
        </div>
      </div>

      {parseError && (
        <div className="panel-error">
          <strong>Error:</strong><br />
          {parseError}
        </div>
      )}


    </div>
  );
};

export default TestCustom;

