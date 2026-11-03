/**
 * ExpandAllIcon — two chevrons pointing away from each other, one up at
 * the top and one down at the bottom (the reference's tree-toolbar
 * Expand All): the levels unfold outward. Drawn on a 16x16 grid with
 * 1.5px strokes and wrapped in antd's Icon so it inherits `.anticon`
 * sizing and currentColor like every stock icon. CollapseAllIcon is the
 * same pair turned inward.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const ExpandAllSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 5.5 8 2.5l3 3" fill="none" />
    <path d="M5 10.5 8 13.5l3-3" fill="none" />
  </svg>
);

export const ExpandAllIcon: React.FC<GlyphIconProps> = (props) => <Icon component={ExpandAllSvg} {...props} />;
