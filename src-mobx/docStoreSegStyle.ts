import type { CompData } from './docStoreTypes';

// Text style entries supported in segment data under the fixed 'style' key.
// Every entry is optional. A missing entry means default rendering. One
// segment carries exactly one style object; styling part of a segment is
// implemented by splitting the segment (see doc-mobx/comp_text_style.md).
export type SegTextStyle = {
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  isDeleteline?: boolean;
  colorText?: string; // '#RRGGBB' or '#RRGGBBAA'
  colorBackground?: string; // '#RRGGBB' or '#RRGGBBAA'
  fontFamily?: string; // css font-family value
  fontSize?: number; // px
};

const fieldNameListStyleBool = ['isBold', 'isItalic', 'isUnderline', 'isDeleteline'] as const;
const fieldNameListStyleText = ['colorText', 'colorBackground', 'fontFamily'] as const;

// Keep only meaningful entries: booleans only when true, strings only when
// non-empty, fontSize only when a positive number. Returns null when nothing
// remains, so a missing style entry and an emptied style object compare as
// the same (default) style.
export function segStyleNormalize(styleRaw: any): SegTextStyle | null {
  if (!styleRaw || typeof styleRaw !== 'object') return null;
  const styleNext: SegTextStyle = {};
  for (const fieldName of fieldNameListStyleBool) {
    if (styleRaw[fieldName] === true) {
      styleNext[fieldName] = true;
    }
  }
  for (const fieldName of fieldNameListStyleText) {
    const value = styleRaw[fieldName];
    if (typeof value === 'string' && value.length > 0) {
      styleNext[fieldName] = value;
    }
  }
  const fontSize = Number(styleRaw.fontSize);
  if (Number.isFinite(fontSize) && fontSize > 0) {
    styleNext.fontSize = fontSize;
  }
  return Object.keys(styleNext).length > 0 ? styleNext : null;
}

// Set the patch entries above the base style. A patch entry with a falsy
// value (false, null, '', 0) removes that entry from the result.
export function segStyleApplyPatch(styleBase: SegTextStyle | null, stylePatch: Record<string, any>) {
  return segStyleNormalize({
    ...(styleBase || {}),
    ...(stylePatch || {}),
  });
}

export function segStyleIsSame(styleA: SegTextStyle | null, styleB: SegTextStyle | null) {
  return segStyleKeyCreate(styleA) === segStyleKeyCreate(styleB);
}

export function segStyleKeyCreate(style: SegTextStyle | null) {
  const styleSafe = segStyleNormalize(style) || {};
  const fieldNameList = Object.keys(styleSafe).sort();
  return JSON.stringify(fieldNameList.map((fieldName) => [fieldName, (styleSafe as any)[fieldName]]));
}

export function docStoreGetSegmentStyle(compData: CompData | null | undefined) {
  return segStyleNormalize(compData?.data?.style);
}

// The default interpretation of style entries as inline css properties
// (camelCase react style keys). Returns undefined for the default style so
// components can pass the result to the style prop directly.
export function segStyleToCssProps(style: SegTextStyle | null): Record<string, string> | undefined {
  const styleSafe = segStyleNormalize(style);
  if (!styleSafe) return undefined;
  const cssProps: Record<string, string> = {};
  if (styleSafe.isBold === true) {
    cssProps.fontWeight = 'bold';
  }
  if (styleSafe.isItalic === true) {
    cssProps.fontStyle = 'italic';
  }
  const decorationList = [
    styleSafe.isUnderline === true ? 'underline' : '',
    styleSafe.isDeleteline === true ? 'line-through' : '',
  ].filter(Boolean);
  if (decorationList.length > 0) {
    cssProps.textDecorationLine = decorationList.join(' ');
  }
  if (styleSafe.colorText) {
    cssProps.color = styleSafe.colorText;
  }
  if (styleSafe.colorBackground) {
    cssProps.backgroundColor = styleSafe.colorBackground;
  }
  if (styleSafe.fontFamily) {
    cssProps.fontFamily = styleSafe.fontFamily;
  }
  if (styleSafe.fontSize) {
    cssProps.fontSize = `${styleSafe.fontSize}px`;
  }
  return cssProps;
}
