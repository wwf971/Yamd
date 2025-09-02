// Main Yamd parser - imports decomposed modules for better readability

// YAML to JSON conversion
export { parseYamlToJson, formatJson } from './parse/_0_yaml_to_json.js';

// Sample data
export { getSampleYaml, getCornerCaseYaml } from './parse/_0_yaml_sample.js';

// Attribute parsing
export { 
  extractSquareBracketAttr, 
  normalizeAttributeKey, 
  normalizeAttributeValue, 
  parseShorthandAttribute 
} from './parse/_1_parse_attr.js';

// Tree building
export { processNodes } from './parse/_2_build_nodes_tree.js';

// Tree flattening  
export { flattenJson } from './parse/_3_flatten_nodes_tree.js';

/**
 * Complete Yamd processing pipeline
 * @param {string} yamlString - Input YAML string
 * @returns {object} - {success: boolean, data: object, error: string}
 */
export function processYamd(yamlString) {
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
    const { flattened, rootId } = flattenJson(processedData);

    return {
      success: true,
      data: { nodes: flattened, rootId },
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