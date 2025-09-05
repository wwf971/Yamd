import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import YamdPlainText from './YamdPlainText.jsx';
import YamdRichTextLaTeXInline from './YamdRichTextLaTeXInline.jsx';
import YamdRichTextRef from './YamdRichTextRef.jsx';
import YamdRichTextBib from './YamdRichTextBib.jsx';
import { calcPreferredBulletYPose as _calcPreferredBulletYPose} from './YamdRichText.js';

/**
 * Rich text renderer with inline LaTeX math support
 * Renders segmented text content with clean LaTeX conversion (NO MathJax fallback)
 * Also handles bullet positioning like YamdPlainText
 */
const YamdRichText = forwardRef(({ text, className, parentInfo, textRich = null, globalInfo = null }, ref) => {
  // ref to measure text for bullet positioning (used by Zustand system)
  const textRef = useRef(null);

  // expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    calcPreferredBulletYPose: (containerClassName) => {
      return _calcPreferredBulletYPose(textRef.current, textRich, containerClassName);
    }
  }), [textRich]);

  // Note: Bullet positioning is now handled entirely by Zustand store in YamdNodeText
  // All positioning logic moved to calcPreferredBulletYPose in YamdRichText.js
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
  
  // Fallback to plain text renderer if no textRich segments
  return (
    <YamdPlainText 
      text={text} 
      className={className} 
      parentInfo={parentInfo} 
    />
  );
});

YamdRichText.displayName = 'YamdRichText';

export default YamdRichText;