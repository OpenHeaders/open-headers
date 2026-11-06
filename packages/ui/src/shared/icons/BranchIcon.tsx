/**
 * BranchIcon — a stem with a node at each end and a third node off to
 * the right whose line curves down into the stem (the reference's
 * branch glyph): a line of history that split from another. Drawn on a
 * 16x16 grid with 1.5px strokes and wrapped in antd's Icon so it
 * inherits `.anticon` sizing and currentColor like every stock icon.
 * It stands in for every branch affordance; `MergeIcon` is the same
 * anatomy with the side line joining the stem instead.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const BranchSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
      d="M6.25 3.5a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 1 1 3.5 0M6.25 12.5a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 1 1 3.5 0M13.25 4.5a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 1 1 3.5 0M4.5 5.25v5.5M11.5 6.25C11.5 9.5 4.5 7.75 4.5 10.75"
      fill="none"
    />
  </svg>
);

export const BranchIcon: React.FC<GlyphIconProps> = (props) => <Icon component={BranchSvg} {...props} />;
