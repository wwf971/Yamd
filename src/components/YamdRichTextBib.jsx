import React from 'react';

/**
 * Bibliography reference segment renderer - displays clickable bibliography citations
 * Renders ref-bib segments with click handling for navigation to bibliography list
 */
const YamdRichTextBib = ({ segment, globalInfo }) => {
  if (!segment || segment.type !== 'ref-bib') {
    console.warn('YamdRichTextBib received invalid segment:', segment);
    return <span className="yamd-bib-fallback">{segment?.textRaw || '[Invalid Bib]'}</span>;
  }

  if (!globalInfo?.onBibClick) {
    // No click handler available - render as plain text
    return <span className="yamd-bib-text">[{segment.displayText}]</span>;
  }

  const { bibKeys, bibIds, displayText } = segment;

  // Simple click handler for individual bib keys
  const handleBibClick = (bibKey, bibId) => (e) => {
    e.preventDefault();
    if (globalInfo.onBibClick) {
      globalInfo.onBibClick({
        bibKey: bibKey,
        bibId: bibId,
        sourceElement: e.target
      });
    }
  };

  // If multiple keys, render as separate clickable spans
  if (bibKeys.length > 1) {
    return (
      <span className="yamd-bib-group">
        [
        {bibKeys.map((bibKey, index) => {
          const bibId = bibIds[index];
          return (
            <React.Fragment key={bibKey}>
              <span 
                className="yamd-bib-link"
                onClick={handleBibClick(bibKey, bibId)}
                data-bib-key={bibKey}
                data-bib-id={bibId}
                style={{ cursor: 'pointer' }}
              >
                {bibKey}
              </span>
              {index < bibKeys.length - 1 && <span className="yamd-bib-separator">, </span>}
            </React.Fragment>
          );
        })}
        ]
      </span>
    );
  }

  // Single key - use the same handler
  const singleBibKey = bibKeys[0];
  const singleBibId = bibIds[0];

  return (
    <span 
      className="yamd-bib-link"
      onClick={handleBibClick(singleBibKey, singleBibId)}
      data-bib-key={singleBibKey}
      data-bib-id={singleBibId}
      style={{ cursor: 'pointer' }}
    >
      [{displayText}]
    </span>
  );
};

export default YamdRichTextBib;
