/**
 * TagIcon — a label whose far corner is drawn to a point, with the
 * eyelet near the near corner (the reference's tag glyph): a name
 * hung on one commit. Drawn on a 16x16 grid with 1.5px strokes and
 * wrapped in antd's Icon so it inherits `.anticon` sizing and
 * currentColor like every stock icon. It stands in for every tag
 * affordance beside `BranchIcon`.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const TagSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2.75 2.75h5.5l5 5-5.5 5.5-5-5zM6.5 5.75a.75.75 0 1 1-1.5 0 .75.75 0 1 1 1.5 0" fill="none" />
  </svg>
);

export const TagIcon: React.FC<GlyphIconProps> = (props) => <Icon component={TagSvg} {...props} />;
