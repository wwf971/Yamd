import React, { useState, useEffect } from 'react';
import YamdDoc from '@/core/YamdDoc.jsx';
import { useDocStore, docsData } from '@/core/DocStore.js';
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
import { DocDataDisplay } from './TestUtils.jsx';
import './TestEdit.css';

/**
 * TestEdit - Component for testing document editing functionality
 * Displays YAML source, rendered document, and flattened data side-by-side
 */
const TestEdit = () => {
  const sampleNames = getSampleYamlSeries('edit');
  const defaultSample = "text-rich";
  const [selectedSample, setSelectedSample] = useState(defaultSample);
  const [yamlInput, setYamlInput] = useState(getSampleYaml(defaultSample));
  const [flattenedData, setFlattenedData] = useState(null);
  const [flattenedOutput, setFlattenedOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [docId, setDocId] = useState(null);
  const [nodeIds, setNodeIds] = useState([]);

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
          
          // Generate a unique docId
          const newDocId = `doc_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
          
          // Initialize Jotai atoms from flattened data
          const docInfo = docsData.fromFlattenedData(newDocId, finalResult);
          
          // Store nodeIds for rendering individual node displays
          setNodeIds(docInfo.nodeIds);
          
          // Also store in Zustand for backward compatibility (will be removed later)
          useDocStore.getState().setDocData(newDocId, {
            docId: newDocId,
            createdAt: new Date().toISOString(),
            docData: finalResult
          });
          
          // Set docId state AFTER data is in store
          setDocId(newDocId);
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

  // Note: Real-time updates are now handled by Jotai subscriptions in NodeDataDisplay components
  // No need for manual Zustand subscription anymore

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
          <h3 className="rendered-panel-title">Rendered Document (Editable)</h3>
          <div className="rendered-panel-content">
            {docId ? (
              <YamdDoc 
                docId={docId}
                disableRefJump={false} 
                isEditable={true}
              />
            ) : (
              <div className="rendered-panel-placeholder">
                {isLoading ? 'Processing...' : 'No document to display'}
              </div>
            )}
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
    </div>
  );
};

export default TestEdit;
