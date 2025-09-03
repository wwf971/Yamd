import React, { useState } from 'react';
import YamdNode from './YamdNode.jsx';
import { loadMathJax } from '@/mathjax/MathJaxLoad.js';
import { 
  parseYamlToJson, 
  formatJson, 
  getSampleYaml, 
  getCornerCaseYaml,
  processNodes, 
  flattenJson,
  processAllLaTeXInline
} from './ParseYamd.js';

const TestYamd = () => {
  const [yamlInput, setYamlInput] = useState(getSampleYaml());
  const [jsonOutput, setJsonOutput] = useState('');
  const [processedOutput, setProcessedOutput] = useState('');
  const [flattenedOutput, setFlattenedOutput] = useState('');
  const [flattenedData, setFlattenedData] = useState(null);
  const [parseError, setParseError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // initialize mathjax
  React.useEffect(() => {
    console.log("🔧 Loading MathJax for TestYamd...");
    loadMathJax().catch(err => {
      console.error('Failed to load MathJax in TestYamd:', err);
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
        const finalData = await processAllLaTeXInline(flattenedData);
        
        const finalResult = { nodes: finalData.nodes, rootNodeId: finalData.rootNodeId, assets: finalData.assets };
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
    setYamlInput(getSampleYaml());
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
        
        <button 
          onClick={handleLoadCornerCases}
          style={{
            padding: '8px 16px',
            backgroundColor: '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Corner Cases
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto', gap: '15px' }}>
        {/* Panel 1: YAML Input */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '1rem' }}>1. YAML Input</h3>
          <textarea
            value={yamlInput}
            onChange={(e) => setYamlInput(e.target.value)}
            placeholder="Enter your YAML here..."
            style={{
              height: '300px',
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
              height: '300px',
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
                height: '300px',
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
              height: '300px',
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
              height: '300px',
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

      {/* Full-width Rendering Panel */}
      {flattenedData && (
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#333', fontSize: '1.1rem' }}>5. Rendered Document</h3>
          <div style={{
            border: '2px solid #28a745',
            borderRadius: '8px',
            padding: '20px',
            backgroundColor: '#f8fff8',
            minHeight: '200px'
          }}>
        <YamdNode
          nodeId={flattenedData.rootNodeId}
          getNodeDataById={(nodeId) => flattenedData.nodes[nodeId]}
          getAssetById={(assetId) => flattenedData.assets?.[assetId]}
          parentInfo={null}
          globalInfo={{
            fetchExternalData: (nodeData) => {
              // Default implementation: always return code 1 (component should handle itself)
              console.log('🌐 fetchExternalData called with:', nodeData);
              return {
                code: 1, // Component should handle data fetching itself
                message: 'Component should handle data fetching directly',
                data: null
              };
            }
          }}
        />
          </div>
        </div>
      )}

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e9ecef', borderRadius: '4px' }}>
        <h4 style={{ margin: '0 0 10px 0' }}>Processing Pipeline:</h4>
        <ol style={{ margin: 0, paddingLeft: '20px' }}>
          <li><strong>YAML Input:</strong> Enter YAML with square bracket grammar like <code>[self=panel, child=ul]</code> and inline LaTeX like <code>$E = mc^2$</code></li>
          <li><strong>Raw JSON:</strong> Direct YAML-to-JSON conversion without processing</li>
          <li><strong>Processed Nodes:</strong> Square bracket attributes parsed, nodes typed, children remain nested objects</li>
          <li><strong>Flattened Structure:</strong> ID-based flat dictionary with parent-child references</li>
          <li><strong>LaTeX Processing:</strong> Inline LaTeX patterns detected, registered in assets, and converted to clean HTML (NO MathJax fallback)</li>
        </ol>
        <div style={{ marginTop: '10px', fontSize: '0.9em', color: '#555' }}>
          <strong>Grammar Examples:</strong> <code>name[self=panel]</code>, <code>[self=divider,child=ul]</code>, <code>item[selfClass=highlight]</code>
        </div>
      </div>
    </div>
  );
};

export default TestYamd;
