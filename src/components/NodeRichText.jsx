import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import YamdPlainText from './NodePlainText.jsx';
import YamdRichTextLaTeXInline from './NodeRichTextLaTeXInline.jsx';
import YamdRichTextRef from './NodeRichTextRef.jsx';
import YamdRichTextBib from './NodeRichTextBib.jsx';
import { calcBulletYPos as _calcBulletYPos} from './NodeRichText.js';

/**
 * Rich text renderer with inline LaTeX math support
 * Renders segmented text content with clean LaTeX conversion (NO MathJax fallback)
 * Also handles bullet positioning like YamdPlainText
 */
const YamdRichText = forwardRef(({ text, className, parentInfo, textRich = null, globalInfo = null }, ref) => {
  // ref to measure text for bullet positioning (used by Zustand system)
  const textRef = useRef(null);

  // console.log("YamdRichText textRich:", textRich);
  // expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    calcBulletYPos: (containerClassName) => {
      return _calcBulletYPos(textRef.current, textRich, containerClassName);
    }
  }), [textRich]);

  // Note: Bullet positioning is now handled entirely by Zustand store in YamdNodeText
  // All positioning logic moved to calcBulletYPos in YamdRichText.js
  // If textRich segments are provided, render them
  if (textRich && Array.isArray(textRich)) {
    return (
      <span ref={textRef} className={className}>
        {textRich.map((segment, index) => {
          if (segment.type === 'latex_inline') {
            // Use dedicated LaTeX component - NO MathJax fallback!
            return (
              <YamdRichTextLaTeXInline 
                key={index}
                segment={segment}
                globalInfo={globalInfo}
              />
            );
          } else if (segment.type === 'ref-asset') {
            // Use dedicated reference component
            return (
              <YamdRichTextRef
                key={index}
                segment={segment}
                globalInfo={globalInfo}
              />
            );
          } else if (segment.type === 'ref-bib') {
            // Use dedicated bibliography component
            return (
              <YamdRichTextBib
                key={index}
                segment={segment}
                globalInfo={globalInfo}
              />
            );
          } else {
            // Regular text segment
            return (
              <span key={index} className="yamd-text-segment">
                {segment.textRaw}
              </span>
            );
          }
        })}
      </span>
    );
  }

  console.log("ERROR: textRich is missing or invalid:", textRich);
  
  // Error: textRich should always exist
  return (
    <span ref={textRef} className={`${className} yamd-error`} style={{color: 'red', border: '1px solid red'}}>
      ERROR: textRich missing or invalid. text="{text}", textRich={JSON.stringify(textRich)}
    </span>
  );
});

YamdRichText.displayName = 'YamdRichText';

export default YamdRichText;