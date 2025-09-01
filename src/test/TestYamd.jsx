import React, { useState } from 'react';
import { 
  parseYamlToJson, 
  formatJson, 
  getSampleYaml, 
  processNodes, 
  flattenJson 
} from './ParseYamd.js';

const TestYamd = () => {
  const [yamlInput, setYamlInput] = useState(getSampleYaml());
  const [jsonOutput, setJsonOutput] = useState('');
  const [processedOutput, setProcessedOutput] = useState('');
  const [flattenedOutput, setFlattenedOutput] = useState('');
  const [parseError, setParseError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleParse = () => {
    setIsLoading(true);
    setParseError('');
    
    // Add small delay to show loading state
    setTimeout(() => {
      const yamlResult = parseYamlToJson(yamlInput);
      
      if (yamlResult.success) {
        try {
          // Step 1: YAML → JSON
          const rawJson = yamlResult.data;
          setJsonOutput(formatJson(rawJson));
          
          // Step 2: Process nodes (apply square bracket grammar)
          const processedData = processNodes(rawJson);
          setProcessedOutput(formatJson(processedData));
          
          // Step 3: Flatten to ID-based structure
          const { flattened, rootId } = flattenJson(processedData);
          const flattenedResult = { nodes: flattened, rootId };
          setFlattenedOutput(formatJson(flattenedResult));
          
          setParseError('');
        } catch (error) {
          console.error('Processing error:', error);
          setParseError(`Processing error: ${error.message}`);
          setProcessedOutput('');
          setFlattenedOutput('');
        }
      } else {
        setJsonOutput('');
        setProcessedOutput('');
        setFlattenedOutput('');
        setParseError(yamlResult.error);
      }
      
      setIsLoading(false);
    }, 100);
  };

  const handleClear = () => {
    setYamlInput('');
    setJsonOutput('');
    setProcessedOutput('');
    setFlattenedOutput('');
    setParseError('');
  };

  const handleLoadSample = () => {
    setYamlInput(getSampleYaml());
    setJsonOutput('');
    setProcessedOutput('');
    setFlattenedOutput('');
    setParseError('');
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Yamd Parser - Complete Processing Pipeline</h2>
      <p>Complete Yamd processing: YAML → Raw JSON → Processed Nodes → Flattened Structure</p>
      
      <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button 
          onClick={handleParse} 
          disabled={isLoading}
          style={{
            padding: '8px 16px',
            backgroundColor: '#007acc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1
          }}
        >
          {isLoading ? 'Processing...' : 'Parse Complete Pipeline'}
        </button>
        
        <button 
          onClick={handleClear}
          style={{
            padding: '8px 16px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Clear
        </button>
        
        <button 
          onClick={handleLoadSample}
          style={{
            padding: '8px 16px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Load Sample
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '15px', height: '600px' }}>
        {/* Panel 1: YAML Input */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '1rem' }}>1. YAML Input</h3>
          <textarea
            value={yamlInput}
            onChange={(e) => setYamlInput(e.target.value)}
            placeholder="Enter your YAML here..."
            style={{
              flex: 1,
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontFamily: 'Monaco, Consolas, "Lucida Console", monospace',
              fontSize: '12px',
              resize: 'none',
              outline: 'none'
            }}
          />
          <div style={{ marginTop: '3px', fontSize: '11px', color: '#666' }}>
            Lines: {yamlInput.split('\n').length} | Chars: {yamlInput.length}
          </div>
        </div>

        {/* Panel 2: Raw JSON */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '1rem' }}>2. Raw JSON</h3>
          {parseError ? (
            <div style={{
              flex: 1,
              padding: '8px',
              border: '1px solid #dc3545',
              borderRadius: '4px',
              backgroundColor: '#f8d7da',
              color: '#721c24',
              fontFamily: 'Monaco, Consolas, "Lucida Console", monospace',
              fontSize: '11px',
              overflow: 'auto'
            }}>
              <strong>Error:</strong><br />
              {parseError}
            </div>
          ) : (
            <textarea
              value={jsonOutput}
              readOnly
              placeholder="Raw JSON from YAML..."
              style={{
                flex: 1,
                padding: '8px',
                border: '1px solid #007acc',
                borderRadius: '4px',
                fontFamily: 'Monaco, Consolas, "Lucida Console", monospace',
                fontSize: '11px',
                resize: 'none',
                outline: 'none',
                backgroundColor: '#f0f8ff'
              }}
            />
          )}
          <div style={{ marginTop: '3px', fontSize: '11px', color: '#666' }}>
            {parseError ? '❌ Failed' : jsonOutput ? `${jsonOutput.length} chars` : 'Ready'}
          </div>
        </div>

        {/* Panel 3: Processed Nodes */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '1rem' }}>3. Processed Nodes</h3>
          <textarea
            value={processedOutput}
            readOnly
            placeholder="Processed nodes with parsed attributes..."
            style={{
              flex: 1,
              padding: '8px',
              border: '1px solid #28a745',
              borderRadius: '4px',
              fontFamily: 'Monaco, Consolas, "Lucida Console", monospace',
              fontSize: '11px',
              resize: 'none',
              outline: 'none',
              backgroundColor: '#f0fff0'
            }}
          />
          <div style={{ marginTop: '3px', fontSize: '11px', color: '#666' }}>
            {processedOutput ? `${processedOutput.length} chars` : 'Awaiting processing'}
          </div>
        </div>

        {/* Panel 4: Flattened Structure */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '1rem' }}>4. Flattened Structure</h3>
          <textarea
            value={flattenedOutput}
            readOnly
            placeholder="Flattened ID-based structure..."
            style={{
              flex: 1,
              padding: '8px',
              border: '1px solid #ffc107',
              borderRadius: '4px',
              fontFamily: 'Monaco, Consolas, "Lucida Console", monospace',
              fontSize: '11px',
              resize: 'none',
              outline: 'none',
              backgroundColor: '#fffbf0'
            }}
          />
          <div style={{ marginTop: '3px', fontSize: '11px', color: '#666' }}>
            {flattenedOutput ? `${flattenedOutput.length} chars` : 'Awaiting flattening'}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e9ecef', borderRadius: '4px' }}>
        <h4 style={{ margin: '0 0 10px 0' }}>Processing Pipeline:</h4>
        <ol style={{ margin: 0, paddingLeft: '20px' }}>
          <li><strong>YAML Input:</strong> Enter YAML with square bracket grammar like <code>[self=panel, child=ul]</code></li>
          <li><strong>Raw JSON:</strong> Direct YAML-to-JSON conversion without processing</li>
          <li><strong>Processed Nodes:</strong> Square bracket attributes parsed, nodes typed, children remain nested objects</li>
          <li><strong>Flattened Structure:</strong> ID-based flat dictionary with parent-child references (like ProjectStore)</li>
        </ol>
        <div style={{ marginTop: '10px', fontSize: '0.9em', color: '#555' }}>
          <strong>Grammar Examples:</strong> <code>name[self=panel]</code>, <code>[self=divider,child=ul]</code>, <code>item[selfClass=highlight]</code>
        </div>
      </div>
    </div>
  );
};

export default TestYamd;
