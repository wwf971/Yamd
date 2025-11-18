import React, { useState, useEffect } from 'react';
import YamdDoc from '@/core/YamdDoc.jsx';
import { loadMathJax } from '@/mathjax/MathJaxLoad.js';
import { 
  parseYamlToJson, 
  formatJson, 
  getSampleYaml,
  getSampleYamlNames,
  getCornerCaseYaml,
  processNodes, 
  flattenJson,
  processAllTextSegments
} from '@/parse/ParseYamd.js';
import './TestRender.css';

const TestRender = () => {
  const sampleNames = getSampleYamlNames();
  const defaultSample = "rich-text";
  const [selectedSample, setSelectedSample] = useState(defaultSample);
  const [yamlInput, setYamlInput] = useState(getSampleYaml(defaultSample));
  const [jsonOutput, setJsonOutput] = useState('');
  const [processedOutput, setProcessedOutput] = useState('');
  const [flattenedOutput, setFlattenedOutput] = useState('');
  const [flattenedData, setFlattenedData] = useState(null);
  const [parseError, setParseError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // initialize mathjax
  React.useEffect(() => {
    console.log("🔧 Loading MathJax for TestRender...");
    loadMathJax().catch(err => {
      console.error('Failed to load MathJax in TestRender:', err);
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
        setJsonOutput(formatJson(rawJson));
        
        // Step 2: Process nodes (apply square bracket grammar)
        const processedData = processNodes(rawJson);
        setProcessedOutput(formatJson(processedData));
        
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
        setFlattenedOutput(formatJson(finalResult));
        setFlattenedData(finalResult);
        
        setParseError('');
      } else {
        setJsonOutput('');
        setProcessedOutput('');
        setFlattenedOutput('');
        setFlattenedData(null);
        setParseError(yamlResult.message);
      }
    } catch (error) {
      console.error('Processing error:', error);
      setParseError(`Processing error: ${error.message}`);
      setProcessedOutput('');
      setFlattenedOutput('');
      setFlattenedData(null);
    }
    
    setIsLoading(false);
  };

  const handleClear = () => {
    setYamlInput('');
    setJsonOutput('');
    setProcessedOutput('');
    setFlattenedOutput('');
    setParseError('');
  };

  const handleLoadSample = () => {
    setYamlInput(getSampleYaml(selectedSample));
    setJsonOutput('');
    setProcessedOutput('');
    setFlattenedOutput('');
    setFlattenedData(null);
    setParseError('');
  };

  const handleSampleChange = (sampleName) => {
    setSelectedSample(sampleName);
    setYamlInput(getSampleYaml(sampleName));
    setJsonOutput('');
    setProcessedOutput('');
    setFlattenedOutput('');
    setFlattenedData(null);
    setParseError('');
  };

  const handleLoadCornerCases = () => {
    setYamlInput(getCornerCaseYaml());
    setJsonOutput('');
    setProcessedOutput('');
    setFlattenedOutput('');
    setFlattenedData(null);
    setParseError('');
  };

  useEffect(() => {
    // click parse button automatically after 1 second
    setTimeout(() => {
      const parseButton = document.getElementById('parse-button');
      if (parseButton) {
        parseButton.click();
      }
    }, 1000);
  }, [yamlInput]);

  return (
    <div className="test-render-container">
      <div className="test-render-header">
        <h2 className="test-render-title">Yamd Parser - Complete Processing Pipeline</h2>
        <p className="test-render-description">Complete Yamd processing: YAML → Raw JSON → Processed Nodes → Flattened Structure</p>
      </div>
      
      <div className="button-controls">
        <button 
          id="parse-button"
          onClick={handleParse} 
          disabled={isLoading}
          className="btn btn-parse"
        >
          {isLoading ? 'Processing...' : 'Parse'}
        </button>
        
        <button 
          onClick={handleClear}
          className="btn btn-clear"
        >
          Clear
        </button>
        
        <button 
          onClick={handleLoadSample}
          className="btn btn-sample"
        >
          Reload Sample
        </button>
        
        <button 
          onClick={handleLoadCornerCases}
          className="btn btn-corner-cases"
        >
          Corner Cases
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

      <div className="panels-grid">
        {/* Panel 1: YAML Input */}
        <div className="panel">
          <h3 className="panel-title">1. YAML Input</h3>
          <textarea
            value={yamlInput}
            onChange={(e) => setYamlInput(e.target.value)}
            placeholder="Enter your YAML here..."
            className="panel-textarea panel-textarea-input"
          />
          <div className="panel-info">
            Lines: {yamlInput.split('\n').length} | Chars: {yamlInput.length}
          </div>
        </div>

        {/* Panel 2: Raw JSON */}
        <div className="panel">
          <h3 className="panel-title">2. Raw JSON</h3>
          {parseError ? (
            <div className="panel-error">
              <strong>Error:</strong><br />
              {parseError}
            </div>
          ) : (
            <textarea
              value={jsonOutput}
              readOnly
              placeholder="Raw JSON from YAML..."
              className="panel-textarea panel-textarea-raw-json"
            />
          )}
          <div className="panel-info">
            {parseError ? '❌ Failed' : jsonOutput ? `${jsonOutput.length} chars` : 'Ready'}
          </div>
        </div>

        {/* Panel 3: Processed Nodes */}
        <div className="panel">
          <h3 className="panel-title">3. Processed Nodes</h3>
          <textarea
            value={processedOutput}
            readOnly
            placeholder="Processed nodes with parsed attributes..."
            className="panel-textarea panel-textarea-processed"
          />
          <div className="panel-info">
            {processedOutput ? `${processedOutput.length} chars` : 'Awaiting processing'}
          </div>
        </div>

        {/* Panel 4: Flattened Structure */}
        <div className="panel">
          <h3 className="panel-title">4. Flattened Structure</h3>
          <textarea
            value={flattenedOutput}
            readOnly
            placeholder="Flattened ID-based structure..."
            className="panel-textarea panel-textarea-flattened"
          />
          <div className="panel-info">
            {flattenedOutput ? `${flattenedOutput.length} chars` : 'Awaiting flattening'}
          </div>
        </div>
      </div>

      {/* Full-width Rendering Panel */}
      {flattenedData && (
        <div className="rendered-document-section">
          <h3 className="rendered-document-title">5. Rendered Document</h3>
          <div className="rendered-document-container">
        <YamdDoc docData={flattenedData} disableRefJump={false} />
          </div>
        </div>
      )}

      <div className="pipeline-info">
        <h4 className="pipeline-title">Processing Pipeline:</h4>
        <ol className="pipeline-list">
          <li><strong>YAML Input:</strong> Enter YAML with square bracket grammar like <code>[self=panel, child=ul]</code> and inline LaTeX like <code>$E = mc^2$</code></li>
          <li><strong>Raw JSON:</strong> Direct YAML-to-JSON conversion without processing</li>
          <li><strong>Processed Nodes:</strong> Square bracket attributes parsed, nodes typed, children remain nested objects</li>
          <li><strong>Flattened Structure:</strong> ID-based flat dictionary with parent-child references</li>
          <li><strong>LaTeX Processing:</strong> Inline LaTeX patterns detected, registered in assets, and converted to clean HTML (NO MathJax fallback)</li>
        </ol>
        <div className="pipeline-examples">
          <strong>Grammar Examples:</strong> <code>name[self=panel]</code>, <code>[self=divider,child=ul]</code>, <code>item[selfClass=highlight]</code>
        </div>
      </div>
    </div>
  );
};

export default TestRender;
