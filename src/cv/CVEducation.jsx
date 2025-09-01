import React from 'react'
import { Node } from '@/markdown-yaml/Node.jsx'
import NodeRoot from '@/markdown-yaml/NodeRoot.jsx';
import { useAssetStore } from '@/asset/Asset.js'
import './CVEducation.css'

const CVEducation = () => {
  // Get education data from YAML (fetched centrally in App.jsx)
  const eduAssetPath = 'yaml/project/home/2-edu.yaml';
  const eduAsset = useAssetStore((state) => state.assets[eduAssetPath] || null);

  // Filter data to only show master and bachelor entries (same logic as Education.jsx)
  const getEducationDataFiltered = () => {
    if (!eduAsset?.content?.data) return null;
    
    const rawData = eduAsset.content.data;
    console.log('Raw education data:', rawData);
    
    // Filter for only master and bachelor types
    let dataFiltered = [
      ...rawData.filter(item => item.type === 'master'),
      ...rawData.filter(item => item.type === 'bachelor'),
    ];
    
    const dataTransformed = [];
    dataFiltered = dataFiltered.map(item => {
      
      const introKey = Object.keys(item).find(key => 
        key === 'intro' || key.startsWith('intro[')
      );
      const introData = introKey ? item[introKey] : null;

      // const timeStr = `${item.time.start.year}-${item.time.end.year}`;
      const timeStr = `Graduated in ${item.time.end.year}/${String(item.time.end.month).padStart(2, '0')}`;
      dataTransformed.push(
        {
          [`${timeStr}[self=top-right]`]:[{[`${item.school}[selfClass=cv-edu-school,child=ul]`]: [introData[1]]}]
        }
      );
    });
    
    console.warn('Filtered education dataTransformed:', dataTransformed);
    return dataTransformed;
  };

  const dataFiltered = getEducationDataFiltered();
  
  console.log('CVEducation - dataFiltered for Node:', dataFiltered);
  
  if (!dataFiltered || dataFiltered.length === 0) {
    return (
      <div className="education-section">
        <div className="cv-section-title" style={{ marginBottom: '-4px' }}>Education</div>
        <div className="education-loading">
          Loading education data...
        </div>
      </div>
    );
  }

  return (
    <div className="education-section">
      <div className="cv-section-title" style={{ marginBottom: '-4px' }}>Education</div>
      {/* <NodeRoot data={dataFiltered} rootStyle="default" /> */}
      <div style={{ paddingLeft: '3px', paddingRight: '6px' }}>
        <Node data={dataFiltered} rootStyle="default" />
      </div>
    </div>
  )
}

export default CVEducation
