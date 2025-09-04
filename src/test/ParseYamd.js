// Main Yamd parser - imports decomposed modules for better readability

// YAML to JSON conversion
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
export { processNodes } from './parse/_2_build_nodes_tree.js';

// Tree flattening  
export { flattenJson } from './parse/_3_flatten_nodes_tree.js';

// Text segment processing (LaTeX, refs, bibs)
export { parseLatexInline, processAllTextSegments } from './parse/_4_text_segment.js';

/**
 * Complete Yamd processing pipeline
 * @param {string} yamlString - Input YAML string
 * @param {boolean} processLatex - Whether to process LaTeX (default: true)
 * @returns {object} - {success: boolean, data: object, error: string}
 */
export async function processYamd(yamlString, processLatex = true) {
  try {
    // Step 1: Parse YAML to JSON
    const yamlResult = parseYamlToJson(yamlString);
    if (yamlResult.code !== 0) {
      return {
        success: false,
        data: null,
        error: yamlResult.message
      };
    }

    // Step 2: Process nodes (apply square bracket grammar)
    const processedData = processNodes(yamlResult.data);

    // Step 3: Flatten to ID-based structure
    const flattenedData = flattenJson(processedData);

    // Step 4: Process text segments (LaTeX, refs, bibs) (optional)
    let finalData = flattenedData;
    if (processLatex) {
      finalData = await processAllTextSegments(flattenedData);
    }

      return {
    success: true,
    data: { 
      nodes: finalData.nodes, 
      rootNodeId: finalData.rootNodeId, 
      assets: finalData.assets, 
      refs: finalData.refs || {},
      bibs: finalData.bibs || {},
      bibsLookup: finalData.bibsLookup || {}
    },
    error: null
  };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}