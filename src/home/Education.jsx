import React from 'react';
import NodeRoot from '@/markdown-yaml/NodeRoot.jsx';

function Education({ eduAsset }) {
  // Filter data to only show master and undergraduate entries
  const getEducationDataFiltered = () => {
    if (!eduAsset?.content?.data) return null;
    
    const rawData = eduAsset.content.data;
    // console.log('Raw education data:', rawData);
    
    // filter for only master and undergraduate types
    const dataFiltered = [
      ...rawData.filter(item => 
        item.type === 'master'
      ),
      ...rawData.filter(item => 
        item.type === 'bachelor'
      ),
    ];
    
    // console.log('Filtered education data:', dataFiltered);
    
    // Transform into NodeRoot format (array of objects with single key-value pairs)
    const dataTransformed = dataFiltered.map((item, index) => {
      // Create a display key combining type and school
      // const displayKey = `${item.type}_${item.school}`;
      const displayKey = `${item.time.end.year}`;
      // Find the intro key - it could be "intro" or "intro[xxx]"
      const introKey = Object.keys(item).find(key => 
        key === 'intro' || key.startsWith('intro[')
      );
      const introData = introKey ? item[introKey] : null;
 
      return {
        // [displayKey] tell JavaScript to use the value of the displayKey variable as the property name
        // not the literal string "displayKey"
        [displayKey]: introData
      };
    });
    
    return dataTransformed;
  };

  // Education-specific parser for category names
  const parseEducationCategoryStyle = (categoryName) => {
    // For education, the year categories should display their content as plain-list
    // since the intro data comes from intro[child=plain-list] in YAML
    
    return {
      name: categoryName, // The year (e.g., "2024")
      selfStyle: 'default',
      childStyle: 'plain-list' // Force plain-list display for education intro
    };
  };

  const dataFiltered = getEducationDataFiltered();
  
  if (!dataFiltered || dataFiltered.length === 0) {
    return (
      <div className="education-loading">
        No education data available...
      </div>
    );
  }

  return (
    <div className="education">
      <NodeRoot 
        data={dataFiltered}
        title="Education"
        parseCategoryStyle={parseEducationCategoryStyle}
        lineAboveFirstRoot={{
          height: '10px',
          text: 'future',
          textStyle: { color: '#888' },
          lineStyle: { background: '#888' }
        }}
        lineBelowLastRoot={{
          height: '40px',
          text: 'past',
          textStyle: { color: '#888' },
          lineStyle: { background: '#888' }
        }}
        addDividerLine={false}
      />
    </div>
  );
}

export default Education;
