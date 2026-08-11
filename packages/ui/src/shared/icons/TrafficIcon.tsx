/**
 * TrafficIcon — a pulse line, live traffic on the monitor. Shared glyph
 * for the Traffic concept (tool-window tab, settings category) so every
 * surface renders the same drawing. Drawn on a 16x16 grid with 1.5px
 * strokes and wrapped in antd's Icon so it inherits `.anticon` sizing
 * and currentColor like every stock icon.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const TrafficSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M1.5 8h3l2-4.5 3 9 2-4.5h3" />
  </svg>
);

export const TrafficIcon: React.FC<GlyphIconProps> = (props) => <Icon component={TrafficSvg} {...props} />;
