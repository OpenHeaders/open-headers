/**
 * CollapseAllIcon — two chevrons pointing at each other, one down at the
 * top and one up at the bottom (the reference's tree-toolbar Collapse
 * All): the levels fold inward. Drawn on a 16x16 grid with 1.5px strokes
 * and wrapped in antd's Icon so it inherits `.anticon` sizing and
 * currentColor like every stock icon. ExpandAllIcon is the same pair
 * turned outward.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const CollapseAllSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 2.5 8 5.5l3-3M5 13.5 8 10.5l3 3" fill="none" />
  </svg>
);

export const CollapseAllIcon: React.FC<GlyphIconProps> = (props) => <Icon component={CollapseAllSvg} {...props} />;
