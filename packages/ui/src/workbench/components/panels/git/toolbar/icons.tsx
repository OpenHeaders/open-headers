/**
 * Inline glyphs the icon set lacks — small currentColor SVGs sized to
 * sit beside the antd outline icons in the log toolbar: the cherry
 * pair (Cherry-Pick) and the sort-arrow-with-graph (Graph Options —
 * the arrow, two linked commits, and the corner mark of a button that
 * opens a menu, as the reference draws it).
 */

import type React from 'react';

const svgProps = {
  width: 14,
  height: 14,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.3,
  'aria-hidden': true,
} as const;

export const CherryPickIcon: React.FC = () => (
  <svg {...svgProps}>
    <path d="M7.8 11a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 1 1 5.2 0M13.6 11.6a2.4 2.4 0 1 1-4.8 0 2.4 2.4 0 1 1 4.8 0M5.6 8.5 C6.2 5.5 8 3.5 11 3 M11.2 9.2 C10.8 6.8 11 4.8 11 3M11 3 C12.2 2.6 13.4 2.8 14 3.4" fill="none" />
  </svg>
);

export const GraphOptionsIcon: React.FC = () => (
  <svg {...svgProps}>
    <path d="M4 2.5V12.5M4 12.5L1.9 10.2M4 12.5L6.1 10.2M11.8 4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 1 1 3 0M10.3 5.5V7.6M11.8 9.1a1.5 1.5 0 1 1-3 0 1.5 1.5 0 1 1 3 0M15.3 13.2V15.3H13.2Z" fill="none" />
  </svg>
);
