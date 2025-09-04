/**
 * Yamd Rendering Settings
 * Centralized configuration for consistent styling across components
 */



// Bullet dimensions and positioning
export const BULLET_DIMENSIONS = {
  width: '12px',
  height: '1.2em'
};

// Timeline bullet dimensions and positioning
export const TIMELINE_BULLET_DIMENSIONS = {
  container_width: '20px',    // Width of the bullet container
  container_height: '20px',   // Height of the bullet container
  bullet_width: '15px',       // Width of the actual bullet SVG
  bullet_height: '15px',      // Height of the actual bullet SVG
  connect_line_gap: '2px'     // Gap between connect lines and bullets
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
  captionTitleDefault: 'Eq'
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

export const IMAGE_LIST_SETTINGS = {
  defaultHeight: '200px'
};

export const VIDEO_LIST_SETTINGS = {
  defaultHeight: '200px'
};

// Image settings
export const IMAGE_SETTINGS = {
  captionTitleDefault: 'Figure'
};

export const VIDEO_SETTINGS = {
  captionTitleDefault: 'Video',
  maxHeight: '400px'
};