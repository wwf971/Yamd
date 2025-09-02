import yaml from 'js-yaml';

/**
 * Parse YAML string to JSON
 * @param {string} yamlString - The YAML string to parse
 * @returns {object} - {code: 0/1/2, message: string, data: object}
 */
export function parseYamlToJson(yamlString) {
  if (!yamlString || typeof yamlString !== 'string') {
    return {
      code: 1,
      message: 'Invalid input: YAML string is required',
      data: null
    };
  }

  try {
    const result = yaml.load(yamlString);
    return {
      code: 0,
      message: 'Success',
      data: result
    };
  } catch (error) {
    return {
      code: 2,
      message: `YAML parsing error: ${error.message}`,
      data: null
    };
  }
}

/**
 * Format JSON object as pretty-printed string
 * @param {any} obj - The object to format
 * @returns {string} - Pretty-printed JSON string
 */
export function formatJson(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (error) {
    return `Error formatting JSON: ${error.message}`;
  }
}
