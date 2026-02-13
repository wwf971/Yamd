import NodeCustomBox from '@/custom/NodeCustomBox.jsx';
import CustomCompNotFoundError from '@/custom/CustomCompNotFoundError.jsx';

const registry = new Map();

registry.set('box', NodeCustomBox);

export const getCustomComp = (customType) => {
  if (!customType) return CustomCompNotFoundError;
  return registry.get(customType) || CustomCompNotFoundError;
};

export const registerCustomComp = (customType, component) => {
  if (!customType || !component) return { code: -1, message: 'customType and component are required' };
  registry.set(customType, component);
  return { code: 0 };
};

export const unregisterCustomComp = (customType) => {
  if (!customType) return { code: -1, message: 'customType is required' };
  registry.delete(customType);
  return { code: 0 };
};

export const clearCustomCompRegistry = () => {
  registry.clear();
  return { code: 0 };
};