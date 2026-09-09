/**
 * GoToIcon — a plain diagonal arrow, bottom-left to top-right, for the
 * "Go to …" jumps between tabs (a suggestion row's Go to authorization,
 * a warning's Go to settings). Stock RiseOutlined draws a chart's
 * rising line with a kink, which reads as a trend, not a jump. Drawn on
 * a 16x16 grid with 1.5px strokes and wrapped in antd's Icon so it
 * inherits `.anticon` sizing and currentColor like every stock icon.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const GoToSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 12 12 4" />
    <path d="M6.5 4H12v5.5" />
  </svg>
);

export const GoToIcon: React.FC<GlyphIconProps> = (props) => <Icon component={GoToSvg} {...props} />;
