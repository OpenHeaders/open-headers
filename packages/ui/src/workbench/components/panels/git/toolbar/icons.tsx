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
    <circle cx="5.2" cy="11" r="2.6" />
    <circle cx="11.2" cy="11.6" r="2.4" />
    <path d="M5.6 8.5 C6.2 5.5 8 3.5 11 3 M11.2 9.2 C10.8 6.8 11 4.8 11 3" />
    <path d="M11 3 C12.2 2.6 13.4 2.8 14 3.4" />
  </svg>
);

export const GraphOptionsIcon: React.FC = () => (
  <svg {...svgProps}>
    <path d="M5 3 V13 M5 13 L2.8 10.6 M5 13 L7.2 10.6" />
    <circle cx="11.5" cy="4" r="1.4" />
    <circle cx="11.5" cy="8" r="1.4" />
    <circle cx="11.5" cy="12" r="1.4" />
  </svg>
);
