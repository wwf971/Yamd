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
import NodeCustomBox from '@/custom/NodeCustomBox.jsx';
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

  // Custom node renderer - maps customType to component
  const customNodeRenderer = {
    'box': NodeCustomBox,
  };

  // initialize mathjax
  React.useEffect(() => {
    console.log("🔧 Loading MathJax for TestCustom...");
    loadMathJax().catch(err => {
      console.error('Failed to load MathJax in TestCustom:', err);
    });
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
    }, 1000);
  }, [yamlInput]);

  return (
    <div className="test-render-container">
      <div className="test-render-header">
        <h2 className="test-render-title">Custom Node Test</h2>
        <p className="test-render-description">Testing custom node types with NodeWrapper integration</p>
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

      {/* YAML Input */}
      <div className="panel">
        <h3 className="panel-title">YAML Input</h3>
        <textarea
          value={yamlInput}
          onChange={(e) => setYamlInput(e.target.value)}
          placeholder="Enter your YAML here..."
          className="panel-textarea panel-textarea-input"
          style={{ height: '200px' }}
        />
      </div>

      {parseError && (
        <div className="panel-error">
          <strong>Error:</strong><br />
          {parseError}
        </div>
      )}

      {/* Split View: Rendered Document and Flattened Data */}
      {docId && docData && (
        <div className="split-view-section">
          {/* Left Panel: Rendered Document */}
          <div className="rendered-panel">
            <h3 className="rendered-panel-title">Rendered Document with Custom Nodes</h3>
            <div className="rendered-panel-content">
              <YamdDoc 
                docId={docId}
                disableRefJump={false}
                customNodeRenderer={customNodeRenderer}
              />
            </div>
          </div>
          
          {/* Right Panel: Flattened Data */}
          <div className="flattened-panel">
            <h3 className="flattened-panel-title">Flattened Data (Real-time Updates)</h3>
            <DocDataDisplay 
              key={docId}
              docId={docId} 
              nodeIds={nodeIds} 
              isLoading={isLoading}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TestCustom;

