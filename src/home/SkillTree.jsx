import React from 'react';
import NodeRoot from '@/markdown-yaml/NodeRoot.jsx';
import './SkillTree.css';

function SkillTree({ skillsAsset, title="Skill Set" }) {
  // Skills-specific parser that handles legacy syntax
  const parseSkillCategoryStyle = (categoryName) => {
    const styleMatch = categoryName.match(/^(.+?)\[(.+?)\]$/);
    if (styleMatch) {
      const name = styleMatch[1];
      const styleString = styleMatch[2];
      
      // Parse comma-separated style attributes
      const styles = { self: 'default', child: 'default' };
      styleString.split(',').forEach(attr => {
        const [key, value] = attr.split('=').map(s => s.trim());
        if (key === 'self' || key === 'child') {
          styles[key] = value;
        }
        // Legacy support: treat bare "style=ul" as "child=ul"
        if (key === 'style' && value === 'ul') {
          styles.child = 'ul';
        }
      });
      
      return {
        name,
        selfStyle: styles.self,
        childStyle: styles.child
      };
    }
    return {
      name: categoryName,
      selfStyle: 'default',
      childStyle: 'default'
    };
  };

  return (
    <div className="skill-tree">
      <NodeRoot 
        data={skillsAsset?.content?.data}
        title={title}
        parseCategoryStyle={parseSkillCategoryStyle}
      />
    </div>
  );
}

export default SkillTree;
