import React, { useRef } from 'react';

/**
 * Plain text renderer with bullet positioning support
 * Measures text to notify parent about preferred bullet Y position (first line midline)
 */
const YamdPlainText = ({ text, className, parentInfo }) => {
  // Ref to measure text for bullet positioning
  const textRef = useRef(null);
  // console.log('YamdPlainText:', text)
  // Note: Bullet positioning is now handled entirely by Zustand store in YamdNodeText
  // No prop drilling logic needed here anymore
  // console.log('YamdPlainText:', text)
  return (
    <span ref={textRef} className={className}>
      {text}
    </span>
  );
};

export default YamdPlainText;
