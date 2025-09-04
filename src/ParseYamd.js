// Main Yamd parser - imports decomposed modules for better readability

// YAML to JSON conversion
import { parseYamlToJson as parseYamlToJsonInternal, formatJson as formatJsonInternal } from './parse/_0_yaml_to_json.js';
export { parseYamlToJson, formatJson } from './parse/_0_yaml_to_json.js';

// Sample data
export { getSampleYaml, getCornerCaseYaml } from './parse/_0_yaml_sample.js';

// Attribute parsing
export { 
  extractSquareBracketAttr, 
  normalizeAttrKey, 
  normalizeAttributeValue, 
  parseShorthandAttribute 
} from './parse/_1_parse_attr.js';

// Tree building
import { processNodes as processNodesInternal } from './parse/_2_build_nodes_tree.js';
export { processNodes } from './parse/_2_build_nodes_tree.js';

// Tree flattening  
import { flattenJson as flattenJsonInternal } from './parse/_3_flatten_nodes_tree.js';
export { flattenJson } from './parse/_3_flatten_nodes_tree.js';

// Text segment processing (LaTeX, refs, bibs)
import { processAllTextSegments as processAllTextSegmentsInternal, scanAssets as scanAssetsInternal } from './parse/_4_text_segment.js';
export { parseLatexInline, processAllTextSegments, scanAssets } from './parse/_4_text_segment.js';

/**
 * Complete Yamd processing pipeline
 * @param {string} yamlString - Input YAML string
 * @param {boolean} processLatex - Whether to process LaTeX (default: true)
 * @returns {object} - {success: boolean, data: object, error: string}
 */
export async function processYamd(yamlString, processLatex = true) {
  console.log("processYamd called!");
  try {
    // Step 1: Parse YAML to JSON
    console.log("Step 1: Parse YAML to JSON");
    const yamlResult = parseYamlToJsonInternal(yamlString);
    if (yamlResult.code !== 0) {
      return {
        success: false,
        data: null,
        error: yamlResult.message
      };
    }

    // Step 2: Process nodes (apply square bracket grammar)
    console.log("Step 2: Process nodes");
    const processedData = processNodesInternal(yamlResult.data);

    // Step 3: Flatten to ID-based structure
    console.log("Step 3: Flatten to ID-based structure");
    const flattenedData = flattenJsonInternal(processedData);

    // Step 4: Process text segments (LaTeX, refs, bibs) (optional)
    let finalData = flattenedData;
    console.log("Before processAllTextSegments, processLatex:", processLatex);
    if (processLatex) {
      console.log("Calling processAllTextSegments...");
      finalData = await processAllTextSegmentsInternal(flattenedData);
      console.log("processAllTextSegments completed");
    }
    console.log("finalData: ", finalData);
    // Step 5: Scan assets for proper indexing (especially image-list subindices)
    
    // Check if we have assets to scan
    if (finalData.assets && Object.keys(finalData.assets).length > 0) {
      console.log("Calling scanAssets with", Object.keys(finalData.assets).length, "assets");
      scanAssetsInternal(finalData.nodes, finalData.assets);
    } else {
      console.log("No assets to scan, finalData.assets:", finalData.assets);
    }

  return {
    code: 0,
    message: 'Success',
    data: { 
      nodes: finalData.nodes, 
      rootNodeId: finalData.rootNodeId, 
      assets: finalData.assets, 
      refs: finalData.refs || {},
      bibs: finalData.bibs || {},
      bibsLookup: finalData.bibsLookup || {}
    }
  };
  } catch (error) {
    return {
      code: -1,
      message: error.message,
      data: null
    };
  }
}