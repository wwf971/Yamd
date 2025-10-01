/**
 * Yamd Rendering Settings
 * Centralized configuration for consistent styling across components
 */

// Indentation settings for nested content
export const LIST_SETTINGS = {
  // indent for node whose childDisplay is ul/ol/p
  child_indent_x: '3px',
  // indent for nested list items
  bullet_y_pos_default: '1.2rem'
};

// Bullet dimensions and positioning
export const BULLET_DIMENSIONS = {
  width: '12px',
  height: '1.2em',
  content_offset_x: '-2px'  // horizontal distance between bullet and content
};

// LaTeX rendering settings
export const LATEX_SETTINGS = {
  // Margins for inline LaTeX SVG elements
  inlineMargins: '4px 2px',
  // Margins for block LaTeX elements
  blockMargins: '8px 0',
  // Default caption title
  caption_title_default: 'Eq'
};

// panel settings
export const PANEL_SETTINGS = {
  expanded_default: true,
  borderRadius: '8px',
  headerPadding: '6px 8px',
  contentPadding: '6px 8px'
};

// Timeline settings
export const TIMELINE_SETTINGS = {
  lineWidth: '2px',
  itemSpacing: '16px'
};

// Timeline bullet dimensions and positioning
export const TIMELINE_BULLET_SETTINGS = {
  container_width: '20px',    // Width of the bullet container
  container_height: '20px',   // Height of the bullet container
  bullet_width: '15px',       // Width of the actual bullet SVG
  bullet_height: '15px',      // Height of the actual bullet SVG
  connect_line_gap: '2px',     // Gap between connect lines and bullets
  bullet_y_pos_default: '1.2rem'
};

export const IMAGE_LIST_SETTINGS = {
  height_default: '200px'
};

export const VIDEO_LIST_SETTINGS = {
  height_default: '200px'
};

// Image settings
export const IMAGE_SETTINGS = {
  caption_title_default: 'Figure'
};

export const VIDEO_SETTINGS = {
  caption_title_default: 'Video',
  maxHeight: '400px'
};