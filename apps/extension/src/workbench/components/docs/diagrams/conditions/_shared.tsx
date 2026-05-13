/**
 * Conditions — shared primitives.
 *
 * Diagram-local colors and the Row interface used by both the
 * "matching attributes" anatomy and the per-condition reference
 * diagrams. Translucent rgba so they re-tint cleanly across light
 * and dark themes.
 */

export interface Row {
  attr: string;
  value: string;
  cond: string;
  fill: string;
  stroke: string;
}

export const FILL_CYAN = 'rgba(19, 194, 194, 0.14)';
export const STROKE_CYAN = 'rgba(19, 194, 194, 0.55)';
export const FILL_GOLD = 'rgba(250, 173, 20, 0.16)';
export const STROKE_GOLD = 'rgba(250, 173, 20, 0.6)';
export const FILL_MAGENTA = 'rgba(235, 47, 150, 0.12)';
export const STROKE_MAGENTA = 'rgba(235, 47, 150, 0.55)';
