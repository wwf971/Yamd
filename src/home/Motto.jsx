import React from 'react';
import './Motto.css';

function Motto({motto_sentence, motto_people=null, motto_people_in_next_line=true}) {
  return (
    <div className="motto-container">
      {motto_people_in_next_line ? (
        // Multi-line layout: motto on first line, attribution on second line (right-aligned)
        <>
          <div>{motto_sentence}</div>
          {motto_people && (
            <div className="motto-attribution-nextline">
              -- {motto_people}
            </div>
          )}
        </>
      ) : (
        // Single line layout: motto and attribution on same line
        <span>
          {motto_sentence}
          {motto_people && (
            <span className="motto-attribution-sameline">
              -- {motto_people}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

export default Motto;
