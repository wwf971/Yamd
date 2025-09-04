import React from 'react';

/**
 * Bibliography list renderer - displays referenced bibliography at the end of document
 * Similar to YamdRefHandler but for bibliography management
 */
const YamdBibsList = ({ bibs, globalInfo }) => {
  if (!bibs || Object.keys(bibs).length === 0) {
    return (
      <div className="yamd-bibs-list">
        <h3 className="yamd-bibs-title">References</h3>
        <div className="yamd-bibs-content">
          <div className="yamd-bib-entry">
            <span className="yamd-bib-text">No bibliography cited</span>
          </div>
        </div>
      </div>
    );
  }

  // Filter to only show bibs that are actually referenced
  const referencedBibs = Object.values(bibs).filter(bib => 
    bib.referencedBy && bib.referencedBy.length > 0
  );

  if (referencedBibs.length === 0) {
    return (
      <div className="yamd-bibs-list">
        <h3 className="yamd-bibs-title">References</h3>
        <div className="yamd-bibs-content">
          <div className="yamd-bib-entry">
            <span className="yamd-bib-text">No bibliography cited</span>
          </div>
        </div>
      </div>
    );
  }

  // Sort bibs by order of first reference (not alphabetical)
  const sortedBibs = referencedBibs.sort((a, b) => {
    const aFirstRef = Math.min(...a.referencedBy);
    const bFirstRef = Math.min(...b.referencedBy);
    return aFirstRef - bFirstRef;
  });

  const getBibText = (bibKey) => {
    if (globalInfo?.getBibText) {
      const result = globalInfo.getBibText(bibKey);
      if (result.code === 0) {
        return result.data;
      }
    }
    // Return null for fallback - we'll handle the display separately
    return null;
  };

  return (
    <div className="yamd-bibs-list">
      <h3 className="yamd-bibs-title">References</h3>
      <div className="yamd-bibs-content">
        {sortedBibs.map((bib, index) => {
          const bibText = getBibText(bib.bibKey);
          return (
            <div 
              key={bib.id} 
              id={bib.id} 
              className="yamd-bib-entry"
              data-bib-key={bib.bibKey}
            >
              <span className="yamd-bib-index">[{index + 1}]</span>
              <span className="yamd-bib-key">[{bib.bibKey}]</span>
              {bibText ? (
                <span className="yamd-bib-text">{bibText}</span>
              ) : (
                <span className="yamd-bib-fallback">Citation text not available</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default YamdBibsList;
