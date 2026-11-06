/**
 * PullIcon — a diagonal arrow from the top-right that lands at the
 * bottom-left, its head squared to the axes (the reference's incoming
 * arrow): commits come down from the remote into the branch. Drawn on
 * a 16x16 grid with 1.5px strokes and wrapped in antd's Icon so it
 * inherits `.anticon` sizing and currentColor like every stock icon.
 * It stands in for every pull and update affordance; `PushIcon` is its
 * mirror and `FetchIcon` the same arrow landing in a corner.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const PullSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12.5 3.5 4.5 11.5M4.5 6.5v5h5" fill="none" />
  </svg>
);

export const PullIcon: React.FC<GlyphIconProps> = (props) => <Icon component={PullSvg} {...props} />;
