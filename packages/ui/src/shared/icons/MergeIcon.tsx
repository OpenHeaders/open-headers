/**
 * MergeIcon — a stem with a node at each end and a third node off to
 * the right that the stem's top curves down into (the reference's
 * merge glyph): one line of history joining another. Drawn on a 16x16
 * grid with 1.5px strokes and wrapped in antd's Icon so it inherits
 * `.anticon` sizing and currentColor like every stock icon. It stands
 * in for every merge affordance; `BranchIcon` is the same anatomy with
 * the side line splitting off instead.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const MergeSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
      d="M6.25 3.5a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 1 1 3.5 0M6.25 12.5a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 1 1 3.5 0M13.25 9.5a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 1 1 3.5 0M4.5 5.25v5.5M4.5 5.25C4.5 8.75 9.75 7.5 9.75 9.5"
      fill="none"
    />
  </svg>
);

export const MergeIcon: React.FC<GlyphIconProps> = (props) => <Icon component={MergeSvg} {...props} />;
