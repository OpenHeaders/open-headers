/**
 * FoldOptionsIcon — three text lines where the second opens with a
 * folded chip (an ellipsis in a rounded box) before the line carries
 * on: a run inside a line collapsed to one token (the console's Fold
 * Options toggle). Drawn on a 16x16 grid with 1.5px strokes and
 * wrapped in antd's Icon so it inherits `.anticon` sizing and
 * currentColor like every stock icon.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const FoldOptionsSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2.5 3.5h11" fill="none" />
    <rect x="2.5" y="6" width="7" height="4" rx="1.25" fill="none" />
    <path d="M4.5 8h.01M6 8h.01M7.5 8h.01" fill="none" strokeWidth={1.25} />
    <path d="M11.5 8h2" fill="none" />
    <path d="M2.5 12.5h7" fill="none" />
  </svg>
);

export const FoldOptionsIcon: React.FC<GlyphIconProps> = (props) => <Icon component={FoldOptionsSvg} {...props} />;
