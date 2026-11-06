/**
 * PushIcon — a diagonal arrow from the bottom-left that lands at the
 * top-right, its head squared to the axes (the reference's outgoing
 * arrow): commits go up from the branch to the remote. Drawn on a
 * 16x16 grid with 1.5px strokes and wrapped in antd's Icon so it
 * inherits `.anticon` sizing and currentColor like every stock icon.
 * It stands in for every push affordance; `PullIcon` is its mirror.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const PushSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3.5 12.5 11.5 4.5M6.5 4.5h5v5" fill="none" />
  </svg>
);

export const PushIcon: React.FC<GlyphIconProps> = (props) => <Icon component={PushSvg} {...props} />;
