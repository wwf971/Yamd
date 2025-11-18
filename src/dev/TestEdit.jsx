import React, { useState, useEffect } from 'react';
import YamdDoc from '@/core/YamdDoc.jsx';
import { loadMathJax } from '@/mathjax/MathJaxLoad.js';
import { 
  parseYamlToJson, 
  formatJson, 
  getSampleYaml,
  getSampleYamlNames,
  processNodes, 
  flattenJson,
  processAllTextSegments
} from '@/parse/ParseYamd.js';
import './TestEdit.css';

/**
 * TestEdit - Component for testing document editing functionality
 * Displays YAML source, rendered document, and flattened data side-by-side
 */
const TestEdit = () => {
  const sampleNames = getSampleYamlNames();
  const defaultSample = "rich-text";
  const [selectedSample, setSelectedSample] = useState(defaultSample);
  const [yamlInput, setYamlInput] = useState(getSampleYaml(defaultSample));
  const [flattenedData, setFlattenedData] = useState(null);
  const [flattenedOutput, setFlattenedOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Initialize MathJax
  useEffect(() => {
    console.log("🔧 Loading MathJax for TestEdit...");
    loadMathJax().catch(err => {
      console.error('Failed to load MathJax in TestEdit:', err);
    });
  }, []);

  // Auto-parse when YAML input changes
  useEffect(() => {
    const parseYaml = async () => {
      setIsLoading(true);
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
          
          setFlattenedOutput(formatJson(finalResult));
          setFlattenedData(finalResult);
        } else {
          setFlattenedOutput('');
          setFlattenedData(null);
        }
      } catch (error) {
        console.error('Processing error:', error);
        setFlattenedOutput('');
        setFlattenedData(null);
      }
      setIsLoading(false);
    };

    // Debounce parsing to avoid excessive processing
    const timer = setTimeout(parseYaml, 500);
    return () => clearTimeout(timer);
  }, [yamlInput]);

  const handleSampleChange = (sampleName) => {
    setSelectedSample(sampleName);
    setYamlInput(getSampleYaml(sampleName));
  };

  return (
    <div className="test-edit-container">
      <div className="test-edit-header">
        <h2 className="test-edit-title">YAMD Document Editor</h2>
        <p className="test-edit-description">View YAML source, rendered document, and internal flattened representation</p>
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

      {/* Top Row: YAML Display */}
      <div className="yaml-display-section">
        <h3 className="yaml-display-title">YAML Source</h3>
        <textarea
          value={yamlInput}
          readOnly
          className="yaml-display-textarea"
          placeholder="YAML source will appear here..."
        />
      </div>

      {/* Bottom Row: Split View */}
      <div className="split-view-section">
        {/* Left Panel: Rendered Document */}
        <div className="rendered-panel">
          <h3 className="rendered-panel-title">Rendered Document (Future: Editable)</h3>
          <div className="rendered-panel-content">
            {flattenedData ? (
              <YamdDoc docData={flattenedData} disableRefJump={false} />
            ) : (
              <div className="rendered-panel-placeholder">
                {isLoading ? 'Processing...' : 'No document to display'}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Flattened Data */}
        <div className="flattened-panel">
          <h3 className="flattened-panel-title">Flattened Data (Future: Real-time Updates)</h3>
          <textarea
            value={flattenedOutput}
            readOnly
            className="flattened-panel-textarea"
            placeholder="Flattened document structure will appear here..."
          />
          <div className="flattened-panel-info">
            {flattenedOutput ? `${flattenedOutput.length} chars` : 'Awaiting data'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestEdit;
