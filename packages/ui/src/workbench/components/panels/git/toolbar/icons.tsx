/**
 * Inline glyphs the icon set lacks — small currentColor SVGs sized to
 * sit beside the antd outline icons in the log toolbar: the cherry
 * pair (Cherry-Pick) and the sort-arrow-with-graph (Graph Options).
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
    <path d="M5 3 V13 M5 13 L2.8 10.6 M5 13 L7.2 10.6M12.9 4a1.4 1.4 0 1 1-2.8 0 1.4 1.4 0 1 1 2.8 0M12.9 8a1.4 1.4 0 1 1-2.8 0 1.4 1.4 0 1 1 2.8 0M12.9 12a1.4 1.4 0 1 1-2.8 0 1.4 1.4 0 1 1 2.8 0" fill="none" />
  </svg>
);
