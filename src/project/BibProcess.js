
export const extractCitationsFromText = (text) => {
  const keys = new Set();
  if (!text || typeof text !== 'string') return keys;
  
  const matches = text.match(/\\bib\{([\w\d-]+(?:,[\w\d-]+)*)\}/g);
  if (matches) {
    matches.forEach(match => {
      const keysString = match.match(/\\bib\{([\w\d-]+(?:,[\w\d-]+)*)\}/)[1];
      const extractedKeys = keysString.split(',').map(key => key.replace('bib.', '').trim());
      extractedKeys.forEach(key => keys.add(key));
    });
  }
  return keys;
};

export const extractAllBibKeysFromNodes = (nodesDict) => {
  const allBibKeys = new Set();
  Object.values(nodesDict).forEach(node => {
    // extract from text_raw
    if (node.text_raw) {
      const keys = extractCitationsFromText(node.text_raw);
      keys.forEach(key => allBibKeys.add(key));
    }
    
    // extract from title
    if (node.title) {
      const keys = extractCitationsFromText(node.title);
      if (keys.size > 0) {
        // console.log('🔍 Found citations in title:', node.title, Array.from(keys));
      }
      keys.forEach(key => allBibKeys.add(key));
    }
    
    // extract from caption
    if (node.caption) {
      const keys = extractCitationsFromText(node.caption);
      keys.forEach(key => allBibKeys.add(key));
    }
  });
  return allBibKeys;
};
