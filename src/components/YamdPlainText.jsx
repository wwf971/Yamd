import React, { useRef, useEffect } from 'react';

/**
 * Plain text renderer with bullet positioning support
 * Measures text to notify parent about preferred bullet Y position (first line midline)
 */
const YamdPlainText = ({ text, className, parentInfo }) => {
  // Ref to measure text for bullet positioning
  const textRef = useRef(null);
  // console.log('YamdPlainText:', text)
  // Notify parent about preferred bullet Y position if there's a bullet to the left
  useEffect(() => {
    if (parentInfo?.hasBulletToLeft && parentInfo?.notifyPreferredBulletYPos && textRef.current) {
      // Calculate the Y position of the first line's midline
      const textElement = textRef.current;
      const computedStyle = window.getComputedStyle(textElement);
      const lineHeight = parseFloat(computedStyle.lineHeight);
      
      // if lineHeight is 'normal' or not a number, estimate from font size
      const fontSize = parseFloat(computedStyle.fontSize);
      const actualLineHeight = isNaN(lineHeight) ? fontSize * 1.2 : lineHeight;
      
      // console.warn('actualLineHeight', actualLineHeight);
      // first line midline is at half the line height
      const preferredBulletYPos = actualLineHeight / 2;
      parentInfo.notifyPreferredBulletYPos(preferredBulletYPos);
    }
  }, [parentInfo, text]);
  // console.log('YamdPlainText:', text)
  return (
    <span ref={textRef} className={className}>
      {text}
    </span>
  );
};

export default YamdPlainText;
