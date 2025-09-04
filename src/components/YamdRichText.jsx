import React, { useRef, useEffect } from 'react';
import YamdPlainText from './YamdPlainText.jsx';
import YamdRichTextLaTeXInline from './YamdRichTextLaTeXInline.jsx';
import YamdRichTextRef from './YamdRichTextRef.jsx';
import YamdRichTextBib from './YamdRichTextBib.jsx';

/**
 * Rich text renderer with inline LaTeX math support
 * Renders segmented text content with clean LaTeX conversion (NO MathJax fallback)
 * Also handles bullet positioning like YamdPlainText
 */
const YamdRichText = ({ text, className, parentInfo, textRich = null, globalInfo = null }) => {
  // Ref to measure text for bullet positioning
  const textRef = useRef(null);
  // Ref to track if we've already notified parent to prevent infinite loops
  const hasNotifiedRef = useRef(false);

  // Notify parent about preferred bullet Y position if there's a bullet to the left
  useEffect(() => {
    if (parentInfo?.hasBulletToLeft && parentInfo?.notifyPreferredBulletYPos && textRef.current && !hasNotifiedRef.current) {
      const preferredBulletYPosOffset = 0;
      const textElement = textRef.current;
      
      // Use textRich data to determine the first segment type and get its element
      if (textRich && Array.isArray(textRich) && textRich.length > 0) {
        const firstSegment = textRich[0];
        
        // Handle different segment types based on textRich data
        if (firstSegment.type === 'latex') {
          // First segment is LaTeX - get the LaTeX component element
          const firstSegmentElement = textElement.children[0]; // Should be the LaTeX component
          
          if (firstSegmentElement) {
            const firstSegmentRect = firstSegmentElement.getBoundingClientRect();
            
            // Find the bullet container using dynamic class name from parentInfo
            const bulletContainerClass = parentInfo?.bulletContainerClassName || '.yamd-bullet-container';
            if (parentInfo?.bulletContainerClassName) {
              console.log('Child found bullet container class from parentInfo:', parentInfo.bulletContainerClassName);
            }
            const bulletContainer = textElement.closest(bulletContainerClass);
            
            if (bulletContainer && firstSegmentRect.height > 0) {
              // Use the midline of the LaTeX element relative to bullet container
              const containerRect = bulletContainer.getBoundingClientRect();
              const segmentRelativeTop = firstSegmentRect.top - containerRect.top;
              const preferredBulletYPos = segmentRelativeTop + (firstSegmentRect.height / 2) - 3;
              // console.log('YamdRichText calculated bullet position:', preferredBulletYPos, 'px from container top');
              parentInfo.notifyPreferredBulletYPos(preferredBulletYPos);
              hasNotifiedRef.current = true;
              return;
            } else if (firstSegmentRect.height > 0) {
              // Fallback: use textElement itself as reference
              const containerRect = textElement.getBoundingClientRect();
              const segmentRelativeTop = firstSegmentRect.top - containerRect.top;
              const preferredBulletYPos = segmentRelativeTop + (firstSegmentRect.height / 2) - 3;
              // console.log('YamdRichText calculated bullet position:', preferredBulletYPos, 'px from container top');
              parentInfo.notifyPreferredBulletYPos(preferredBulletYPos);
              hasNotifiedRef.current = true;
              return;
            }
          }
        } else {
          // First segment is text - use simple midline of the segment
          const firstSegmentElement = textElement.children[0]; // Should be the text span
          
          if (firstSegmentElement) {
            const firstSegmentRect = firstSegmentElement.getBoundingClientRect();
            
            // Find the bullet container using dynamic class name from parentInfo
            const bulletContainerClass = parentInfo?.bulletContainerClassName || '.yamd-bullet-container';
            if (parentInfo?.bulletContainerClassName) {
              // console.warn('Child found bullet container class from parentInfo:', parentInfo.bulletContainerClassName);
            }
            const bulletContainer = textElement.closest(bulletContainerClass);
            
            if (bulletContainer && firstSegmentRect.height > 0) {
              // Use the simple midline of the text segment relative to bullet container
              const containerRect = bulletContainer.getBoundingClientRect();
              const segmentRelativeTop = firstSegmentRect.top - containerRect.top;
              const preferredBulletYPos = segmentRelativeTop + (firstSegmentRect.height / 2) - preferredBulletYPosOffset;
              console.warn('preferredBulletYPos', preferredBulletYPos);
              parentInfo.notifyPreferredBulletYPos(preferredBulletYPos);
              hasNotifiedRef.current = true;
              return;
            } else if (firstSegmentRect.height > 0) {
              // Fallback: use textElement itself as reference
              const containerRect = textElement.getBoundingClientRect();
              const segmentRelativeTop = firstSegmentRect.top - containerRect.top;
              const preferredBulletYPos = segmentRelativeTop + (firstSegmentRect.height / 2) - preferredBulletYPosOffset;
              // console.log('YamdRichText calculated bullet position (fallback):', preferredBulletYPos, 'px from container top');
              parentInfo.notifyPreferredBulletYPos(preferredBulletYPos);
              hasNotifiedRef.current = true;
              return;
            }
          }
        }
      }
      // console.warn('textRich is not an array or is empty');
      // Fallback for non-rich text or if first segment element not found
      // Try to get the first child element
      const firstChild = textElement.firstElementChild || textElement.firstChild;
      
      if (firstChild) {
        if (firstChild.nodeType === Node.ELEMENT_NODE) {
          // First child is an element
          const firstSegmentRect = firstChild.getBoundingClientRect();
          const containerRect = textElement.getBoundingClientRect();
          
          if (firstSegmentRect.height > 0) {
            const segmentRelativeTop = firstSegmentRect.top - containerRect.top;
            const preferredBulletYPos = segmentRelativeTop + (firstSegmentRect.height / 2) - preferredBulletYPosOffset;
            parentInfo.notifyPreferredBulletYPos(preferredBulletYPos);
            return;
          }
        }
      }
      
      // Final fallback: use line height estimation
      const computedStyle = window.getComputedStyle(textElement);
      const lineHeight = parseFloat(computedStyle.lineHeight);
      const fontSize = parseFloat(computedStyle.fontSize);
      const actualLineHeight = isNaN(lineHeight) ? fontSize * 1.2 : lineHeight;
      const preferredBulletYPos = actualLineHeight / 2 - preferredBulletYPosOffset;
      parentInfo.notifyPreferredBulletYPos(preferredBulletYPos);
      hasNotifiedRef.current = true;
    }
  }, [parentInfo, text, textRich]);
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
};

export default YamdRichText;