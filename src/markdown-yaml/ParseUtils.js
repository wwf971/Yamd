// Utility to parse style syntax from node name
export const parseNodeStyle = (nodeName) => {
    // Allow empty name before brackets: both "name[style]" and "[style]" are valid
    const matchResult = nodeName.match(/^(.*?)\[(.+?)\]$/);
    if (matchResult) {
      const name = matchResult[1]; // Can be empty string
      const styleString = matchResult[2];

      // Parse comma-separated style attributes
      const styles = { self: 'default', child: 'default', childClass: null, selfClass: null, valueNum: null, panelDefault: null };
      styleString.split(',').forEach(attr => {
        const [key, value] = attr.split('=').map(s => s.trim());
        if (key === 'self' || key === 'child' || key === 'childClass' || key === 'selfClass' || key === 'panelDefault') {
          styles[key] = value;
        } else if (key === 'valueNum') {
          styles[key] = parseInt(value) || null;
        }
      });
      
      return {
        name,
        selfStyle: styles.self,
        childStyle: styles.child,
        childClass: styles.childClass,
        selfClass: styles.selfClass,
        valueNum: styles.valueNum,
        panelDefault: styles.panelDefault
      };
    }
    return {
      name: nodeName,
      selfStyle: 'default',
      childStyle: 'default',
      childClass: null,
      selfClass: null,
      valueNum: null,
      panelDefault: null
    };
  };