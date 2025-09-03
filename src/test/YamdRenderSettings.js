/**
 * Yamd Rendering Settings
 * Centralized configuration for consistent styling across components
 */

// Bullet dimensions and positioning
export const BULLET_DIMENSIONS = {
  width: '12px',
  height: '1.2em'
};

// Indentation settings for nested content
export const LIST_INDENT = {
  // Indent for ul/ol/p children
  childIndent: '12px',
  // Indent for nested list items
  nestedIndent: '12px'
};

// LaTeX rendering settings
export const LATEX_SETTINGS = {
  // Margins for inline LaTeX SVG elements
  inlineMargins: '4px 2px',
  // Margins for block LaTeX elements
  blockMargins: '8px 0',
  // Default caption title
  defaultCaptionTitle: 'Eq'
};

// Panel settings
export const PANEL_SETTINGS = {
  defaultExpanded: true,
  borderRadius: '8px',
  headerPadding: '6px 8px',
  contentPadding: '6px 8px'
};

// Timeline settings
export const TIMELINE_SETTINGS = {
  bulletSize: '12px',
  lineWidth: '2px',
  itemSpacing: '16px'
};
