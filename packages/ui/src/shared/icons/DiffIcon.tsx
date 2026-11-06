/**
 * DiffIcon — one frame split down the middle, a minus in the left pane
 * and a plus in the right (the reference's diff glyph): what went and
 * what came, side by side. Drawn on a 16x16 grid with 1.5px strokes
 * and wrapped in antd's Icon so it inherits `.anticon` sizing and
 * currentColor like every stock icon. It stands in for every patch
 * and diff affordance that is not a two-way compare.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const DiffSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path
      d="M3.25 3h9.5a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-9.5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8 3v10M4.4 8h1.8M11.6 6.9v2.2M10.5 8h2.2"
      fill="none"
    />
  </svg>
);

export const DiffIcon: React.FC<GlyphIconProps> = (props) => <Icon component={DiffSvg} {...props} />;
